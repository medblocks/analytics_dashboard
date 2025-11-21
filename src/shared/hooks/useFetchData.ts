import { useState, useEffect } from 'react'
import { fetchJSON } from '../utils/api'

interface UseFetchDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFetchData<T>(path: string, dependencies: any[] = []): UseFetchDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchJSON<T>(path)
      setData(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    
    const run = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await fetchJSON<T>(path)
            if (mounted) setData(result)
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to load data'
            if (mounted) setError(message)
        } finally {
            if (mounted) setLoading(false)
        }
    }

    run()
    
    return () => { mounted = false }
  }, [path, ...dependencies])

  return { data, loading, error, refetch: fetchData }
}

