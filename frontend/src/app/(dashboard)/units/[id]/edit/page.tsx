import { useEffect, useState } from 'react';
import api, { getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type UnitFormState = {
  unit_number: string;
  floor_number: string;
  unit_type: string;
  monthly_rent: string;
  deposit_amount: string;
  status: 'vacant' | 'occupied' | 'maintenance';
  description: string;
};

const UNIT_TYPES = [
  'room',
  'apartment',
  'studio',
  'shop',
  'office',
  'other',
  'commercial',
  'single_room',
  '1BHK',
  '2BHK',
  '3BHK',
];

export default function UnitEditPage() {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<UnitFormState>({
    unit_number: '',
    floor_number: '1',
    unit_type: 'room',
    monthly_rent: '',
    deposit_amount: '',
    status: 'vacant',
    description: '',
  });

  useEffect(() => {
    const fetchUnit = async () => {
      try {
        const { data } = await api.get(`/units/${id}`);
        setFormData({
          unit_number: data.unit_number || '',
          floor_number: data.floor_number ? String(data.floor_number) : '1',
          unit_type: data.unit_type || 'room',
          monthly_rent: data.monthly_rent ? String(data.monthly_rent) : '',
          deposit_amount: data.deposit_amount ? String(data.deposit_amount) : '0',
          status: data.status || 'vacant',
          description: data.description || '',
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kupakia chumba.' : 'Failed to load unit.'));
      } finally {
        setLoading(false);
      }
    };

    void fetchUnit();
  }, [id]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.put(`/units/${id}`, {
        ...formData,
        floor_number: Number(formData.floor_number),
        monthly_rent: Number(formData.monthly_rent),
        deposit_amount: Number(formData.deposit_amount || 0),
      });

      invalidateGetCache('/units');
      invalidateGetCache('/properties');
      invalidateGetCache('/dashboard');
      invalidateGetCache('/notifications');
      toast.success(isSw ? 'Chumba kimesasishwa.' : 'Unit updated successfully.');
      navigate('/units');
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kusasisha chumba.' : 'Failed to update unit.'));
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
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/units" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{isSw ? 'Hariri Chumba' : 'Edit Unit'}</h2>
          <p className="text-brand-500">{isSw ? 'Sasisha taarifa za chumba na upatikanaji wake' : 'Update unit details and availability'}</p>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Namba ya Chumba *' : 'Unit Number *'}</label>
              <input
                required
                name="unit_number"
                value={formData.unit_number}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Namba ya Ghorofa *' : 'Floor Number *'}</label>
              <input
                required
                type="number"
                name="floor_number"
                value={formData.floor_number}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Aina ya Chumba *' : 'Unit Type *'}</label>
              <select
                required
                name="unit_type"
                value={formData.unit_type}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              >
                {UNIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {isSw
                      ? ({
                        room: 'chumba',
                        apartment: 'apartment',
                        studio: 'studio',
                        shop: 'duka',
                        office: 'ofisi',
                        other: 'nyingine',
                        commercial: 'biashara',
                        single_room: 'chumba kimoja',
                        '1BHK': '1BHK',
                        '2BHK': '2BHK',
                        '3BHK': '3BHK',
                      } as Record<string, string>)[type] || type
                      : type}
                  </option>
                ))}
              </select>
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
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Kiasi cha Dhamana' : 'Deposit Amount'}</label>
              <input
                type="number"
                step="0.01"
                name="deposit_amount"
                value={formData.deposit_amount}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Hali *' : 'Status *'}</label>
              <select
                required
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              >
                <option value="vacant">{isSw ? 'wazi' : 'vacant'}</option>
                <option value="occupied">{isSw ? 'imekaliwa' : 'occupied'}</option>
                <option value="maintenance">{isSw ? 'matengenezo' : 'maintenance'}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-500 uppercase">{isSw ? 'Maelezo' : 'Description'}</label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-border mt-6">
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
