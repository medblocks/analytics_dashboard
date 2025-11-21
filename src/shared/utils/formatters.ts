export function formatDateForParam(date: Date): string {
  return new Date(date).toISOString()
}

export function formatPercentage(value: number): string {
  return value.toFixed(1) + '%'
}

