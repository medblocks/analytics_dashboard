import type { Row } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { GooglePerformanceTable } from '../shared/components/GooglePerformanceTable'
import { ErrorCard } from '../shared/components/ErrorCard'
import { usePerformanceMetrics } from '../shared/hooks/usePerformanceMetrics'
import { formatPercentage } from '../shared/utils/formatters'

type GoogleTabProps = {
  start: Date
  end: Date
  rows: Row[]
  prevRows?: Row[]
  loading: boolean
  error: string | null
}

export function GoogleTab({ rows, prevRows = [], loading, error }: GoogleTabProps) {
  const totals = usePerformanceMetrics(rows)
  const prevTotals = usePerformanceMetrics(prevRows)

  const getTrend = (current: number, prev: number) => {
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

  const pagesTrend = getTrend(rows.length, prevRows.length);
  const redirectsTrend = getTrend(totals.redirects, prevTotals.redirects);
  const conversionsTrend = getTrend(totals.conversions, prevTotals.conversions);
  const conversionRate = totals.redirects > 0 ? (totals.conversions / totals.redirects) * 100 : 0;
  const prevConversionRate = prevTotals.redirects > 0 ? (prevTotals.conversions / prevTotals.redirects) * 100 : 0;
  const conversionRateTrend = getTrend(conversionRate, prevConversionRate);

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div className="cards">
          <StatsCard 
            title="Total Pages" 
            value={rows.length} 
            loading={loading}
            prevValue={prevRows.length}
            trend={pagesTrend.direction}
            trendValue={pagesTrend.value}
          />
          <StatsCard 
            title="Total Redirects" 
            value={totals.redirects} 
            loading={loading}
            prevValue={prevTotals.redirects}
            trend={redirectsTrend.direction}
            trendValue={redirectsTrend.value}
          />
          <StatsCard 
            title="Total Conversions" 
            value={totals.conversions} 
            loading={loading}
            prevValue={prevTotals.conversions}
            trend={conversionsTrend.direction}
            trendValue={conversionsTrend.value}
          />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage(conversionRate) : '0%'} 
            loading={loading}
            prevValue={prevTotals.redirects > 0 ? formatPercentage(prevConversionRate) : '0%'}
            trend={conversionRateTrend.direction}
            trendValue={conversionRateTrend.value}
          />
        </div>
        
        <GooglePerformanceTable rows={rows} totals={totals} loading={loading} />
      </div>
    </>
  )
}
