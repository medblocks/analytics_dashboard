import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Helper function to fetch YouTube video info
async function fetchYouTubeVideoInfo(videoIds) {
	if (!YOUTUBE_API_KEY) {
		console.warn('YouTube API key not configured');
		return {};
	}

	if (!videoIds || videoIds.length === 0) {
		return {};
	}

	// Skip IDs we already know the API has no data for.
	const candidateIds = videoIds.filter((id) => !knownBadVideoIds.has(id));
	if (candidateIds.length === 0) return {};

	// YouTube API allows up to 50 video IDs per request
	const chunks = [];
	for (let i = 0; i < candidateIds.length; i += 50) {
		chunks.push(candidateIds.slice(i, i + 50));
	}

	const videoInfoMap = {};

	for (const chunk of chunks) {
		try {
			const idsParam = chunk.join(',');
			const url = `${YOUTUBE_API_BASE_URL}/videos?part=snippet,statistics&id=${idsParam}&key=${YOUTUBE_API_KEY}`;

			const response = await fetch(url, {
				headers: {
					'Referer': 'https://medblocks.com',
					'X-Requested-With': 'XMLHttpRequest'
				}
			});
			if (!response.ok) {
				console.error('YouTube API error:', response.status, await response.text());
				continue;
			}

			const data = await response.json();
			const returned = new Set();

			if (data.items) {
				for (const item of data.items) {
					returned.add(item.id);
					videoInfoMap[item.id] = {
						title: item.snippet?.title || null,
						channelTitle: item.snippet?.channelTitle || null,
						publishedAt: item.snippet?.publishedAt || null,
						thumbnailUrl: item.snippet?.thumbnails?.default?.url || null,
						viewCount: parseInt(item.statistics?.viewCount || '0', 10),
						likeCount: parseInt(item.statistics?.likeCount || '0', 10),
						commentCount: parseInt(item.statistics?.commentCount || '0', 10),
					};
				}
			}

			// Mark candidates the API didn't return as known-bad so we skip them next time.
			for (const id of chunk) {
				if (!returned.has(id)) knownBadVideoIds.add(id);
			}
		} catch (error) {
			console.error('Error fetching YouTube video info:', error);
		}
	}

	return videoInfoMap;
}

// Helper function to extract YouTube video ID from URL or campaign parameter
// Negative cache for video IDs the YouTube API returned no data for. Stops
// fetchYouTubeVideoInfo from repeatedly querying IDs that the API has no record of
// (e.g. truncated descriptive campaign names like "fhir_app_ch" that pass the 11-char
// shape check but aren't real video IDs). Persists for the process lifetime.
const knownBadVideoIds = new Set();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4000;

// Security: Disable X-Powered-By header
app.disable("x-powered-by");

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
	next();
});

// Serve static files from the dist directory in production
if (process.env.NODE_ENV === "production") {
	const distPath = path.join(__dirname, "../dist");
	console.log(`Serving static files from: ${distPath}`);
	
	app.use(express.static(distPath, {
		maxAge: "1d", // Cache static assets for 1 day
		etag: true,
	}));
}

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
	console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
	console.error('Please create a .env file with the following variables:');
	console.error('DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');
	process.exit(1);
}

const pool = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: parseInt(process.env.DB_PORT),
	// Connection pool configuration
	max: 20, // Maximum number of clients in the pool
	connectionTimeoutMillis: 30000, // Wait up to 30 seconds for a connection
	idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
	allowExitOnIdle: false, // Keep pool alive even when idle
});

// Handle pool errors to prevent app crashes
pool.on('error', (err) => {
	console.error('Unexpected database pool error:', err);
});

// Test database connection on startup
async function testDatabaseConnection() {
	try {
		const client = await pool.connect();
		await client.query('SELECT 1');
		client.release();
		console.log('✅ Database connection successful');
		return true;
	} catch (err) {
		console.error('❌ Database connection failed:', err.message);
		console.error('Database config:', {
			host: process.env.DB_HOST,
			user: process.env.DB_USER,
			database: process.env.DB_NAME,
			port: process.env.DB_PORT,
		});
		return false;
	}
}

function asRange(req) {
	const start = req.query.start;
	const end = req.query.end;
	if (!start || !end) {
		throw new Error("Missing start or end");
	}
  console.log("Got the date range", start, end);
	return { start, end };
}

// Helper function to calculate previous week period
function getPreviousPeriod(start, end) {
	const startDate = new Date(start);
	const endDate = new Date(end);
	const durationMs = endDate - startDate;
	
	// Previous period ends exactly when current period starts
	// and has the same duration going backwards
	const prevEnd = startDate.toISOString();
	const prevStart = new Date(startDate.getTime() - durationMs).toISOString();
	
	console.log(`Current period: ${start} to ${end}`);
	console.log(`Previous period: ${prevStart} to ${prevEnd}`);
	
	return {
		prevStart,
		prevEnd
	};
}

// Source-classification rules applied to columns named utm_source / utm_medium / referrer_domain.
// Reused inside multiple CTEs so all attribution decisions stay consistent.
//   Google: organic search only (google.com + country variants, search.google.com,
//           Android quick-search). Excludes accounts.google.com (OAuth callback
//           that fires on every Google-OAuth signup), mail/gemini/notebooklm/etc.
//   YouTube: utm_source=youtube OR YouTube domains.
//   LinkedIn: utm_source=linkedin (excluding utm_medium=bio) OR LinkedIn domains.
const SOURCE_CASE_SQL = `
  CASE
    WHEN lower(utm_source) = 'linkedin'
      AND coalesce(lower(utm_medium),'') <> 'bio' THEN 'linkedin'
    WHEN referrer_domain IN ('linkedin.com','com.linkedin.android','lnkd.in') THEN 'linkedin'
    WHEN lower(utm_source) = 'youtube' THEN 'youtube'
    WHEN referrer_domain IN ('youtube.com','m.youtube.com','com.google.android.youtube','youtu.be') THEN 'youtube'
    WHEN referrer_domain ~* '^(www\\.)?google\\.[a-z.]+$'
      OR referrer_domain = 'search.google.com'
      OR referrer_domain = 'com.google.android.googlequicksearchbox' THEN 'google'
    ELSE 'other'
  END
`;

// Attribution model: signups in date range, classified by their converting session's
// first pageview. Sum of source counts always equals total signups in the range.
// Caller composes additional CTEs after these by prefixing this with "WITH" and
// continuing with ", more_cte AS (...)" before the final SELECT. Binds $1=start, $2=end.
const ATTRIBUTED_SIGNUPS_CTES = `
signups AS (
  SELECT id AS user_id, date_created
  FROM directus_user
  WHERE status = 'published'
    AND date_created >= $1::timestamptz
    AND date_created <  $2::timestamptz
),
converting_event AS (
  -- The umami event that recorded the actual signup. event_type=2 with
  -- event_name='SignUp' is the umami custom event Clerk fires on account
  -- creation. SignIn events (also event_type=2) are explicitly excluded —
  -- they're for existing users logging back in, not new conversions.
  SELECT DISTINCT ON (s.user_id)
    s.user_id,
    uwe.session_id
  FROM signups s
  JOIN umami_event_data ued
    ON ued.data_key = 'user_id'
   AND ued.string_value = s.user_id
   AND ued.created_at BETWEEN s.date_created - INTERVAL '2 minutes'
                          AND s.date_created + INTERVAL '2 minutes'
  JOIN umami_website_event uwe
    ON uwe.event_id = ued.website_event_id
   AND uwe.event_type = 2
   AND uwe.event_name = 'SignUp'
  ORDER BY s.user_id, abs(extract(epoch FROM (uwe.created_at - s.date_created)))
),
session_first_view AS (
  SELECT DISTINCT ON (uwe.session_id)
    uwe.session_id,
    uwe.url_path,
    uwe.url_query,
    uwe.utm_source,
    uwe.utm_medium,
    uwe.utm_campaign,
    uwe.utm_term,
    uwe.referrer_domain
  FROM umami_website_event uwe
  WHERE uwe.session_id IN (SELECT session_id FROM converting_event)
    AND uwe.event_type = 1
  ORDER BY uwe.session_id, uwe.created_at ASC
),
attributed_signups AS (
  SELECT
    s.user_id,
    sfv.url_path  AS landing_page,
    sfv.url_query AS landing_query,
    sfv.utm_source,
    sfv.utm_medium,
    sfv.utm_campaign,
    sfv.utm_term,
    sfv.referrer_domain,
    COALESCE(${SOURCE_CASE_SQL}, 'other') AS source
  FROM signups s
  LEFT JOIN converting_event ce ON ce.user_id = s.user_id
  LEFT JOIN session_first_view sfv ON sfv.session_id = ce.session_id
)`;

// Per-session all-time first-pageview classification, scoped to sessions active in the range.
// "Active" = had ANY umami event during the range. We classify by the session's TRUE first
// pageview (which may predate the range — sessions linger across days), so that the same
// session has the same source/landing_page in attributed_signups and in classified_sessions.
// This guarantees every converted session shows up in source_redirects, so conversion rates
// are well-defined per landing page. Composes after ATTRIBUTED_SIGNUPS_CTES via comma.
const RANGE_CLASSIFIED_SESSIONS_CTES = `
range_active_sessions AS (
  SELECT DISTINCT session_id
  FROM umami_website_event
  WHERE created_at >= $1::timestamptz
    AND created_at <  $2::timestamptz
),
session_all_time_first_view AS (
  SELECT DISTINCT ON (uwe.session_id)
    uwe.session_id,
    uwe.url_path,
    uwe.url_query,
    uwe.utm_source,
    uwe.utm_medium,
    uwe.utm_campaign,
    uwe.utm_term,
    uwe.referrer_domain
  FROM umami_website_event uwe
  WHERE uwe.session_id IN (SELECT session_id FROM range_active_sessions)
    AND uwe.event_type = 1
  ORDER BY uwe.session_id, uwe.created_at ASC
),
classified_sessions AS (
  SELECT
    session_id,
    url_path,
    url_query,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    ${SOURCE_CASE_SQL} AS source
  FROM session_all_time_first_view
)`;

// The compact form used by /api/totals — only the attributed_signups CTE.
const ATTRIBUTED_SIGNUPS_CTE = `WITH ${ATTRIBUTED_SIGNUPS_CTES}`;

// In-memory storage for custom keywords (overrides CSV when set)
// NOTE: This is GLOBAL for all users and resets on server restart
// For persistent storage, consider saving to database
// For per-user keywords, consider using sessions or localStorage
let customKeywordsByCategory = {
	openehr: null,
	fhir: null
};

// Helper function to read keywords from CSV file
function getKeywordsFromCSV(category = 'openehr') {
	try {
		const csvFiles = {
			openehr: path.join(__dirname, "../openehr_all-keywords_us_2025-12-01.csv"),
			fhir: path.join(__dirname, "../fhir_keywords.csv")
		};
		
		const csvPath = csvFiles[category];
		if (!csvPath) {
			console.error(`Unknown category: ${category}`);
			return [];
		}
		
		const csvContent = fs.readFileSync(csvPath, "utf-8");
		const lines = csvContent.split("\n");
		
		// Skip header row and extract first column (keywords)
		const keywords = lines
			.slice(1) // Skip header
			.map(line => line.split(",")[0]?.trim()) // Get first column
			.filter(keyword => keyword && keyword.length > 0); // Remove empty entries
		
		console.log(`Loaded ${keywords.length} ${category} keywords from CSV`);
		return keywords;
	} catch (error) {
		console.error(`Error reading CSV file for ${category}:`, error);
		return [];
	}
}

// Get current keywords (custom or from CSV)
function getCurrentKeywords(category = 'openehr') {
	const customKeywords = customKeywordsByCategory[category];
	if (customKeywords && customKeywords.length > 0) {
		console.log(`Using ${customKeywords.length} custom ${category} keywords`);
		return customKeywords;
	}
	return getKeywordsFromCSV(category);
}

// Get all keywords from all categories combined
function getAllKeywords() {
	const categories = ['openehr', 'fhir'];
	const allKeywords = [];
	
	categories.forEach(category => {
		const keywords = getCurrentKeywords(category);
		allKeywords.push(...keywords);
	});
	
	return allKeywords;
}

// Health check endpoint - must be before other routes
app.get("/health", (req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API health check with database connection test
app.get("/api/health", async (req, res) => {
	try {
		const client = await pool.connect();
		try {
			await client.query('SELECT 1');
			res.status(200).json({ 
				status: "ok", 
				database: "connected",
				timestamp: new Date().toISOString() 
			});
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Health check failed:", e);
		res.status(503).json({ 
			status: "error", 
			database: "disconnected",
			error: e.message,
			timestamp: new Date().toISOString() 
		});
	}
});

app.get("/api/total-users", async (req, res) => {
	try {
		const client = await pool.connect();
		try {
			const { rows } = await client.query(
				`select count(*)::int as user_no from directus_user where status = 'published'`
			);
			res.json({ totalUsers: rows[0]?.user_no ?? 0 });
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/total-users:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/user-growth", async (req, res) => {
	try {
		const client = await pool.connect();
		try {
			const { rows } = await client.query(
				`WITH date_range AS (
          SELECT generate_series(
            date_trunc('day', now() - interval '30 days'),
            date_trunc('day', now()),
            '1 day'::interval
          ) as date
        ),
        daily_counts AS (
          SELECT
            date_trunc('day', date_created) as date,
            count(*)::int as daily_count
          FROM directus_user
          WHERE status = 'published'
            AND date_created > now() - interval '30 days'
          GROUP BY 1
        ),
        all_dates_with_counts AS (
          SELECT
            dr.date,
            COALESCE(dc.daily_count, 0)::int as daily_count,
            (SELECT COUNT(*)::int
             FROM directus_user
             WHERE status = 'published'
               AND date_trunc('day', date_created) <= dr.date) as cumulative_count
          FROM date_range dr
          LEFT JOIN daily_counts dc ON dr.date = dc.date
        )
        SELECT 
          date,
          daily_count,
          cumulative_count
        FROM all_dates_with_counts
        ORDER BY date ASC`
			);
			console.log('User growth data sample:', rows.slice(0, 3), '...', rows.slice(-2));
			res.json(rows);
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/user-growth:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/totals", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);

		const totalsQuery = `${ATTRIBUTED_SIGNUPS_CTE}
SELECT
  count(*)::int AS total_users,
  (count(*) FILTER (WHERE source = 'linkedin'))::int AS linkedin_conversions,
  (count(*) FILTER (WHERE source = 'youtube'))::int AS youtube_conversions,
  (count(*) FILTER (WHERE source = 'google'))::int  AS google_conversions,
  (count(*) FILTER (WHERE source = 'other'))::int   AS other_conversions
FROM attributed_signups`;

		const client = await pool.connect();
		try {
			const [{ rows: cur }, { rows: prev }] = await Promise.all([
				client.query(totalsQuery, [start, end]),
				client.query(totalsQuery, [prevStart, prevEnd]),
			]);

			const totalUsers = cur[0]?.total_users ?? 0;
			const linkedinConversions = cur[0]?.linkedin_conversions ?? 0;
			const youtubeConversions = cur[0]?.youtube_conversions ?? 0;
			const googleConversions = cur[0]?.google_conversions ?? 0;
			const otherConversions = cur[0]?.other_conversions ?? 0;

			const prevTotalUsers = prev[0]?.total_users ?? 0;
			const prevLinkedinConversions = prev[0]?.linkedin_conversions ?? 0;
			const prevYoutubeConversions = prev[0]?.youtube_conversions ?? 0;
			const prevGoogleConversions = prev[0]?.google_conversions ?? 0;
			const prevOtherConversions = prev[0]?.other_conversions ?? 0;

			res.json({
				totalUsers,
				linkedinConversions,
				youtubeConversions,
				googleConversions,
				otherConversions,
				prevTotalUsers,
				prevLinkedinConversions,
				prevYoutubeConversions,
				prevGoogleConversions,
				prevOtherConversions,
			});
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/totals:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Build the per-source landing-page rollup query.
// Each row = (landing_page) for sessions classified as `source`, with redirect_count
// (sessions that landed on this page from this source) and user_converted (signups
// attributed to this source whose converting session's first pageview was this page).
function buildSourceLandingPageQuery(source, { includeQueries = false } = {}) {
	return `WITH ${ATTRIBUTED_SIGNUPS_CTES},
${RANGE_CLASSIFIED_SESSIONS_CTES},
source_redirects AS (
  SELECT url_path, count(*)::int AS redirect_count
  FROM classified_sessions
  WHERE source = '${source}'
  GROUP BY url_path
),
source_conversions AS (
  SELECT landing_page AS url_path, count(*)::int AS user_converted
  FROM attributed_signups
  WHERE source = '${source}' AND landing_page IS NOT NULL
  GROUP BY landing_page
)${includeQueries ? `,
queries_by_path AS (
  SELECT
    regexp_replace(page, '^https?://[^/]+', '') AS url_path,
    query,
    MIN(position) AS best_position
  FROM search_console_fresh
  WHERE fetch_date >= $1::date AND fetch_date <= $2::date
  GROUP BY 1, 2
),
top_queries_by_path AS (
  SELECT url_path, ARRAY_AGG(query ORDER BY best_position ASC) AS queries
  FROM (
    SELECT url_path, query, best_position,
      ROW_NUMBER() OVER (PARTITION BY url_path ORDER BY best_position ASC) AS rn
    FROM queries_by_path
  ) ranked
  WHERE rn <= 5
  GROUP BY url_path
)` : ''}
SELECT
  r.url_path AS post,
  r.redirect_count,
  COALESCE(c.user_converted, 0)::int AS user_converted${includeQueries ? `,
  COALESCE(array_to_json(q.queries), '[]'::json) AS queries` : ''}
FROM source_redirects r
LEFT JOIN source_conversions c ON c.url_path = r.url_path${includeQueries ? `
LEFT JOIN top_queries_by_path q ON q.url_path = r.url_path` : ''}
ORDER BY user_converted DESC, redirect_count DESC`;
}

app.get("/api/google", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);
		const sql = buildSourceLandingPageQuery('google', { includeQueries: true });
		const client = await pool.connect();
		try {
			const [{ rows }, { rows: prevRows }] = await Promise.all([
				client.query(sql, [start, end]),
				client.query(sql, [prevStart, prevEnd]),
			]);
			res.json({ rows, prevRows });
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/google:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Other-source signups — drill-down for everything not LinkedIn/YouTube/Google.
// Each row = (landing_page, sub_source) where sub_source labels which kind of "other"
// (direct, Brevo email, Google-OAuth callback, Bing/DuckDuckGo, AI chat, internal, etc.).
// Reuses attributed_signups (filter source='other') with a small classifier in front.
app.get("/api/other", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);

		const subSourceCase = `
  CASE
    WHEN asg.landing_page IS NULL THEN 'No entry pageview'
    WHEN lower(asg.utm_source) = 'brevo'
      OR asg.referrer_domain ILIKE '%sendibm%' THEN 'Brevo / Email'
    WHEN asg.referrer_domain = 'accounts.google.com' THEN 'Google OAuth callback'
    WHEN asg.referrer_domain IN ('bing.com','duckduckgo.com','search.brave.com','search.yahoo.com') THEN 'Other search engine'
    WHEN asg.referrer_domain IN ('chatgpt.com','perplexity.ai','claude.ai','gemini.google.com','notebooklm.google.com') THEN 'AI chat'
    WHEN asg.referrer_domain = 'medblocks.com' THEN 'Internal'
    WHEN coalesce(asg.referrer_domain,'') = '' AND coalesce(asg.utm_source,'') = '' THEN 'Direct'
    ELSE COALESCE(NULLIF(asg.referrer_domain,''), NULLIF(asg.utm_source,''), 'Other')
  END`;

		const sql = `WITH ${ATTRIBUTED_SIGNUPS_CTES}
SELECT
  COALESCE(asg.landing_page, '(no entry pageview)') AS post,
  ${subSourceCase} AS sub_source,
  count(*)::int AS user_converted,
  COALESCE(NULLIF(asg.referrer_domain,''), '-') AS referrer_domain,
  COALESCE(NULLIF(asg.utm_source,''), '-')      AS utm_source,
  COALESCE(NULLIF(asg.utm_medium,''), '-')      AS utm_medium,
  COALESCE(NULLIF(asg.utm_campaign,''), '-')    AS utm_campaign
FROM attributed_signups asg
WHERE asg.source = 'other'
GROUP BY 1, 2, 4, 5, 6, 7
ORDER BY user_converted DESC, post`;

		const client = await pool.connect();
		try {
			const [{ rows }, { rows: prevRows }] = await Promise.all([
				client.query(sql, [start, end]),
				client.query(sql, [prevStart, prevEnd]),
			]);
			res.json({ rows, prevRows });
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/other:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Get current keywords (custom or default from CSV)
app.get("/api/keywords", (req, res) => {
	try {
		const category = req.query.category || 'openehr';
		const keywords = getCurrentKeywords(category);
		const isCustom = customKeywordsByCategory[category] !== null && customKeywordsByCategory[category]?.length > 0;
		
		res.json({ 
			keywords, 
			count: keywords.length,
			isCustom,
			category 
		});
	} catch (e) {
		console.error("Error in /api/keywords:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Get all keyword categories at once
app.get("/api/keywords/all", (req, res) => {
	try {
		const categories = ['openehr', 'fhir'];
		const result = {};
		
		categories.forEach(category => {
			const keywords = getCurrentKeywords(category);
			const isCustom = customKeywordsByCategory[category] !== null && customKeywordsByCategory[category]?.length > 0;
			result[category] = {
				keywords,
				count: keywords.length,
				isCustom
			};
		});
		
		res.json(result);
	} catch (e) {
		console.error("Error in /api/keywords/all:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Update keywords with custom list
app.post("/api/keywords", (req, res) => {
	try {
		const { keywords, category = 'openehr' } = req.body;
		
		if (!keywords || !Array.isArray(keywords)) {
			return res.status(400).json({ error: "Keywords must be an array" });
		}
		
		if (!['openehr', 'fhir'].includes(category)) {
			return res.status(400).json({ error: "Invalid category. Must be 'openehr' or 'fhir'" });
		}
		
		// Filter and clean keywords
		const cleanedKeywords = keywords
			.map(k => k?.trim())
			.filter(k => k && k.length > 0);
		
		customKeywordsByCategory[category] = cleanedKeywords;
		console.log(`Updated to ${cleanedKeywords.length} custom ${category} keywords`);
		
		res.json({ 
			success: true, 
			count: cleanedKeywords.length,
			category,
			message: `${category} keywords updated successfully` 
		});
	} catch (e) {
		console.error("Error in POST /api/keywords:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Reset to default CSV keywords
app.delete("/api/keywords", (req, res) => {
	try {
		const category = req.query.category || 'openehr';
		
		if (!['openehr', 'fhir'].includes(category)) {
			return res.status(400).json({ error: "Invalid category. Must be 'openehr' or 'fhir'" });
		}
		
		customKeywordsByCategory[category] = null;
		const defaultKeywords = getKeywordsFromCSV(category);
		console.log(`Reset to default CSV keywords for ${category} (${defaultKeywords.length} keywords)`);
		
		res.json({ 
			success: true, 
			count: defaultKeywords.length,
			category,
			message: `${category} keywords reset to default CSV` 
		});
	} catch (e) {
		console.error("Error in DELETE /api/keywords:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/search-queries", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		
		// Get all keywords from all categories (custom or from CSV)
		const keywords = getAllKeywords();
		if (keywords.length === 0) {
			return res.status(500).json({ error: "No keywords found" });
		}
		
		const client = await pool.connect();
		try {
			const { rows } = await client.query(
				`WITH queries_with_paths AS (
  SELECT
    query,
    regexp_replace(page, '^https?://[^/]+', '') AS url_path
  FROM search_console_fresh
  WHERE fetch_date >= $1::date
    AND fetch_date <= $2::date
    AND query = ANY($3)
),
base AS (
  SELECT
    qwp.query,
    qwp.url_path,
    uwe.session_id,
    uwe.event_id AS uwe_id
  FROM queries_with_paths qwp
  JOIN umami_website_event uwe
    ON uwe.url_path = qwp.url_path
  WHERE uwe.created_at > $1::timestamptz
    AND uwe.created_at < $2::timestamptz
    AND uwe.referrer_domain ILIKE '%google%'
),
query_sessions AS (
  SELECT DISTINCT query, session_id
  FROM base
),
unique_sessions AS (
  SELECT DISTINCT session_id FROM base
),
first_conversion_events AS (
  SELECT DISTINCT ON (us.session_id)
    us.session_id,
    u2.event_id AS website_event_id
  FROM unique_sessions us
  JOIN umami_website_event u2 
    ON u2.session_id = us.session_id AND u2.event_type = 2
  ORDER BY us.session_id, u2.created_at ASC
),
conversion_user_data AS (
  SELECT DISTINCT ON (fce.session_id)
    fce.session_id,
    ued.string_value AS user_id,
    ued.created_at AS event_data_created_at
  FROM first_conversion_events fce
  JOIN umami_event_data ued 
    ON ued.website_event_id = fce.website_event_id AND ued.data_key = 'user_id'
  ORDER BY fce.session_id, ued.created_at ASC
),
converted_sessions AS (
  SELECT cud.session_id
  FROM conversion_user_data cud
  JOIN directus_user du 
    ON du.id = cud.user_id
    AND du.date_created BETWEEN (cud.event_data_created_at - INTERVAL '2 minutes')
                            AND (cud.event_data_created_at + INTERVAL '2 minutes')
),
session_conversions AS (
  SELECT qs.query, qs.session_id,
    CASE WHEN cs.session_id IS NOT NULL THEN 1 ELSE 0 END AS converted
  FROM query_sessions qs
  LEFT JOIN converted_sessions cs ON cs.session_id = qs.session_id
),
redirects_by_query AS (
  SELECT
    query,
    COUNT(*) AS redirect_count
  FROM base
  GROUP BY query
),
conversions_by_query AS (
  SELECT
    query,
    SUM(converted) AS user_converted
  FROM session_conversions
  GROUP BY query
),
paths_by_query AS (
  SELECT
    query,
    ARRAY_AGG(DISTINCT url_path ORDER BY url_path) AS url_paths
  FROM base
  GROUP BY query
)
SELECT
  r.query,
  r.redirect_count::int,
  COALESCE(c.user_converted, 0)::int AS user_converted,
  COALESCE(p.url_paths, ARRAY[]::text[]) AS url_paths
FROM redirects_by_query r
LEFT JOIN conversions_by_query c
  ON c.query = r.query
LEFT JOIN paths_by_query p
  ON p.query = r.query
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`,
				[start, end, keywords]
			);
			console.log(`Found ${rows.length} queries matching CSV keywords`);
			res.json(rows);
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/search-queries:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/brevo", async (req, res) => {
	try {
		const client = await pool.connect();
		try {
			const { rows } = await client.query(
				`WITH base AS (
  SELECT
    btrim(regexp_replace(b.campaign_name, '[[:space:]]+', ' ', 'g')) AS post,
    uwe.session_id,
    uwe.event_id AS uwe_id
  FROM umami_website_event uwe
  JOIN LATERAL (
    SELECT dc.*
    FROM directus_content dc
    WHERE dc.full_link <> ''
      AND concat_ws(
            '',
            'https://medblocks.com',
            uwe.url_path,
            CASE WHEN COALESCE(uwe.url_query,'') <> '' THEN '?' || uwe.url_query ELSE '' END
          ) LIKE dc.full_link || '%'
    ORDER BY length(dc.full_link) DESC
    LIMIT 1
  ) dc ON TRUE
  JOIN brevo_cumulative b
    ON b.campaign_id::text = dc.content_id::text
  WHERE uwe.url_query ILIKE '%utm_source=brevo%'
),
post_sessions AS (
  SELECT DISTINCT post, session_id
  FROM base
),
unique_sessions AS (
  SELECT DISTINCT session_id FROM base
),
first_conversion_events AS (
  SELECT DISTINCT ON (us.session_id)
    us.session_id,
    u2.event_id AS website_event_id
  FROM unique_sessions us
  JOIN umami_website_event u2 
    ON u2.session_id = us.session_id AND u2.event_type = 2
  ORDER BY us.session_id, u2.created_at ASC
),
conversion_user_data AS (
  SELECT DISTINCT ON (fce.session_id)
    fce.session_id,
    ued.string_value AS user_id,
    ued.created_at AS event_data_created_at
  FROM first_conversion_events fce
  JOIN umami_event_data ued 
    ON ued.website_event_id = fce.website_event_id AND ued.data_key = 'user_id'
  ORDER BY fce.session_id, ued.created_at ASC
),
converted_sessions AS (
  SELECT cud.session_id
  FROM conversion_user_data cud
  JOIN directus_user du 
    ON du.id = cud.user_id
    AND du.date_created BETWEEN (cud.event_data_created_at - INTERVAL '2 minutes')
                            AND (cud.event_data_created_at + INTERVAL '2 minutes')
),
session_conversions AS (
  SELECT ps.post, ps.session_id,
    CASE WHEN cs.session_id IS NOT NULL THEN 1 ELSE 0 END AS converted
  FROM post_sessions ps
  LEFT JOIN converted_sessions cs ON cs.session_id = ps.session_id
),
redirects_by_post AS (
  SELECT
    post,
    COUNT(DISTINCT uwe_id) AS redirect_count
  FROM base
  GROUP BY post
),
conversions_by_post AS (
  SELECT
    post,
    SUM(converted) AS user_converted
  FROM session_conversions
  GROUP BY post
)
SELECT
  r.post,
  r.redirect_count::int,
  COALESCE(c.user_converted, 0)::int AS user_converted
FROM redirects_by_post r
LEFT JOIN conversions_by_post c
  ON c.post = r.post
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`
			);
			res.json(rows);
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/brevo:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// LinkedIn Raw — landing-page rollup of LinkedIn-attributed signups.
// Each row = (landing_page) for sessions classified as `linkedin`. Schema mirrors
// /api/google's response (post, redirect_count, user_converted) so the existing
// LinkedInRawTab continues to render. content_id is no longer included; with
// last-touch landing-page attribution it is no longer the row key.
app.get("/api/linkedin-raw", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);
		const sql = buildSourceLandingPageQuery('linkedin');
		const client = await pool.connect();
		try {
			const [{ rows }, { rows: prevRows }] = await Promise.all([
				client.query(sql, [start, end]),
				client.query(sql, [prevStart, prevEnd]),
			]);
			// Existing frontend reads `content_id`; surface as null (deprecated field).
			const enrich = (r) => ({ ...r, content_id: null });
			res.json({ rows: rows.map(enrich), prevRows: prevRows.map(enrich) });
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/linkedin-raw:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// YouTube Raw — landing-page rollup of YouTube-attributed signups, with per-video
// breakdown and a separate "Paid YT Ads" bucket for utm_medium=cpc / paid_video traffic
// (which is Google-Ads-on-YouTube, not organic videos).
//
// Each row in `rows` is keyed by (landing_page, video_id) so two videos sending traffic
// to the same landing page show as separate rows. Rows in `paidRows` are keyed by
// (landing_page, utm_campaign).
//
// video_id is extracted from the landing page's url_query (utm_campaign / utm_id / utm_term).
// The new extractor (see extractVideoIdFromUrl above) rejects pure-numeric Google Ads IDs
// and remembers IDs the YouTube API returned no data for, so the API call list shrinks
// over time to real-video-IDs only.
app.get("/api/youtube-raw", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);

		// Build a YT-specific row query: each row = (landing page, video_id), with
		// redirect_count from classified_sessions and user_converted from attributed_signups.
		// Paid rows use utm_medium IN ('cpc','paid_video') and bucket by utm_campaign.
		//
		// Video ID extraction handles three quirks of the live data:
		//   - utm_campaign/utm_id/utm_term often have an OAuth callback suffix appended
		//     ("NOojX8LvleM?from_auth=true", "8-xn1FbO7KY?from_auth=true", URL-encoded
		//     "NOojX8LvleM%3Ffrom_auth%3Dtrue"). We match an 11-char prefix followed by
		//     a non-id character or end.
		//   - Pure-numeric values are Google Ads campaign IDs (e.g. 23762018856), not
		//     real video IDs — rejected.
		//   - utm_id is not a first-class umami column; parse it from url_query.
		const ytRowsSQL = `WITH ${ATTRIBUTED_SIGNUPS_CTES},
${RANGE_CLASSIFIED_SESSIONS_CTES},
yt_session_video AS (
  SELECT
    cs.session_id,
    cs.url_path,
    cs.utm_medium,
    cs.utm_campaign,
    COALESCE(
      CASE WHEN substring(cs.utm_campaign, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') !~ '^[0-9]+$'
           THEN substring(cs.utm_campaign, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') END,
      CASE WHEN (regexp_match(cs.url_query, 'utm_id=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])'))[1] !~ '^[0-9]+$'
           THEN (regexp_match(cs.url_query, 'utm_id=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])'))[1] END,
      CASE WHEN substring(cs.utm_term, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') !~ '^[0-9]+$'
           THEN substring(cs.utm_term, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') END
    ) AS video_id
  FROM classified_sessions cs
  WHERE cs.source = 'youtube'
),
yt_redirects AS (
  SELECT
    url_path,
    video_id,
    count(*)::int AS redirect_count
  FROM yt_session_video
  WHERE coalesce(lower(utm_medium),'') NOT IN ('cpc','paid_video')
  GROUP BY url_path, video_id
),
yt_conversions AS (
  SELECT
    asg.landing_page AS url_path,
    COALESCE(
      CASE WHEN substring(asg.utm_campaign, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') !~ '^[0-9]+$'
           THEN substring(asg.utm_campaign, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') END,
      CASE WHEN (regexp_match(asg.landing_query, 'utm_id=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])'))[1] !~ '^[0-9]+$'
           THEN (regexp_match(asg.landing_query, 'utm_id=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])'))[1] END,
      CASE WHEN substring(asg.utm_term, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') !~ '^[0-9]+$'
           THEN substring(asg.utm_term, '^([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)') END
    ) AS video_id,
    count(*)::int AS user_converted
  FROM attributed_signups asg
  WHERE asg.source = 'youtube'
    AND asg.landing_page IS NOT NULL
    AND coalesce(lower(asg.utm_medium),'') NOT IN ('cpc','paid_video')
  GROUP BY 1, 2
),
yt_paid_redirects AS (
  SELECT
    url_path,
    utm_campaign,
    count(*)::int AS redirect_count
  FROM yt_session_video
  WHERE coalesce(lower(utm_medium),'') IN ('cpc','paid_video')
  GROUP BY url_path, utm_campaign
),
yt_paid_conversions AS (
  SELECT
    asg.landing_page AS url_path,
    asg.utm_campaign,
    count(*)::int AS user_converted
  FROM attributed_signups asg
  WHERE asg.source = 'youtube'
    AND asg.landing_page IS NOT NULL
    AND coalesce(lower(asg.utm_medium),'') IN ('cpc','paid_video')
  GROUP BY 1, 2
)
SELECT
  'organic'::text AS bucket,
  r.url_path AS post,
  r.video_id,
  r.redirect_count,
  COALESCE(c.user_converted, 0)::int AS user_converted,
  NULL::text AS utm_campaign
FROM yt_redirects r
LEFT JOIN yt_conversions c
  ON c.url_path = r.url_path AND c.video_id IS NOT DISTINCT FROM r.video_id
UNION ALL
SELECT
  'paid'::text AS bucket,
  r.url_path AS post,
  NULL::text AS video_id,
  r.redirect_count,
  COALESCE(c.user_converted, 0)::int AS user_converted,
  r.utm_campaign
FROM yt_paid_redirects r
LEFT JOIN yt_paid_conversions c
  ON c.url_path = r.url_path AND c.utm_campaign IS NOT DISTINCT FROM r.utm_campaign
ORDER BY user_converted DESC, redirect_count DESC`;

		const client = await pool.connect();
		try {
			const [{ rows: curAll }, { rows: prevAll }] = await Promise.all([
				client.query(ytRowsSQL, [start, end]),
				client.query(ytRowsSQL, [prevStart, prevEnd]),
			]);

			const splitBuckets = (all) => {
				const organic = [];
				const paid = [];
				for (const r of all) {
					if (r.bucket === 'paid') {
						paid.push({
							post: r.post,
							utm_campaign: r.utm_campaign,
							redirect_count: r.redirect_count,
							user_converted: r.user_converted,
						});
					} else {
						organic.push({
							post: r.post,
							video_id: r.video_id,
							redirect_count: r.redirect_count,
							user_converted: r.user_converted,
						});
					}
				}
				return { organic, paid };
			};

			const cur = splitBuckets(curAll);
			const prev = splitBuckets(prevAll);

			// Fetch YouTube API info for the unique video IDs surfaced in current rows.
			const uniqueVideoIds = [...new Set(cur.organic.map(r => r.video_id).filter(Boolean))];
			let videoInfoMap = {};
			if (uniqueVideoIds.length > 0) {
				console.log(`Fetching YouTube info for ${uniqueVideoIds.length} unique videos`);
				videoInfoMap = await fetchYouTubeVideoInfo(uniqueVideoIds);
				console.log(`Got info for ${Object.keys(videoInfoMap).length} videos`);
			}

			const enrichOrganic = (r) => {
				const ytInfo = r.video_id ? videoInfoMap[r.video_id] : null;
				return {
					post: r.post,
					redirect_count: r.redirect_count,
					user_converted: r.user_converted,
					videoId: r.video_id || null,
					videoTitle: ytInfo?.title || null,
					channelTitle: ytInfo?.channelTitle || null,
					ytViewCount: ytInfo?.viewCount ?? null,
					ytLikeCount: ytInfo?.likeCount ?? null,
					ytCommentCount: ytInfo?.commentCount ?? null,
					thumbnailUrl: ytInfo?.thumbnailUrl || null,
				};
			};

			res.json({
				rows: cur.organic.map(enrichOrganic),
				prevRows: prev.organic.map(enrichOrganic),
				paidRows: cur.paid,
				prevPaidRows: prev.paid,
			});
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/youtube-raw:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Raw Umami Data - All events without mapping to specific content databases
// This provides visibility into all traffic sources, referrers, and paths
app.get("/api/umami-raw", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const client = await pool.connect();
		
		console.log(`Fetching raw Umami data for date range: ${start} to ${end}`);
		
		try {
			const [
				{ rows: bySource },
				{ rows: byReferrer },
				{ rows: byPath },
				{ rows: topEvents },
				{ rows: summary }
			] = await Promise.all([
				// Events grouped by UTM source
				client.query(
					`SELECT 
						CASE 
							WHEN url_query ILIKE '%utm_source=linkedin%' THEN 'linkedin'
							WHEN url_query ILIKE '%utm_source=youtube%' THEN 'youtube'
							WHEN url_query ILIKE '%utm_source=brevo%' THEN 'brevo'
							WHEN url_query ILIKE '%utm_source=google%' THEN 'google'
							WHEN url_query ILIKE '%utm_source=%' THEN 
								substring(url_query FROM 'utm_source=([^&]+)')
							WHEN referrer_domain ILIKE '%google%' THEN 'google (organic)'
							WHEN referrer_domain ILIKE '%linkedin%' THEN 'linkedin (organic)'
							WHEN referrer_domain ILIKE '%youtube%' THEN 'youtube (organic)'
							WHEN referrer_domain IS NOT NULL AND referrer_domain != '' THEN 'other referrer'
							ELSE 'direct'
						END AS source,
						COUNT(*)::int AS event_count,
						COUNT(DISTINCT session_id)::int AS unique_sessions,
						COUNT(DISTINCT CASE WHEN event_type = 2 THEN event_id END)::int AS conversions
					FROM umami_website_event
					WHERE created_at > $1::timestamptz
						AND created_at < $2::timestamptz
					GROUP BY 1
					ORDER BY event_count DESC`,
					[start, end]
				),
				// Events grouped by referrer domain
				client.query(
					`SELECT 
						COALESCE(NULLIF(referrer_domain, ''), 'direct') AS referrer,
						COUNT(*)::int AS event_count,
						COUNT(DISTINCT session_id)::int AS unique_sessions,
						COUNT(DISTINCT CASE WHEN event_type = 2 THEN event_id END)::int AS conversions
					FROM umami_website_event
					WHERE created_at > $1::timestamptz
						AND created_at < $2::timestamptz
					GROUP BY 1
					ORDER BY event_count DESC
					LIMIT 50`,
					[start, end]
				),
				// Events grouped by URL path
				client.query(
					`SELECT 
						url_path AS path,
						COUNT(*)::int AS event_count,
						COUNT(DISTINCT session_id)::int AS unique_sessions,
						COUNT(DISTINCT CASE WHEN event_type = 2 THEN event_id END)::int AS conversions
					FROM umami_website_event
					WHERE created_at > $1::timestamptz
						AND created_at < $2::timestamptz
					GROUP BY 1
					ORDER BY event_count DESC
					LIMIT 100`,
					[start, end]
				),
				// Recent events with full details (limited)
				client.query(
					`SELECT 
						url_path,
						url_query,
						referrer_domain,
						event_type,
						session_id,
						created_at
					FROM umami_website_event
					WHERE created_at > $1::timestamptz
						AND created_at < $2::timestamptz
					ORDER BY created_at DESC
					LIMIT 200`,
					[start, end]
				),
				// Overall summary
				client.query(
					`SELECT 
						COUNT(*)::int AS total_events,
						COUNT(DISTINCT session_id)::int AS unique_sessions,
						COUNT(DISTINCT CASE WHEN event_type = 2 THEN event_id END)::int AS total_conversions,
						COUNT(DISTINCT url_path)::int AS unique_paths,
						COUNT(DISTINCT referrer_domain)::int AS unique_referrers
					FROM umami_website_event
					WHERE created_at > $1::timestamptz
						AND created_at < $2::timestamptz`,
					[start, end]
				)
			]);
			
			console.log(`Raw Umami data: ${summary[0]?.total_events || 0} events, ${bySource.length} sources, ${byReferrer.length} referrers`);
			
			res.json({
				summary: summary[0] || { total_events: 0, unique_sessions: 0, total_conversions: 0, unique_paths: 0, unique_referrers: 0 },
				bySource,
				byReferrer,
				byPath,
				topEvents
			});
			
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/umami-raw:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/youtube-rankings", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const client = await pool.connect();
		
		console.log(`Fetching YouTube rankings for date range: ${start} to ${end}`);
		
		try {
			const { rows } = await client.query(
				`WITH latest_keywords AS (
					-- Get distinct keywords with their watch_time from the latest date in range
					SELECT DISTINCT ON (keyword) 
						keyword,
						fetch_date,
						watch_time_hours,
						views,
						average_view_duration,
						impressions,
						impressions_ctr
					FROM yt_keywords
					WHERE fetch_date >= $1::date AND fetch_date <= $2::date
					ORDER BY keyword, fetch_date DESC
				),
				latest_run AS (
					-- Get the latest fetch_run_id from yt_search_ranking within the date range
					SELECT fetch_run_id
					FROM yt_search_ranking
					WHERE fetch_date >= $1::date AND fetch_date <= $2::date
					ORDER BY fetched_at DESC
					LIMIT 1
				),
				ranking_data AS (
					-- Get ranking data for keywords from latest run
					SELECT 
						r.keyword,
						r.position,
						r.channel_name,
						r.video_id,
						r.video_title,
						r.result_type
					FROM yt_search_ranking r
					CROSS JOIN latest_run lr
					WHERE r.fetch_run_id = lr.fetch_run_id
						AND r.keyword IN (SELECT keyword FROM latest_keywords)
				),
				top_3_results AS (
					-- Get top 3 positions for each keyword
					SELECT 
						keyword,
						json_agg(
							json_build_object(
								'position', position,
								'channel_name', channel_name,
								'video_id', video_id,
								'video_title', video_title,
								'result_type', result_type
							) ORDER BY position
						) AS top_3
					FROM ranking_data
					WHERE position <= 3
					GROUP BY keyword
				),
				sidharth_in_4_to_10 AS (
					-- Get Sidharth Ramesh's videos in positions 4-10
					SELECT 
						keyword,
						json_agg(
							json_build_object(
								'position', position,
								'video_id', video_id,
								'video_title', video_title
							) ORDER BY position
						) AS sidharth_videos
					FROM ranking_data
					WHERE position BETWEEN 4 AND 10
						AND channel_name = 'Sidharth Ramesh'
					GROUP BY keyword
				)
				SELECT 
					lk.keyword,
					lk.fetch_date,
					lk.watch_time_hours,
					lk.average_view_duration,
					COALESCE(t.top_3, '[]'::json) AS top_3,
					COALESCE(s.sidharth_videos, '[]'::json) AS sidharth_videos
				FROM latest_keywords lk
				LEFT JOIN top_3_results t ON t.keyword = lk.keyword
				LEFT JOIN sidharth_in_4_to_10 s ON s.keyword = lk.keyword
				ORDER BY lk.watch_time_hours DESC NULLS LAST`,
				[start, end]
			);
			
			console.log(`Processed ${rows.length} keywords with rankings`);
			res.json(rows);
			
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/youtube-rankings:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Contact Us Analytics - Tracks contact page visits and form submissions
app.get("/api/contact-us", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const client = await pool.connect();
		
		// Calculate previous period for comparison
		const startDate = new Date(start);
		const endDate = new Date(end);
		const durationMs = endDate.getTime() - startDate.getTime();
		const prevStart = new Date(startDate.getTime() - durationMs).toISOString();
		const prevEnd = start;
		
		console.log(`Fetching Contact Us data for date range: ${start} to ${end}`);
		
		try {
			const [
				{ rows: currentPeriod },
				{ rows: previousPeriod },
				{ rows: recentEvents }
			] = await Promise.all([
				// Current period counts - query event_name column directly from umami_website_event
				client.query(
					`SELECT 
						COALESCE(SUM(CASE WHEN event_name = 'contact-page-visit' THEN 1 ELSE 0 END), 0)::int AS page_visits,
						COALESCE(SUM(CASE WHEN event_name = 'contact-page-form-submit' THEN 1 ELSE 0 END), 0)::int AS form_submissions
					FROM umami_website_event
					WHERE event_name IN ('contact-page-visit', 'contact-page-form-submit')
						AND created_at > $1::timestamptz
						AND created_at < $2::timestamptz`,
					[start, end]
				),
				// Previous period counts for trend comparison
				client.query(
					`SELECT 
						COALESCE(SUM(CASE WHEN event_name = 'contact-page-visit' THEN 1 ELSE 0 END), 0)::int AS page_visits,
						COALESCE(SUM(CASE WHEN event_name = 'contact-page-form-submit' THEN 1 ELSE 0 END), 0)::int AS form_submissions
					FROM umami_website_event
					WHERE event_name IN ('contact-page-visit', 'contact-page-form-submit')
						AND created_at > $1::timestamptz
						AND created_at < $2::timestamptz`,
					[prevStart, prevEnd]
				),
				// Recent events for the table
				client.query(
					`SELECT 
						event_name,
						session_id,
						created_at,
						url_path
					FROM umami_website_event
					WHERE event_name IN ('contact-page-visit', 'contact-page-form-submit')
						AND created_at > $1::timestamptz
						AND created_at < $2::timestamptz
					ORDER BY created_at DESC
					LIMIT 1000`,
					[start, end]
				)
			]);
			
			const current = currentPeriod[0] || { page_visits: 0, form_submissions: 0 };
			const prev = previousPeriod[0] || { page_visits: 0, form_submissions: 0 };
			
			// Calculate conversion rates
			const conversionRate = current.page_visits > 0 
				? (current.form_submissions / current.page_visits) * 100 
				: 0;
			const prevConversionRate = prev.page_visits > 0 
				? (prev.form_submissions / prev.page_visits) * 100 
				: 0;
			
			console.log(`Contact Us: ${current.page_visits} visits, ${current.form_submissions} submissions, ${conversionRate.toFixed(2)}% conversion`);
			
			res.json({
				summary: {
					page_visits: current.page_visits,
					form_submissions: current.form_submissions,
					conversion_rate: conversionRate
				},
				prevSummary: {
					page_visits: prev.page_visits,
					form_submissions: prev.form_submissions,
					conversion_rate: prevConversionRate
				},
				recentEvents
			});
			
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/contact-us:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

// Serve the React app for all other routes (SPA routing) in production
// This catch-all route must be last - it handles client-side routing
if (process.env.NODE_ENV === "production") {
	// Use app.use with a path check for better Express 5 compatibility
	app.use((req, res, next) => {
		// Skip API routes (should already be handled, but safety check)
		if (req.path.startsWith("/api/")) {
			return next();
		}
		
		// Skip static file requests (files with extensions)
		// Static middleware handles existing files, but we want to return 404
		// for missing static assets instead of serving index.html
		if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
			return res.status(404).json({ error: "Not found" });
		}
		
		// Serve the React app for all other routes (enables client-side routing)
		res.sendFile(path.join(__dirname, "../dist/index.html"), (err) => {
			if (err) {
				console.error("Failed to serve index.html:", err);
				res.status(500).json({ error: "Failed to load application" });
			}
		});
	});
}

app.listen(port, '0.0.0.0', async () => {
	console.log(`🚀 API server running on http://0.0.0.0:${port}`);
	console.log(`📦 Environment: ${process.env.NODE_ENV}`);
	console.log(`🗄️  Database host: ${process.env.DB_HOST}`);
	console.log(`❤️  Health check available at: http://0.0.0.0:${port}/health`);
	console.log('');
	console.log('Testing database connection...');
	await testDatabaseConnection();
});
