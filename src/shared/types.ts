export interface Totals {
  totalUsers: number
  linkedinViews: number
  youtubeViews: number
  googleViews: number
  other: number
}

export interface TotalUsers {
  totalUsers: number
}

export interface Row {
  post: string
  redirect_count: number
  user_converted: number
}

export interface CalculatedTotals {
  redirects: number
  conversions: number
}

export type TabType = 'overview' | 'linkedin' | 'youtube' | 'google' | 'brevo'
