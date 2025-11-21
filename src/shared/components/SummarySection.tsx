import type { CalculatedTotals, Row } from '../types'
import { formatPercentage } from '../utils/formatters'

type SummarySectionProps = {
  title: string
  rows: Row[]
  totals: CalculatedTotals
  loading?: boolean
  itemLabel?: string
}

export function SummarySection({ title, rows, totals, loading = false, itemLabel = 'Items' }: SummarySectionProps) {
  return (
    <div className="summary-section">
      <h3>{title}</h3>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}><i>Loading...</i></div>
      ) : (
        <div className="summary-grid">
          <div className="summary-item">
            <div className="label">Total {itemLabel}</div>
            <div className="value">{rows.length}</div>
          </div>
          <div className="summary-item">
            <div className="label">Total Redirects</div>
            <div className="value">{totals.redirects}</div>
          </div>
          <div className="summary-item">
            <div className="label">Total Conversions</div>
            <div className="value">{totals.conversions}</div>
          </div>
          <div className="summary-item">
            <div className="label">Conversion Rate</div>
            <div className="value">
              {totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

