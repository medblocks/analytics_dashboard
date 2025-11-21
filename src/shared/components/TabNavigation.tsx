import type { TabType } from '../types'

type TabNavigationProps = {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="tab-navigation">
      <button className="btn" onClick={() => onTabChange('overview')} disabled={activeTab === 'overview'}>Overview</button>
      <button className="btn" onClick={() => onTabChange('linkedin')} disabled={activeTab === 'linkedin'}>LinkedIn</button>
      <button className="btn" onClick={() => onTabChange('youtube')} disabled={activeTab === 'youtube'}>YouTube</button>
      <button className="btn" onClick={() => onTabChange('google')} disabled={activeTab === 'google'}>Google</button>
      <button className="btn" onClick={() => onTabChange('brevo')} disabled={activeTab === 'brevo'}>Brevo</button>
    </div>
  )
}

