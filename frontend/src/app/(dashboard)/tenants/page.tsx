import { useEffect, useState } from 'react';
import api, { cachedGet, invalidateGetCache, getApiErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  UserGroupIcon, PlusIcon, MagnifyingGlassIcon,
  PhoneIcon, ArrowUpRightIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';

export default function TenantsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<{ tenants: any[]; total: number }>({ tenants: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const tt = t('tenants');

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const query = new URLSearchParams();
        if (search) query.append('search', search);
        if (statusFilter) query.append('status', statusFilter);

        const queryString = query.toString();
        const result = await cachedGet<{ tenants: any[]; total: number }>(
          `/tenants${queryString ? `?${queryString}` : ''}`
        );
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchTenants();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/tenants/${deleteTarget.id}`);
      invalidateGetCache('/tenants');
      invalidateGetCache('/units');
      setData((prev) => ({
        ...prev,
        tenants: prev.tenants.filter((t) => t.id !== deleteTarget.id),
        total: prev.total - 1,
      }));
      toast.success(`Tenant "${deleteTarget.full_name}" has been removed.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove tenant.'));
      throw err;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{tt.title}</h2>
          <p className="text-brand-500">{tt.desc}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400" />
            <input
              type="text"
              placeholder={tt.search_placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary text-sm text-brand-700 dark:text-brand-300"
          >
            <option value="">{tt.all_statuses}</option>
            <option value="paid">{tt.statuses.paid}</option>
            <option value="due_soon">{tt.statuses.due_soon}</option>
            <option value="overdue">{tt.statuses.overdue}</option>
            <option value="partial">{tt.statuses.partial}</option>
          </select>
          <Link to="/tenants/new" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap">
            <PlusIcon className="h-5 w-5" />
            {tt.add_tenant}
          </Link>
        </div>
      </div>

      {loading && !data.tenants.length ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.tenants.length > 0 ? data.tenants.map((t: any) => (
            <div key={t.id} className="glass-panel rounded-2xl p-6 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
              {/* Status color accent line at top */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${getStatusColor(t.payment_status).split(' ')[0]}`} />

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-800 text-primary font-bold text-lg">
                    {t.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-brand-900 dark:text-white leading-tight">{t.full_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-brand-500 mt-1">
                      <PhoneIcon className="h-3 w-3" />
                      {t.phone}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(t)}
                  className="p-1.5 rounded-lg text-brand-400 hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove tenant"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 my-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">{tt.table.unit}</p>
                  <p className="font-medium text-brand-900 dark:text-white text-sm mt-0.5">{t.unit_number}</p>
                  <p className="text-xs text-brand-500 max-w-full truncate">{t.property_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">{tt.table.status}</p>
                  <div className="mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(t.payment_status)}`}>
                      {tt.statuses[t.payment_status as keyof typeof tt.statuses] || t.payment_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">{tt.table.rent}</p>
                  <p className="font-bold text-brand-900 dark:text-white text-sm mt-0.5">{formatCurrency(t.monthly_rent)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">{tt.table.due_date}</p>
                  <p className={`font-bold text-sm mt-0.5 ${t.payment_status === 'overdue' ? 'text-danger' : 'text-brand-900 dark:text-white'}`}>
                    {formatDate(t.next_due_date)}
                  </p>
                </div>
              </div>

              {t.outstanding_balance > 0 && (
                <div className="bg-danger/5 border border-danger/10 p-3 rounded-lg mb-4 flex justify-between items-center">
                  <span className="text-xs font-semibold text-danger">Arrears / Balance</span>
                  <span className="font-bold text-danger text-sm">{formatCurrency(t.outstanding_balance)}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Link to={`/tenants/${t.id}`} className="flex-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-800 dark:hover:bg-brand-700 text-brand-700 dark:text-white text-center py-2 rounded-lg text-sm font-semibold transition-colors">
                  View Profile
                </Link>
                <button className="flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary px-4 rounded-lg transition-colors group-hover:bg-primary group-hover:text-white">
                  <ArrowUpRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-20 bg-white/50 dark:bg-brand-900/50 rounded-2xl border border-dashed border-brand-300">
              <UserGroupIcon className="mx-auto h-12 w-12 text-brand-400 mb-4" />
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">No tenants found</h3>
              <p className="text-brand-500 max-w-sm mx-auto mt-2">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Tenant"
        description="Are you sure you want to remove this tenant? Their unit will be marked as vacant. Payment history is preserved."
        itemName={deleteTarget ? `${deleteTarget.full_name} — Unit ${deleteTarget.unit_number}` : undefined}
        warning={deleteTarget?.outstanding_balance > 0 ? `This tenant has an outstanding balance of ${formatCurrency(deleteTarget.outstanding_balance)}.` : undefined}
      />
    </div>
  );
}
