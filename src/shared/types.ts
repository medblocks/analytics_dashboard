export interface Totals {
  totalUsers: number
  linkedinViews: number
  youtubeViews: number
  googleViews: number
  other: number
  prevTotalUsers?: number
  prevLinkedinViews?: number
  prevYoutubeViews?: number
  prevGoogleViews?: number
  prevOther?: number
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

export type TabType = 'overview' | 'linkedin' | 'youtube' | 'google' | 'brevo' | 'search-queries' | 'yt-search-ranking' | 'raw-umami' | 'linkedin-raw' | 'youtube-raw'
