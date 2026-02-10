import { 
  LayoutDashboard, 
  Linkedin, 
  Youtube, 
  Chrome, 
  Search, 
  Mail,
  Trophy,
  Database,
  Phone
} from 'lucide-react';
import type { TabType } from '../shared/types';

type SidebarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { id: 'linkedin-raw', label: 'LinkedIn Raw', icon: Linkedin },
    { id: 'youtube', label: 'YouTube', icon: Youtube },
    { id: 'youtube-raw', label: 'YouTube Raw', icon: Youtube },
    { id: 'google', label: 'Google', icon: Chrome },
    { id: 'search-queries', label: 'Search Queries', icon: Search },
    { id: 'yt-search-ranking', label: 'YT Rankings', icon: Trophy },
    { id: 'brevo', label: 'Brevo', icon: Mail },
    { id: 'contact-us', label: 'Contact Us', icon: Phone },
    { id: 'raw-umami', label: 'Raw Umami', icon: Database },
  ] as const;

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          {/* Assuming favicon is available, otherwise fallback to text only */}
          <img 
            src="https://medblocks.com/favicon.ico" 
            alt="Medblocks" 
            className="logo-icon"
            style={{ borderRadius: '4px' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="logo-text">Medblocks Analytics</span>
        </div>
      </div>
      
      <div className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
