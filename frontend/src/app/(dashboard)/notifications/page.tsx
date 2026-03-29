'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellAlertIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  HomeModernIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { cachedGet, getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';
type AlertCategory =
  | 'overdue_rent'
  | 'upcoming_rent'
  | 'lease_deadline'
  | 'maintenance'
  | 'property_update'
  | 'recent_activity';

type AlertItem = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  action_label?: string;
  action_url?: string;
  created_at?: string;
  due_date?: string;
  is_read?: boolean;
  source: 'monitor' | 'activity';
  activity_type?: string;
  tenant?: {
    id: number;
    full_name: string;
    phone?: string;
  } | null;
  property?: {
    id: number;
    name: string;
  } | null;
  unit?: {
    id?: number;
    unit_number: string;
    unit_type?: string;
  } | null;
  metrics?: {
    amount?: number;
    days_overdue?: number;
    days_until_due?: number;
    days_until_lease_end?: number;
    vacant_units?: number;
    occupancy_rate?: number;
  };
};

type AlertsResponse = {
  unread: number;
  summary: Record<string, number> & {
    active: number;
  };
  alerts: AlertItem[];
  recent_activity: AlertItem[];
  settings: {
    reminder_days: number;
    lease_reminder_days: number;
  };
};

const severityStyles: Record<AlertSeverity, string> = {
  critical: 'border-danger/20 bg-danger/10 text-danger',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  info: 'border-info/20 bg-info/10 text-info',
  success: 'border-success/20 bg-success/10 text-success',
};

const severityLabels: Record<AlertSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
  success: 'Success',
};

const categoryLabels: Record<AlertCategory, string> = {
  overdue_rent: 'Overdue rent',
  upcoming_rent: 'Upcoming rent',
  lease_deadline: 'Lease deadline',
  maintenance: 'Maintenance',
  property_update: 'Property update',
  recent_activity: 'Recent activity',
};

const categoryIcons: Record<AlertCategory, typeof ExclamationTriangleIcon> = {
  overdue_rent: ExclamationTriangleIcon,
  upcoming_rent: ClockIcon,
  lease_deadline: CalendarDaysIcon,
  maintenance: WrenchScrewdriverIcon,
  property_update: HomeModernIcon,
  recent_activity: CheckCircleIcon,
};

const summaryCards = [
  { key: 'critical', label: 'Critical', accent: 'text-danger', tone: 'bg-danger/10' },
  { key: 'overdue_rent', label: 'Overdue rent', accent: 'text-danger', tone: 'bg-danger/10' },
  { key: 'upcoming_rent', label: 'Upcoming rent', accent: 'text-warning', tone: 'bg-warning/10' },
  { key: 'lease_deadline', label: 'Lease deadlines', accent: 'text-info', tone: 'bg-info/10' },
] as const;

export default function NotificationsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AlertCategory>('all');

  const fetchAlerts = async (force = false) => {
    try {
      const result = await cachedGet<AlertsResponse>('/notifications', { force, ttlMs: 15_000 });
      setData(result);
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load alerts.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAlerts();
  }, []);

  const refreshAlerts = async () => {
    invalidateGetCache('/notifications');
    setLoading(true);
    const success = await fetchAlerts(true);

    if (success) {
      toast.success('Alerts refreshed');
    }
  };

  const alerts = data?.alerts || [];
  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) {
      return false;
    }

    if (categoryFilter !== 'all' && alert.category !== categoryFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="glass-panel rounded-3xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_45%)] pointer-events-none" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <BellAlertIcon className="h-4 w-4" />
              Alerts Center
            </div>
            <div>
              <h2 className="text-3xl font-bold text-brand-900 dark:text-white">Real-time property attention board</h2>
              <p className="mt-2 text-sm text-brand-500">
                Tenant balances, payment schedules, lease dates, maintenance flags, and occupancy gaps are checked every time this page loads.
              </p>
            </div>
            {data && (
              <p className="text-sm text-brand-500">
                Rent reminders open {data.settings.reminder_days} days before due dates and lease reminders open {data.settings.lease_reminder_days} days before lease end.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm dark:bg-brand-900/60">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-400">Active alerts</p>
              <p className="mt-1 text-2xl font-bold text-brand-900 dark:text-white">{data?.summary.active ?? 0}</p>
            </div>
            <button
              type="button"
              onClick={refreshAlerts}
              className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              Refresh feed
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.key} className="glass-panel rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-brand-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-brand-900 dark:text-white">{data?.summary[card.key] ?? 0}</p>
              </div>
              <div className={cn('rounded-2xl p-3', card.tone)}>
                <BellAlertIcon className={cn('h-5 w-5', card.accent)} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-brand-900 dark:text-white">Live alerts</h3>
                <p className="text-sm text-brand-500">Filter urgent items and jump straight to the affected tenant or property.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
                <FunnelIcon className="h-4 w-4" />
                Filters
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(['all', 'critical', 'warning', 'info'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSeverityFilter(value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    severityFilter === value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-brand-600 hover:border-primary/40 hover:text-primary dark:bg-brand-900'
                  )}
                >
                  {value === 'all' ? 'All severities' : severityLabels[value]}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(['all', 'overdue_rent', 'upcoming_rent', 'lease_deadline', 'maintenance', 'property_update'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategoryFilter(value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    categoryFilter === value
                      ? 'border-brand-900 bg-brand-900 text-white dark:border-white dark:bg-white dark:text-brand-900'
                      : 'border-border bg-white text-brand-600 hover:border-brand-400 hover:text-brand-900 dark:bg-brand-900'
                  )}
                >
                  {value === 'all' ? 'All categories' : categoryLabels[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="glass-panel rounded-2xl p-12">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-success" />
                <h3 className="mt-4 text-lg font-bold text-brand-900 dark:text-white">No alerts match these filters</h3>
                <p className="mt-2 text-sm text-brand-500">Try broadening the filters or refresh the feed to pull the latest monitoring results.</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const Icon = categoryIcons[alert.category];

                return (
                  <article key={alert.id} className="glass-panel rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div className={cn('mt-1 rounded-2xl border p-3', severityStyles[alert.severity])}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', severityStyles[alert.severity])}>
                              {severityLabels[alert.severity]}
                            </span>
                            <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-brand-500">
                              {categoryLabels[alert.category]}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-brand-900 dark:text-white">{alert.title}</h3>
                            <p className="mt-1 text-sm text-brand-500">{alert.message}</p>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-brand-500">
                            {alert.tenant && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 dark:bg-brand-800">
                                <BellAlertIcon className="h-4 w-4" />
                                {alert.tenant.full_name}
                              </span>
                            )}
                            {alert.property && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 dark:bg-brand-800">
                                <BuildingOffice2Icon className="h-4 w-4" />
                                {alert.property.name}
                              </span>
                            )}
                            {alert.unit?.unit_number && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 dark:bg-brand-800">
                                <HomeModernIcon className="h-4 w-4" />
                                Unit {alert.unit.unit_number}
                              </span>
                            )}
                            {alert.due_date && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 dark:bg-brand-800">
                                <CalendarDaysIcon className="h-4 w-4" />
                                {formatDate(alert.due_date)}
                              </span>
                            )}
                          </div>

                          {typeof alert.metrics?.amount === 'number' && (
                            <p className="text-sm font-semibold text-brand-900 dark:text-white">
                              Amount involved: {formatCurrency(alert.metrics.amount)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex min-w-[170px] flex-col items-start gap-3 md:items-end">
                        <p className="text-xs uppercase tracking-[0.2em] text-brand-400">
                          {alert.created_at ? formatDate(alert.created_at) : 'Live'}
                        </p>
                        {alert.action_url && (
                          <Link
                            to={alert.action_url}
                            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                          >
                            {alert.action_label || 'Open'}
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="glass-panel rounded-2xl p-5">
            <h3 className="text-lg font-bold text-brand-900 dark:text-white">Coverage</h3>
            <div className="mt-4 space-y-3 text-sm text-brand-500">
              <div className="rounded-2xl border border-border p-4">
                <p className="font-semibold text-brand-900 dark:text-white">Rent monitoring</p>
                <p className="mt-1">Flags overdue balances and upcoming due dates from tenant records and rent schedules.</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-semibold text-brand-900 dark:text-white">Lease deadlines</p>
                <p className="mt-1">Highlights leases approaching their end date so renewals and move-outs are not missed.</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-semibold text-brand-900 dark:text-white">Property activity</p>
                <p className="mt-1">Surfaces units in maintenance and low-occupancy properties that need leasing attention.</p>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">Recent activity</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-brand-400">Stored feed</span>
            </div>

            <div className="mt-4 space-y-3">
              {(data?.recent_activity || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-brand-500">
                  New payments and system notifications will appear here as activity comes in.
                </p>
              ) : (
                data?.recent_activity.map((item) => {
                  const Icon = categoryIcons[item.category];

                  return (
                    <div key={item.id} className="rounded-2xl border border-border p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('rounded-xl border p-2', severityStyles[item.severity])}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-brand-900 dark:text-white">{item.title}</p>
                            <span className="shrink-0 text-xs text-brand-400">
                              {item.created_at ? formatDate(item.created_at) : ''}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-brand-500">{item.message}</p>
                          {item.action_url && (
                            <Link to={item.action_url} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
                              {item.action_label || 'Open'}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
