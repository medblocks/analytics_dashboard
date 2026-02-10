import { useState, useMemo } from 'react'
import './App.css'

// Types
import type { Totals, TotalUsers, Row, QueryRow, TabType, YTRankingRow, YTRankingApiResponse, UmamiRawData, YouTubeRawRow, LinkedInRawRow, ContactUsData } from './shared/types'

// Components
import { DateRangeFilter } from './shared/components/DateRangeFilter'
import { Sidebar } from './components/Sidebar'
import { DashboardLayout } from './components/DashboardLayout'
import { OverviewTab } from './components/OverviewTab'
import { LinkedInTab } from './components/LinkedInTab'
import { YouTubeTab } from './components/YouTubeTab'
import { GoogleTab } from './components/GoogleTab'
import { SearchQueriesTab } from './components/SearchQueriesTab'
import { YTSearchRankingTab } from './components/YTSearchRankingTab'
import { BrevoTab } from './components/BrevoTab'
import { RawUmamiTab } from './components/RawUmamiTab'
import { LinkedInRawTab } from './components/LinkedInRawTab'
import { YouTubeRawTab } from './components/YouTubeRawTab'
import { ContactUsTab } from './components/ContactUsTab'

// Hooks and Utils
import { useDateRange } from './shared/hooks/useDateRange'
import { useFetchData } from './shared/hooks/useFetchData'
import { formatDateForParam } from './shared/utils/formatters'

const tabTitles: Record<TabType, string> = {
  overview: 'Dashboard Overview',
  linkedin: 'LinkedIn Analytics',
  'linkedin-raw': 'LinkedIn Raw Analytics',
  youtube: 'YouTube Analytics',
  'youtube-raw': 'YouTube Raw Analytics',
  google: 'Google Analytics',
  'search-queries': 'Search Queries',
  'yt-search-ranking': 'YouTube Search Ranking',
  brevo: 'Brevo Email Marketing',
  'contact-us': 'Contact Us Analytics',
  'raw-umami': 'Raw Umami Analytics'
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
  const { data: ytRankingApiData, loading: ytRankingLoading, error: ytRankingError } = useFetchData<YTRankingApiResponse[]>(`/youtube-rankings${query}`, [query])
  
  // Transform API response to UI format
  const ytRankingRows: YTRankingRow[] = useMemo(() => {
    if (!ytRankingApiData) return []
    return ytRankingApiData.map((row) => ({
      keyword: row.keyword,
      fetchDate: row.fetch_date,
      watchTimeHours: row.watch_time_hours,
      averageViewDuration: row.average_view_duration,
      topThree: row.top_3 || [],
      sidharthVideos: row.sidharth_videos || [],
    }))
  }, [ytRankingApiData])
  const { data: brevoRows, loading: brevoLoading, error: brevoError, refetch: refetchBrevo } = useFetchData<Row[]>(`/brevo`, [])
  const { data: rawUmamiData, loading: rawUmamiLoading, error: rawUmamiError } = useFetchData<UmamiRawData>(`/umami-raw${query}`, [query])
  const { data: contactUsData, loading: contactUsLoading, error: contactUsError } = useFetchData<ContactUsData>(`/contact-us${query}`, [query])
  
  // Raw LinkedIn and YouTube data (mapped to directus_content only, no scraping required)
  const { data: liRawData, loading: liRawLoading, error: liRawError } = useFetchData<{rows: LinkedInRawRow[], prevRows: LinkedInRawRow[]}>(`/linkedin-raw${query}`, [query])
  const { data: ytRawData, loading: ytRawLoading, error: ytRawError } = useFetchData<{rows: YouTubeRawRow[], prevRows: YouTubeRawRow[]}>(`/youtube-raw${query}`, [query])
  
  const liRawRows = liRawData?.rows || []
  const liRawPrevRows = liRawData?.prevRows || []
  const ytRawRows = ytRawData?.rows || []
  const ytRawPrevRows = ytRawData?.prevRows || []

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

      {activeTab === 'linkedin-raw' && (
        <LinkedInRawTab 
          start={start} 
          end={end} 
          rows={liRawRows} 
          prevRows={liRawPrevRows}
          loading={liRawLoading} 
          error={liRawError} 
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

      {activeTab === 'youtube-raw' && (
        <YouTubeRawTab 
          start={start} 
          end={end} 
          rows={ytRawRows} 
          prevRows={ytRawPrevRows}
          loading={ytRawLoading} 
          error={ytRawError} 
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

      {activeTab === 'yt-search-ranking' && (
        <YTSearchRankingTab 
          start={start} 
          end={end} 
          rows={ytRankingRows || []} 
          loading={ytRankingLoading} 
          error={ytRankingError} 
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

      {activeTab === 'contact-us' && (
        <ContactUsTab 
          data={contactUsData || null} 
          loading={contactUsLoading} 
          error={contactUsError} 
        />
      )}

      {activeTab === 'raw-umami' && (
        <RawUmamiTab 
          data={rawUmamiData || null} 
          loading={rawUmamiLoading} 
          error={rawUmamiError} 
        />
      )}
    </DashboardLayout>
  )
}

export default App
