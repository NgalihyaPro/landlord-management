import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-brand-50 dark:bg-brand-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <Topbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative z-0">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
