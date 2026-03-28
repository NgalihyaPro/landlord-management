import { BellIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { cachedGet } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type NotificationSummary = {
  unread: number;
};

export function Topbar() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  
  const titleMap: Record<string, string> = {
    '/dashboard': t('dashboard.title'),
    '/properties': t('sidebar.properties'),
    '/units': t('sidebar.units'),
    '/tenants': t('sidebar.tenants'),
    '/payments': t('sidebar.payments'),
    '/reports': t('sidebar.reports'),
    '/notifications': t('sidebar.alerts'),
    '/settings': t('common.settings'),
    '/users': t('common.user_staff'),
    '/admin/approvals': t('common.approvals'),
  };

  const getTitle = () => {
    const key = Object.keys(titleMap).find(k => pathname.startsWith(k));
    return key ? titleMap[key] : 'Landlord Workspace';
  };

  useEffect(() => {
    const fetchNotificationSummary = async () => {
      try {
        const data = await cachedGet<NotificationSummary & { notifications?: unknown[] }>('/notifications', { force: true, ttlMs: 5_000 });
        setUnreadCount(Number(data.unread || 0));
      } catch {
        setUnreadCount(0);
      }
    };

    if (user) {
      void fetchNotificationSummary();
    }
  }, [pathname, user]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white/50 px-8 backdrop-blur-md dark:bg-brand-900/50 sticky top-0 z-10 gap-4">
      <h1 className="text-xl font-bold tracking-tight text-brand-900 dark:text-white truncate">
        {getTitle()}
      </h1>

      <div className="flex items-center gap-4 sm:gap-6 ml-auto">
        {user?.organization_name && (
          <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-brand-600 shadow-sm lg:flex dark:bg-brand-800 dark:text-brand-200">
            <BuildingOfficeIcon className="h-4 w-4 text-primary" />
            <span className="max-w-[220px] truncate font-medium">{user.organization_name}</span>
          </div>
        )}

        <LanguageSwitcher />

        <Link to="/notifications" className="relative text-brand-500 hover:text-primary transition-colors shrink-0" aria-label={t('sidebar.alerts')}>
          <BellIcon className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
