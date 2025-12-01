import { useState, useMemo } from 'react'
import './App.css'

// Types
import type { Totals, TotalUsers, Row, QueryRow, TabType } from './shared/types'

// Components
import { DateRangeFilter } from './shared/components/DateRangeFilter'
import { Sidebar } from './components/Sidebar'
import { DashboardLayout } from './components/DashboardLayout'
import { OverviewTab } from './components/OverviewTab'
import { LinkedInTab } from './components/LinkedInTab'
import { YouTubeTab } from './components/YouTubeTab'
import { GoogleTab } from './components/GoogleTab'
import { SearchQueriesTab } from './components/SearchQueriesTab'
import { BrevoTab } from './components/BrevoTab'

// Hooks and Utils
import { useDateRange } from './shared/hooks/useDateRange'
import { useFetchData } from './shared/hooks/useFetchData'
import { formatDateForParam } from './shared/utils/formatters'

const tabTitles: Record<TabType, string> = {
  overview: 'Dashboard Overview',
  linkedin: 'LinkedIn Analytics',
  youtube: 'YouTube Analytics',
  google: 'Google Analytics',
  'search-queries': 'Search Queries',
  brevo: 'Brevo Email Marketing'
};

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
  const { data: userGrowthData } = useFetchData<any[]>('/user-growth', []) // New Endpoint

  const { data: ytData, loading: ytLoading, error: ytError } = useFetchData<{rows: Row[], prevRows: Row[]}>(`/youtube${query}`, [query])
  const { data: liData, loading: liLoading, error: liError } = useFetchData<{rows: Row[], prevRows: Row[]}>(`/linkedin${query}`, [query])
  const { data: googleData, loading: googleLoading, error: googleError } = useFetchData<{rows: Row[], prevRows: Row[]}>(`/google${query}`, [query])
  
  const ytRows = ytData?.rows || []
  const ytPrevRows = ytData?.prevRows || []
  const liRows = liData?.rows || []
  const liPrevRows = liData?.prevRows || []
  const googleRows = googleData?.rows || []
  const googlePrevRows = googleData?.prevRows || []
  const { data: searchQueryRows, loading: searchQueriesLoading, error: searchQueriesError } = useFetchData<QueryRow[]>(`/search-queries${query}`, [query])
  const { data: brevoRows, loading: brevoLoading, error: brevoError, refetch: refetchBrevo } = useFetchData<Row[]>(`/brevo`, [])

  // Consolidated error handling for Overview
  const overviewError = totalsError || liError || ytError || googleError || brevoError

  const headerContent = (
    <div className="header-content">
      <h1 className="page-title">{tabTitles[activeTab]}</h1>
      {/* Date Filter Controls - Hide on Brevo tab */}
      {activeTab !== 'brevo' && (
        <DateRangeFilter 
          start={start} 
          end={end} 
          onStartChange={setStart} 
          onEndChange={setEnd} 
          onRefresh={() => setEnd(new Date(end))}
          layout="horizontal"
        />
      )}
    </div>
  );

  return (
    <DashboardLayout
      sidebar={<Sidebar activeTab={activeTab} onTabChange={setActiveTab} />}
      header={headerContent}
    >
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
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
          userGrowthData={userGrowthData || undefined}
          prevTotals={totals ? {
            totalUsers: totals.prevTotalUsers ?? 0,
            linkedinViews: totals.prevLinkedinViews ?? 0,
            youtubeViews: totals.prevYoutubeViews ?? 0,
            googleViews: totals.prevGoogleViews ?? 0,
            other: totals.prevOther ?? 0
          } : null}
        />
      )}

      {activeTab === 'linkedin' && (
        <LinkedInTab 
          start={start} 
          end={end} 
          rows={liRows} 
          prevRows={liPrevRows}
          loading={liLoading} 
          error={liError} 
        />
      )}

      {activeTab === 'youtube' && (
        <YouTubeTab 
          start={start} 
          end={end} 
          rows={ytRows} 
          prevRows={ytPrevRows}
          loading={ytLoading} 
          error={ytError} 
        />
      )}

      {activeTab === 'google' && (
        <GoogleTab 
          start={start} 
          end={end} 
          rows={googleRows} 
          prevRows={googlePrevRows}
          loading={googleLoading} 
          error={googleError} 
        />
      )}

      {activeTab === 'search-queries' && (
        <SearchQueriesTab 
          start={start} 
          end={end} 
          rows={searchQueryRows || []} 
          loading={searchQueriesLoading} 
          error={searchQueriesError} 
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
    </DashboardLayout>
  )
}

export default App
