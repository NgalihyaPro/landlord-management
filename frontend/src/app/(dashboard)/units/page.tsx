import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/api';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { PlusIcon, HomeIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export default function UnitsPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const data = await cachedGet<any[]>('/units');
        setUnits(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, []);

  const filteredUnits = units.filter((u: any) => 
    u.unit_number.toLowerCase().includes(search.toLowerCase()) ||
    u.property_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.tenant_name && u.tenant_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Units & Rooms</h2>
          <p className="text-brand-500">Manage individual apartments, rooms, and their occupants</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400" />
            <input 
              type="text"
              placeholder="Search units, property, tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm transition-all"
            />
          </div>
          <Link to="/units/new" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap">
            <PlusIcon className="h-5 w-5" />
            Add Unit
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-brand-50/50 dark:bg-brand-800/50 border-b border-border/50 text-xs uppercase tracking-wider text-brand-500">
                  <th className="px-6 py-4 font-semibold">Unit Number</th>
                  <th className="px-6 py-4 font-semibold">Property</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Current Tenant</th>
                  <th className="px-6 py-4 font-semibold text-right">Rent / Month</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
                {filteredUnits.length > 0 ? filteredUnits.map((u: any) => (
                  <tr key={u.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-brand-100 dark:bg-brand-800 p-2 rounded-lg">
                          <HomeIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-brand-900 dark:text-white text-base">{u.unit_number}</p>
                          <p className="text-xs text-brand-500">Floor {u.floor_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{u.property_name}</td>
                    <td className="px-6 py-4 capitalize">{u.unit_type}</td>
                    <td className="px-6 py-4">
                      {u.tenant_name ? (
                        <div className="flex items-center gap-2">
                          <UserCircleIcon className="h-5 w-5 text-brand-400" />
                          <div>
                            <p className="font-medium text-brand-900 dark:text-white leading-tight">{u.tenant_name}</p>
                            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wide">{u.payment_status}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-brand-400 italic">No tenant assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-brand-900 dark:text-white">
                      {formatCurrency(u.monthly_rent)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/properties/${u.property_id}`} className="text-primary hover:underline font-semibold text-sm transition-colors opacity-0 group-hover:opacity-100">
                        View Property
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-brand-500 bg-brand-50/20 dark:bg-brand-900/20">
                      No units matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
