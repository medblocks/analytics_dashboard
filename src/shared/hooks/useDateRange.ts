import { useState } from 'react'

export function useDateRange(): [Date, Date, (a: Date | string) => void, (b: Date | string) => void] {
  const now = new Date()
  const initialEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const initialStart = new Date(initialEnd)
  initialStart.setUTCDate(initialStart.getUTCDate() - 7)

  const [start, setStart] = useState<Date>(initialStart)
  const [end, setEnd] = useState<Date>(initialEnd)
  
  const setStartWithMidnight = (date: Date | string) => {
    const parsedDate = typeof date === 'string' ? new Date(date) : date
    if (isNaN(parsedDate.getTime())) return // Ignore invalid dates
    const newDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
    setStart(newDate)
  }
  
  const setEndWithMidnight = (date: Date | string) => {
    const parsedDate = typeof date === 'string' ? new Date(date) : date
    if (isNaN(parsedDate.getTime())) return // Ignore invalid dates
    const newDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
    setEnd(newDate)
  }
  
  return [start, end, setStartWithMidnight, setEndWithMidnight]
}

