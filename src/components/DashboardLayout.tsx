import type { ReactNode } from 'react';

type DashboardLayoutProps = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export function DashboardLayout({ sidebar, header, children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      {sidebar}
      <div className="main-wrapper">
        <header className="top-header">
          {header}
        </header>
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}

