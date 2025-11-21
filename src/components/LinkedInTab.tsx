import type { Row } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { PerformanceTable } from '../shared/components/PerformanceTable'
import { ErrorCard } from '../shared/components/ErrorCard'
import { usePerformanceMetrics } from '../shared/hooks/usePerformanceMetrics'
import { formatPercentage } from '../shared/utils/formatters'

type LinkedInTabProps = {
  start: Date
  end: Date
  rows: Row[]
  loading: boolean
  error: string | null
}

export function LinkedInTab({ start, end, rows, loading, error }: LinkedInTabProps) {
  const totals = usePerformanceMetrics(rows)

  return (
    <>
      <div className="sectionTitle">📱 LinkedIn Content</div>
      {error && <ErrorCard message={error} />}
      <p className="muted">Data for {start.toLocaleDateString()} - {end.toLocaleDateString()}</p>
      
      <div className="page-content">
        <div className="cards">
          <StatsCard title="Total Posts" value={rows.length} loading={loading} />
          <StatsCard title="Total Redirects" value={totals.redirects} loading={loading} />
          <StatsCard title="Total Conversions" value={totals.conversions} loading={loading} />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'} 
            loading={loading} 
          />
        </div>
        
        <PerformanceTable rows={rows} totals={totals} loading={loading} colName="Post" />
      </div>
    </>
  )
}

