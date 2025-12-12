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

export type TabType = 'overview' | 'linkedin' | 'youtube' | 'google' | 'brevo' | 'search-queries' | 'yt-search-ranking'
