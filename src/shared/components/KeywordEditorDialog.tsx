import { useState, useEffect } from 'react'
import './KeywordEditorDialog.css'

type KeywordEditorDialogProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (keywords: string[]) => void
  currentKeywords: string[]
  isCustom: boolean
}

export function KeywordEditorDialog({ 
  isOpen, 
  onClose, 
  onSave, 
  currentKeywords,
  isCustom 
}: KeywordEditorDialogProps) {
  const [keywordsText, setKeywordsText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setKeywordsText(currentKeywords.join('\n'))
    }
  }, [isOpen, currentKeywords])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Split by newlines and filter empty lines
      const keywords = keywordsText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0)
      
      await onSave(keywords)
      onClose()
    } catch (error) {
      console.error('Error saving keywords:', error)
      alert('Failed to save keywords. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset to the default CSV keywords?')) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/keywords', { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to reset keywords')
      
      const data = await response.json()
      alert(`Reset successful! ${data.count} keywords loaded from CSV.`)
      window.location.reload() // Reload to fetch fresh data
    } catch (error) {
      console.error('Error resetting keywords:', error)
      alert('Failed to reset keywords. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const keywordCount = keywordsText.split('\n').filter(k => k.trim().length > 0).length

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Search Keywords</h2>
          <button className="close-button" onClick={onClose} disabled={isSaving}>×</button>
        </div>
        
        <div className="dialog-body">
          <div className="dialog-info">
            <p>
              {isCustom ? (
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
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="Enter keywords, one per line..."
            rows={20}
            disabled={isSaving}
          />
        </div>
        
        <div className="dialog-footer">
          <div className="footer-left">
            {isCustom && (
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

