type PrimaryCardProps = {
  title: string
  value: string | number
  loading?: boolean
}

export function PrimaryCard({ title, value, loading = false }: PrimaryCardProps) {
  return (
    <div className="primary-card">
      <h2>{title}</h2>
      <div className="value">
        {loading ? <i>Loading...</i> : value}
      </div>
    </div>
  )
}

