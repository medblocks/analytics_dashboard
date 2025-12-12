import type { YTRankingRow } from '../shared/types'
import { YTSearchRankingTable } from '../shared/components/YTSearchRankingTable'
import { ErrorCard } from '../shared/components/ErrorCard'

type YTSearchRankingTabProps = {
  start: Date
  end: Date
  rows: YTRankingRow[]
  loading: boolean
  error: string | null
}

export function YTSearchRankingTab({ rows, loading, error }: YTSearchRankingTabProps) {
  return (
    <>
      {error && <ErrorCard message={error} />}
        <YTSearchRankingTable rows={rows} loading={loading} />
    </>
  )
}
