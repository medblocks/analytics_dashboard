import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

type StatsCardProps = {
  title: string
  value: string | number
  loading?: boolean
  prevValue?: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function StatsCard({ 
  title, 
  value, 
  loading = false,
  prevValue,
  trend,
  trendValue
}: StatsCardProps) {
  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title}
        {trend && (
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            fontSize: '10px',
            fontWeight: '600',
            color: trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#64748b',
            backgroundColor: trend === 'up' ? '#ecfdf5' : trend === 'down' ? '#fef2f2' : '#f1f5f9',
            padding: '3px 8px',
            borderRadius: '6px',
            gap: '3px'
          }}>
            {trend === 'up' && <ArrowUpRight size={12} />}
            {trend === 'down' && <ArrowDownRight size={12} />}
            {trend === 'neutral' && <Minus size={12} />}
            {trendValue}
          </span>
        )}
      </h3>
      <div className="value">
        {loading ? <span style={{ fontSize: '28px', color: '#cbd5e1' }}>—</span> : value}
      </div>
      {prevValue !== undefined && !loading && (
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
          vs {prevValue} prev.
        </div>
      )}
    </div>
  )
}
