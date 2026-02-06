import type { LinkedInRawRow } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { ErrorCard } from '../shared/components/ErrorCard'
import { usePerformanceMetrics } from '../shared/hooks/usePerformanceMetrics'
import { formatPercentage } from '../shared/utils/formatters'
import { ExpandableText } from '../shared/components/ExpandableText'

type LinkedInRawTabProps = {
  start: Date
  end: Date
  rows: LinkedInRawRow[]
  prevRows?: LinkedInRawRow[]
  loading: boolean
  error: string | null
}

export function LinkedInRawTab({ rows, prevRows = [], loading, error }: LinkedInRawTabProps) {
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

  const urlsTrend = getTrend(rows.length, prevRows.length);
  const redirectsTrend = getTrend(totals.redirects, prevTotals.redirects);
  const conversionsTrend = getTrend(totals.conversions, prevTotals.conversions);
  const conversionRate = totals.redirects > 0 ? (totals.conversions / totals.redirects) * 100 : 0;
  const prevConversionRate = prevTotals.redirects > 0 ? (prevTotals.conversions / prevTotals.redirects) * 100 : 0;
  const conversionRateTrend = getTrend(conversionRate, prevConversionRate);

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div className="raw-tab-notice">
          <strong>Raw Data:</strong> Shows LinkedIn traffic mapped to Directus content URLs (no post title mapping required)
        </div>
        
        <div className="cards">
          <StatsCard 
            title="Total URLs" 
            value={rows.length} 
            loading={loading}
            prevValue={prevRows.length}
            trend={urlsTrend.direction}
            trendValue={urlsTrend.value}
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
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>URL / Content</th>
                  <th>Content ID</th>
                  <th>Redirects</th>
                  <th>Conversions</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`linkedin-raw-${r.post}`}>
                    <td><ExpandableText text={r.post} maxLength={60} /></td>
                    <td>{r.content_id || '-'}</td>
                    <td>{r.redirect_count}</td>
                    <td>{r.user_converted}</td>
                    <td>{r.redirect_count > 0 ? formatPercentage((r.user_converted / r.redirect_count) * 100) : '0%'}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  <td></td>
                  <td><strong>{totals.redirects}</strong></td>
                  <td><strong>{totals.conversions}</strong></td>
                  <td><strong>{totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
