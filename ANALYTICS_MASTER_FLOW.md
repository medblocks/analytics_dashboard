# Medblocks Analytics — Master Flow

This document describes how the two repos in this folder work **together** to turn raw
marketing/traffic data into the funnels shown on the analytics dashboard.

| Repo | Role | Stack |
|------|------|-------|
| [`analytics_script_2`](./analytics_script_2) | **ETL / scraper** — pulls data from every source and loads it into Postgres; defines the SQL views & funnel functions | Node + TypeScript (`tsx`), Playwright, `pg`, Postgres |
| [`analytics_dashboard`](./analytics_dashboard) | **Read layer** — Express API over the same Postgres + a React/Vite UI | React 18 + Vite, Express 5, `pg`, Recharts |

The scraper only ever *writes* to the warehouse; the dashboard only ever *reads* from it. There
is no direct connection between the two repos — the **`analytics` database is the contract**.

---

## 0. Two databases, one warehouse (read this first)

There are **three** DB configs across the two repos, but they point at only **two** databases on
the same server. Don't let the shared IP fool you:

| Config | Repo | Host : Port | DB name | User | Role |
|--------|------|-------------|---------|------|------|
| `UMAMI_DB_*` | scraper | `35.227.22.159:`**`6432`** | **`umami`** | `postgres` | **Source** — Umami's own DB (read-only input). Port `6432` is a PgBouncer pooler. |
| `DATABASE_URL` | scraper | `35.227.22.159:`**`5432`** | **`analytics`** | `analytics` | **Warehouse** — scraper *writes* here |
| `DB_*` | dashboard | `35.227.22.159:`**`5432`** | **`analytics`** | `analytics` | **Warehouse** — dashboard *reads* here |

- **`umami`** is a *separate, upstream* Postgres owned by the Umami web-analytics product. The
  scraper connects to it **only to copy data out** ([src/umami.ts](./analytics_script_2/src/umami.ts)).
- **`analytics`** is the **single source of truth** — the warehouse. Both the scraper's
  `DATABASE_URL` and the dashboard's `DB_*` point at this same database.

```
   umami DB  (35.227.22.159:6432, db=umami)         ← external SOURCE, owned by Umami
       │   read-only copy via src/umami.ts (verbatim, no filtering)
       ▼
   analytics DB (35.227.22.159:5432, db=analytics)  ← the warehouse / source of truth
       ├── scraper  writes  (DATABASE_URL)
       └── dashboard reads   (DB_*)
```

Why a separate warehouse instead of querying `umami` directly? Because the funnels join Umami
events with data Umami never sees — Brevo email, LinkedIn/YouTube metrics, Search Console, and
Directus CMS content/registrations. The fix for untracked clicks lives **entirely inside the
`analytics` DB** (the funnel SQL); the `umami` source DB is never touched by it.

---

## 1. End-to-end picture

```
 EXTERNAL SOURCES                 analytics_script_2 (ETL)              POSTGRES (shared)                 analytics_dashboard
 ────────────────                ────────────────────────             ──────────────────                ───────────────────

 Umami DB (remote) ───copy────►  src/umami.ts                ┌───►  umami_website_event   ──┐
   website_event                  (streamed via pg-cursor)   │      umami_session           │
   session                                                   │      umami_session_data      │
   session_data                                              │      umami_event_data        │
   event_data                                                │                              │
                                                             │                              │   SQL views + funnel fns
 Brevo API ─────────────────►   src/brevo.ts ──────────────►├───►  brevo                    ├──►  f_brevo_funnel()      ──┐
   (email campaign stats)         scrape.ts (delta logic)    │      brevo_cumulative         │     f_youtube_funnel()      │
                                                             │                              │     f_linkedin_funnel()     │
 LinkedIn (Playwright) ──────►   src/linkedin.ts ───────────►├───►  linkedin                 │     f_google_search_funnel()│
   (post analytics, login)        scrape.ts (delta logic)    │      linkedin_cumulative      │     v_*_url_map views        │
                                                             │                              │           │                  │
 YouTube (Playwright + API) ─►   src/youtube*.ts ───────────►├───►  youtube                  │           ▼                  ▼
   (video stats, keywords)        processYouTube.ts          │      yt_keywords              │      server/index.js  ──►  React UI
                                                             │      yt_search_ranking        │      (Express API)         (src/components/*Tab.tsx)
 Google Search Console ──────►   src/searchConsole.ts ──────►├───►  search_console           │       /api/brevo            Overview / Google /
   (queries, clicks, impr.)       scrape.ts                  │      search_console_fresh     │       /api/google          Brevo / LinkedIn /
                                                             │                              │       /api/linkedin-raw    YouTube / Raw Umami /
 Directus CMS API ───────────►   src/directus/*.ts ─────────►└───►  directus_content         │       /api/youtube-raw     Contact Us / …
   (content, users, contacts,     syncToDb.ts (paged upsert)        directus_user            │       /api/umami-raw
    enrollments, registrations)                                     directus_contact         │       /api/total-users
                                                                    directus_enrollment      │       /api/search-queries
                                                                    directus_fhir_*_reg      │       /api/contact-us
                                                                    directus_webinar_enroll  ─┘       /api/user-growth
```

---

## 2. The ETL run (`analytics_script_2`)

Entry point: [`src/scrape.ts`](./analytics_script_2/src/scrape.ts) (`npm run scrape`). It runs
once per day (scheduled via `dokploy_schedule_script.sh` / Docker) and processes **yesterday**
(most sources lag ~1 day; Search Console lags ~3 days and is fetched separately).

Order of operations inside `scrape()`:

1. **Search Console** — historical (`scDate`, 3 days back) + fresh (`date`, 1 day back) →
   `search_console` / `search_console_fresh`.
2. **Brevo** — fetch campaign stats; compute **deltas** vs `brevo_cumulative`, insert only
   non-zero-change days into `brevo`, then refresh the cumulative snapshot
   ([scrape.ts:161-249](./analytics_script_2/src/scrape.ts#L161-L249)).
3. **Umami** — [`fetchUmamiEvents`](./analytics_script_2/src/umami.ts) streams 4 tables
   (`website_event`, `session`, `session_data`, `event_data`) from the **remote Umami
   Postgres** in 10k-row batches and bulk-upserts them locally with
   `ON CONFLICT … DO NOTHING`. **No filtering** — every raw event is copied verbatim.
4. **Directus** — each collection streamed in pages of 500 and upserted; full sync if the
   target table is empty, otherwise date-filtered since yesterday.
5. **LinkedIn / YouTube** — Playwright scrapers (currently commented out in `scrape.ts`;
   run via their own scripts / logins). Same delta-vs-cumulative pattern as Brevo.

Other entry points: `npm run scrape:date` (backfill a specific day),
`npm run backfill:search-console`, `npm run directus-export`
([src/directus/export.ts](./analytics_script_2/src/directus/export.ts) — full Directus dump,
no date filter).

---

## 3. From raw events to funnels (the SQL layer)

The funnels live in [`analytics_script_2/views/`](./analytics_script_2/views) and are installed
into Postgres by `setup-views-functions.sh`. The dashboard calls these functions; it does **not**
re-implement the funnel logic (with the exception of the raw/exploratory endpoints).

Each channel has two pieces:

- **`v_<channel>_url_map`** — joins `directus_content` (the campaign links you authored) to the
  channel's stats table, producing `content_id → full_link`.
- **`f_<channel>_funnel(start, end)`** — the funnel: impressions → **clicks** → registrations.

**How a "click" is attributed:** the funnel reconstructs the landing URL from each Umami event
and matches it against the campaign's `full_link`:

```sql
JOIN umami_website_event u
  ON ('https://medblocks.com' || u.url_path
      || CASE WHEN u.url_query IS NOT NULL THEN '?' ELSE '' END
      || COALESCE(u.url_query, '')) = m.full_link
```

YouTube/LinkedIn additionally filter on `referrer_domain`; Brevo (email, no referrer) relies on
the URL match alone. Registrations are tied back via `umami_session.distinct_id` →
`SignIn`/`SignUp` events → `umami_event_data.user_id`.

> ### ⚠️ Known issue — under-counted / "untraceable" clicks
> The click join above requires the landing URL to equal the stored `full_link`
> **character-for-character**. Real clicks are silently dropped whenever the actual URL differs:
> extra params appended by the source (Brevo's redirector, `fbclid`/`gclid`), reordered query
> params, or trailing-slash/case/encoding differences. The clicks exist in `umami_website_event`
> but never join to a campaign → they appear "untracked." Fix direction: match on a **normalized**
> URL (path + whitelisted UTM params, order-insensitive) or join on `utm_campaign` instead of the
> full URL string. See `views/Brevo/f_brevo_funnel.sql:37`, `views/YouTube/f_youtube_funnel.sql:41`,
> `views/LinkedIn/f_linkedin_funnel.sql:37`.

The dashboard's `/api/umami-raw` endpoint buckets traffic by `utm_source`/`referrer_domain`
([server/index.js:1222-1244](./analytics_dashboard/server/index.js#L1222-L1244)) and a shared
`SOURCE_CASE_SQL` ([server/index.js:207-219](./analytics_dashboard/server/index.js#L207-L219))
classifies sources for attribution — note its `referrer_domain IN (…)` lists are case-sensitive.

---

## 4. The read layer (`analytics_dashboard`)

- **API:** [`server/index.js`](./analytics_dashboard/server/index.js) — one Express server,
  ~16 endpoints, each running SQL (mostly calling the `f_*_funnel` functions) against Postgres.
- **UI:** [`src/`](./analytics_dashboard/src) — React + Vite. One `*Tab.tsx` component per
  channel (`OverviewTab`, `GoogleTab`, `BrevoTab`, `LinkedInRawTab`, `YouTubeRawTab`,
  `RawUmamiTab`, `ContactUsTab`, …), all driven by a shared `useDateRange` hook and
  `useFetchData`.
- **Run:** `npm start` (concurrently runs Vite dev server + API).

---

## 5. Shared database tables

| Group | Tables |
|-------|--------|
| Umami (raw, verbatim copy) | `umami_website_event`, `umami_session`, `umami_session_data`, `umami_event_data` |
| Brevo (email) | `brevo` (daily deltas), `brevo_cumulative` (snapshot) |
| LinkedIn | `linkedin` (daily), `linkedin_cumulative` |
| YouTube | `youtube`, `yt_keywords`, `yt_search_ranking` |
| Search Console | `search_console`, `search_console_fresh` |
| Directus (CMS mirror) | `directus_content`, `directus_user`, `directus_contact`, `directus_enrollment`, `directus_fhir_builders_reg`, `directus_fhir_challenge_reg`, `directus_webinar_enrollment` |

Schema source of truth: [`analytics_script_2/db/init.sql`](./analytics_script_2/db/init.sql).

---

## 6. Quick start

```bash
# 1. ETL — populate Postgres
cd analytics_script_2
npm install && npx playwright install chromium
cp env.example .env          # fill DB + source credentials
bash setup-views-functions.sh  # install v_* views and f_*_funnel functions
npm run scrape                 # or: npm run scrape:date 2026-06-14

# 2. Dashboard — read & visualize
cd ../analytics_dashboard
npm install
cp .env.example .env          # point at the same Postgres
npm start                      # Vite UI + Express API
```
