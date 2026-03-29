import { useEffect, useMemo, useRef, useState } from 'react';
import api, { cachedGet, invalidateGetCache } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  CurrencyDollarIcon,
  ArrowLeftIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import SetupFlowStepper from '@/components/flow/SetupFlowStepper';

type TenantOption = {
  id: number;
  full_name: string;
  property_name: string;
  unit_number: string;
  monthly_rent: number;
  required_amount: number;
  outstanding_balance: number;
  payment_status: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

const getTenantLabel = (tenant: TenantOption) =>
  `${tenant.full_name} (${tenant.property_name} - Unit ${tenant.unit_number})`;

const toSafeNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export default function RecordPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantPickerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  const [formData, setFormData] = useState({
    tenant_id: '',
    amount_paid: '',
    payment_method_id: '',
    reference_number: '',
    payment_date: new Date().toISOString().split('T')[0],
  });

  const [selectedTenantInfo, setSelectedTenantInfo] = useState<TenantOption | null>(null);
  const tenantIdFromFlow = searchParams.get('tenant_id');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantsRes, methodsRes] = await Promise.all([
          cachedGet<{ tenants: TenantOption[]; total: number }>('/tenants?limit=200'),
          cachedGet<PaymentMethod[]>('/payments/methods'),
        ]);

        setTenants(tenantsRes.tenants || []);
        setMethods(methodsRes || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load tenants and payment methods');
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tenantPickerRef.current && !tenantPickerRef.current.contains(event.target as Node)) {
        setIsTenantDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTenants = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();

    return tenants.filter((tenant) => {
      if (!query) return true;

      return [
        tenant.full_name,
        tenant.property_name,
        tenant.unit_number,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [tenantSearch, tenants]);

  const selectTenant = async (tenant: TenantOption) => {
    const fallbackBalance = Math.max(toSafeNumber(tenant.outstanding_balance), 0);
    setSelectedTenantInfo(tenant);
    setTenantSearch(getTenantLabel(tenant));
    setIsTenantDropdownOpen(false);
    setFormData((prev) => ({
      ...prev,
      tenant_id: tenant.id.toString(),
      amount_paid: fallbackBalance > 0 ? fallbackBalance.toString() : '',
    }));

    try {
      const { data } = await api.get(`/tenants/${tenant.id}`);
      const paymentHistory = Array.isArray(data.payment_history) ? data.payment_history : [];
      const totalPaid = paymentHistory.reduce((sum: number, payment: any) => sum + toSafeNumber(payment.amount_paid), 0);
      const requiredAmount = toSafeNumber(data.required_amount) || toSafeNumber(data.monthly_rent);
      const refreshedBalance = Math.max(0, requiredAmount - totalPaid);

      const refreshedTenant: TenantOption = {
        ...tenant,
        monthly_rent: toSafeNumber(data.monthly_rent) || toSafeNumber(tenant.monthly_rent),
        required_amount: requiredAmount,
        outstanding_balance: refreshedBalance,
      };

      setSelectedTenantInfo(refreshedTenant);
      setFormData((prev) => ({
        ...prev,
        amount_paid: refreshedBalance > 0 ? refreshedBalance.toString() : '',
      }));
    } catch (error) {
      console.error('Failed to load tenant payment totals:', error);
      toast.error('Failed to load the latest tenant balance due.');
    }
  };

  useEffect(() => {
    if (!tenantIdFromFlow || !tenants.length || selectedTenantInfo) return;

    const matchedTenant = tenants.find((tenant) => tenant.id.toString() === tenantIdFromFlow);
    if (matchedTenant) {
      void selectTenant(matchedTenant);
    }
  }, [tenantIdFromFlow, tenants, selectedTenantInfo]);

  const handleTenantSearchChange = (value: string) => {
    setTenantSearch(value);
    setIsTenantDropdownOpen(true);

    if (selectedTenantInfo && value !== getTenantLabel(selectedTenantInfo)) {
      setSelectedTenantInfo(null);
      setFormData((prev) => ({
      ...prev,
      tenant_id: '',
      amount_paid: '',
      }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tenant_id) {
      toast.error('Please select a tenant');
      setIsTenantDropdownOpen(true);
      return;
    }

    setLoading(true);

    try {
      await api.post('/payments', {
        ...formData,
        tenant_id: Number(formData.tenant_id),
        payment_method_id: formData.payment_method_id ? Number(formData.payment_method_id) : null,
        amount_paid: Number(formData.amount_paid),
      });

      invalidateGetCache('/payments');
      invalidateGetCache('/dashboard');
      invalidateGetCache('/tenants');
      invalidateGetCache('/notifications');
      invalidateGetCache('/reports');
      toast.success('Setup flow complete. First payment recorded successfully.');
      navigate('/payments');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <SetupFlowStepper currentStep={3} />

      <div className="flex items-center gap-4">
        <Link to="/payments" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Record Payment</h2>
          <p className="text-brand-500">Log incoming rent payments and issue receipts</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-brand-600 dark:text-brand-300">
        Final step. Record the first payment to complete the guided property setup flow.
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-brand-500 uppercase">Select Tenant *</label>

            <div ref={tenantPickerRef} className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-brand-400" />
              <input
                type="text"
                value={tenantSearch}
                onChange={(e) => handleTenantSearchChange(e.target.value)}
                onFocus={() => setIsTenantDropdownOpen(true)}
                placeholder="Search by tenant, property, or unit"
                className="w-full rounded-lg border border-brand-200 bg-white/50 py-2.5 pl-9 pr-10 text-sm dark:border-brand-700 dark:bg-brand-900/50 focus:outline-none focus:border-primary focus:ring-1"
              />
              <ChevronUpDownIcon className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-brand-400" />

              {isTenantDropdownOpen && (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-brand-200 bg-white shadow-xl dark:border-brand-700 dark:bg-brand-900">
                  {loadingOptions ? (
                    <div className="px-4 py-3 text-sm text-brand-500">Loading tenants...</div>
                  ) : filteredTenants.length ? (
                    filteredTenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => selectTenant(tenant)}
                        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-brand-50 dark:hover:bg-brand-800/70 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-brand-900 dark:text-white">{tenant.full_name}</p>
                          <p className="text-xs text-brand-500">{tenant.property_name} - Unit {tenant.unit_number}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-brand-500 uppercase">Balance Due</p>
                          <p className="text-sm font-bold text-danger">{formatCurrency(toSafeNumber(tenant.outstanding_balance))}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-brand-500">No tenants match your search.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedTenantInfo && (
            <div className="bg-brand-50 dark:bg-brand-800/50 p-4 rounded-xl border border-brand-200 dark:border-brand-700 flex justify-between items-center gap-4">
              <div>
                <p className="text-xs text-brand-500 font-semibold uppercase">Expected Monthly Rent</p>
                <p className="font-bold text-brand-900 dark:text-white text-lg">
                  {formatCurrency(toSafeNumber(selectedTenantInfo.monthly_rent))}
                </p>
                <p className="text-xs text-brand-500 mt-1">
                  {selectedTenantInfo.property_name} - Unit {selectedTenantInfo.unit_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-danger font-semibold uppercase">Balance Due</p>
                <p className="font-bold text-danger text-lg">
                  {formatCurrency(toSafeNumber(selectedTenantInfo.outstanding_balance))}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase flex gap-2">
                <CurrencyDollarIcon className="h-4 w-4 text-success" />
                Payment Received *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                name="amount_paid"
                value={formData.amount_paid}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-bold text-success"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">Payment Date *</label>
              <input
                required
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">Payment Method *</label>
              <select
                required
                name="payment_method_id"
                value={formData.payment_method_id}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium disabled:opacity-60"
              >
                <option value="">{loadingOptions ? 'Loading methods...' : '-- Method --'}</option>
                {methods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">Reference / Transaction ID</label>
              <input
                name="reference_number"
                value={formData.reference_number}
                onChange={handleChange}
                placeholder="e.g. TXN-123456"
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 rounded-lg mr-3 transition-colors dark:text-brand-300 dark:hover:bg-brand-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingOptions}
              className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70"
            >
              {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckIcon className="h-5 w-5" />}
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
