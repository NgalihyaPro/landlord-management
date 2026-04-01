import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { BuildingOfficeIcon, MapPinIcon, HomeModernIcon, ArrowLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

export default function PropertyDetailsPage() {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const { id } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const getStatusLabel = (status: string) => {
    if (!isSw) return status;
    if (status === 'active') return 'inatumika';
    if (status === 'inactive') return 'imezimwa';
    if (status === 'vacant') return 'wazi';
    if (status === 'occupied') return 'imekaliwa';
    if (status === 'maintenance') return 'matengenezo';
    return status;
  };

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data } = await api.get(`/properties/${id}`);
        setProperty(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  if (loading) return <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mt-20"></div>;
  if (!property) return <div className="text-center mt-20 font-semibold text-brand-500">{isSw ? 'Mali haijapatikana.' : 'Property not found.'}</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/properties" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{property.name}</h2>
          <div className="flex items-center gap-1 text-brand-500 mt-1">
            <MapPinIcon className="h-4 w-4 shrink-0" />
            <span>{property.address}, {property.city}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-primary">
            <div className="flex items-center gap-3 mb-4">
              <BuildingOfficeIcon className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">{isSw ? 'Muhtasari wa Mali' : 'Property Overview'}</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{isSw ? 'Jumla ya Vyumba' : 'Total Units'}</p>
                <p className="text-xl font-bold text-brand-900 dark:text-white">{property.total_units}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">{isSw ? 'Hali' : 'Status'}</p>
                <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${property.status === 'active' ? 'bg-success/10 text-success border border-success/20' : 'bg-brand-200 text-brand-600 border border-brand-300'}`}>
                  {getStatusLabel(property.status)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-brand-50/50 dark:bg-brand-800/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-900 dark:text-white flex items-center gap-2">
                <HomeModernIcon className="h-5 w-5 text-primary" />
                {isSw ? `Vyumba ndani ya ${property.name}` : `Units inside ${property.name}`}
              </h3>
              <Link to="/units/new" className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm">
                {isSw ? '+ Ongeza Chumba' : '+ Add Unit'}
              </Link>
            </div>
            <div className="overflow-x-auto">
              {property.units && property.units.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white/30 dark:bg-brand-900/30 border-b border-border/50 text-xs uppercase tracking-wider text-brand-500">
                      <th className="px-4 py-3 font-semibold">{isSw ? 'Namba ya Chumba' : 'Unit Number'}</th>
                      <th className="px-4 py-3 font-semibold text-center">{isSw ? 'Mpangaji' : 'Tenant'}</th>
                      <th className="px-4 py-3 font-semibold text-right">{isSw ? 'Kodi' : 'Rent'}</th>
                      <th className="px-4 py-3 font-semibold text-center">{isSw ? 'Hali' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
                    {property.units.map((u: any) => (
                      <tr key={u.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors">
                        <td className="px-4 py-3 font-bold">{u.unit_number} <span className="text-xs font-normal text-brand-400 block">{u.unit_type}</span></td>
                        <td className="px-4 py-3 text-center">
                          {u.tenant_name ? (
                            <Link to={`/tenants/${u.tenant_id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold text-sm">
                              <UserIcon className="h-4 w-4" /> {u.tenant_name}
                            </Link>
                          ) : (
                            <span className="text-brand-400 italic text-sm">{isSw ? 'Wazi' : 'Vacant'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-right">{formatCurrency(u.monthly_rent)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(u.status)}`}>
                            {getStatusLabel(u.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-brand-500">
                  <p>{isSw ? 'Bado hakuna vyumba vilivyoongezwa kwenye mali hii.' : 'No units have been added to this property yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
