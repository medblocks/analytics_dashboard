import { useState } from 'react'
import type { QueryRow, CalculatedTotals } from '../types'
import { ExpandableText } from './ExpandableText'
import { formatPercentage } from '../utils/formatters'

type SearchQueriesTableProps = {
  rows: QueryRow[]
  totals: CalculatedTotals
  loading?: boolean
}

export function SearchQueriesTable({ rows, totals, loading = false }: SearchQueriesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (query: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(query)) {
        next.delete(query)
      } else {
        next.add(query)
      }
      return next
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Search Query</th>
            <th>Redirects</th>
            <th>Conversions</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isExpanded = expandedRows.has(r.query)
            return (
              <>
                <tr 
                  key={`query-${r.query}`}
                  onClick={() => toggleRow(r.query)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span style={{ marginRight: '8px' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <ExpandableText text={r.query} maxLength={60} />
                  </td>
                  <td>{r.redirect_count}</td>
                  <td>{r.user_converted}</td>
                  <td>{r.redirect_count > 0 ? formatPercentage((r.user_converted / r.redirect_count) * 100) : '0%'}</td>
                </tr>
                {isExpanded && (
                  <tr key={`query-${r.query}-expanded`}>
                    <td colSpan={4} style={{ backgroundColor: '#f5f5f5', padding: '12px' }}>
                      <div style={{ marginLeft: '24px' }}>
                        <strong>URL Paths ({r.url_paths.length}):</strong>
                        {r.url_paths && r.url_paths.length > 0 ? (
                          <div className="queries-container" style={{ marginTop: '8px' }}>
                            {r.url_paths.map((path, idx) => (
                              <span key={`${r.query}-path-${idx}`} className="query-chip">
                                {path}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="no-queries"> No paths</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
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

