type ErrorCardProps = {
  message: string
}

export function ErrorCard({ message }: ErrorCardProps) {
  return <div className="error-card">Error: {message}</div>
}

