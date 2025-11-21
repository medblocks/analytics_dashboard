import type { Row, CalculatedTotals } from '../types'
import { ExpandableText } from './ExpandableText'
import { formatPercentage } from '../utils/formatters'

type PerformanceTableProps = {
  rows: Row[]
  totals: CalculatedTotals
  loading?: boolean
  colName: string
}

export function PerformanceTable({ rows, totals, loading = false, colName }: PerformanceTableProps) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>{colName}</th>
            <th>Redirects</th>
            <th>Conversions</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${colName}-${r.post}`}>
              <td><ExpandableText text={r.post} maxLength={60} /></td>
              <td>{r.redirect_count}</td>
              <td>{r.user_converted}</td>
              <td>{r.redirect_count > 0 ? formatPercentage((r.user_converted / r.redirect_count) * 100) : '0%'}</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td><strong>Total</strong></td>
            <td><strong>{totals.redirects}</strong></td>
            <td><strong>{totals.conversions}</strong></td>
            <td><strong>{totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

