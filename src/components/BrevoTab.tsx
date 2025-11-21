import type { Row } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { PerformanceTable } from '../shared/components/PerformanceTable'
import { ErrorCard } from '../shared/components/ErrorCard'
import { usePerformanceMetrics } from '../shared/hooks/usePerformanceMetrics'
import { formatPercentage } from '../shared/utils/formatters'

type BrevoTabProps = {
  rows: Row[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function BrevoTab({ rows, loading, error, onRefresh }: BrevoTabProps) {
  const totals = usePerformanceMetrics(rows)

  return (
    <>
      <div className="sectionTitle">📧 Brevo Email Campaigns</div>
      <div className="note-card">
        <strong>Note:</strong> Brevo data is not filtered by date range and shows all-time campaign statistics.
      </div>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div className="cards">
          <StatsCard title="Total Campaigns" value={rows.length} loading={loading} />
          <StatsCard title="Total Redirects" value={totals.redirects} loading={loading} />
          <StatsCard title="Total Conversions" value={totals.conversions} loading={loading} />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'} 
            loading={loading} 
          />
        </div>
        
        <PerformanceTable rows={rows} totals={totals} loading={loading} colName="Campaign" />
        
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="btn" onClick={onRefresh}>Refresh Data</button>
        </div>
      </div>
    </>
  )
}

