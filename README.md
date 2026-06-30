# analytics_dashboard — Analytics Read Layer & UI

The **read half** of the Medblocks analytics stack: an Express API over Postgres plus a
React/Vite dashboard that visualizes the funnels. It reads the data and SQL functions produced
by [`analytics_script_2`](../analytics_script_2).

> **Big picture:** see [`../ANALYTICS_MASTER_FLOW.md`](../ANALYTICS_MASTER_FLOW.md) for how this
> repo and the scraper fit together.

This repo **only reads** from Postgres; the scraper **only writes**. Postgres is the contract.

---

## Architecture

```
Postgres ──► server/index.js (Express API) ──► src/components/*Tab.tsx (React + Recharts)
 (funnels)        ~16 /api/* endpoints              one tab per channel
```

- **API:** [`server/index.js`](server/index.js), a single Express 5 server. The channel
  endpoints build on the inline `ATTRIBUTED_SIGNUPS_CTES` (signup attribution computed in SQL);
  `/api/brevo` still uses the scraper's `f_brevo_funnel`; the raw and exploratory endpoints query
  `umami_*` tables directly.
- **UI:** [`src/`](src) — React 18 + Vite. One `*Tab.tsx` per channel, all driven by the shared
  [`useDateRange`](src/shared/hooks/useDateRange.ts) and
  [`useFetchData`](src/shared/hooks/useFetchData.ts) hooks.

### Key API endpoints (`server/index.js`)

| Endpoint | Purpose |
|----------|---------|
| `/api/totals`, `/api/total-users`, `/api/user-growth` | Top-level KPIs (LinkedIn / YouTube / Google / Google Ads / Other) and the all-time growth chart |
| `/api/google` | Organic Google search landing-page funnel |
| `/api/google-ads` | Paid Google funnel (`utm_source=google`, cpc / demand_gen), kept separate from organic |
| `/api/source-growth?source=` | Per-channel 30-day growth (daily bars + all-time cumulative), for the channel tabs |
| `/api/search-queries`, `/api/keywords` | Google Search Console queries and keyword editor |
| `/api/brevo` | Email campaign funnel (`f_brevo_funnel`) |
| `/api/linkedin-raw`, `/api/youtube-raw`, `/api/youtube-rankings` | LinkedIn / YouTube funnels and rankings |
| `/api/umami-raw` | Raw traffic bucketed by `utm_source` / `referrer_domain` |
| `/api/other`, `/api/contact-us` | Other-source drill-down and contact-form data |

### UI tabs (`src/components`)

`OverviewTab`, `GoogleTab`, `GoogleAdsTab`, `BrevoTab`, `LinkedInRawTab`, `YouTubeRawTab`,
`YTSearchRankingTab`, `SearchQueriesTab`, `RawUmamiTab`, `ContactUsTab`, `OtherTab`.

---

## Source attribution (read carefully)

Signups are attributed with a **first-touch** model. A signup's source is resolved in priority
order, then mapped to a channel:

1. **First-touch cookie** carried on the SignUp event (`first_utm_*` / `first_referrer_url`,
   written by the website from its `mb_utm_data` cookie).
2. **`session_any_source`**: the earliest source-bearing event of the converting session (any
   event type), skipping sourceless events and auth-callback / internal referrers. This recovers
   the real source when it sits on a later pageview or a custom event, not the first pageview.
3. **First pageview** of the converting session (last-resort fallback).

A signup is **"Direct"** only when none of the above carries a usable source.

**Channel mapping (`SOURCE_CASE_SQL` in `server/index.js`).** The resolved `utm_source` /
`utm_medium` / `referrer_domain` map to a channel:

- **LinkedIn / YouTube**: `utm_source`, `utm_medium`, or the platform's referrer domains.
- **Google Ads**: `utm_source=google` (paid: cpc / demand_gen), checked **before** organic so a
  paid click stays paid even when its referrer is `google.com`.
- **Google**: organic search referrers (`google.com` and country variants, `search.google.com`,
  Android quick-search), with no `utm_source=google`.
- **Other**: everything else. The `/api/other` drill-down sub-labels it (Direct, Brevo / Email,
  Google OAuth callback, AI chat, Other search engine, No entry pageview, and so on).

**Channel tabs reconcile with the Overview.** Each channel tab classifies sessions with the same
resolution (`classified_sessions`) and FULL OUTER joins redirects to conversions, so a tab's
conversion total equals the Overview's count for that channel. Page-less signups fold into a
single `(no entry page)` row.

> The `/api/brevo` email funnel still matches the landing URL to the campaign `full_link`
> byte-for-byte (in the scraper's `f_brevo_funnel`), so it can drop clicks when query params
> differ. The raw `/api/umami-raw` endpoint never loses events. See
> [`../ANALYTICS_MASTER_FLOW.md`](../ANALYTICS_MASTER_FLOW.md).

---

## Setup

```bash
npm install
cp .env.example .env   # point at the SAME Postgres the scraper writes to
npm start              # runs Vite UI + Express API concurrently
```

### Environment variables (`.env`)

> `DB_*` must point at the **`analytics` warehouse** (`db=analytics`, port `5432`) — the *same*
> database the scraper writes to. This repo never connects to the upstream `umami` source DB;
> that's the scraper's job. See
> [`../ANALYTICS_MASTER_FLOW.md`](../ANALYTICS_MASTER_FLOW.md#0-two-databases-one-warehouse-read-this-first).

| Var | Purpose |
|-----|---------|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | **`analytics` warehouse** connection (required) |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `dev` / `production` (serves built UI in production) |

### Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Vite dev server + Express API together (`concurrently`) |
| `npm run dev` | Vite UI only |
| `npm run server` | Express API only |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
