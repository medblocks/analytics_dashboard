import { useState } from 'react'
import type { UmamiRawData } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { ErrorCard } from '../shared/components/ErrorCard'

type RawUmamiTabProps = {
  data: UmamiRawData | null
  loading: boolean
  error: string | null
}

type SubTab = 'sources' | 'referrers' | 'paths' | 'events'

export function RawUmamiTab({ data, loading, error }: RawUmamiTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('sources')

  const summary = data?.summary || {
    total_events: 0,
    unique_sessions: 0,
    total_conversions: 0,
    unique_paths: 0,
    unique_referrers: 0
  }

  const formatNumber = (num: number) => num.toLocaleString()

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        {/* Summary Cards */}
        <div className="cards">
          <StatsCard 
            title="Total Events" 
            value={summary.total_events} 
            loading={loading}
          />
          <StatsCard 
            title="Unique Sessions" 
            value={summary.unique_sessions} 
            loading={loading}
          />
          <StatsCard 
            title="Conversions" 
            value={summary.total_conversions} 
            loading={loading}
          />
          <StatsCard 
            title="Unique Paths" 
            value={summary.unique_paths} 
            loading={loading}
          />
          <StatsCard 
            title="Unique Referrers" 
            value={summary.unique_referrers} 
            loading={loading}
          />
        </div>

        {/* Sub-tabs for different views */}
        <div className="sub-tabs">
          <button 
            className={`sub-tab ${activeSubTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('sources')}
          >
            By Source
          </button>
          <button 
            className={`sub-tab ${activeSubTab === 'referrers' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('referrers')}
          >
            By Referrer
          </button>
          <button 
            className={`sub-tab ${activeSubTab === 'paths' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('paths')}
          >
            By Path
          </button>
          <button 
            className={`sub-tab ${activeSubTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('events')}
          >
            Recent Events
          </button>
        </div>

        {/* Data Tables */}
        <div className="table-wrapper">
          {loading ? (
            <div className="table-loading">Loading data...</div>
          ) : (
            <>
              {/* By Source Table */}
              {activeSubTab === 'sources' && (
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Events</th>
                      <th>Sessions</th>
                      <th>Conversions</th>
                      <th>Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.bySource?.map((row, idx) => (
                      <tr key={idx}>
                        <td className="source-cell">{row.source}</td>
                        <td>{formatNumber(row.event_count)}</td>
                        <td>{formatNumber(row.unique_sessions)}</td>
                        <td>{row.conversions}</td>
                        <td>
                          {row.unique_sessions > 0 
                            ? ((row.conversions / row.unique_sessions) * 100).toFixed(2) + '%'
                            : '0%'
                          }
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={5} className="no-data">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* By Referrer Table */}
              {activeSubTab === 'referrers' && (
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>Referrer Domain</th>
                      <th>Events</th>
                      <th>Sessions</th>
                      <th>Conversions</th>
                      <th>Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.byReferrer?.map((row, idx) => (
                      <tr key={idx}>
                        <td className="referrer-cell">{row.referrer}</td>
                        <td>{formatNumber(row.event_count)}</td>
                        <td>{formatNumber(row.unique_sessions)}</td>
                        <td>{row.conversions}</td>
                        <td>
                          {row.unique_sessions > 0 
                            ? ((row.conversions / row.unique_sessions) * 100).toFixed(2) + '%'
                            : '0%'
                          }
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={5} className="no-data">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* By Path Table */}
              {activeSubTab === 'paths' && (
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>URL Path</th>
                      <th>Events</th>
                      <th>Sessions</th>
                      <th>Conversions</th>
                      <th>Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.byPath?.map((row, idx) => (
                      <tr key={idx}>
                        <td className="path-cell" title={row.path}>{row.path}</td>
                        <td>{formatNumber(row.event_count)}</td>
                        <td>{formatNumber(row.unique_sessions)}</td>
                        <td>{row.conversions}</td>
                        <td>
                          {row.unique_sessions > 0 
                            ? ((row.conversions / row.unique_sessions) * 100).toFixed(2) + '%'
                            : '0%'
                          }
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={5} className="no-data">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* Recent Events Table */}
              {activeSubTab === 'events' && (
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Path</th>
                      <th>Query</th>
                      <th>Referrer</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topEvents?.map((row, idx) => (
                      <tr key={idx}>
                        <td className="time-cell">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="path-cell" title={row.url_path}>{row.url_path}</td>
                        <td className="query-cell" title={row.url_query || ''}>
                          {row.url_query ? (
                            <span className="query-params">
                              {row.url_query.length > 50 
                                ? row.url_query.substring(0, 50) + '...' 
                                : row.url_query
                              }
                            </span>
                          ) : (
                            <span className="no-query">-</span>
                          )}
                        </td>
                        <td className="referrer-cell">{row.referrer_domain || 'direct'}</td>
                        <td>
                          <span className={`event-type ${row.event_type === 2 ? 'conversion' : 'pageview'}`}>
                            {row.event_type === 2 ? 'Conversion' : 'Pageview'}
                          </span>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={5} className="no-data">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
