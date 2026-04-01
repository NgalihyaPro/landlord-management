import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { prefetchGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  HomeIcon, BuildingOfficeIcon, UserGroupIcon,
  CreditCardIcon, ChartBarIcon, BellIcon,
  Cog6ToothIcon, ArrowRightOnRectangleIcon,
  UserIcon, ShieldCheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

type NavLink = {
  href: string;
  labelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  roles?: string[];
  platformAdminOnly?: boolean;
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const PRIMARY_LINKS: NavLink[] = [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: HomeIcon },
  { href: '/properties', labelKey: 'sidebar.properties', icon: BuildingOfficeIcon },
  { href: '/units', labelKey: 'sidebar.units', icon: HomeIcon },
  { href: '/tenants', labelKey: 'sidebar.tenants', icon: UserGroupIcon },
  { href: '/payments', labelKey: 'sidebar.payments', icon: CreditCardIcon },
  { href: '/reports', labelKey: 'sidebar.reports', icon: ChartBarIcon },
];

const SECONDARY_LINKS: NavLink[] = [
  { href: '/admin/approvals', labelKey: 'common.approvals', icon: ShieldCheckIcon, platformAdminOnly: true },
  { href: '/notifications', labelKey: 'sidebar.alerts', icon: BellIcon },
  { href: '/settings', labelKey: 'common.settings', icon: Cog6ToothIcon },
  { href: '/users', labelKey: 'common.user_staff', icon: UserIcon, roles: ['admin'] },
];

const DATA_PREFETCHERS: Record<string, () => void> = {
  '/dashboard': () => prefetchGet('/dashboard'),
  '/properties': () => prefetchGet('/properties'),
  '/units': () => prefetchGet('/units'),
  '/tenants': () => prefetchGet('/tenants'),
  '/payments': () => { prefetchGet('/payments'); prefetchGet('/payments/methods'); },
  '/reports': () => prefetchGet(`/reports/overview?month=${getCurrentMonth()}`),
  '/notifications': () => prefetchGet('/notifications'),
  '/settings': () => prefetchGet('/settings'),
  '/users': () => prefetchGet('/users'),
  '/admin/approvals': () => prefetchGet('/platform-admin/registrations'),
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const prefetchLink = (href: string) => {
    DATA_PREFETCHERS[href]?.();
  };

  useEffect(() => {
    PRIMARY_LINKS.forEach((link) => prefetchLink(link.href));
    SECONDARY_LINKS.forEach((link) => {
      if (link.platformAdminOnly && !user?.is_platform_admin) return;
      if (!link.roles || (user && link.roles.includes(user.role))) {
        prefetchLink(link.href);
      }
    });
  }, [user]);

  // Close sidebar on navigation (mobile)
  const handleNavClick = () => {
    onClose();
  };

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={cn(
          'lp-sidebar-shell fixed inset-y-0 left-0 z-40 flex h-screen w-72 flex-col justify-between border-r shadow-xl transition-transform duration-300 ease-in-out',
          // Mobile: slide in/out; Desktop: always visible
          'md:relative md:translate-x-0 md:w-64 md:z-auto md:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Logo + Close button */}
          <div className="flex h-24 items-center justify-between px-5">
            <div className="lp-sidebar-brand">
              <div className="lp-sidebar-logo-wrap">
                <img src="/logo.png" alt="LandlordPro logo" className="lp-sidebar-logo-image" />
              </div>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={onClose}
              className="lp-sidebar-close-btn md:hidden"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-1.5 px-4">
            <p className="lp-sidebar-section-label">
              {t('sidebar.menu_title')}
            </p>
            {PRIMARY_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={handleNavClick}
                  onMouseEnter={() => prefetchLink(link.href)}
                  className={cn(
                    'lp-sidebar-link',
                    isActive ? 'lp-sidebar-link-active' : ''
                  )}
                >
                  <Icon className="lp-sidebar-link-icon" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="lp-sidebar-divider border-t p-4">
          <div className="mb-4 flex flex-col gap-1.5">
            {SECONDARY_LINKS.map((link) => {
              if (link.platformAdminOnly && !user?.is_platform_admin) return null;
              if (link.roles && user && !link.roles.includes(user.role)) return null;
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={handleNavClick}
                  onMouseEnter={() => prefetchLink(link.href)}
                  className={cn(
                    'lp-sidebar-link',
                    isActive ? 'lp-sidebar-link-active' : ''
                  )}
                >
                  <Icon className="lp-sidebar-link-icon" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => { onClose(); logout(); }}
            className="lp-sidebar-signout"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            {t('common.sign_out')}
          </button>

          {user && (
            <div className="lp-sidebar-user-card">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm">
                {user.full_name.charAt(0)}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-brand-900 dark:text-brand-100">
                  {user.full_name}
                </span>
                <span className="truncate text-xs text-brand-500 dark:text-brand-400 capitalize">
                  {user.role}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
