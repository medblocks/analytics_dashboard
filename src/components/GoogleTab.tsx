import type { Row } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { PerformanceTable } from '../shared/components/PerformanceTable'
import { ErrorCard } from '../shared/components/ErrorCard'
import { usePerformanceMetrics } from '../shared/hooks/usePerformanceMetrics'
import { formatPercentage } from '../shared/utils/formatters'

type GoogleTabProps = {
  start: Date
  end: Date
  rows: Row[]
  loading: boolean
  error: string | null
}

export function GoogleTab({ start, end, rows, loading, error }: GoogleTabProps) {
  const totals = usePerformanceMetrics(rows)

  return (
    <>
      <div className="sectionTitle">🔍 Google Search</div>
      {error && <ErrorCard message={error} />}
      <p className="muted">Data for {start.toLocaleDateString()} - {end.toLocaleDateString()}</p>
      
      <div className="page-content">
        <div className="cards">
          <StatsCard title="Total Pages" value={rows.length} loading={loading} />
          <StatsCard title="Total Redirects" value={totals.redirects} loading={loading} />
          <StatsCard title="Total Conversions" value={totals.conversions} loading={loading} />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'} 
            loading={loading} 
          />
        </div>
        
        <PerformanceTable rows={rows} totals={totals} loading={loading} colName="URL Path" />
      </div>
    </>
  )
}

