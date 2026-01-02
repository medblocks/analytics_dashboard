import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

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
				`select count(*)::int as user_no from directus_user`
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
          WHERE date_created > now() - interval '30 days'
          GROUP BY 1
        ),
        all_dates_with_counts AS (
          SELECT 
            dr.date,
            COALESCE(dc.daily_count, 0)::int as daily_count,
            (SELECT COUNT(*)::int 
             FROM directus_user 
             WHERE date_trunc('day', date_created) <= dr.date) as cumulative_count
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

		const client = await pool.connect();
		try {
			const [
				{ rows: uRows },
				{ rows: liRows },
				{ rows: ytRows },
				{ rows: gRows },
				{ rows: prevURows },
				{ rows: prevLiRows },
				{ rows: prevYtRows },
				{ rows: prevGRows },
			] = await Promise.all([
				// Current period
				client.query(
					`select count(*)::int as user_no from directus_user WHERE date_created > $1::timestamptz and date_created < $2::timestamptz`,
					[start, end]
				),
				client.query(
					`SELECT count(*)::int as linkedin_views
           FROM umami_website_event uwe
           WHERE created_at > $1::timestamptz and created_at < $2::timestamptz
           AND url_query ILIKE '%utm_source=linkedin%'
           AND url_query NOT ILIKE '%utm_medium=bio&utm_source=linkedin%'`,
					[start, end]
				),
				client.query(
					`SELECT count(*)::int as yt_views
           FROM umami_website_event uwe
           WHERE created_at > $1::timestamptz and created_at < $2::timestamptz
           AND url_query ILIKE '%utm_source=youtube%'`,
					[start, end]
				),
				client.query(
					`SELECT count(*)::int as google_views
           FROM umami_website_event uwe
           WHERE created_at > $1::timestamptz and created_at < $2::timestamptz
           AND referrer_domain ILIKE '%google%'`,
					[start, end]
				),
				// Previous period
				client.query(
					`select count(*)::int as user_no from directus_user WHERE date_created > $1::timestamptz and date_created < $2::timestamptz`,
					[prevStart, prevEnd]
				),
				client.query(
					`SELECT count(*)::int as linkedin_views
           FROM umami_website_event uwe
           WHERE created_at > $1::timestamptz and created_at < $2::timestamptz
           AND url_query ILIKE '%utm_source=linkedin%'
           AND url_query NOT ILIKE '%utm_medium=bio&utm_source=linkedin%'`,
					[prevStart, prevEnd]
				),
				client.query(
					`SELECT count(*)::int as yt_views
           FROM umami_website_event uwe
           WHERE created_at > $1::timestamptz and created_at < $2::timestamptz
           AND url_query ILIKE '%utm_source=youtube%'`,
					[prevStart, prevEnd]
				),
				client.query(
					`SELECT count(*)::int as google_views
           FROM umami_website_event uwe
           WHERE created_at > $1::timestamptz and created_at < $2::timestamptz
           AND referrer_domain ILIKE '%google%'`,
					[prevStart, prevEnd]
				),
			]);

			const totalUsers = uRows[0]?.user_no ?? 0;
			const linkedinViews = liRows[0]?.linkedin_views ?? 0;
			const youtubeViews = ytRows[0]?.yt_views ?? 0;
			const googleViews = gRows[0]?.google_views ?? 0;
			const other = Math.max(
				0,
				totalUsers - (linkedinViews + youtubeViews + googleViews)
			);

			const prevTotalUsers = prevURows[0]?.user_no ?? 0;
			const prevLinkedinViews = prevLiRows[0]?.linkedin_views ?? 0;
			const prevYoutubeViews = prevYtRows[0]?.yt_views ?? 0;
			const prevGoogleViews = prevGRows[0]?.google_views ?? 0;
			const prevOther = Math.max(
				0,
				prevTotalUsers - (prevLinkedinViews + prevYoutubeViews + prevGoogleViews)
			);

			res.json({ 
				totalUsers, 
				linkedinViews, 
				youtubeViews, 
				googleViews, 
				other,
				prevTotalUsers,
				prevLinkedinViews,
				prevYoutubeViews,
				prevGoogleViews,
				prevOther
			});
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/totals:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/google", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);
		const client = await pool.connect();
		try {
			const [{ rows }, { rows: prevRows }] = await Promise.all([
				// Current period
				client.query(
				`WITH base AS (
  SELECT
    uwe.url_path AS post,
    uwe.session_id,
    uwe.event_id AS uwe_id
  FROM umami_website_event uwe
  WHERE uwe.created_at > $1::timestamptz
    AND uwe.created_at < $2::timestamptz
    AND uwe.referrer_domain ILIKE '%google%'
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
    COUNT(*) AS redirect_count
  FROM base
  GROUP BY post
),
conversions_by_post AS (
  SELECT
    post,
    SUM(converted) AS user_converted
  FROM session_conversions
  GROUP BY post
),
queries_by_path AS (
  SELECT
    regexp_replace(page, '^https?://[^/]+', '') AS url_path,
    query,
    MIN(position) AS best_position
  FROM search_console_fresh
  WHERE fetch_date >= $1::date
    AND fetch_date <= $2::date
  GROUP BY regexp_replace(page, '^https?://[^/]+', ''), query
),
top_queries_by_path AS (
  SELECT
    url_path,
    ARRAY_AGG(query ORDER BY best_position ASC) AS queries
  FROM (
    SELECT
      url_path,
      query,
      best_position,
      ROW_NUMBER() OVER (PARTITION BY url_path ORDER BY best_position ASC) AS rn
    FROM queries_by_path
  ) ranked
  WHERE rn <= 5
  GROUP BY url_path
)
SELECT
  r.post,
  r.redirect_count::int,
  COALESCE(c.user_converted, 0)::int AS user_converted,
  COALESCE(array_to_json(q.queries), '[]'::json) AS queries
FROM redirects_by_post r
LEFT JOIN conversions_by_post c
  ON c.post = r.post
LEFT JOIN top_queries_by_path q
  ON q.url_path = r.post
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`,
				[start, end]
			),
			// Previous period
			client.query(
				`WITH base AS (
  SELECT
    uwe.url_path AS post,
    uwe.session_id,
    uwe.event_id AS uwe_id
  FROM umami_website_event uwe
  WHERE uwe.created_at > $1::timestamptz
    AND uwe.created_at < $2::timestamptz
    AND uwe.referrer_domain ILIKE '%google%'
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
    COUNT(*) AS redirect_count
  FROM base
  GROUP BY post
),
conversions_by_post AS (
  SELECT
    post,
    SUM(converted) AS user_converted
  FROM session_conversions
  GROUP BY post
),
queries_by_path AS (
  SELECT
    regexp_replace(page, '^https?://[^/]+', '') AS url_path,
    query,
    MIN(position) AS best_position
  FROM search_console_fresh
  WHERE fetch_date >= $1::date
    AND fetch_date <= $2::date
  GROUP BY regexp_replace(page, '^https?://[^/]+', ''), query
),
top_queries_by_path AS (
  SELECT
    url_path,
    ARRAY_AGG(query ORDER BY best_position ASC) AS queries
  FROM (
    SELECT
      url_path,
      query,
      best_position,
      ROW_NUMBER() OVER (PARTITION BY url_path ORDER BY best_position ASC) AS rn
    FROM queries_by_path
  ) ranked
  WHERE rn <= 5
  GROUP BY url_path
)
SELECT
  r.post,
  r.redirect_count::int,
  COALESCE(c.user_converted, 0)::int AS user_converted,
  COALESCE(array_to_json(q.queries), '[]'::json) AS queries
FROM redirects_by_post r
LEFT JOIN conversions_by_post c
  ON c.post = r.post
LEFT JOIN top_queries_by_path q
  ON q.url_path = r.post
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`,
				[prevStart, prevEnd]
			)
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

app.get("/api/youtube", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);
		const client = await pool.connect();
		try {
			const [{ rows }, { rows: prevRows }] = await Promise.all([
				// Current period
				client.query(
				`WITH base AS (
  SELECT
    btrim(regexp_replace(y.video_title, '[[:space:]]+', ' ', 'g')) AS post,
    uwe.session_id,
    uwe.event_id AS uwe_id
  FROM umami_website_event uwe
  JOIN directus_content dc
    ON POSITION(dc.full_link IN ('https://medblocks.com' || uwe.url_path || '?' || uwe.url_query)) = 1
  JOIN youtube y
    ON y.video_id = dc.content_id
    AND y.fetch_date = $2::date
  WHERE uwe.created_at > $1::timestamptz
    AND uwe.created_at < $2::timestamptz
    AND uwe.url_query ILIKE '%utm_source=youtube%'
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
    COUNT(*) AS redirect_count
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
ORDER BY c.user_converted DESC;`,
				[start, end]
			),
			// Previous period
			client.query(
				`WITH base AS (
  SELECT
    btrim(regexp_replace(y.video_title, '[[:space:]]+', ' ', 'g')) AS post,
    uwe.session_id,
    uwe.event_id AS uwe_id
  FROM umami_website_event uwe
  JOIN directus_content dc
    ON POSITION(dc.full_link IN ('https://medblocks.com' || uwe.url_path || '?' || uwe.url_query)) = 1
  JOIN youtube y
    ON y.video_id = dc.content_id
    AND y.fetch_date = $2::date
  WHERE uwe.created_at > $1::timestamptz
    AND uwe.created_at < $2::timestamptz
    AND uwe.url_query ILIKE '%utm_source=youtube%'
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
    COUNT(*) AS redirect_count
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
ORDER BY c.user_converted DESC;`,
				[prevStart, prevEnd]
			)
		]);
			res.json({ rows, prevRows });
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/youtube:", e);
		res.status(500).json({ error: e.message || "Internal server error" });
	}
});

app.get("/api/linkedin", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const { prevStart, prevEnd } = getPreviousPeriod(start, end);
		const client = await pool.connect();
    console.log("Got the date ranges", start, end);
    console.log("Previous period:", prevStart, prevEnd);
    console.log("Querying LinkedIn data");
		try {
			const [{ rows }, { rows: prevRows }] = await Promise.all([
				// Current period
				client.query(
				`WITH base AS (
  SELECT
    btrim(regexp_replace(l.post, '[[:space:]]+', ' ', 'g')) AS post,
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
  JOIN linkedin l
    ON l.post_url_id = dc.content_id
  WHERE uwe.created_at >= $1::timestamptz
    AND uwe.created_at <  $2::timestamptz
    AND uwe.url_query ILIKE '%utm_source=linkedin%'
    AND NOT (
      uwe.url_query ILIKE '%utm_medium=bio%' AND
      uwe.url_query ILIKE '%utm_source=linkedin%'
    )
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
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`,
				[start, end]
			),
			// Previous period
			client.query(
				`WITH base AS (
  SELECT
    btrim(regexp_replace(l.post, '[[:space:]]+', ' ', 'g')) AS post,
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
  JOIN linkedin l
    ON l.post_url_id = dc.content_id
  WHERE uwe.created_at >= $1::timestamptz
    AND uwe.created_at <  $2::timestamptz
    AND uwe.url_query ILIKE '%utm_source=linkedin%'
    AND NOT (
      uwe.url_query ILIKE '%utm_medium=bio%' AND
      uwe.url_query ILIKE '%utm_source=linkedin%'
    )
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
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`,
				[prevStart, prevEnd]
			)
		]);
      console.log("Got the LinkedIn data");
			res.json({ rows, prevRows });
		} finally {
			client.release();
		}
	} catch (e) {
		console.error("Error in /api/linkedin:", e);
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
