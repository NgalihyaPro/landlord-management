import { useEffect, useMemo, useRef, useState } from 'react';
import api, { cachedGet, invalidateGetCache } from '@/lib/api';
import { ArrowLeftIcon, CheckIcon, ChevronUpDownIcon, HomeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import SetupFlowStepper from '@/components/flow/SetupFlowStepper';
import { useLanguage } from '@/context/LanguageContext';

type PropertyOption = {
  id: number;
  name: string;
  city: string | null;
  region: string | null;
  address: string;
  total_units: number;
  unit_count?: number;
  vacant_count?: number;
  status: string;
};

const getPropertyLabel = (property: PropertyOption) =>
  `${property.name}${property.city ? ` (${property.city})` : ''}`;

export default function AddUnitPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const tx = t('setup_flow.unit');
  const common = t('common');
  const [searchParams] = useSearchParams();
  const propertyPickerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [propertySearch, setPropertySearch] = useState('');
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null);

  const [formData, setFormData] = useState({
    property_id: '',
    unit_number: '',
    floor_number: '1',
    unit_type: '1BHK',
    monthly_rent: '',
  });

  const propertyIdFromFlow = searchParams.get('property_id');

  useEffect(() => {
    const fetchProps = async () => {
      try {
        const data = await cachedGet<PropertyOption[]>('/properties?status=active');
        setProperties(data);
      } catch (err) {
        console.error(err);
        toast.error(tx.load_properties_failed);
      } finally {
        setLoadingProperties(false);
      }
    };

    fetchProps();
  }, []);

  useEffect(() => {
    if (!propertyIdFromFlow || !properties.length) return;

    const matchedProperty = properties.find((property) => property.id.toString() === propertyIdFromFlow);
    if (matchedProperty) {
      selectProperty(matchedProperty);
    }
  }, [properties, propertyIdFromFlow]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (propertyPickerRef.current && !propertyPickerRef.current.contains(event.target as Node)) {
        setIsPropertyDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProperties = useMemo(() => {
    const query = propertySearch.trim().toLowerCase();

    return properties.filter((property) => {
      if (!query) return true;

      return [
        property.name,
        property.city,
        property.region,
        property.address,
      ].some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [properties, propertySearch]);

  const selectProperty = (property: PropertyOption) => {
    setSelectedProperty(property);
    setPropertySearch(getPropertyLabel(property));
    setIsPropertyDropdownOpen(false);
    setFormData((prev) => ({ ...prev, property_id: property.id.toString() }));
  };

  const handlePropertySearchChange = (value: string) => {
    setPropertySearch(value);
    setIsPropertyDropdownOpen(true);

    if (selectedProperty && value !== getPropertyLabel(selectedProperty)) {
      setSelectedProperty(null);
      setFormData((prev) => ({ ...prev, property_id: '' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.property_id) {
      toast.error(tx.please_select_property);
      setIsPropertyDropdownOpen(true);
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/units', {
        ...formData,
        property_id: Number(formData.property_id),
        floor_number: Number(formData.floor_number),
        monthly_rent: Number(formData.monthly_rent),
      });
      invalidateGetCache('/units');
      invalidateGetCache('/properties');
      invalidateGetCache('/dashboard');
      toast.success(tx.saved_toast);
      navigate(`/tenants/new?property_id=${formData.property_id}&unit_id=${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || tx.save_failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <SetupFlowStepper currentStep={1} />

      <div className="flex items-center gap-4">
        <Link to="/units" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
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
          <div className="space-y-3">
            <label className="text-xs font-semibold text-brand-500 uppercase">{tx.select_property} *</label>

            <div ref={propertyPickerRef} className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-brand-400" />
              <input
                type="text"
                value={propertySearch}
                onChange={(e) => handlePropertySearchChange(e.target.value)}
                onFocus={() => setIsPropertyDropdownOpen(true)}
                placeholder={tx.search_property}
                className="w-full rounded-lg border border-brand-200 bg-white/50 py-2.5 pl-9 pr-10 text-sm dark:border-brand-700 dark:bg-brand-900/50 focus:outline-none focus:border-primary focus:ring-1"
              />
              <ChevronUpDownIcon className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-brand-400" />

              {isPropertyDropdownOpen && (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-brand-200 bg-white shadow-xl dark:border-brand-700 dark:bg-brand-900">
                  {loadingProperties ? (
                    <div className="px-4 py-3 text-sm text-brand-500">{tx.loading_properties}</div>
                  ) : filteredProperties.length ? (
                    filteredProperties.map((property) => (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => selectProperty(property)}
                        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-brand-50 dark:hover:bg-brand-800/70 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-brand-900 dark:text-white">{property.name}</p>
                          <p className="text-xs text-brand-500">
                            {[property.city, property.region].filter(Boolean).join(', ') || property.address}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-brand-500 uppercase">{t('dashboard.total_units')}</p>
                          <p className="text-sm font-bold text-primary">{property.unit_count ?? property.total_units ?? 0}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-brand-500">{tx.no_property_match}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedProperty && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-700 dark:bg-brand-800/50">
              <p className="text-xs font-semibold uppercase text-brand-500">{tx.selected_property}</p>
              <div className="mt-2 flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-brand-900 dark:text-white">{selectedProperty.name}</p>
                  <p className="text-sm text-brand-500">
                    {selectedProperty.address}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase text-brand-500">{tx.vacant_units}</p>
                  <p className="text-lg font-bold text-success">{selectedProperty.vacant_count ?? 0}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase flex gap-2">
                <HomeIcon className="h-4 w-4 text-primary" />
                {tx.unit_number} *
              </label>
              <input
                required
                name="unit_number"
                value={formData.unit_number}
                onChange={handleChange}
                placeholder={tx.unit_number_placeholder}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{tx.floor_number}</label>
              <input
                required
                type="number"
                name="floor_number"
                value={formData.floor_number}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{tx.unit_type} *</label>
              <select
                required
                name="unit_type"
                value={formData.unit_type}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              >
                <option value="1BHK">1 Bedroom (1BHK)</option>
                <option value="2BHK">2 Bedrooms (2BHK)</option>
                <option value="3BHK">3 Bedrooms (3BHK)</option>
                <option value="studio">Studio</option>
                <option value="commercial">Commercial Space</option>
                <option value="single_room">Single Room</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">{tx.base_rent} *</label>
              <input
                required
                type="number"
                step="0.01"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                placeholder={tx.rent_placeholder}
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
              {common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || loadingProperties}
              className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70"
            >
              {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckIcon className="h-5 w-5" />}
              {tx.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
