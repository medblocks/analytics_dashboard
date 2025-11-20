import { useEffect, useMemo, useState } from 'react'
import './App.css'

// ExpandableText component for collapsible/expandable text fields
function ExpandableText({ text, maxLength = 50 }: { text: string; maxLength?: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const shouldTruncate = text.length > maxLength
  const displayText = shouldTruncate && !isExpanded ? text.slice(0, maxLength) + '...' : text
  
  if (!shouldTruncate) {
    return <span>{text}</span>
  }
  
  return (
    <div 
      className={`expandable-text ${isExpanded ? 'expanded' : 'collapsed'}`}
      onClick={() => setIsExpanded(!isExpanded)}
      title={isExpanded ? 'Click to collapse' : 'Click to expand'}
    >
      {displayText}
    </div>
  )
}

type Totals = {
  totalUsers: number
  linkedinViews: number
  youtubeViews: number
  googleViews: number
  other: number
}

type TotalUsers = {
  totalUsers: number
}

type Row = { post: string; redirect_count: number; user_converted: number }

function formatDateForParam(date: Date): string {
  return new Date(date).toISOString()
}

function useDateRange(): [Date, Date, (a: Date | string) => void, (b: Date | string) => void] {
  const now = new Date()
  const initialEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const initialStart = new Date(initialEnd)
  initialStart.setUTCDate(initialStart.getUTCDate() - 7)

  const [start, setStart] = useState<Date>(initialStart)
  const [end, setEnd] = useState<Date>(initialEnd)
  
  const setStartWithMidnight = (date: Date | string) => {
    const parsedDate = typeof date === 'string' ? new Date(date) : date
    if (isNaN(parsedDate.getTime())) return // Ignore invalid dates
    const newDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
    setStart(newDate)
  }
  
  const setEndWithMidnight = (date: Date | string) => {
    const parsedDate = typeof date === 'string' ? new Date(date) : date
    if (isNaN(parsedDate.getTime())) return // Ignore invalid dates
    const newDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
    setEnd(newDate)
  }
  
  return [start, end, setStartWithMidnight, setEndWithMidnight]
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function App() {
  const [start, end, setStart, setEnd] = useDateRange()
  const [totals, setTotals] = useState<Totals | null>(null)
  const [totalUsers, setTotalUsers] = useState<TotalUsers | null>(null)
  const [ytRows, setYtRows] = useState<Row[]>([])
  const [liRows, setLiRows] = useState<Row[]>([])
  const [googleRows, setGoogleRows] = useState<Row[]>([])
  const [brevoRows, setBrevoRows] = useState<Row[]>([])
  
  // Individual loading states for each data source
  const [totalsLoading, setTotalsLoading] = useState(false)
  const [totalUsersLoading, setTotalUsersLoading] = useState(false)
  const [ytLoading, setYtLoading] = useState(false)
  const [liLoading, setLiLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [brevoLoading, setBrevoLoading] = useState(false)
  
  const [error, setError] = useState<string | null>(null)
  const [brevoError, setBrevoError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'linkedin' | 'youtube' | 'google' | 'brevo'>('overview')

  const query = useMemo(
    () => `?start=${encodeURIComponent(formatDateForParam(start))}&end=${encodeURIComponent(formatDateForParam(end))}`,
    [start, end]
  )

  // Fetch total users (independent of date range)
  useEffect(() => {
    let mounted = true
    async function fetchTotalUsers() {
      setTotalUsersLoading(true)
      try {
        const result = await fetchJSON<TotalUsers>('/total-users')
        if (mounted) setTotalUsers(result)
      } catch (e) {
        console.error('Failed to fetch total users:', e)
      } finally {
        if (mounted) setTotalUsersLoading(false)
      }
    }
    fetchTotalUsers()
    return () => { mounted = false }
  }, [])

  // Fetch date-range specific data - each fetches independently and concurrently
  useEffect(() => {
    let mounted = true
    setError(null)
    
    // Fetch totals
    setTotalsLoading(true)
    fetchJSON<Totals>(`/totals${query}`)
      .then((t) => {
        if (mounted) setTotals(t)
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load totals'
        if (mounted) setError(message)
      })
      .finally(() => {
        if (mounted) setTotalsLoading(false)
      })
    
    // Fetch YouTube data
    setYtLoading(true)
    fetchJSON<Row[]>(`/youtube${query}`)
      .then((yt) => {
        if (mounted) setYtRows(yt)
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load YouTube data'
        if (mounted) setError(message)
      })
      .finally(() => {
        if (mounted) setYtLoading(false)
      })
    
    // Fetch LinkedIn data
    setLiLoading(true)
    fetchJSON<Row[]>(`/linkedin${query}`)
      .then((li) => {
        if (mounted) setLiRows(li)
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load LinkedIn data'
        if (mounted) setError(message)
      })
      .finally(() => {
        if (mounted) setLiLoading(false)
      })
    
    // Fetch Google data
    setGoogleLoading(true)
    fetchJSON<Row[]>(`/google${query}`)
      .then((google) => {
        if (mounted) setGoogleRows(google)
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load Google data'
        if (mounted) setError(message)
      })
      .finally(() => {
        if (mounted) setGoogleLoading(false)
      })
    
    return () => { mounted = false }
  }, [query])

  // Fetch Brevo (no date filters)
  useEffect(() => {
    let mounted = true
    async function run() {
      setBrevoLoading(true)
      setBrevoError(null)
      try {
        const rows = await fetchJSON<Row[]>(`/brevo`)
        if (!mounted) return
        setBrevoRows(rows)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load brevo'
        if (mounted) setBrevoError(message)
      } finally {
        if (mounted) setBrevoLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [])


  const liTotals = useMemo(() => {
    return liRows.reduce((acc, row) => ({
      redirects: acc.redirects + row.redirect_count,
      conversions: acc.conversions + row.user_converted
    }), { redirects: 0, conversions: 0 })
  }, [liRows])

  const ytTotals = useMemo(() => {
    return ytRows.reduce((acc, row) => ({
      redirects: acc.redirects + row.redirect_count,
      conversions: acc.conversions + row.user_converted
    }), { redirects: 0, conversions: 0 })
  }, [ytRows])

  const googleTotals = useMemo(() => {
    return googleRows.reduce((acc, row) => ({
      redirects: acc.redirects + row.redirect_count,
      conversions: acc.conversions + row.user_converted
    }), { redirects: 0, conversions: 0 })
  }, [googleRows])

  const brevoTotals = useMemo(() => {
    return brevoRows.reduce((acc, row) => ({
      redirects: acc.redirects + row.redirect_count,
      conversions: acc.conversions + row.user_converted
    }), { redirects: 0, conversions: 0 })
  }, [brevoRows])

  return (
    <div className="container">
      <div className="header">
        <h1>Analytics Dashboard</h1>
        
        {/* Date Filter Controls */}
        <div className="controls" style={{ display: activeTab !== 'brevo' ? 'flex' : 'none', marginBottom: '16px' }}>
          <label className="muted">Start</label>
          <input
            className="input"
            type="date"
            value={start.toISOString().slice(0,10)}
            onChange={(e) => setStart(e.target.value)}
          />
          <label className="muted">End</label>
          <input
            className="input"
            type="date"
            value={end.toISOString().slice(0,10)}
            onChange={(e) => setEnd(e.target.value)}
          />
          <button className="btn" onClick={() => setEnd(new Date(end))}>Refresh</button>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button className="btn" onClick={() => setActiveTab('overview')} disabled={activeTab==='overview'}>Overview</button>
          <button className="btn" onClick={() => setActiveTab('linkedin')} disabled={activeTab==='linkedin'}>LinkedIn</button>
          <button className="btn" onClick={() => setActiveTab('youtube')} disabled={activeTab==='youtube'}>YouTube</button>
          <button className="btn" onClick={() => setActiveTab('google')} disabled={activeTab==='google'}>Google</button>
          <button className="btn" onClick={() => setActiveTab('brevo')} disabled={activeTab==='brevo'}>Brevo</button>
        </div>
      </div>



      {activeTab === 'overview' && (
        <>
          {/* Primary Total Users Box */}
          <div className="primary-card">
            <h2>Total Users (All Time)</h2>
            <div className="value">
              {totalUsersLoading ? <i>Loading...</i> : totalUsers?.totalUsers ?? '—'}
            </div>
          </div>

          {error && <div className="error-card">Error: {error}</div>}
          
          <div className="page-content">
            <h2 style={{color: '#1a202c', marginBottom: '24px', textAlign: 'center'}}>Statistics for {start.toLocaleDateString()} - {end.toLocaleDateString()}</h2>
            <div className="cards">
              <div className="card">
                <h3>Total Users</h3>
                <div className="value">
                  {totalsLoading ? <i>Loading...</i> : totals?.totalUsers ?? '-'}
                </div>
              </div>
              <div className="card">
                <h3>LinkedIn Views</h3>
                <div className="value">
                  {totalsLoading ? <i>Loading...</i> : totals?.linkedinViews ?? '-'}
                </div>
              </div>
              <div className="card">
                <h3>YouTube Views</h3>
                <div className="value">
                  {totalsLoading ? <i>Loading...</i> : totals?.youtubeViews ?? '-'}
                </div>
              </div>
              <div className="card">
                <h3>Google Views</h3>
                <div className="value">
                  {totalsLoading ? <i>Loading...</i> : totals?.googleViews ?? '-'}
                </div>
              </div>
            </div>
          </div>

          {/* LinkedIn Summary */}
          <div className="summary-section">
            <h3>📱 LinkedIn Performance</h3>
            {liLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><i>Loading...</i></div>
            ) : (
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="label">Total Posts</div>
                  <div className="value">{liRows.length}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Redirects</div>
                  <div className="value">{liTotals.redirects}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Conversions</div>
                  <div className="value">{liTotals.conversions}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Conversion Rate</div>
                  <div className="value">{liTotals.redirects > 0 ? ((liTotals.conversions / liTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
                </div>
              </div>
            )}
          </div>

          {/* YouTube Summary */}
          <div className="summary-section">
            <h3>🎥 YouTube Performance</h3>
            {ytLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><i>Loading...</i></div>
            ) : (
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="label">Total Videos</div>
                  <div className="value">{ytRows.length}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Redirects</div>
                  <div className="value">{ytTotals.redirects}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Conversions</div>
                  <div className="value">{ytTotals.conversions}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Conversion Rate</div>
                  <div className="value">{ytTotals.redirects > 0 ? ((ytTotals.conversions / ytTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Google Summary */}
          <div className="summary-section">
            <h3>🔍 Google Search Performance</h3>
            {googleLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><i>Loading...</i></div>
            ) : (
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="label">Total Pages</div>
                  <div className="value">{googleRows.length}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Redirects</div>
                  <div className="value">{googleTotals.redirects}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Conversions</div>
                  <div className="value">{googleTotals.conversions}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Conversion Rate</div>
                  <div className="value">{googleTotals.redirects > 0 ? ((googleTotals.conversions / googleTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Brevo Summary */}
          <div className="summary-section">
            <h3>📧 Brevo Email Performance (All Time)</h3>
            {brevoLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><i>Loading...</i></div>
            ) : (
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="label">Total Campaigns</div>
                  <div className="value">{brevoRows.length}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Redirects</div>
                  <div className="value">{brevoTotals.redirects}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Total Conversions</div>
                  <div className="value">{brevoTotals.conversions}</div>
                </div>
                <div className="summary-item">
                  <div className="label">Conversion Rate</div>
                  <div className="value">{brevoTotals.redirects > 0 ? ((brevoTotals.conversions / brevoTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'linkedin' && (
        <>
          <div className="sectionTitle">📱 LinkedIn Content</div>
          {error && <div className="error-card">Error: {error}</div>}
          <p className="muted">Data for {start.toLocaleDateString()} - {end.toLocaleDateString()}</p>
          
          <div className="page-content">
            <div className="cards">
              <div className="card">
                <h3>Total Posts</h3>
                <div className="value">{liLoading ? <i>Loading...</i> : liRows.length}</div>
              </div>
              <div className="card">
                <h3>Total Redirects</h3>
                <div className="value">{liLoading ? <i>Loading...</i> : liTotals.redirects}</div>
              </div>
              <div className="card">
                <h3>Total Conversions</h3>
                <div className="value">{liLoading ? <i>Loading...</i> : liTotals.conversions}</div>
              </div>
              <div className="card">
                <h3>Conversion Rate</h3>
                <div className="value">{liLoading ? <i>Loading...</i> : liTotals.redirects > 0 ? ((liTotals.conversions / liTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
              </div>
            </div>
            
            {liLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Post</th>
                      <th>Redirects</th>
                      <th>Conversions</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liRows.map((r) => (
                      <tr key={`li-${r.post}`}>
                        <td><ExpandableText text={r.post} maxLength={60} /></td>
                        <td>{r.redirect_count}</td>
                        <td>{r.user_converted}</td>
                        <td>{r.redirect_count > 0 ? ((r.user_converted / r.redirect_count) * 100).toFixed(1) + '%' : '0%'}</td>
                      </tr>
                    ))}
                    <tr className="totals-row">
                      <td><strong>Total</strong></td>
                      <td><strong>{liTotals.redirects}</strong></td>
                      <td><strong>{liTotals.conversions}</strong></td>
                      <td><strong>{liTotals.redirects > 0 ? ((liTotals.conversions / liTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'youtube' && (
        <>
          <div className="sectionTitle">🎥 YouTube Content</div>
          {error && <div className="error-card">Error: {error}</div>}
          <p className="muted">Data for {start.toLocaleDateString()} - {end.toLocaleDateString()}</p>
          
          <div className="page-content">
            <div className="cards">
              <div className="card">
                <h3>Total Videos</h3>
                <div className="value">{ytLoading ? <i>Loading...</i> : ytRows.length}</div>
              </div>
              <div className="card">
                <h3>Total Redirects</h3>
                <div className="value">{ytLoading ? <i>Loading...</i> : ytTotals.redirects}</div>
              </div>
              <div className="card">
                <h3>Total Conversions</h3>
                <div className="value">{ytLoading ? <i>Loading...</i> : ytTotals.conversions}</div>
              </div>
              <div className="card">
                <h3>Conversion Rate</h3>
                <div className="value">{ytLoading ? <i>Loading...</i> : ytTotals.redirects > 0 ? ((ytTotals.conversions / ytTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
              </div>
            </div>
            
            {ytLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Video</th>
                      <th>Redirects</th>
                      <th>Conversions</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ytRows.map((r) => (
                      <tr key={`yt-${r.post}`}>
                        <td><ExpandableText text={r.post} maxLength={60} /></td>
                        <td>{r.redirect_count}</td>
                        <td>{r.user_converted}</td>
                        <td>{r.redirect_count > 0 ? ((r.user_converted / r.redirect_count) * 100).toFixed(1) + '%' : '0%'}</td>
                      </tr>
                    ))}
                    <tr className="totals-row">
                      <td><strong>Total</strong></td>
                      <td><strong>{ytTotals.redirects}</strong></td>
                      <td><strong>{ytTotals.conversions}</strong></td>
                      <td><strong>{ytTotals.redirects > 0 ? ((ytTotals.conversions / ytTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'google' && (
        <>
          <div className="sectionTitle">🔍 Google Search</div>
          {error && <div className="error-card">Error: {error}</div>}
          <p className="muted">Data for {start.toLocaleDateString()} - {end.toLocaleDateString()}</p>
          
          <div className="page-content">
            <div className="cards">
              <div className="card">
                <h3>Total Pages</h3>
                <div className="value">{googleLoading ? <i>Loading...</i> : googleRows.length}</div>
              </div>
              <div className="card">
                <h3>Total Redirects</h3>
                <div className="value">{googleLoading ? <i>Loading...</i> : googleTotals.redirects}</div>
              </div>
              <div className="card">
                <h3>Total Conversions</h3>
                <div className="value">{googleLoading ? <i>Loading...</i> : googleTotals.conversions}</div>
              </div>
              <div className="card">
                <h3>Conversion Rate</h3>
                <div className="value">{googleLoading ? <i>Loading...</i> : googleTotals.redirects > 0 ? ((googleTotals.conversions / googleTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
              </div>
            </div>
            
            {googleLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>URL Path</th>
                      <th>Redirects</th>
                      <th>Conversions</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {googleRows.map((r) => (
                      <tr key={`google-${r.post}`}>
                        <td><ExpandableText text={r.post} maxLength={60} /></td>
                        <td>{r.redirect_count}</td>
                        <td>{r.user_converted}</td>
                        <td>{r.redirect_count > 0 ? ((r.user_converted / r.redirect_count) * 100).toFixed(1) + '%' : '0%'}</td>
                      </tr>
                    ))}
                    <tr className="totals-row">
                      <td><strong>Total</strong></td>
                      <td><strong>{googleTotals.redirects}</strong></td>
                      <td><strong>{googleTotals.conversions}</strong></td>
                      <td><strong>{googleTotals.redirects > 0 ? ((googleTotals.conversions / googleTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'brevo' && (
        <>
          <div className="sectionTitle">📧 Brevo Email Campaigns</div>
          <div className="note-card">
            <strong>Note:</strong> Brevo data is not filtered by date range and shows all-time campaign statistics.
          </div>
          {brevoError && <div className="error-card">Error: {brevoError}</div>}
          
          <div className="page-content">
            <div className="cards">
              <div className="card">
                <h3>Total Campaigns</h3>
                <div className="value">{brevoLoading ? <i>Loading...</i> : brevoRows.length}</div>
              </div>
              <div className="card">
                <h3>Total Redirects</h3>
                <div className="value">{brevoLoading ? <i>Loading...</i> : brevoTotals.redirects}</div>
              </div>
              <div className="card">
                <h3>Total Conversions</h3>
                <div className="value">{brevoLoading ? <i>Loading...</i> : brevoTotals.conversions}</div>
              </div>
              <div className="card">
                <h3>Conversion Rate</h3>
                <div className="value">{brevoLoading ? <i>Loading...</i> : brevoTotals.redirects > 0 ? ((brevoTotals.conversions / brevoTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</div>
              </div>
            </div>
            
            {brevoLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><i>Loading...</i></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Redirects</th>
                      <th>Conversions</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brevoRows.map((r) => (
                      <tr key={`brevo-${r.post}`}>
                        <td><ExpandableText text={r.post} maxLength={60} /></td>
                        <td>{r.redirect_count}</td>
                        <td>{r.user_converted}</td>
                        <td>{r.redirect_count > 0 ? ((r.user_converted / r.redirect_count) * 100).toFixed(1) + '%' : '0%'}</td>
                      </tr>
                    ))}
                    <tr className="totals-row">
                      <td><strong>Total</strong></td>
                      <td><strong>{brevoTotals.redirects}</strong></td>
                      <td><strong>{brevoTotals.conversions}</strong></td>
                      <td><strong>{brevoTotals.redirects > 0 ? ((brevoTotals.conversions / brevoTotals.redirects) * 100).toFixed(1) + '%' : '0%'}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{textAlign: 'center', marginTop: '24px'}}>
              <button className="btn" onClick={async () => {
                setBrevoLoading(true)
                setBrevoError(null)
                try {
                  const rows = await fetchJSON<Row[]>(`/brevo`)
                  setBrevoRows(rows)
                } catch (e) {
                  const message = e instanceof Error ? e.message : 'Failed to load brevo'
                  setBrevoError(message)
                } finally {
                  setBrevoLoading(false)
                }
              }}>Refresh Data</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
