import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/api';
import { BuildingOfficeIcon, PlusIcon, MapPinIcon, HomeModernIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProps = async () => {
      try {
        const data = await cachedGet<any[]>('/properties');
        setProperties(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProps();
  }, []);

  if (loading) return <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mt-20"></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Properties</h2>
          <p className="text-brand-500">Manage your buildings and real estate assets</p>
        </div>
        <Link to="/properties/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-primary">
          <PlusIcon className="h-5 w-5" />
          Add Property
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((p: any) => (
          <div key={p.id} className="glass-panel rounded-2xl p-6 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-brand-100 dark:bg-brand-800 p-3 rounded-xl">
                <BuildingOfficeIcon className="h-8 w-8 text-primary" />
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${p.status === 'active' ? 'bg-success/10 text-success border border-success/20' : 'bg-brand-200 text-brand-600 border border-brand-300'}`}>
                {p.status}
              </span>
            </div>
            
            <h3 className="text-xl font-bold text-brand-900 dark:text-white line-clamp-1 mb-1">{p.name}</h3>
            <div className="flex items-start gap-1 text-sm text-brand-500 mb-6 h-10">
              <MapPinIcon className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{p.address}, {p.city}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-brand-100 dark:border-brand-800/50 pt-4 mb-4">
              <div>
                <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider">Total Units</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <HomeModernIcon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                  <span className="font-bold text-brand-900 dark:text-white">{p.total_units}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider">Occupancy</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-full bg-brand-100 dark:bg-brand-800 rounded-full h-1.5">
                    <div 
                      className="bg-primary h-1.5 rounded-full" 
                      style={{ width: `${p.total_units ? Math.round((p.occupied_count / p.total_units) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-brand-900 dark:text-white">
                    {p.total_units ? Math.round((p.occupied_count / p.total_units) * 100) : 0}%
                  </span>
                </div>
                <p className="text-[10px] text-brand-500 mt-0.5">{p.occupied_count} occupied, {p.vacant_count} vacant</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Link to={`/properties/${p.id}`} className="flex-1 bg-brand-50 dark:bg-brand-800 hover:bg-brand-100 dark:hover:bg-brand-700 text-brand-700 dark:text-white text-center py-2 rounded-lg text-sm font-semibold transition-colors">
                View Details
              </Link>
            </div>
          </div>
        ))}

        {properties.length === 0 && (
          <div className="col-span-full text-center py-20 bg-white/50 dark:bg-brand-900/50 rounded-2xl border border-dashed border-brand-300">
            <BuildingOfficeIcon className="mx-auto h-12 w-12 text-brand-400 mb-4" />
            <h3 className="text-lg font-bold text-brand-900 dark:text-white">No properties found</h3>
            <p className="text-brand-500 max-w-sm mx-auto mt-2 mb-6">You haven't added any properties yet. Start by adding a building or apartment complex.</p>
            <button className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              Add First Property
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
