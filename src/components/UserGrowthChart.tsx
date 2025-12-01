import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

type ChartData = {
  date: string;
  daily_count: number;
  cumulative_count: number;
};

type UserGrowthChartProps = {
  data: ChartData[];
  loading?: boolean;
};

export function UserGrowthChart({ data, loading }: UserGrowthChartProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative' | 'both'>('both');
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Sort by date just in case
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Show all 30 days
    return sorted.map(item => ({
      ...item,
      // Format date for display
      displayDate: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px' }}>
        <span style={{ color: '#64748b' }}>Loading chart...</span>
      </div>
    );
  }

  if (chartData.length < 2) {
     return (
      <div className="chart-container" style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Not enough data for graph
      </div>
    );
  }

  return (
    <div className="chart-wrapper" style={{ marginTop: '24px', padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h4 style={{ margin: 0, color: '#1a202c', fontSize: '16px', fontWeight: 600 }}>User Growth (Last 30 Days)</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('daily')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: viewMode === 'daily' ? '#2463eb' : 'white',
              color: viewMode === 'daily' ? 'white' : '#64748b',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode('cumulative')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: viewMode === 'cumulative' ? '#2463eb' : 'white',
              color: viewMode === 'cumulative' ? 'white' : '#64748b',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Cumulative
          </button>
          <button
            onClick={() => setViewMode('both')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: viewMode === 'both' ? '#2463eb' : 'white',
              color: viewMode === 'both' ? 'white' : '#64748b',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Both
          </button>
        </div>
      </div>
      <div style={{ height: '350px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 10,
              right: 50,
              left: 10,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#16a34a', fontSize: 12 }}
              allowDecimals={false}
              label={{ 
                value: 'Total Users', 
                angle: -90, 
                position: 'insideLeft',
                offset: 10,
                style: { 
                  fill: '#16a34a', 
                  fontWeight: 600,
                  textAnchor: 'middle'
                } 
              }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#2463eb', fontSize: 12 }}
              allowDecimals={false}
              label={{ 
                value: 'Daily New Users', 
                angle: 90, 
                position: 'insideRight',
                offset: 10,
                style: { 
                  fill: '#2463eb', 
                  fontWeight: 600,
                  textAnchor: 'middle'
                } 
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
              formatter={(value: number, name: string) => {
                const label = name === 'daily_count' ? 'Daily New Users' : 'Total Users';
                return [value, label];
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => {
                if (value === 'daily_count') return 'Daily New Users';
                if (value === 'cumulative_count') return 'Total Users';
                return value;
              }}
            />
            {(viewMode === 'daily' || viewMode === 'both') && (
              <Bar 
                dataKey="daily_count" 
                name="daily_count"
                fill="#2463eb"
                fillOpacity={0.8}
                yAxisId="right"
                radius={[4, 4, 0, 0]}
              />
            )}
            {(viewMode === 'cumulative' || viewMode === 'both') && (
              <Area 
                type="monotone" 
                dataKey="cumulative_count" 
                name="cumulative_count"
                stroke="#16a34a" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorCumulative)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#16a34a' }}
                yAxisId="left"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
