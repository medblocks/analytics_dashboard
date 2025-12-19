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

type Category = 'openehr' | 'fhir'

type CategoryData = {
  keywords: string[]
  isCustom: boolean
}

export function SearchQueriesTab({ rows, loading, error }: SearchQueriesTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [categoriesData, setCategoriesData] = useState<Record<Category, CategoryData>>({
    openehr: { keywords: [], isCustom: false },
    fhir: { keywords: [], isCustom: false }
  })
  const [loadingKeywords, setLoadingKeywords] = useState(true)
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(new Set(['openehr', 'fhir']))

  // Merge keywords from selected categories with actual row data to show all keywords even with 0 values
  const displayRows = useMemo(() => {
    const allKeywords: string[] = []
    
    // Only include keywords from selected categories
    if (selectedCategories.has('openehr')) {
      allKeywords.push(...categoriesData.openehr.keywords)
    }
    if (selectedCategories.has('fhir')) {
      allKeywords.push(...categoriesData.fhir.keywords)
    }
    
    if (allKeywords.length === 0) return []

    // Create a map of existing row data
    const rowMap = new Map(rows.map(row => [row.query.toLowerCase(), row]))

    // Create rows for all keywords, using actual data if available
    return allKeywords.map(keyword => {
      const existingRow = rowMap.get(keyword.toLowerCase())
      return existingRow || {
        query: keyword,
        redirect_count: 0,
        user_converted: 0,
        url_paths: []
      }
    })
  }, [rows, categoriesData, selectedCategories])

  const totals = useMemo(() => {
    return displayRows.reduce(
      (acc, row) => ({
        redirects: acc.redirects + row.redirect_count,
        conversions: acc.conversions + row.user_converted,
      }),
      { redirects: 0, conversions: 0 }
    )
  }, [displayRows])

  // Fetch current keywords
  useEffect(() => {
    fetchKeywords()
  }, [])

  const fetchKeywords = async () => {
    try {
      setLoadingKeywords(true)
      const response = await fetch('/api/keywords/all')
      if (!response.ok) throw new Error('Failed to fetch keywords')
      
      const data = await response.json()
      setCategoriesData({
        openehr: {
          keywords: data.openehr?.keywords || [],
          isCustom: data.openehr?.isCustom || false
        },
        fhir: {
          keywords: data.fhir?.keywords || [],
          isCustom: data.fhir?.isCustom || false
        }
      })
    } catch (error) {
      console.error('Error fetching keywords:', error)
    } finally {
      setLoadingKeywords(false)
    }
  }

  const handleSaveKeywords = async (newKeywords: string[], category: Category) => {
    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: newKeywords, category })
      })
      
      if (!response.ok) throw new Error('Failed to save keywords')
      
      const data = await response.json()
      const categoryLabel = category === 'openehr' ? 'openEHR' : 'FHIR'
      alert(`Success! ${data.count} ${categoryLabel} keywords saved. Refreshing data...`)
      
      // Refresh the page to reload data with new keywords
      window.location.reload()
    } catch (error) {
      console.error('Error saving keywords:', error)
      throw error
    }
  }

  const toggleCategory = (category: Category) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  return (
    <>
      {error && <ErrorCard message={error} />}
      
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {!loadingKeywords && (
              <>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {(categoriesData.openehr.isCustom || categoriesData.fhir.isCustom) ? (
                    <span style={{ color: '#2463eb', fontWeight: 500 }}>
                      ✓ Using {categoriesData.openehr.keywords.length} openEHR + {categoriesData.fhir.keywords.length} FHIR keywords
                      {categoriesData.openehr.isCustom && categoriesData.fhir.isCustom && ' (both custom)'}
                      {categoriesData.openehr.isCustom && !categoriesData.fhir.isCustom && ' (openEHR custom)'}
                      {!categoriesData.openehr.isCustom && categoriesData.fhir.isCustom && ' (FHIR custom)'}
                    </span>
                  ) : (
                    <span>
                      Available: {categoriesData.openehr.keywords.length} openEHR + {categoriesData.fhir.keywords.length} FHIR keywords from CSV
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>Display:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.has('openehr')}
                      onChange={() => toggleCategory('openehr')}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span>openEHR ({categoriesData.openehr.keywords.length})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.has('fhir')}
                      onChange={() => toggleCategory('fhir')}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span>FHIR ({categoriesData.fhir.keywords.length})</span>
                  </label>
                  {selectedCategories.size > 0 && (
                    <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>
                      (Showing {displayRows.length} keywords)
                    </span>
                  )}
                </div>
              </>
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
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2463eb'}
          >
            Edit Keywords
          </button>
        </div>

        <div className="cards">
          <StatsCard title="Total Queries" value={displayRows.length} loading={loading} />
          <StatsCard title="Total Redirects" value={totals.redirects} loading={loading} />
          <StatsCard title="Total Conversions" value={totals.conversions} loading={loading} />
          <StatsCard 
            title="Conversion Rate" 
            value={totals.redirects > 0 ? formatPercentage((totals.conversions / totals.redirects) * 100) : '0%'} 
            loading={loading} 
          />
        </div>
        
        {selectedCategories.size === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '2px dashed #e0e0e0'
          }}>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
              No keyword categories selected
            </p>
            <p style={{ fontSize: '14px', color: '#999' }}>
              Select at least one category above to view search queries, or click "Edit Keywords" to manage your keywords.
            </p>
          </div>
        ) : (
          <SearchQueriesTable rows={displayRows} totals={totals} loading={loading} />
        )}
      </div>

      <KeywordEditorDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveKeywords}
        categoriesData={categoriesData}
      />
    </>
  )
}
