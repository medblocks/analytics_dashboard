export interface Totals {
  totalUsers: number
  linkedinConversions: number
  youtubeConversions: number
  googleConversions: number
  otherConversions: number
  prevTotalUsers?: number
  prevLinkedinConversions?: number
  prevYoutubeConversions?: number
  prevGoogleConversions?: number
  prevOtherConversions?: number
}

export interface TotalUsers {
  totalUsers: number
}

export interface Row {
  post: string
  redirect_count: number
  user_converted: number
  queries?: string[]
}

// Extended Row with content_id (for LinkedIn Raw tab)
export interface LinkedInRawRow extends Row {
  content_id: string | null
}

// Extended Row with YouTube video info (for YouTube Raw tab)
export interface YouTubeRawRow extends Row {
  videoId: string | null
  videoTitle: string | null
  channelTitle: string | null
  ytViewCount: number | null
  ytLikeCount: number | null
  ytCommentCount: number | null
  thumbnailUrl: string | null
}

// Paid YouTube Ads row (utm_medium=cpc/paid_video) for YouTube Raw tab.
// These come from Google Ads campaigns running on YouTube and use numeric campaign
// IDs in utm_campaign — not real video IDs. Surfaced separately so they don't
// pollute organic-video performance.
export interface YouTubeRawPaidRow {
  post: string
  utm_campaign: string | null
  redirect_count: number
  user_converted: number
}

export interface QueryRow {
  query: string
  redirect_count: number
  user_converted: number
  url_paths: string[]
}

export interface YTRankingPosition {
  position: number;
  channel_name?: string | null;
  video_id: string | null;
  video_title: string;
  result_type?: string;
}

export interface YTRankingRow {
  keyword: string;
  fetchDate: string;
  topThree: YTRankingPosition[];
  sidharthVideos: YTRankingPosition[];
  watchTimeHours?: number;
  averageViewDuration?: string;
}

// API response types (snake_case from backend)
export interface YTRankingApiResponse {
  keyword: string;
  fetch_date: string;
  watch_time_hours: number;
  average_view_duration: string;
  top_3: YTRankingPosition[];
  sidharth_videos: YTRankingPosition[];
}

export interface CalculatedTotals {
  redirects: number
  conversions: number
}

// Raw Umami Analytics Types
export interface UmamiSourceRow {
  source: string
  event_count: number
  unique_sessions: number
  conversions: number
}

export interface UmamiReferrerRow {
  referrer: string
  event_count: number
  unique_sessions: number
  conversions: number
}

export interface UmamiPathRow {
  path: string
  event_count: number
  unique_sessions: number
  conversions: number
}

export interface UmamiEventRow {
  url_path: string
  url_query: string | null
  referrer_domain: string | null
  event_type: number
  session_id: string
  created_at: string
}

export interface UmamiSummary {
  total_events: number
  unique_sessions: number
  total_conversions: number
  unique_paths: number
  unique_referrers: number
}

export interface UmamiRawData {
  summary: UmamiSummary
  bySource: UmamiSourceRow[]
  byReferrer: UmamiReferrerRow[]
  byPath: UmamiPathRow[]
  topEvents: UmamiEventRow[]
}

export type TabType = 'overview' | 'google' | 'other' | 'brevo' | 'search-queries' | 'yt-search-ranking' | 'raw-umami' | 'linkedin-raw' | 'youtube-raw' | 'contact-us'

// Row in the Other tab: signups not attributed to LinkedIn/YouTube/Google.
// sub_source labels the kind (Direct / Brevo / OAuth callback / Bing / etc.).
export interface OtherRow {
  post: string
  sub_source: string
  user_converted: number
  referrer_domain: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
}

// Contact Us Analytics Types
export interface ContactUsData {
  summary: {
    page_visits: number
    form_submissions: number
    conversion_rate: number
  }
  prevSummary: {
    page_visits: number
    form_submissions: number
    conversion_rate: number
  }
  recentEvents: ContactUsEvent[]
}

export interface ContactUsEvent {
  event_name: string
  session_id: string
  created_at: string
  url_path: string | null
}
