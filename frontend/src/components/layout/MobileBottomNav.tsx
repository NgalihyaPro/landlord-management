import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CreditCardIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BuildingOfficeIcon as BuildingIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid';
import { useLanguage } from '@/context/LanguageContext';

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: HomeIcon, activeIcon: HomeIconSolid },
  { href: '/properties', labelKey: 'sidebar.properties', icon: BuildingOfficeIcon, activeIcon: BuildingIconSolid },
  { href: '/tenants', labelKey: 'sidebar.tenants', icon: UserGroupIcon, activeIcon: UserGroupIconSolid },
  { href: '/payments', labelKey: 'sidebar.payments', icon: CreditCardIcon, activeIcon: CreditCardIconSolid },
  { href: '/reports', labelKey: 'sidebar.reports', icon: ChartBarIcon, activeIcon: ChartBarIconSolid },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-border bg-white/90 dark:bg-brand-900/90 backdrop-blur-md safe-area-pb">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = isActive ? item.activeIcon : item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors active:scale-95',
                isActive
                  ? 'text-primary'
                  : 'text-brand-400 hover:text-brand-600 dark:text-brand-500'
              )}
            >
              <Icon className="h-6 w-6" />
              <span className={cn(
                'text-[10px] font-semibold tracking-wide truncate max-w-[60px] text-center leading-tight',
                isActive ? 'text-primary' : 'text-brand-400'
              )}>
                {t(item.labelKey)}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
