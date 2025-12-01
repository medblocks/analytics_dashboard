type DateRangeFilterProps = {
  start: Date
  end: Date
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
  onRefresh: () => void
  layout?: 'horizontal' | 'stacked' | 'compact'
}

export function DateRangeFilter({ 
  start, 
  end, 
  onStartChange, 
  onEndChange, 
  onRefresh,
  layout = 'horizontal' 
}: DateRangeFilterProps) {
  
  // OPTION 1: Horizontal Layout (Current - with improved centering)
  if (layout === 'horizontal') {
    return (
      <div className="controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label className="muted">Start</label>
          <input
            className="input"
            type="date"
            value={start.toISOString().slice(0, 10)}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label className="muted">End</label>
          <input
            className="input"
            type="date"
            value={end.toISOString().slice(0, 10)}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
        <button className="btn" onClick={onRefresh}>Refresh</button>
      </div>
    )
  }
  
  // OPTION 2: Stacked Layout (Labels above inputs)
  if (layout === 'stacked') {
    return (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="muted" style={{ display: 'block' }}>Start</label>
          <input
            className="input"
            type="date"
            value={start.toISOString().slice(0, 10)}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="muted" style={{ display: 'block' }}>End</label>
          <input
            className="input"
            type="date"
            value={end.toISOString().slice(0, 10)}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
        <button className="btn" onClick={onRefresh}>Refresh</button>
      </div>
    )
  }
  
  // OPTION 3: Compact Layout (No labels, cleaner look)
  if (layout === 'compact') {
    return (
      <div className="controls" style={{ gap: '12px' }}>
        <input
          className="input"
          type="date"
          value={start.toISOString().slice(0, 10)}
          onChange={(e) => onStartChange(e.target.value)}
          style={{ minWidth: '160px' }}
        />
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>→</span>
        <input
          className="input"
          type="date"
          value={end.toISOString().slice(0, 10)}
          onChange={(e) => onEndChange(e.target.value)}
          style={{ minWidth: '160px' }}
        />
        <button className="btn" onClick={onRefresh}>Refresh</button>
      </div>
    )
  }
  
  return null
}

