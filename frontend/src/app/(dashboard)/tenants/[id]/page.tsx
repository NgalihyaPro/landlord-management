import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { UserCircleIcon, PhoneIcon, MapPinIcon, ArrowLeftIcon, BanknotesIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { Link, useParams } from 'react-router-dom';

export default function TenantProfilePage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const { data } = await api.get(`/tenants/${id}`);
        setTenant(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, [id]);

  if (loading) return <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mt-20"></div>;
  if (!tenant) return <div className="text-center mt-20 font-semibold text-brand-500">Tenant not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-2 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Tenant Profile</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${getStatusColor(tenant.payment_status).split(' ')[0]}`} />
            
            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <div className="h-20 w-20 bg-brand-100 dark:bg-brand-800 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-3 shadow-inner">
                {tenant.full_name.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-brand-900 dark:text-white">{tenant.full_name}</h3>
              <p className="text-sm font-medium text-brand-500 mt-1 flex items-center gap-1">
                <PhoneIcon className="h-4 w-4" /> {tenant.phone}
              </p>
              <div className="mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(tenant.payment_status)}`}>
                  {tenant.payment_status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="border-t border-brand-100 dark:border-brand-800 pt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Property</p>
                <div className="flex items-start gap-2 mt-1">
                  <MapPinIcon className="h-5 w-5 text-brand-500 shrink-0" />
                  <div>
                    <p className="font-bold text-brand-900 dark:text-white text-sm">
                      <Link to={`/properties/${tenant.property_id}`} className="hover:text-primary transition-colors underline decoration-brand-200 underline-offset-2">
                        {tenant.property_name}
                      </Link>
                    </p>
                    <p className="text-xs text-brand-500 mt-0.5">Unit {tenant.unit_number} ({tenant.unit_type})</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Rent</p>
                  <p className="font-bold text-brand-900 dark:text-white">{formatCurrency(tenant.monthly_rent)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Next Due</p>
                  <p className={`font-bold ${tenant.payment_status === 'overdue' ? 'text-danger' : 'text-brand-900 dark:text-white'}`}>
                    {formatDate(tenant.next_due_date)}
                  </p>
                </div>
              </div>
            </div>

            {tenant.outstanding_balance > 0 && (
              <div className="mt-6 bg-danger/5 border border-danger/10 p-4 rounded-xl flex justify-between items-center text-danger">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Balance Due</p>
                  <p className="text-lg font-bold">{formatCurrency(tenant.outstanding_balance)}</p>
                </div>
                <Link to="/payments/new" className="px-3 py-1.5 bg-danger text-white text-xs font-bold rounded hover:bg-danger/90 transition-colors shadow-sm">
                  Pay Now
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 bg-brand-50/50 dark:bg-brand-800/50 flex items-center gap-3">
              <BanknotesIcon className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">Payment History</h3>
            </div>
            
            <div className="p-0">
              {tenant.payment_history && tenant.payment_history.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {tenant.payment_history.map((p: any) => (
                    <div key={p.id} className="p-4 sm:p-5 hover:bg-brand-50/30 dark:hover:bg-brand-800/30 transition-colors flex flex-wrap gap-4 justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-success/10 p-2 rounded-lg text-success">
                          <CreditCardIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-brand-900 dark:text-white text-sm">Rent Payment</p>
                          <p className="text-xs text-brand-500 font-mono mt-0.5">{p.receipt_number}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-success text-base">+{formatCurrency(p.amount_paid)}</p>
                        <p className="text-xs text-brand-500 font-medium mt-0.5">{formatDate(p.payment_date)}</p>
                      </div>
                      
                      <div className="w-full sm:w-auto text-center sm:text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-success/20 bg-success/10 text-success inline-block">
                          Completed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <BanknotesIcon className="h-12 w-12 text-brand-200 dark:text-brand-700 mx-auto mb-3" />
                  <p className="text-brand-500 font-medium">No payments recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
