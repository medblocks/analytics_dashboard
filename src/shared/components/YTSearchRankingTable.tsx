import type { YTRankingRow, YTRankingPosition } from '../types'

type YTSearchRankingTableProps = {
  rows: YTRankingRow[]
  loading: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(str: string, maxLen: number): string {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

function PositionCell({ video }: { video?: YTRankingPosition }) {
  if (!video) {
    return <span style={{ color: '#d1d5db' }}>—</span>
  }

  const isPlaylist = video.result_type === 'playlist'
  const channelName = truncate(video.channel_name || '', 20)
  const title = truncate(video.video_title, 35)

  return (
    <div style={{ lineHeight: 1.4 }}>
      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
        {channelName || (isPlaylist ? 'Playlist' : '—')}
      </div>
      {video.video_id ? (
        <a 
          href={`https://www.youtube.com/watch?v=${video.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', textDecoration: 'none', fontSize: '12px' }}
          title={video.video_title}
        >
          {title}
        </a>
      ) : (
        <span style={{ color: '#4b5563', fontSize: '12px' }} title={video.video_title}>
          {title}
        </span>
      )}
    </div>
  )
}

function SidharthCell({ videos }: { videos: YTRankingPosition[] }) {
  if (!videos || videos.length === 0) {
    return <span style={{ color: '#d1d5db' }}>—</span>
  }

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {videos.map((video, idx) => (
        <a
          key={`${video.video_id}-${idx}`}
          href={`https://www.youtube.com/watch?v=${video.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          title={video.video_title}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          #{video.position}
        </a>
      ))}
    </div>
  )
}

export function YTSearchRankingTable({ rows, loading }: YTSearchRankingTableProps) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="loading-state">Loading rankings...</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">No rankings found for this period</div>
      </div>
    )
  }

  // Helper to get video at specific position
  const getAtPosition = (videos: YTRankingPosition[], pos: number) => 
    videos.find(v => v.position === pos)

  return (
    <div className="table-container" style={{ overflowX: 'auto' }}>
      <table className="performance-table" style={{ fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ width: '140px', whiteSpace: 'nowrap' }}>Keyword</th>
            <th style={{ width: '70px', textAlign: 'center' }}>Watch</th>
            <th style={{ width: '55px', textAlign: 'center' }}>Avg</th>
            <th style={{ width: '180px' }}>#1</th>
            <th style={{ width: '180px' }}>#2</th>
            <th style={{ width: '180px' }}>#3</th>
            <th style={{ width: '120px' }}>Sidharth (4-10)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.keyword} style={{ height: '52px' }}>
              <td style={{ verticalAlign: 'middle' }}>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>
                  {row.keyword}
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                  {formatDate(row.fetchDate)}
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', textAlign: 'center', color: '#374151', fontWeight: 500 }}>
                {row.watchTimeHours !== undefined ? `${row.watchTimeHours.toFixed(0)}h` : '—'}
              </td>
              <td style={{ verticalAlign: 'middle', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                {row.averageViewDuration || '—'}
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <PositionCell video={getAtPosition(row.topThree, 1)} />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <PositionCell video={getAtPosition(row.topThree, 2)} />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <PositionCell video={getAtPosition(row.topThree, 3)} />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <SidharthCell videos={row.sidharthVideos} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
