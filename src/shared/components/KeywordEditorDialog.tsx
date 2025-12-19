import { useState, useEffect } from 'react'
import './KeywordEditorDialog.css'

type Category = 'openehr' | 'fhir'

type CategoryData = {
  keywords: string[]
  isCustom: boolean
}

type KeywordEditorDialogProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (keywords: string[], category: Category) => void
  categoriesData: Record<Category, CategoryData>
}

export function KeywordEditorDialog({ 
  isOpen, 
  onClose, 
  onSave,
  categoriesData
}: KeywordEditorDialogProps) {
  const [activeTab, setActiveTab] = useState<Category>('openehr')
  const [keywordsText, setKeywordsText] = useState<Record<Category, string>>({
    openehr: '',
    fhir: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setKeywordsText({
        openehr: categoriesData.openehr.keywords.join('\n'),
        fhir: categoriesData.fhir.keywords.join('\n')
      })
    }
  }, [isOpen, categoriesData])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Split by newlines and filter empty lines
      const keywords = keywordsText[activeTab]
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0)
      
      await onSave(keywords, activeTab)
      onClose()
    } catch (error) {
      console.error('Error saving keywords:', error)
      alert('Failed to save keywords. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    const categoryLabel = activeTab === 'openehr' ? 'openEHR' : 'FHIR'
    if (!confirm(`Are you sure you want to reset ${categoryLabel} keywords to the default CSV?`)) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/keywords?category=${activeTab}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to reset keywords')
      
      const data = await response.json()
      alert(`Reset successful! ${data.count} ${categoryLabel} keywords loaded from CSV.`)
      window.location.reload() // Reload to fetch fresh data
    } catch (error) {
      console.error('Error resetting keywords:', error)
      alert('Failed to reset keywords. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const currentCategoryData = categoriesData[activeTab]
  const keywordCount = keywordsText[activeTab].split('\n').filter(k => k.trim().length > 0).length

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-header-top">
            <h2>Edit Search Keywords</h2>
            <button className="close-button" onClick={onClose} disabled={isSaving}>×</button>
          </div>
          
          <div className="dialog-tabs">
            <button
              className={`dialog-tab ${activeTab === 'openehr' ? 'active' : ''}`}
              onClick={() => setActiveTab('openehr')}
              disabled={isSaving}
            >
              openEHR Keywords
            </button>
            <button
              className={`dialog-tab ${activeTab === 'fhir' ? 'active' : ''}`}
              onClick={() => setActiveTab('fhir')}
              disabled={isSaving}
            >
              FHIR Keywords
            </button>
          </div>
        </div>
        
        <div className="dialog-body">
          <div className="dialog-info">
            <p>
              {currentCategoryData.isCustom ? (
                <span className="custom-badge">Using Custom Keywords</span>
              ) : (
                <span className="default-badge">Using Default CSV Keywords</span>
              )}
            </p>
            <p className="keyword-count">{keywordCount} keywords</p>
          </div>
          
          <p className="dialog-instructions">
            Enter one keyword per line. These keywords will be used for search query filtering.
          </p>
          
          <textarea
            className="keyword-textarea"
            value={keywordsText[activeTab]}
            onChange={(e) => setKeywordsText(prev => ({ ...prev, [activeTab]: e.target.value }))}
            placeholder="Enter keywords, one per line..."
            rows={20}
            disabled={isSaving}
          />
        </div>
        
        <div className="dialog-footer">
          <div className="footer-left">
            {currentCategoryData.isCustom && (
              <button 
                className="reset-button" 
                onClick={handleReset}
                disabled={isSaving}
              >
                Reset to Default CSV
              </button>
            )}
          </div>
          <div className="footer-right">
            <button 
              className="cancel-button" 
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              className="save-button" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Keywords'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

