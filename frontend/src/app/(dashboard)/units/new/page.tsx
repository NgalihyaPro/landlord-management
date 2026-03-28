import { useEffect, useMemo, useRef, useState } from 'react';
import api, { cachedGet, invalidateGetCache } from '@/lib/api';
import { ArrowLeftIcon, CheckIcon, ChevronUpDownIcon, HomeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import SetupFlowStepper from '@/components/flow/SetupFlowStepper';

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
        toast.error('Failed to load properties');
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
      toast.error('Please select a property');
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
      toast.success('Unit saved. Continue with tenant registration.');
      navigate(`/tenants/new?property_id=${formData.property_id}&unit_id=${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add unit');
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
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Add New Unit</h2>
          <p className="text-brand-500">Add an apartment, room, or commercial space to a property</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-brand-600 dark:text-brand-300">
        Step 2 of 4. Save this unit and the flow will move straight to tenant registration for this property.
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-brand-500 uppercase">Select Property *</label>

            <div ref={propertyPickerRef} className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-brand-400" />
              <input
                type="text"
                value={propertySearch}
                onChange={(e) => handlePropertySearchChange(e.target.value)}
                onFocus={() => setIsPropertyDropdownOpen(true)}
                placeholder="Search by property name, city, or address"
                className="w-full rounded-lg border border-brand-200 bg-white/50 py-2.5 pl-9 pr-10 text-sm dark:border-brand-700 dark:bg-brand-900/50 focus:outline-none focus:border-primary focus:ring-1"
              />
              <ChevronUpDownIcon className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-brand-400" />

              {isPropertyDropdownOpen && (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-brand-200 bg-white shadow-xl dark:border-brand-700 dark:bg-brand-900">
                  {loadingProperties ? (
                    <div className="px-4 py-3 text-sm text-brand-500">Loading properties...</div>
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
                          <p className="text-xs font-semibold text-brand-500 uppercase">Units</p>
                          <p className="text-sm font-bold text-primary">{property.unit_count ?? property.total_units ?? 0}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-brand-500">No properties match your search.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedProperty && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-700 dark:bg-brand-800/50">
              <p className="text-xs font-semibold uppercase text-brand-500">Selected Property</p>
              <div className="mt-2 flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-brand-900 dark:text-white">{selectedProperty.name}</p>
                  <p className="text-sm text-brand-500">
                    {selectedProperty.address}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase text-brand-500">Vacant Units</p>
                  <p className="text-lg font-bold text-success">{selectedProperty.vacant_count ?? 0}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase flex gap-2">
                <HomeIcon className="h-4 w-4 text-primary" />
                Unit Number *
              </label>
              <input
                required
                name="unit_number"
                value={formData.unit_number}
                onChange={handleChange}
                placeholder="e.g. A-101"
                className="w-full px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase">Floor Number</label>
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
              <label className="text-xs font-semibold text-brand-500 uppercase">Unit Type *</label>
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
              <label className="text-xs font-semibold text-brand-500 uppercase">Base Monthly Rent *</label>
              <input
                required
                type="number"
                step="0.01"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                placeholder="e.g. 500.00"
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
              disabled={loading || loadingProperties}
              className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70"
            >
              {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckIcon className="h-5 w-5" />}
              Save Unit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
