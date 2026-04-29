import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  ArrowUpRightIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
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

type DashboardCard = {
  title: string;
  value?: string | number;
  subtext?: string;
  icon: typeof BuildingOfficeIcon;
  color: string;
  bg: string;
  detailRows?: Array<{
    label: string;
    value: string;
  }>;
};

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  const normalizeCurrency = (value: string) => value.replace(/\u00a0/g, ' ');
  const formatCountLabel = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;

  const currencyValue = normalizeCurrency(formatCurrency(data.summary.collected_this_month));
  const expectedValue = normalizeCurrency(formatCurrency(data.summary.expected_this_month));

  const cards: DashboardCard[] = [
    {
      title: td.properties_units,
      detailRows: [
        {
          label: td.total_properties,
          value: formatCountLabel(data.summary.total_properties, 'Property', 'Properties'),
        },
        {
          label: td.total_units,
          value: formatCountLabel(data.summary.total_units, 'Unit', 'Units'),
        },
      ],
      icon: BuildingOfficeIcon,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      title: td.active_tenants,
      value: data.summary.total_tenants,
      icon: UserGroupIcon,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: td.monthly_collection,
      value: currencyValue,
      subtext: `of ${expectedValue}`,
      icon: CurrencyDollarIcon,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      title: td.overdue_cases,
      value: data.summary.overdue_tenants,
      icon: ExclamationTriangleIcon,
      color: 'text-danger',
      bg: 'bg-danger/10',
    },
  ];

  return (
    <div className="relative z-10 space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-brand-900 to-brand-600 bg-clip-text text-xl font-bold text-transparent dark:from-white dark:to-brand-300 md:text-2xl">
            {td.title}
          </h2>
          <p className="mt-1 text-sm text-brand-500">{td.welcome}</p>
        </div>
        <Link
          to="/payments/new"
          className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 sm:flex"
        >
          <CurrencyDollarIcon className="h-5 w-5" />
          {tp.record_payment}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
        {cards.map((kpi, idx) => (
          <div key={idx} className="glass-panel rounded-2xl p-4 transition-shadow hover:shadow-md md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="max-w-[12ch] text-sm font-semibold leading-snug text-brand-500 md:text-base">
                  {kpi.title}
                </p>

                {kpi.detailRows ? (
                  <div className="mt-4 space-y-3">
                    {kpi.detailRows.map((row) => (
                      <div key={row.label} className="rounded-xl bg-brand-50/80 px-3 py-2 dark:bg-brand-800/40">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-400">
                          {row.label}
                        </p>
                        <p className="mt-1 text-sm font-bold leading-tight text-brand-900 dark:text-white md:text-base">
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <h3 className="mt-3 break-words text-3xl font-bold leading-[1.05] tracking-tight text-brand-900 dark:text-white md:text-[2rem]">
                      {kpi.value}
                    </h3>
                    {kpi.subtext && (
                      <p className="mt-3 text-xs leading-snug text-brand-400 md:text-sm">
                        {kpi.subtext}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className={`ml-1 shrink-0 rounded-xl p-2 md:p-3 ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 md:h-6 md:w-6 ${kpi.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl border-l-4 border-l-danger p-4 md:p-6">
          <div className="mb-4 flex justify-between">
            <h3 className="flex items-center gap-2 text-base font-bold text-brand-900 dark:text-white md:text-lg">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-danger" />
              <span className="truncate">{td.overdue_rent}</span>
            </h3>
            <Link
              to="/reports?tab=overdue"
              className="ml-2 flex shrink-0 items-center text-xs font-medium text-primary hover:underline md:text-sm"
            >
              {td.view_all} <ArrowUpRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {data.overdue_tenants.length === 0 ? (
              <p className="py-4 text-sm text-brand-500">{td.no_overdue}</p>
            ) : (
              data.overdue_tenants.slice(0, 5).map((tenant: any) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-brand-50 dark:hover:bg-brand-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-900 dark:text-white">
                      {tenant.full_name}
                    </p>
                    <p className="truncate text-xs text-brand-500">
                      {tenant.property_name} • {tenant.unit_number}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-sm font-bold text-danger">
                      {formatCurrency(tenant.outstanding_balance || tenant.monthly_rent)}
                    </p>
                    <p className="text-xs text-danger/80">
                      {tenant.days_overdue} {td.days_late}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border-l-4 border-l-warning p-4 md:p-6">
          <div className="mb-4 flex justify-between">
            <h3 className="flex items-center gap-2 text-base font-bold text-brand-900 dark:text-white md:text-lg">
              <ClockIcon className="h-5 w-5 shrink-0 text-warning" />
              <span className="truncate">{td.due_7_days}</span>
            </h3>
            <Link
              to="/reports?tab=duesoon"
              className="ml-2 flex shrink-0 items-center text-xs font-medium text-primary hover:underline md:text-sm"
            >
              {td.view_all} <ArrowUpRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {data.due_soon_tenants.length === 0 ? (
              <p className="py-4 text-sm text-brand-500">{td.no_due_soon}</p>
            ) : (
              data.due_soon_tenants.slice(0, 5).map((tenant: any) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-brand-50 dark:hover:bg-brand-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-900 dark:text-white">
                      {tenant.full_name}
                    </p>
                    <p className="truncate text-xs text-brand-500">
                      {tenant.property_name} • {tenant.unit_number}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-sm font-bold text-brand-900 dark:text-white">
                      {formatCurrency(tenant.monthly_rent)}
                    </p>
                    <p className="text-xs font-medium text-warning">
                      Due {formatDate(tenant.next_due_date)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 md:col-span-2 md:p-6">
          <div className="mb-4 flex justify-between">
            <h3 className="text-base font-bold text-brand-900 dark:text-white md:text-lg">
              {td.recent_payments}
            </h3>
            <Link
              to="/payments"
              className="flex items-center text-xs font-medium text-primary hover:underline md:text-sm"
            >
              {td.payment_history} <ArrowUpRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3 md:hidden">
            {data.recent_payments.slice(0, 5).map((pay: any) => (
              <div
                key={pay.id}
                className="flex items-center justify-between rounded-xl bg-brand-50/50 p-3 dark:bg-brand-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand-900 dark:text-white">
                    {pay.tenant_name}
                  </p>
                  <p className="truncate text-xs text-brand-500">
                    {pay.property_name} • {pay.unit_number}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-400">{formatDate(pay.payment_date)}</p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-sm font-bold text-brand-900 dark:text-white">
                    {formatCurrency(pay.amount_paid)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(pay.payment_status)}`}
                  >
                    {tt.statuses[pay.payment_status as keyof typeof tt.statuses] || pay.payment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-brand-500">
                  <th className="pb-3 font-semibold">{tt.table.name}</th>
                  <th className="pb-3 font-semibold">{tp.table.tenant_property}</th>
                  <th className="pb-3 font-semibold">{tp.table.date_paid}</th>
                  <th className="pb-3 font-semibold">{tp.table.method}</th>
                  <th className="pb-3 text-right font-semibold">{tp.table.amount_paid}</th>
                  <th className="pb-3 text-center font-semibold">{tp.table.status}</th>
                </tr>
              </thead>
              <tbody className="text-sm text-brand-700 dark:text-brand-300">
                {data.recent_payments.slice(0, 6).map((pay: any) => (
                  <tr
                    key={pay.id}
                    className="border-b border-border/50 transition-colors hover:bg-brand-50/50 dark:hover:bg-brand-800/50"
                  >
                    <td className="py-4 font-semibold text-brand-900 dark:text-white">{pay.tenant_name}</td>
                    <td className="py-4 text-brand-500">
                      {pay.property_name} • {pay.unit_number}
                    </td>
                    <td className="py-4">{formatDate(pay.payment_date)}</td>
                    <td className="py-4">{pay.payment_method}</td>
                    <td className="py-4 text-right font-bold text-brand-900 dark:text-white">
                      {formatCurrency(pay.amount_paid)}
                    </td>
                    <td className="py-4 text-center">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(pay.payment_status)}`}
                      >
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
