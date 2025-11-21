type StatsCardProps = {
  title: string
  value: string | number
  loading?: boolean
}

export function StatsCard({ title, value, loading = false }: StatsCardProps) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="value">
        {loading ? <i>Loading...</i> : value}
      </div>
    </div>
  )
}

