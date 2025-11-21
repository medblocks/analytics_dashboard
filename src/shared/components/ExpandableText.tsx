import { useState } from 'react'

export function ExpandableText({ text, maxLength = 50 }: { text: string; maxLength?: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const shouldTruncate = text.length > maxLength
  const displayText = shouldTruncate && !isExpanded ? text.slice(0, maxLength) + '...' : text
  
  if (!shouldTruncate) {
    return <span>{text}</span>
  }
  
  return (
    <div 
      className={`expandable-text ${isExpanded ? 'expanded' : 'collapsed'}`}
      onClick={() => setIsExpanded(!isExpanded)}
      title={isExpanded ? 'Click to collapse' : 'Click to expand'}
    >
      {displayText}
    </div>
  )
}

