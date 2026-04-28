import type { YouTubeRawRow, YouTubeRawPaidRow, CalculatedTotals } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { ErrorCard } from '../shared/components/ErrorCard'
import { formatPercentage } from '../shared/utils/formatters'

type YouTubeRawTabProps = {
  start: Date
  end: Date
  rows: YouTubeRawRow[]
  prevRows?: YouTubeRawRow[]
  paidRows?: YouTubeRawPaidRow[]
  loading: boolean
  error: string | null
}

function rowMetrics<T extends { redirect_count: number; user_converted: number }>(rows: T[]): CalculatedTotals {
  return rows.reduce(
    (acc, row) => ({
      redirects: acc.redirects + (row.redirect_count || 0),
      conversions: acc.conversions + (row.user_converted || 0),
    }),
    { redirects: 0, conversions: 0 }
  )
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-'
  return num.toLocaleString()
}

export function YouTubeRawTab({ rows, prevRows = [], paidRows = [], loading, error }: YouTubeRawTabProps) {
  const totals = rowMetrics(rows)
  const prevTotals = rowMetrics(prevRows)
  const paidTotals = rowMetrics(paidRows)

  const getTrend = (current: number, prev: number) => {
    if (prev === 0) {
      return {
        direction: (current > 0 ? 'up' : 'neutral') as 'up' | 'neutral',
        value: undefined
      };
    }
    const diff = current - prev;
    const pct = (diff / prev) * 100;
    return {
      direction: (diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      value: `${Math.abs(pct).toFixed(1)}%`
    };
  };

  const urlsTrend = getTrend(rows.length, prevRows.length);
  const redirectsTrend = getTrend(totals.redirects, prevTotals.redirects);
  const conversionsTrend = getTrend(totals.conversions, prevTotals.conversions);
  const conversionRate = totals.redirects > 0 ? (totals.conversions / totals.redirects) * 100 : 0;
  const prevConversionRate = prevTotals.redirects > 0 ? (prevTotals.conversions / prevTotals.redirects) * 100 : 0;
  const conversionRateTrend = getTrend(conversionRate, prevConversionRate);

  // Count how many have video info
  const videosWithInfo = rows.filter(r => r.videoTitle).length;

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div className="raw-tab-notice">
          <strong>YouTube Conversions:</strong> signups whose converting session's first
          pageview was a YouTube-sourced page. Each row keys by (landing page, video ID).
          {videosWithInfo > 0 && (
            <span> Resolved YouTube API metadata for <strong>{videosWithInfo}</strong> of <strong>{rows.length}</strong> rows.</span>
          )}
        </div>
        
        <div className="cards">
          <StatsCard 
            title="Total URLs" 
            value={rows.length} 
            loading={loading}
            prevValue={prevRows.length}
            trend={urlsTrend.direction}
            trendValue={urlsTrend.value}
          />
          <StatsCard 
            title="Total Redirects" 
            value={totals.redirects} 
            loading={loading}
            prevValue={prevTotals.redirects}
            trend={redirectsTrend.direction}
            trendValue={redirectsTrend.value}
          />
          <StatsCard 
            title="Total Conversions" 
            value={totals.conversions} 
            loading={loading}
            prevValue={prevTotals.conversions}
            trend={conversionsTrend.direction}
            trendValue={conversionsTrend.value}
          />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage(conversionRate) : '0%'} 
            loading={loading}
            prevValue={prevTotals.redirects > 0 ? formatPercentage(prevConversionRate) : '0%'}
            trend={conversionRateTrend.direction}
            trendValue={conversionRateTrend.value}
          />
        </div>
        
        {/* Custom table with YouTube info */}
        <div className="table-container">
          {loading ? (
            <div className="loading-text">Loading data...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Video</th>
                  <th>URL</th>
                  <th>YT Views</th>
                  <th>YT Likes</th>
                  <th>Redirects</th>
                  <th>Conversions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      {row.videoId ? (
                        <a 
                          href={`https://www.youtube.com/watch?v=${row.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="video-info-cell video-link"
                        >
                          {row.thumbnailUrl && (
                            <img 
                              src={row.thumbnailUrl} 
                              alt="" 
                              className="video-thumbnail-medium"
                            />
                          )}
                          <div className="video-details">
                            {row.videoTitle ? (
                              <>
                                <div className="video-title">{row.videoTitle}</div>
                                {row.channelTitle && (
                                  <div className="channel-name">{row.channelTitle}</div>
                                )}
                              </>
                            ) : (
                              <div className="video-id-only">ID: {row.videoId}</div>
                            )}
                          </div>
                        </a>
                      ) : (
                        <span className="no-video-info">-</span>
                      )}
                    </td>
                    <td>
                      <a 
                        href={row.post.startsWith('http') ? row.post : `https://medblocks.com${row.post}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="url-link"
                        title={row.post}
                      >
                        {row.post.length > 50 ? row.post.substring(0, 50) + '...' : row.post}
                      </a>
                    </td>
                    <td className="yt-stat">{formatNumber(row.ytViewCount)}</td>
                    <td className="yt-stat">{formatNumber(row.ytLikeCount)}</td>
                    <td>{row.redirect_count}</td>
                    <td>{row.user_converted}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td><strong>{totals.redirects}</strong></td>
                  <td><strong>{totals.conversions}</strong></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {paidRows.length > 0 && (
          <div className="page-content" style={{ marginTop: '32px' }}>
            <h3 className="sectionTitle" style={{ fontSize: '18px', marginBottom: '12px' }}>
              Paid YT Ads
            </h3>
            <div className="raw-tab-notice">
              <strong>Paid traffic:</strong> Google Ads campaigns running on YouTube
              (utm_medium=cpc / paid_video). These use numeric Google Ads campaign IDs in
              utm_campaign — not real video IDs — so they're listed separately to keep
              organic-video stats clean.
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Landing Page</th>
                    <th>Campaign</th>
                    <th>Redirects</th>
                    <th>Conversions</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {paidRows.map((r, idx) => (
                    <tr key={`paid-${idx}`}>
                      <td>
                        <a
                          href={r.post.startsWith('http') ? r.post : `https://medblocks.com${r.post}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="url-link"
                          title={r.post}
                        >
                          {r.post.length > 60 ? r.post.substring(0, 60) + '...' : r.post}
                        </a>
                      </td>
                      <td>{r.utm_campaign || '-'}</td>
                      <td>{r.redirect_count}</td>
                      <td>{r.user_converted}</td>
                      <td>{r.redirect_count > 0 ? formatPercentage((r.user_converted / r.redirect_count) * 100) : '0%'}</td>
                    </tr>
                  ))}
                  <tr className="totals-row">
                    <td><strong>Total</strong></td>
                    <td>-</td>
                    <td><strong>{paidTotals.redirects}</strong></td>
                    <td><strong>{paidTotals.conversions}</strong></td>
                    <td><strong>{paidTotals.redirects > 0 ? formatPercentage((paidTotals.conversions / paidTotals.redirects) * 100) : '0%'}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
