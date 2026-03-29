import { useState, useEffect } from 'react';
import api, { cachedGet, getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { UserPlusIcon, ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import SetupFlowStepper from '@/components/flow/SetupFlowStepper';

export default function AddTenantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const unitIdFromFlow = searchParams.get('unit_id');
  const propertyIdFromFlow = searchParams.get('property_id');
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    unit_id: '',
    lease_start_date: '',
    lease_end_date: '',
    deposit_amount: '',
    monthly_rent: '' // We will auto-fill this based on the unit selected, but allow override
  });

  useEffect(() => {
    // Fetch vacant units
    const fetchVacantUnits = async () => {
      try {
        const query = new URLSearchParams({ status: 'vacant' });
        if (propertyIdFromFlow) {
          query.set('property_id', propertyIdFromFlow);
        }
        const data = await cachedGet<any[]>(`/units?${query.toString()}`);
        setUnits(data);
      } catch (err) {
        console.error('Failed to fetch units:', err);
      }
    };
    fetchVacantUnits();
  }, [propertyIdFromFlow]);

  useEffect(() => {
    if (!unitIdFromFlow || !units.length) return;

    const selectedUnit: any = units.find((unit: any) => unit.id.toString() === unitIdFromFlow);
    if (selectedUnit) {
      setFormData(prev => ({
        ...prev,
        unit_id: selectedUnit.id.toString(),
        monthly_rent: selectedUnit.monthly_rent,
      }));
    }
  }, [units, unitIdFromFlow]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Auto-fill monthly_rent if unit changes
    if (name === 'unit_id') {
      const selectedUnit: any = units.find((u: any) => u.id.toString() === value);
      if (selectedUnit) {
        setFormData(prev => ({
          ...prev, 
          [name]: value,
          monthly_rent: selectedUnit.monthly_rent
        }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedUnit: any = units.find((u: any) => u.id.toString() === formData.unit_id);
      
      const payload = {
        ...formData,
        property_id: selectedUnit?.property_id,
        national_id: formData.id_number,
        lease_start: formData.lease_start_date,
        lease_end: formData.lease_end_date,
        next_due_date: formData.lease_start_date,
        deposit_paid: formData.deposit_amount // Assume deposit is paid upfront
      };

      const { data } = await api.post('/tenants', payload);
      invalidateGetCache('/tenants');
      invalidateGetCache('/units');
      invalidateGetCache('/properties');
      invalidateGetCache('/dashboard');
      invalidateGetCache('/notifications');
      invalidateGetCache('/reports');
      toast.success('Tenant saved. Continue to the first payment.');
      navigate(`/payments/new?tenant_id=${data.id}`);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to add tenant'));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <SetupFlowStepper currentStep={2} />

      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Add New Tenant</h2>
          <p className="text-brand-500">Register a new tenant and assign them to a unit</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-brand-600 dark:text-brand-300">
        Step 3 of 4. Register the tenant for the new unit, then the flow will take you directly to recording the first payment.
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Personal Info */}
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-2 mb-4">
              <UserPlusIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">Personal Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Full Name *</label>
                <input required name="full_name" value={formData.full_name} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Phone Number *</label>
                <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">ID / Passport Number *</label>
                <input required name="id_number" value={formData.id_number} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
            </div>
          </div>

          {/* Section 2: Lease Details */}
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-2 mb-4">
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">Lease Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Assign Unit *</label>
                <select required name="unit_id" value={formData.unit_id} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium">
                  <option value="">-- Select Vacant Unit --</option>
                  {units.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.property_name} - Unit {u.unit_number}</option>
                  ))}
                </select>
                {formData.unit_id && unitIdFromFlow && (
                  <p className="text-xs text-brand-500 mt-2">This unit was carried forward from the setup flow.</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Monthly Rent *</label>
                <input required type="number" step="0.01" name="monthly_rent" value={formData.monthly_rent} onChange={handleChange} className="w-full px-4 py-2 bg-brand-50 dark:bg-brand-800/80 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Security Deposit *</label>
                <input required type="number" step="0.01" name="deposit_amount" value={formData.deposit_amount} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Lease Start Date *</label>
                <input required type="date" lang="en-GB" name="lease_start_date" value={formData.lease_start_date} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-brand-500 uppercase">Lease End Date *</label>
                <input required type="date" lang="en-GB" name="lease_end_date" value={formData.lease_end_date} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button 
              type="button" 
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 rounded-lg mr-3 transition-colors dark:text-brand-300 dark:hover:bg-brand-800"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckIcon className="h-5 w-5" />
              )}
              Register Tenant
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
