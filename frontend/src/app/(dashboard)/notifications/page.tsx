'use client';
import { useEffect, useState } from 'react';
import api, { cachedGet, invalidateGetCache } from '@/lib/api';
import { BellAlertIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const [data, setData] = useState<{ notifications: any[]; unread: number }>({ notifications: [], unread: 0 });
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async (force = false) => {
    try {
      const result = await cachedGet<{ notifications: any[]; unread: number }>('/notifications', { force });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/all/read');
      invalidateGetCache('/notifications');
      toast.success('All alerts marked as read');
      fetchNotifs(true);
    } catch (err) {
      toast.error('Failed to mark alerts');
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'overdue': return <ExclamationCircleIcon className="h-6 w-6 text-danger" />;
      case 'due_soon': return <ClockIcon className="h-6 w-6 text-warning" />;
      case 'payment_received': return <CheckCircleIcon className="h-6 w-6 text-success" />;
      default: return <BellAlertIcon className="h-6 w-6 text-info" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-brand-900 dark:text-white">Alerts Center</h2>
          <p className="text-sm text-brand-500">System notifications and important reminders</p>
        </div>
        {data.unread > 0 && (
          <button
            onClick={markAllRead}
            className="shrink-0 text-sm font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 rounded-lg"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-sm divide-y divide-border/50">
          {data.notifications.length > 0 ? data.notifications.map((n: any) => (
            <div key={n.id} className={`p-4 flex gap-4 hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors ${!n.is_read ? 'bg-brand-50/30 dark:bg-brand-800/30' : ''}`}>
              <div className="shrink-0 mt-1">
                {getIcon(n.type)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap justify-between items-start gap-x-4 gap-y-0.5 mb-1">
                  <h4 className={`text-sm font-bold ${!n.is_read ? 'text-brand-900 dark:text-white' : 'text-brand-700 dark:text-brand-300'}`}>
                    {n.title}
                  </h4>
                  <span className="text-xs font-semibold text-brand-400 whitespace-nowrap shrink-0">
                    {formatDate(n.created_at)}
                  </span>
                </div>
                <p className={`text-sm ${!n.is_read ? 'text-brand-700 dark:text-brand-200 font-medium' : 'text-brand-500'}`}>
                  {n.message}
                </p>
              </div>
              {!n.is_read && (
                <div className="shrink-0 flex items-center">
                  <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"></div>
                </div>
              )}
            </div>
          )) : (
            <div className="p-12 text-center">
              <BellAlertIcon className="mx-auto h-12 w-12 text-brand-200 mb-3" />
              <p className="text-brand-500 font-medium">You're all caught up! No active alerts.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
