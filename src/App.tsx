import { useState, useMemo } from 'react'
import './App.css'

// Types
import type { Totals, TotalUsers, Row, TabType } from './shared/types'

// Components
import { DateRangeFilter } from './shared/components/DateRangeFilter'
import { TabNavigation } from './shared/components/TabNavigation'
import { OverviewTab } from './components/OverviewTab'
import { LinkedInTab } from './components/LinkedInTab'
import { YouTubeTab } from './components/YouTubeTab'
import { GoogleTab } from './components/GoogleTab'
import { BrevoTab } from './components/BrevoTab'

// Hooks and Utils
import { useDateRange } from './shared/hooks/useDateRange'
import { useFetchData } from './shared/hooks/useFetchData'
import { formatDateForParam } from './shared/utils/formatters'

function App() {
  const [start, end, setStart, setEnd] = useDateRange()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const query = useMemo(
    () => `?start=${encodeURIComponent(formatDateForParam(start))}&end=${encodeURIComponent(formatDateForParam(end))}`,
    [start, end]
  )

  // Data Fetching
  const { data: totalUsers, loading: totalUsersLoading } = useFetchData<TotalUsers>('/total-users', [])
  const { data: totals, loading: totalsLoading, error: totalsError } = useFetchData<Totals>(`/totals${query}`, [query])
  const { data: ytRows, loading: ytLoading, error: ytError } = useFetchData<Row[]>(`/youtube${query}`, [query])
  const { data: liRows, loading: liLoading, error: liError } = useFetchData<Row[]>(`/linkedin${query}`, [query])
  const { data: googleRows, loading: googleLoading, error: googleError } = useFetchData<Row[]>(`/google${query}`, [query])
  const { data: brevoRows, loading: brevoLoading, error: brevoError, refetch: refetchBrevo } = useFetchData<Row[]>(`/brevo`, [])

  // Consolidated error handling for Overview
  const overviewError = totalsError || liError || ytError || googleError || brevoError

  return (
    <div className="container">
      <div className="header">
        <h1>Analytics Dashboard</h1>
        
        {/* Date Filter Controls - Hide on Brevo tab */}
        {activeTab !== 'brevo' && (
          <DateRangeFilter 
            start={start} 
            end={end} 
            onStartChange={setStart} 
            onEndChange={setEnd} 
            onRefresh={() => setEnd(new Date(end))} 
          />
        )}

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          start={start}
          end={end}
          totals={totals}
          totalsLoading={totalsLoading}
          totalUsers={totalUsers}
          totalUsersLoading={totalUsersLoading}
          liRows={liRows || []}
          liLoading={liLoading}
          ytRows={ytRows || []}
          ytLoading={ytLoading}
          googleRows={googleRows || []}
          googleLoading={googleLoading}
          brevoRows={brevoRows || []}
          brevoLoading={brevoLoading}
          error={overviewError}
        />
      )}

      {activeTab === 'linkedin' && (
        <LinkedInTab 
          start={start} 
          end={end} 
          rows={liRows || []} 
          loading={liLoading} 
          error={liError} 
        />
      )}

      {activeTab === 'youtube' && (
        <YouTubeTab 
          start={start} 
          end={end} 
          rows={ytRows || []} 
          loading={ytLoading} 
          error={ytError} 
        />
      )}

      {activeTab === 'google' && (
        <GoogleTab 
          start={start} 
          end={end} 
          rows={googleRows || []} 
          loading={googleLoading} 
          error={googleError} 
        />
      )}

      {activeTab === 'brevo' && (
        <BrevoTab 
          rows={brevoRows || []} 
          loading={brevoLoading} 
          error={brevoError} 
          onRefresh={refetchBrevo} 
        />
      )}
    </div>
  )
}

export default App
