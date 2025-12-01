import type { Totals, TotalUsers, Row } from '../shared/types'
import { PrimaryCard } from '../shared/components/PrimaryCard'
import { StatsCard } from '../shared/components/StatsCard'
import { ErrorCard } from '../shared/components/ErrorCard'
import { UserGrowthChart } from './UserGrowthChart'

type OverviewTabProps = {
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
  userGrowthData?: any[]
  prevTotals?: Totals | null
}

export function OverviewTab({
  totals,
  totalsLoading,
  totalUsers,
  totalUsersLoading,
  error,
  userGrowthData,
  prevTotals
}: OverviewTabProps) {

  const getTrend = (current?: number, prev?: number) => {
    if (prev === undefined || current === undefined) return undefined;
    if (prev === 0) {
      return {
        direction: (current > 0 ? 'up' : 'neutral') as 'up' | 'neutral',
        value: undefined
      };
    }
    const diff = current - prev;
    const pct = (diff / prev) * 100;
    return {
      direction: (diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      value: `${Math.abs(pct).toFixed(1)}%`
    };
  };

  const userTrend = getTrend(totals?.totalUsers, prevTotals?.totalUsers);
  const liTrend = getTrend(totals?.linkedinViews, prevTotals?.linkedinViews);
  const ytTrend = getTrend(totals?.youtubeViews, prevTotals?.youtubeViews);
  const googleTrend = getTrend(totals?.googleViews, prevTotals?.googleViews);

  return (
    <>
      {/* Primary Total Users Box */}
      <div style={{ marginBottom: '32px' }}>
        <PrimaryCard 
            title="Total Users (All Time)" 
            value={totalUsers?.totalUsers ?? '—'} 
            loading={totalUsersLoading} 
        />
        
      </div>

      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <h3 className="sectionTitle" style={{ fontSize: '18px', marginBottom: '20px' }}>Performance Overview</h3>
        <div className="cards">
          <StatsCard 
            title="Total Users" 
            value={totals?.totalUsers ?? '-'} 
            loading={totalsLoading}
            trend={userTrend?.direction}
            trendValue={userTrend?.value}
            prevValue={prevTotals?.totalUsers}
          />
          <StatsCard 
            title="LinkedIn Views" 
            value={totals?.linkedinViews ?? '-'} 
            loading={totalsLoading}
            trend={liTrend?.direction}
            trendValue={liTrend?.value}
            prevValue={prevTotals?.linkedinViews}
          />
          <StatsCard 
            title="YouTube Views" 
            value={totals?.youtubeViews ?? '-'} 
            loading={totalsLoading}
            trend={ytTrend?.direction}
            trendValue={ytTrend?.value}
            prevValue={prevTotals?.youtubeViews}
          />
          <StatsCard 
            title="Google Views" 
            value={totals?.googleViews ?? '-'} 
            loading={totalsLoading}
            trend={googleTrend?.direction}
            trendValue={googleTrend?.value}
            prevValue={prevTotals?.googleViews}
          />
        </div>
      </div>

      {/* User Growth Chart */}
      {userGrowthData && (
          <UserGrowthChart data={userGrowthData} loading={totalUsersLoading} />
      )}
    </>
  )
}
