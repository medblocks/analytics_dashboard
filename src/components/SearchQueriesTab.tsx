import type { QueryRow } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { SearchQueriesTable } from '../shared/components/SearchQueriesTable'
import { ErrorCard } from '../shared/components/ErrorCard'
import { formatPercentage } from '../shared/utils/formatters'
import { useMemo } from 'react'

type SearchQueriesTabProps = {
  start: Date
  end: Date
  rows: QueryRow[]
  loading: boolean
  error: string | null
}

export function SearchQueriesTab({ rows, loading, error }: SearchQueriesTabProps) {
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        redirects: acc.redirects + row.redirect_count,
        conversions: acc.conversions + row.user_converted,
      }),
      { redirects: 0, conversions: 0 }
    )
  }, [rows])

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div className="cards">
          <StatsCard title="Total Queries" value={rows.length} loading={loading} />
          <StatsCard title="Total Redirects" value={totals.redirects} loading={loading} />
          <StatsCard title="Total Conversions" value={totals.conversions} loading={loading} />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'} 
            loading={loading} 
          />
        </div>
        
        <SearchQueriesTable rows={rows} totals={totals} loading={loading} />
      </div>
    </>
  )
}
