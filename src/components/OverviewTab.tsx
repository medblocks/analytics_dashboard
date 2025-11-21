import type { Totals, TotalUsers, Row } from '../shared/types'
import { PrimaryCard } from '../shared/components/PrimaryCard'
import { StatsCard } from '../shared/components/StatsCard'
import { SummarySection } from '../shared/components/SummarySection'
import { ErrorCard } from '../shared/components/ErrorCard'
import { usePerformanceMetrics } from '../shared/hooks/usePerformanceMetrics'

type OverviewTabProps = {
  start: Date
  end: Date
  totals: Totals | null
  totalsLoading: boolean
  totalUsers: TotalUsers | null
  totalUsersLoading: boolean
  liRows: Row[]
  liLoading: boolean
  ytRows: Row[]
  ytLoading: boolean
  googleRows: Row[]
  googleLoading: boolean
  brevoRows: Row[]
  brevoLoading: boolean
  error: string | null
}

export function OverviewTab({
  start,
  end,
  totals,
  totalsLoading,
  totalUsers,
  totalUsersLoading,
  liRows,
  liLoading,
  ytRows,
  ytLoading,
  googleRows,
  googleLoading,
  brevoRows,
  brevoLoading,
  error
}: OverviewTabProps) {
  const liTotals = usePerformanceMetrics(liRows)
  const ytTotals = usePerformanceMetrics(ytRows)
  const googleTotals = usePerformanceMetrics(googleRows)
  const brevoTotals = usePerformanceMetrics(brevoRows)

  return (
    <>
      {/* Primary Total Users Box */}
      <PrimaryCard 
        title="Total Users (All Time)" 
        value={totalUsers?.totalUsers ?? '—'} 
        loading={totalUsersLoading} 
      />

      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <h2 style={{ color: '#1a202c', marginBottom: '24px', textAlign: 'center' }}>
          Statistics for {start.toLocaleDateString()} - {end.toLocaleDateString()}
        </h2>
        <div className="cards">
          <StatsCard title="Total Users" value={totals?.totalUsers ?? '-'} loading={totalsLoading} />
          <StatsCard title="LinkedIn Views" value={totals?.linkedinViews ?? '-'} loading={totalsLoading} />
          <StatsCard title="YouTube Views" value={totals?.youtubeViews ?? '-'} loading={totalsLoading} />
          <StatsCard title="Google Views" value={totals?.googleViews ?? '-'} loading={totalsLoading} />
        </div>
      </div>

      <SummarySection title="📱 LinkedIn Performance" rows={liRows} totals={liTotals} loading={liLoading} itemLabel="Posts" />
      <SummarySection title="🎥 YouTube Performance" rows={ytRows} totals={ytTotals} loading={ytLoading} itemLabel="Videos" />
      <SummarySection title="🔍 Google Search Performance" rows={googleRows} totals={googleTotals} loading={googleLoading} itemLabel="Pages" />
      <SummarySection title="📧 Brevo Email Performance (All Time)" rows={brevoRows} totals={brevoTotals} loading={brevoLoading} itemLabel="Campaigns" />
    </>
  )
}

