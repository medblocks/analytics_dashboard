import type { QueryRow } from '../shared/types'
import { StatsCard } from '../shared/components/StatsCard'
import { SearchQueriesTable } from '../shared/components/SearchQueriesTable'
import { ErrorCard } from '../shared/components/ErrorCard'
import { KeywordEditorDialog } from '../shared/components/KeywordEditorDialog'
import { formatPercentage } from '../shared/utils/formatters'
import { useMemo, useState, useEffect } from 'react'

type SearchQueriesTabProps = {
  start: Date
  end: Date
  rows: QueryRow[]
  loading: boolean
  error: string | null
}

export function SearchQueriesTab({ rows, loading, error }: SearchQueriesTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [isCustom, setIsCustom] = useState(false)
  const [loadingKeywords, setLoadingKeywords] = useState(true)

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        redirects: acc.redirects + row.redirect_count,
        conversions: acc.conversions + row.user_converted,
      }),
      { redirects: 0, conversions: 0 }
    )
  }, [rows])

  // Fetch current keywords
  useEffect(() => {
    fetchKeywords()
  }, [])

  const fetchKeywords = async () => {
    try {
      setLoadingKeywords(true)
      const response = await fetch('/api/keywords')
      if (!response.ok) throw new Error('Failed to fetch keywords')
      
      const data = await response.json()
      setKeywords(data.keywords || [])
      setIsCustom(data.isCustom || false)
    } catch (error) {
      console.error('Error fetching keywords:', error)
    } finally {
      setLoadingKeywords(false)
    }
  }

  const handleSaveKeywords = async (newKeywords: string[]) => {
    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: newKeywords })
      })
      
      if (!response.ok) throw new Error('Failed to save keywords')
      
      const data = await response.json()
      alert(`Success! ${data.count} keywords saved. Refreshing data...`)
      
      // Refresh the page to reload data with new keywords
      window.location.reload()
    } catch (error) {
      console.error('Error saving keywords:', error)
      throw error
    }
  }

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!loadingKeywords && (
              <span style={{ fontSize: '14px', color: '#666' }}>
                {isCustom ? (
                  <span style={{ color: '#2463eb', fontWeight: 500 }}>
                    ✓ Using {keywords.length} custom keywords
                  </span>
                ) : (
                  <span>
                    Using {keywords.length} default keywords from CSV
                  </span>
                )}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsDialogOpen(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2463eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2463eb'}
          >
            Edit Keywords
          </button>
        </div>

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

      <KeywordEditorDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveKeywords}
        currentKeywords={keywords}
        isCustom={isCustom}
      />
    </>
  )
}
