import { useMemo } from 'react'
import type { Row, CalculatedTotals } from '../types'

export function usePerformanceMetrics(rows: Row[]): CalculatedTotals {
  return useMemo(() => {
    return rows.reduce((acc, row) => ({
      redirects: acc.redirects + row.redirect_count,
      conversions: acc.conversions + row.user_converted
    }), { redirects: 0, conversions: 0 })
  }, [rows])
}

