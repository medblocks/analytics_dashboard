import type { OtherRow } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { ErrorCard } from '../shared/components/ErrorCard'
import { ExpandableText } from '../shared/components/ExpandableText'

type OtherTabProps = {
  rows: OtherRow[]
  prevRows?: OtherRow[]
  loading: boolean
  error: string | null
}

const SUB_SOURCE_ORDER = [
  'Direct',
  'Brevo / Email',
  'Google OAuth callback',
  'Other search engine',
  'AI chat',
  'Internal',
  'No entry pageview',
]

function rankSubSource(s: string): number {
  const i = SUB_SOURCE_ORDER.indexOf(s)
  return i === -1 ? SUB_SOURCE_ORDER.length : i
}

export function OtherTab({ rows, prevRows = [], loading, error }: OtherTabProps) {
  const totals = rows.reduce((sum, r) => sum + r.user_converted, 0)
  const prevTotals = prevRows.reduce((sum, r) => sum + r.user_converted, 0)

  // Group conversions by sub_source for the summary cards.
  const bySubSource = new Map<string, number>()
  for (const r of rows) {
    bySubSource.set(r.sub_source, (bySubSource.get(r.sub_source) ?? 0) + r.user_converted)
  }
  const subSourceCards = [...bySubSource.entries()]
    .sort((a, b) => rankSubSource(a[0]) - rankSubSource(b[0]) || b[1] - a[1])

  const sortedRows = [...rows].sort((a, b) => {
    if (b.user_converted !== a.user_converted) return b.user_converted - a.user_converted
    return rankSubSource(a.sub_source) - rankSubSource(b.sub_source)
  })

  const trend = (() => {
    if (prevTotals === 0) return undefined
    const diff = totals - prevTotals
    const pct = (diff / prevTotals) * 100
    return {
      direction: (diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      value: `${Math.abs(pct).toFixed(1)}%`,
    }
  })()

  return (
    <>
      {error && <ErrorCard message={error} />}

      <div className="page-content">
        <div className="raw-tab-notice">
          <strong>Other Conversions:</strong> signups whose converting session's first
          pageview wasn't classified as LinkedIn, YouTube, or Google search. Sub-source
          column labels the kind (Direct, Brevo email, Google OAuth callback, etc.).
        </div>

        <div className="cards">
          <StatsCard
            title="Total Other Conversions"
            value={totals}
            loading={loading}
            prevValue={prevTotals}
            trend={trend?.direction}
            trendValue={trend?.value}
          />
          {subSourceCards.map(([label, count]) => (
            <StatsCard key={label} title={label} value={count} loading={loading} />
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Landing Page</th>
                  <th>Sub-source</th>
                  <th>Conversions</th>
                  <th>Referrer</th>
                  <th>UTM Source</th>
                  <th>UTM Campaign</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, idx) => (
                  <tr key={`other-${idx}-${r.post}-${r.sub_source}`}>
                    <td><ExpandableText text={r.post} maxLength={50} /></td>
                    <td>{r.sub_source}</td>
                    <td>{r.user_converted}</td>
                    <td>{r.referrer_domain}</td>
                    <td>{r.utm_source}</td>
                    <td>{r.utm_campaign}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  <td>-</td>
                  <td><strong>{totals}</strong></td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
