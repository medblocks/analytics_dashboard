import type { ContactUsData } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { ErrorCard } from '../shared/components/ErrorCard'

type ContactUsTabProps = {
  data: ContactUsData | null
  loading: boolean
  error: string | null
}

export function ContactUsTab({ data, loading, error }: ContactUsTabProps) {
  const summary = data?.summary || {
    page_visits: 0,
    form_submissions: 0,
    conversion_rate: 0
  }

  const prevSummary = data?.prevSummary || {
    page_visits: 0,
    form_submissions: 0,
    conversion_rate: 0
  }

  const formatNumber = (num: number) => num.toLocaleString()
  const formatPercent = (num: number) => num.toFixed(2) + '%'

  const getTrend = (current: number, prev: number): 'up' | 'down' | 'neutral' => {
    if (current > prev) return 'up'
    if (current < prev) return 'down'
    return 'neutral'
  }

  const getTrendValue = (current: number, prev: number): string => {
    if (prev === 0) return current > 0 ? '+100%' : '0%'
    const change = ((current - prev) / prev) * 100
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
  }

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        {/* Summary Cards */}
        <div className="cards">
          <StatsCard 
            title="Page Visits" 
            value={formatNumber(summary.page_visits)} 
            loading={loading}
            prevValue={formatNumber(prevSummary.page_visits)}
            trend={getTrend(summary.page_visits, prevSummary.page_visits)}
            trendValue={getTrendValue(summary.page_visits, prevSummary.page_visits)}
          />
          <StatsCard 
            title="Form Submissions" 
            value={formatNumber(summary.form_submissions)} 
            loading={loading}
            prevValue={formatNumber(prevSummary.form_submissions)}
            trend={getTrend(summary.form_submissions, prevSummary.form_submissions)}
            trendValue={getTrendValue(summary.form_submissions, prevSummary.form_submissions)}
          />
          <StatsCard 
            title="Conversion Rate" 
            value={formatPercent(summary.conversion_rate)} 
            loading={loading}
            prevValue={formatPercent(prevSummary.conversion_rate)}
            trend={getTrend(summary.conversion_rate, prevSummary.conversion_rate)}
            trendValue={getTrendValue(summary.conversion_rate, prevSummary.conversion_rate)}
          />
        </div>

        {/* Recent Events Table */}
        <div className="table-wrapper" style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Recent Events</h3>
          {loading ? (
            <div className="table-loading">Loading data...</div>
          ) : (
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>URL Path</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentEvents?.filter(e => e.event_name === 'contact-page-visit').length ? (
                  data.recentEvents
                    .filter(event => event.event_name === 'contact-page-visit')
                    .map((event, idx) => (
                      <tr key={idx}>
                        <td className="time-cell">
                          {new Date(event.created_at).toLocaleString()}
                        </td>
                        <td className="path-cell" title={event.url_path || ''}>{event.url_path || '-'}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={2} className="no-data">No page visits recorded in this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

