import { useEffect, useMemo, useState } from 'react';
import api, { getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CheckIcon,
  CreditCardIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

const formatDateInputValue = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const getLeaseStatus = (leaseEnd: string | null | undefined, isSw: boolean) => {
  if (!leaseEnd) {
    return { label: isSw ? 'Hakuna tarehe ya mwisho wa mkataba' : 'No lease end date', tone: 'text-brand-500', daysRemaining: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(leaseEnd);
  endDate.setHours(0, 0, 0, 0);

  const daysRemaining = Math.round((endDate.getTime() - today.getTime()) / 86400000);

  if (daysRemaining < 0) {
    return {
      label: isSw
        ? `Imechelewa kwa siku ${Math.abs(daysRemaining)}`
        : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`,
      tone: 'text-danger',
      daysRemaining,
    };
  }

  if (daysRemaining <= 30) {
    return {
      label: isSw
        ? `Zimebaki siku ${daysRemaining}`
        : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
      tone: 'text-warning',
      daysRemaining,
    };
  }

  return {
    label: isSw
      ? `Zimebaki siku ${daysRemaining}`
      : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
    tone: 'text-success',
    daysRemaining,
  };
};

export default function TenantProfilePage() {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [extendLeaseOpen, setExtendLeaseOpen] = useState(searchParams.get('focus') === 'lease');
  const [leaseEndInput, setLeaseEndInput] = useState('');
  const [leaseSaving, setLeaseSaving] = useState(false);
  const getPaymentStatusLabel = (status: string) => {
    if (!isSw) return status.replace('_', ' ');
    if (status === 'paid') return 'amelipa';
    if (status === 'due_soon') return 'inakaribia';
    if (status === 'overdue') return 'imepitwa';
    if (status === 'partial') return 'malipo kidogo';
    return status.replace('_', ' ');
  };

  const fetchTenant = async () => {
    try {
      const { data } = await api.get(`/tenants/${id}`);
      setTenant(data);
      setLeaseEndInput(formatDateInputValue(data.lease_end));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTenant();
  }, [id]);

  useEffect(() => {
    if (searchParams.get('focus') === 'lease') {
      setExtendLeaseOpen(true);
    }
  }, [searchParams]);

  const leaseStatus = useMemo(() => getLeaseStatus(tenant?.lease_end, isSw), [tenant?.lease_end, isSw]);

  const handleExtendLease = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!leaseEndInput) {
      toast.error(isSw ? 'Chagua tarehe mpya ya mwisho wa mkataba.' : 'Choose a new lease end date.');
      return;
    }

    setLeaseSaving(true);

    try {
      await api.put(`/tenants/${id}/extend-lease`, { lease_end: leaseEndInput });
      invalidateGetCache('/tenants');
      invalidateGetCache(`/tenants/${id}`);
      invalidateGetCache('/dashboard');
      invalidateGetCache('/notifications');
      invalidateGetCache('/reports');
      await fetchTenant();
      toast.success(isSw ? 'Mkataba umeongezwa. Arifa zitaondoka baada ya kubonyeza refresh ya alerts.' : 'Lease extended. Notifications will clear on the next alerts refresh.');
      setExtendLeaseOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kuongeza mkataba.' : 'Failed to extend lease.'));
    } finally {
      setLeaseSaving(false);
    }
  };

  const handleDeleteTenant = async () => {
    try {
      await api.delete(`/tenants/${id}`);
      invalidateGetCache('/tenants');
      invalidateGetCache(`/tenants/${id}`);
      invalidateGetCache('/units');
      invalidateGetCache('/dashboard');
      invalidateGetCache('/notifications');
      invalidateGetCache('/reports');
      invalidateGetCache('/properties');
      toast.success(isSw ? 'Mpangaji ameondolewa.' : 'Tenant removed successfully.');
      navigate('/tenants');
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kuondoa mpangaji.' : 'Failed to remove tenant.'));
      throw error;
    }
  };

  if (loading) return <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mt-20"></div>;
  if (!tenant) return <div className="text-center mt-20 font-semibold text-brand-500">{isSw ? 'Mpangaji hajapatikana.' : 'Tenant not found.'}</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div className="flex flex-1 items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{isSw ? 'Wasifu wa Mpangaji' : 'Tenant Profile'}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger/90"
            >
              <TrashIcon className="h-4 w-4" />
              {isSw ? 'Futa Mpangaji' : 'Delete Tenant'}
            </button>
            <Link
              to={`/tenants/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <PencilSquareIcon className="h-4 w-4" />
              {isSw ? 'Hariri Mpangaji' : 'Edit Tenant'}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${getStatusColor(tenant.payment_status).split(' ')[0]}`} />

            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <div className="h-20 w-20 bg-brand-100 dark:bg-brand-800 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-3 shadow-inner">
                {tenant.full_name.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-brand-900 dark:text-white">{tenant.full_name}</h3>
              <p className="text-sm font-medium text-brand-500 mt-1 flex items-center gap-1">
                <PhoneIcon className="h-4 w-4" /> {tenant.phone}
              </p>
              <div className="mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(tenant.payment_status)}`}>
                  {getPaymentStatusLabel(tenant.payment_status)}
                </span>
              </div>
            </div>

            <div className="border-t border-brand-100 dark:border-brand-800 pt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{isSw ? 'Mali' : 'Property'}</p>
                <div className="flex items-start gap-2 mt-1">
                  <MapPinIcon className="h-5 w-5 text-brand-500 shrink-0" />
                  <div>
                    <p className="font-bold text-brand-900 dark:text-white text-sm">
                      <Link to={`/properties/${tenant.property_id}`} className="hover:text-primary transition-colors underline decoration-brand-200 underline-offset-2">
                        {tenant.property_name}
                      </Link>
                    </p>
                    <p className="text-xs text-brand-500 mt-0.5">{isSw ? 'Chumba' : 'Unit'} {tenant.unit_number} ({tenant.unit_type})</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{isSw ? 'Kodi' : 'Rent'}</p>
                  <p className="font-bold text-brand-900 dark:text-white">{formatCurrency(tenant.monthly_rent)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{isSw ? 'Malipo Yajayo' : 'Next Due'}</p>
                  <p className={`font-bold ${tenant.payment_status === 'overdue' ? 'text-danger' : 'text-brand-900 dark:text-white'}`}>
                    {formatDate(tenant.next_due_date)}
                  </p>
                </div>
              </div>
            </div>

            {tenant.outstanding_balance > 0 && (
              <div className="mt-6 bg-danger/5 border border-danger/10 p-4 rounded-xl flex justify-between items-center text-danger">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">{isSw ? 'Salio la Kulipa' : 'Balance Due'}</p>
                  <p className="text-lg font-bold">{formatCurrency(tenant.outstanding_balance)}</p>
                </div>
                <Link to="/payments/new" className="px-3 py-1.5 bg-danger text-white text-xs font-bold rounded hover:bg-danger/90 transition-colors shadow-sm">
                  {isSw ? 'Lipa Sasa' : 'Pay Now'}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 bg-brand-50/50 dark:bg-brand-800/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalendarDaysIcon className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="text-lg font-bold text-brand-900 dark:text-white">{isSw ? 'Mapitio ya Mkataba' : 'Lease Review'}</h3>
                  <p className="text-sm text-brand-500">{isSw ? 'Ongeza mkataba hapa unapopelekwa na arifa kumkagua mpangaji huyu.' : 'Extend the lease here when an alert sends you to review this tenant.'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendLeaseOpen((current) => !current)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                {extendLeaseOpen ? (isSw ? 'Funga' : 'Close') : (isSw ? 'Ongeza mkataba' : 'Extend lease')}
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">{isSw ? 'Mwanzo wa Mkataba' : 'Lease Start'}</p>
                  <p className="mt-2 font-bold text-brand-900 dark:text-white">{formatDate(tenant.lease_start)}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">{isSw ? 'Mwisho wa Mkataba wa Sasa' : 'Current Lease End'}</p>
                  <p className="mt-2 font-bold text-brand-900 dark:text-white">{tenant.lease_end ? formatDate(tenant.lease_end) : (isSw ? 'Haijawekwa' : 'Not set')}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">{isSw ? 'Hali ya Mkataba' : 'Lease Status'}</p>
                  <p className={`mt-2 font-bold ${leaseStatus.tone}`}>{leaseStatus.label}</p>
                </div>
              </div>

              {extendLeaseOpen && (
                <form onSubmit={handleExtendLease} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-brand-500">{isSw ? 'Tarehe mpya ya mwisho wa mkataba' : 'New lease end date'}</label>
                    <input
                      type="date"
                      lang="en-GB"
                      value={leaseEndInput}
                      onChange={(event) => setLeaseEndInput(event.target.value)}
                      min={tenant.lease_end ? formatDateInputValue(tenant.lease_end) : formatDateInputValue(tenant.lease_start)}
                      className="mt-2 w-full rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 dark:border-brand-700 dark:bg-brand-900/60"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-brand-500">
                      {isSw
                        ? 'Kuhifadhi tarehe mpya ya mwisho wa mkataba kutafuta arifa ya deadline baada ya Notifications kufanyiwa refresh.'
                        : 'Saving a later end date resolves the lease deadline alert the next time Notifications refreshes.'}
                    </p>
                    <button
                      type="submit"
                      disabled={leaseSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-70"
                    >
                      {leaseSaving ? (
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                      {isSw ? 'Hifadhi Ongezeko la Mkataba' : 'Save lease extension'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 bg-brand-50/50 dark:bg-brand-800/50 flex items-center gap-3">
              <BanknotesIcon className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">{isSw ? 'Historia ya Malipo' : 'Payment History'}</h3>
            </div>

            <div className="p-0">
              {tenant.payment_history && tenant.payment_history.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {tenant.payment_history.map((payment: any) => (
                    <div key={payment.id} className="p-4 sm:p-5 hover:bg-brand-50/30 dark:hover:bg-brand-800/30 transition-colors flex flex-wrap gap-4 justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-success/10 p-2 rounded-lg text-success">
                          <CreditCardIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-brand-900 dark:text-white text-sm">{isSw ? 'Malipo ya Kodi' : 'Rent Payment'}</p>
                          <p className="text-xs text-brand-500 font-mono mt-0.5">{payment.receipt_number}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-success text-base">+{formatCurrency(payment.amount_paid)}</p>
                        <p className="text-xs text-brand-500 font-medium mt-0.5">{formatDate(payment.payment_date)}</p>
                      </div>

                      <div className="w-full sm:w-auto text-center sm:text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-success/20 bg-success/10 text-success inline-block">
                          {isSw ? 'Imekamilika' : 'Completed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <BanknotesIcon className="h-12 w-12 text-brand-200 dark:text-brand-700 mx-auto mb-3" />
                  <p className="text-brand-500 font-medium">{isSw ? 'Bado hakuna malipo yaliyorekodiwa.' : 'No payments recorded yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteTenant}
        title={isSw ? 'Futa Mpangaji' : 'Delete Tenant'}
        description={isSw
          ? 'Una uhakika unataka kumuondoa mpangaji huyu? Mpangaji atazimwa, historia ya malipo itabaki, na chumba kitakuwa wazi.'
          : 'Are you sure you want to remove this tenant? The tenant will be deactivated, payment history kept, and the assigned unit will be marked as vacant.'}
        itemName={tenant.full_name}
      />
    </div>
  );
}
