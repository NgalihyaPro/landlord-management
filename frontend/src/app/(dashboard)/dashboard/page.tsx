import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { 
  BuildingOfficeIcon, UserGroupIcon, CurrencyDollarIcon,
  ExclamationTriangleIcon, ClockIcon, ArrowUpRightIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

interface DashboardStats {
  summary: {
    total_properties: number;
    total_units: number;
    occupied_units: number;
    vacant_units: number;
    total_tenants: number;
    paid_tenants: number;
    overdue_tenants: number;
    collected_this_month: number;
    expected_this_month: number;
  };
  due_soon_tenants: any[];
  overdue_tenants: any[];
  recent_payments: any[];
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const td = t('dashboard');
  const tp = t('payments');
  const tt = t('tenants');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const result = await cachedGet<DashboardStats>('/dashboard');
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  if (!data) return null;

  const normalizeCurrency = (value: string) => value.replace(/\u00a0/g, ' ');
  const formatCountLabel = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

  const cards = [
    {
      title: td.properties_units,
      value: `${formatCountLabel(data.summary.total_properties, 'Property', 'Properties')} · ${formatCountLabel(data.summary.total_units, 'Unit', 'Units')}`,
      icon: BuildingOfficeIcon,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    { title: td.active_tenants, value: data.summary.total_tenants, icon: UserGroupIcon, color: 'text-primary', bg: 'bg-primary/10' },
    {
      title: td.monthly_collection,
      value: normalizeCurrency(formatCurrency(data.summary.collected_this_month)),
      subtext: `of ${normalizeCurrency(formatCurrency(data.summary.expected_this_month))}`,
      icon: CurrencyDollarIcon,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    { title: td.overdue_cases, value: data.summary.overdue_tenants, icon: ExclamationTriangleIcon, color: 'text-danger', bg: 'bg-danger/10' },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative z-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-900 to-brand-600 dark:from-white dark:to-brand-300">
            {td.title}
          </h2>
          <p className="text-brand-500 mt-1 text-sm">{td.welcome}</p>
        </div>
        <Link to="/payments/new" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <CurrencyDollarIcon className="h-5 w-5" />
          {tp.record_payment}
        </Link>
      </div>

      {/* KPI Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {cards.map((kpi, idx) => (
          <div key={idx} className="glass-panel p-4 md:p-6 rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-brand-500 leading-tight">{kpi.title}</p>
                <h3 className="mt-1 md:mt-2 text-base md:text-2xl font-bold leading-tight text-brand-900 dark:text-white whitespace-normal break-words">
                  {kpi.value}
                </h3>
                {kpi.subtext && (
                  <p className="mt-1 text-[10px] md:text-xs leading-snug text-brand-400 whitespace-normal break-words">
                    {kpi.subtext}
                  </p>
                )}
              </div>
              <div className={`p-2 md:p-3 rounded-xl ${kpi.bg} shrink-0 ml-2`}>
                <kpi.icon className={`h-5 w-5 md:h-6 md:w-6 ${kpi.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Overdue Tenants */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 border-l-4 border-l-danger">
          <div className="flex justify-between mb-4">
            <h3 className="text-base md:text-lg font-bold flex items-center gap-2 text-brand-900 dark:text-white">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger shrink-0" />
              <span className="truncate">{td.overdue_rent}</span>
            </h3>
            <Link to="/reports?tab=overdue" className="text-xs md:text-sm font-medium text-primary hover:underline flex items-center shrink-0 ml-2">
              {td.view_all} <ArrowUpRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {data.overdue_tenants.length === 0 ? (
              <p className="text-sm text-brand-500 py-4">{td.no_overdue}</p>
            ) : (
              data.overdue_tenants.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex justify-between items-center p-3 hover:bg-brand-50 dark:hover:bg-brand-800 rounded-xl transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-brand-900 dark:text-white truncate">{t.full_name}</p>
                    <p className="text-xs text-brand-500 truncate">{t.property_name} • {t.unit_number}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-bold text-sm text-danger">{formatCurrency(t.outstanding_balance || t.monthly_rent)}</p>
                    <p className="text-xs text-danger/80">{t.days_overdue} {td.days_late}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Due Soon Tenants */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 border-l-4 border-l-warning">
          <div className="flex justify-between mb-4">
            <h3 className="text-base md:text-lg font-bold flex items-center gap-2 text-brand-900 dark:text-white">
              <ClockIcon className="h-5 w-5 text-warning shrink-0" />
              <span className="truncate">{td.due_7_days}</span>
            </h3>
            <Link to="/reports?tab=duesoon" className="text-xs md:text-sm font-medium text-primary hover:underline flex items-center shrink-0 ml-2">
              {td.view_all} <ArrowUpRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {data.due_soon_tenants.length === 0 ? (
              <p className="text-sm text-brand-500 py-4">{td.no_due_soon}</p>
            ) : (
              data.due_soon_tenants.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex justify-between items-center p-3 hover:bg-brand-50 dark:hover:bg-brand-800 rounded-xl transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-brand-900 dark:text-white truncate">{t.full_name}</p>
                    <p className="text-xs text-brand-500 truncate">{t.property_name} • {t.unit_number}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-bold text-sm text-brand-900 dark:text-white">{formatCurrency(t.monthly_rent)}</p>
                    <p className="text-xs text-warning font-medium">Due {formatDate(t.next_due_date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payments — card list on mobile, table on desktop */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 lg:col-span-2">
          <div className="flex justify-between mb-4">
            <h3 className="text-base md:text-lg font-bold text-brand-900 dark:text-white">{td.recent_payments}</h3>
            <Link to="/payments" className="text-xs md:text-sm font-medium text-primary hover:underline flex items-center">
              {td.payment_history} <ArrowUpRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {data.recent_payments.slice(0, 5).map((pay: any) => (
              <div key={pay.id} className="flex items-center justify-between p-3 bg-brand-50/50 dark:bg-brand-800/50 rounded-xl">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-brand-900 dark:text-white truncate">{pay.tenant_name}</p>
                  <p className="text-xs text-brand-500 truncate">{pay.property_name} • {pay.unit_number}</p>
                  <p className="text-xs text-brand-400 mt-0.5">{formatDate(pay.payment_date)}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-bold text-sm text-brand-900 dark:text-white">{formatCurrency(pay.amount_paid)}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(pay.payment_status)}`}>
                    {tt.statuses[pay.payment_status as keyof typeof tt.statuses] || pay.payment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-brand-500">
                  <th className="pb-3 font-semibold">{tt.table.name}</th>
                  <th className="pb-3 font-semibold">{tp.table.tenant_property}</th>
                  <th className="pb-3 font-semibold">{tp.table.date_paid}</th>
                  <th className="pb-3 font-semibold">{tp.table.method}</th>
                  <th className="pb-3 font-semibold text-right">{tp.table.amount_paid}</th>
                  <th className="pb-3 font-semibold text-center">{tp.table.status}</th>
                </tr>
              </thead>
              <tbody className="text-sm text-brand-700 dark:text-brand-300">
                {data.recent_payments.slice(0, 6).map((pay: any) => (
                  <tr key={pay.id} className="border-b border-border/50 hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors">
                    <td className="py-4 font-semibold text-brand-900 dark:text-white">{pay.tenant_name}</td>
                    <td className="py-4 text-brand-500">{pay.property_name} • {pay.unit_number}</td>
                    <td className="py-4">{formatDate(pay.payment_date)}</td>
                    <td className="py-4">{pay.payment_method}</td>
                    <td className="py-4 font-bold text-right text-brand-900 dark:text-white">{formatCurrency(pay.amount_paid)}</td>
                    <td className="py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(pay.payment_status)}`}>
                        {tt.statuses[pay.payment_status as keyof typeof tt.statuses] || pay.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
