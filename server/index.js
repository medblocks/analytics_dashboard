import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: parseInt(process.env.DB_PORT),
});

function asRange(req) {
	const start = req.query.start;
	const end = req.query.end;
	if (!start || !end) {
		throw new Error("Missing start or end");
	}
  console.log("Got the date ranger", start, end);
	return { start, end };
}

app.get("/total-users", async (req, res) => {
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
		res.status(400).json({ error: e.message || "bad request" });
	}
});

app.get("/totals", async (req, res) => {
	try {
		const { start, end } = asRange(req);

		const client = await pool.connect();
		try {
			const [
				{ rows: uRows },
				{ rows: liRows },
				{ rows: ytRows },
				{ rows: gRows },
			] = await Promise.all([
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
			]);

			const totalUsers = uRows[0]?.user_no ?? 0;
			const linkedinViews = liRows[0]?.linkedin_views ?? 0;
			const youtubeViews = ytRows[0]?.yt_views ?? 0;
			const googleViews = gRows[0]?.google_views ?? 0;

			const other = Math.max(
				0,
				totalUsers - (linkedinViews + youtubeViews + googleViews)
			);

			res.json({ totalUsers, linkedinViews, youtubeViews, googleViews, other });
		} finally {
			client.release();
		}
	} catch (e) {
		res.status(400).json({ error: e.message || "bad request" });
	}
});

app.get("/google", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const client = await pool.connect();
		try {
			const { rows } = await client.query(
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
session_conversions AS (
  SELECT
    ps.post,
    ps.session_id,
    CASE WHEN EXISTS (
      SELECT 1
      FROM LATERAL (
        SELECT
          u2.event_id AS website_event_id,
          u2.created_at AS event_created_at
        FROM umami_website_event u2
        WHERE u2.session_id = ps.session_id
          AND u2.event_type = 2
        ORDER BY u2.created_at ASC
        LIMIT 1
      ) first_evt
      JOIN LATERAL (
        SELECT
          ued.string_value,
          ued.created_at AS event_data_created_at
        FROM umami_event_data ued
        WHERE ued.website_event_id = first_evt.website_event_id
          AND ued.data_key = 'user_id'
        ORDER BY ued.created_at ASC
        LIMIT 1
      ) user_data ON TRUE
      JOIN directus_user du
        ON du.id = user_data.string_value
       AND du.date_created BETWEEN (user_data.event_data_created_at - INTERVAL '2 minutes')
                               AND (user_data.event_data_created_at + INTERVAL '2 minutes')
    ) THEN 1 ELSE 0 END AS converted
  FROM post_sessions ps
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
ORDER BY COALESCE(c.user_converted, 0) DESC, r.redirect_count DESC;`,
				[start, end]
			);
			res.json(rows);
		} finally {
			client.release();
		}
	} catch (e) {
		res.status(400).json({ error: e.message || "bad request" });
	}
});

app.get("/youtube", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const client = await pool.connect();
		try {
			const { rows } = await client.query(
				`WITH base AS (
SELECT
btrim(regexp_replace(y.video_title, '[[:space:]]+', ' ', 'g')) AS post,
uwe.session_id,
uwe.event_id AS uwe_id
FROM umami_website_event uwe
JOIN directus_content dc
ON POSITION(
dc.full_link IN ('https://medblocks.com' || uwe.url_path || '?' || uwe.url_query)
) = 1
JOIN youtube y
ON y.video_id = dc.content_id
AND y.fetch_date = '2025-09-08'
WHERE uwe.created_at > $1::timestamptz
AND uwe.created_at < $2::timestamptz
AND uwe.url_query ILIKE '%utm_source=youtube%'
),
post_sessions AS (
SELECT DISTINCT post, session_id
FROM base
),
session_conversions AS (
SELECT
ps.post,
ps.session_id,
CASE WHEN EXISTS (
SELECT 1
FROM LATERAL (
SELECT
u2.event_id AS website_event_id,
u2.created_at AS event_created_at
FROM umami_website_event u2
WHERE u2.session_id = ps.session_id
AND u2.event_type = 2
ORDER BY u2.created_at ASC
LIMIT 1
) first_evt
JOIN LATERAL (
SELECT
ued.string_value,
ued.created_at AS event_data_created_at
FROM umami_event_data ued
WHERE ued.website_event_id = first_evt.website_event_id
AND ued.data_key = 'user_id'
ORDER BY ued.created_at ASC
LIMIT 1
) user_data ON TRUE
JOIN directus_user du
ON du.id = user_data.string_value
AND du.date_created BETWEEN (user_data.event_data_created_at - INTERVAL '2 minutes')
AND (user_data.event_data_created_at + INTERVAL '2 minutes')
) THEN 1 ELSE 0 END AS converted
FROM post_sessions ps
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
			);
			res.json(rows);
		} finally {
			client.release();
		}
	} catch (e) {
		res.status(400).json({ error: e.message || "bad request" });
	}
});

app.get("/linkedin", async (req, res) => {
	try {
		const { start, end } = asRange(req);
		const client = await pool.connect();
    console.log("Got the date ranges", start, end);
    console.log("Querying LinkedIn data");
		try {
			const { rows } = await client.query(
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
session_conversions AS (
  SELECT
    ps.post,
    ps.session_id,
    CASE WHEN EXISTS (
      SELECT 1
      FROM LATERAL (
        SELECT
          u2.event_id  AS website_event_id,
          u2.created_at AS event_created_at
        FROM umami_website_event u2
        WHERE u2.session_id = ps.session_id
          AND u2.event_type = 2
        ORDER BY u2.created_at ASC
        LIMIT 1
      ) first_evt
      JOIN LATERAL (
        SELECT
          ued.string_value,
          ued.created_at AS event_data_created_at
        FROM umami_event_data ued
        WHERE ued.website_event_id = first_evt.website_event_id
          AND ued.data_key = 'user_id'
        ORDER BY ued.created_at ASC
        LIMIT 1
      ) user_data ON TRUE
      JOIN directus_user du
        ON du.id = user_data.string_value
       AND du.date_created BETWEEN (user_data.event_data_created_at - INTERVAL '2 minutes')
                                AND (user_data.event_data_created_at + INTERVAL '2 minutes')
    ) THEN 1 ELSE 0 END AS converted
  FROM post_sessions ps
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
			);
      console.log("Got the LinkedIn data");
			res.json(rows);
		} finally {
			client.release();
		}
	} catch (e) {
		res.status(400).json({ error: e.message || "bad request" });
	}
});

app.get("/brevo", async (req, res) => {
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
session_conversions AS (
  SELECT
    ps.post,
    ps.session_id,
    CASE WHEN EXISTS (
      SELECT 1
      FROM LATERAL (
        SELECT
          u2.event_id  AS website_event_id,
          u2.created_at AS event_created_at
        FROM umami_website_event u2
        WHERE u2.session_id = ps.session_id
          AND u2.event_type = 2
        ORDER BY u2.created_at ASC
        LIMIT 1
      ) first_evt
      JOIN LATERAL (
        SELECT
          ued.string_value,
          ued.created_at AS event_data_created_at
        FROM umami_event_data ued
        WHERE ued.website_event_id = first_evt.website_event_id
          AND ued.data_key = 'user_id'
        ORDER BY ued.created_at ASC
        LIMIT 1
      ) user_data ON TRUE
      JOIN directus_user du
        ON du.id = user_data.string_value
       AND du.date_created BETWEEN (user_data.event_data_created_at - INTERVAL '2 minutes')
                                AND (user_data.event_data_created_at + INTERVAL '2 minutes')
    ) THEN 1 ELSE 0 END AS converted
  FROM post_sessions ps
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
		res.status(400).json({ error: e.message || "bad request" });
	}
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
	console.log(`API server on http://localhost:${port}`);
});
