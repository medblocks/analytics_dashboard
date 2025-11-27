import type { Row, CalculatedTotals } from '../types'
import { ExpandableText } from './ExpandableText'
import { formatPercentage } from '../utils/formatters'

type GooglePerformanceTableProps = {
  rows: Row[]
  totals: CalculatedTotals
  loading?: boolean
}

export function GooglePerformanceTable({ rows, totals, loading = false }: GooglePerformanceTableProps) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
  }
  console.log("Rows", rows);

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>URL Path</th>
            <th>Redirects</th>
            <th>Conversions</th>
            <th>Rate</th>
            <th>Top 5 Queries</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`google-${r.post}`}>
              <td><ExpandableText text={r.post} maxLength={60} /></td>
              <td>{r.redirect_count}</td>
              <td>{r.user_converted}</td>
              <td>{r.redirect_count > 0 ? formatPercentage((r.user_converted / r.redirect_count) * 100) : '0%'}</td>
              <td>
                {r.queries && r.queries.length > 0 ? (
                  <div className="queries-container">
                    {r.queries.map((query, idx) => (
                      <span key={`${r.post}-query-${idx}`} className="query-chip">
                        {query}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="no-queries">No queries</span>
                )}
              </td>
            </tr>
          ))}
          <tr className="totals-row">
            <td><strong>Total</strong></td>
            <td><strong>{totals.redirects}</strong></td>
            <td><strong>{totals.conversions}</strong></td>
            <td><strong>{totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

