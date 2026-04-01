import { useEffect, useState } from 'react';
import api, { getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type TenantFormState = {
  full_name: string;
  phone: string;
  email: string;
  national_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  monthly_rent: string;
  lease_end: string;
  notes: string;
};

const formatDateInputValue = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

export default function TenantEditPage() {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<TenantFormState>({
    full_name: '',
    phone: '',
    email: '',
    national_id: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    monthly_rent: '',
    lease_end: '',
    notes: '',
  });

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const { data } = await api.get(`/tenants/${id}`);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          email: data.email || '',
          national_id: data.national_id || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          monthly_rent: data.monthly_rent ? String(data.monthly_rent) : '',
          lease_end: formatDateInputValue(data.lease_end),
          notes: data.notes || '',
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kupakia mpangaji.' : 'Failed to load tenant.'));
      } finally {
        setLoading(false);
      }
    };

    void fetchTenant();
  }, [id]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.put(`/tenants/${id}`, {
        ...formData,
        monthly_rent: Number(formData.monthly_rent),
        lease_end: formData.lease_end || null,
      });

      invalidateGetCache('/tenants');
      invalidateGetCache(`/tenants/${id}`);
      invalidateGetCache('/dashboard');
      invalidateGetCache('/notifications');
      invalidateGetCache('/reports');
      toast.success(isSw ? 'Mpangaji amesasishwa.' : 'Tenant updated successfully.');
      navigate(`/tenants/${id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kusasisha mpangaji.' : 'Failed to update tenant.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to={`/tenants/${id}`} className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{isSw ? 'Hariri Mpangaji' : 'Edit Tenant'}</h2>
          <p className="text-brand-500">{isSw ? 'Sasisha wasifu wa mpangaji na taarifa za mkataba' : 'Update tenant profile and lease information'}</p>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Jina Kamili *' : 'Full Name *'}</label>
              <input
                required
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Simu *' : 'Phone *'}</label>
              <input
                required
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Kitambulisho cha Taifa' : 'National ID'}</label>
              <input
                name="national_id"
                value={formData.national_id}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Jina la Dharura' : 'Emergency Contact Name'}</label>
              <input
                name="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Simu ya Dharura' : 'Emergency Contact Phone'}</label>
              <input
                name="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Kodi ya Mwezi *' : 'Monthly Rent *'}</label>
              <input
                required
                type="number"
                step="0.01"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Tarehe ya Mwisho wa Mkataba' : 'Lease End Date'}</label>
              <input
                type="date"
                lang="en-GB"
                name="lease_end"
                value={formData.lease_end}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Maelezo' : 'Notes'}</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 rounded-lg mr-3 transition-colors dark:text-brand-300 dark:hover:bg-brand-800"
            >
              {isSw ? 'Ghairi' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70"
            >
              {saving ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PencilSquareIcon className="h-5 w-5" />
              )}
              {isSw ? 'Hifadhi Mabadiliko' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
