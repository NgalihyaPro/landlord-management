import { useState } from 'react';
import api, { getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { BuildingOfficeIcon, ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import SetupFlowStepper from '@/components/flow/SetupFlowStepper';
import { useLanguage } from '@/context/LanguageContext';

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const tx = t('setup_flow.property');
  const common = t('common');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    zip_code: '',
    description: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post('/properties', formData);
      invalidateGetCache('/properties');
      invalidateGetCache('/dashboard');
      toast.success(tx.saved_toast);
      navigate(`/units/new?property_id=${data.id}`);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, tx.save_failed));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <SetupFlowStepper currentStep={0} />

      <div className="flex items-center gap-4">
        <Link to="/properties" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{tx.title}</h2>
          <p className="text-brand-500">{tx.subtitle}</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-brand-600 dark:text-brand-300">
        {tx.step_note}
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-500 uppercase flex gap-2">
              <BuildingOfficeIcon className="h-4 w-4 text-primary" /> {tx.property_name} *
            </label>
            <input required name="name" value={formData.name} onChange={handleChange} placeholder={tx.property_name_placeholder} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-500 uppercase">{tx.street_address} *</label>
            <input required name="address" value={formData.address} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{tx.city} *</label>
              <input required name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{tx.zip}</label>
              <input name="zip_code" value={formData.zip_code} onChange={handleChange} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-brand-500 uppercase">{tx.description}</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium resize-none" />
          </div>

          <div className="flex justify-end pt-4 border-t border-border mt-6">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 rounded-lg mr-3 transition-colors dark:text-brand-300 dark:hover:bg-brand-800">
              {common.cancel}
            </button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70">
              {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckIcon className="h-5 w-5" />}
              {tx.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
