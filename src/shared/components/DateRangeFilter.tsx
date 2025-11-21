type DateRangeFilterProps = {
  start: Date
  end: Date
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
  onRefresh: () => void
}

export function DateRangeFilter({ start, end, onStartChange, onEndChange, onRefresh }: DateRangeFilterProps) {
  return (
    <div className="controls">
      <label className="muted">Start</label>
      <input
        className="input"
        type="date"
        value={start.toISOString().slice(0, 10)}
        onChange={(e) => onStartChange(e.target.value)}
      />
      <label className="muted">End</label>
      <input
        className="input"
        type="date"
        value={end.toISOString().slice(0, 10)}
        onChange={(e) => onEndChange(e.target.value)}
      />
      <button className="btn" onClick={onRefresh}>Refresh</button>
    </div>
  )
}

