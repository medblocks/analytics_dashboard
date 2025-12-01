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

export interface CalculatedTotals {
  redirects: number
  conversions: number
}

export type TabType = 'overview' | 'linkedin' | 'youtube' | 'google' | 'brevo' | 'search-queries'
