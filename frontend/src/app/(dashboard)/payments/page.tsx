import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  CreditCardIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

const escapeCsvValue = (value: unknown) => {
  const normalized = String(value ?? '').replace(/"/g, '""');
  return `"${normalized}"`;
};

export default function PaymentsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<{ payments: any[]; total: number }>({ payments: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [methodOptions, setMethodOptions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const tp = t('payments');
  const common = t('tenants');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentsRes, methodsRes] = await Promise.all([
          cachedGet<{ payments: any[]; total: number }>('/payments'),
          cachedGet<any[]>('/payments/methods'),
        ]);
        setData(paymentsRes);
        setMethodOptions(methodsRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPayments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return data.payments.filter((payment: any) => {
      const matchesSearch = !normalizedSearch || [
        payment.receipt_number,
        payment.tenant_name,
        payment.property_name,
        payment.unit_number,
        payment.reference_number,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));

      const matchesMonth = !monthFilter || String(payment.payment_date ?? '').startsWith(monthFilter);
      const matchesMethod = !methodFilter || String(payment.payment_method_id ?? '') === methodFilter;

      return matchesSearch && matchesMonth && matchesMethod;
    });
  }, [data.payments, search, monthFilter, methodFilter]);

  const handleExportCsv = () => {
    if (!filteredPayments.length) {
      toast.error('No payment records available to export');
      return;
    }

    const headers = [
      'Receipt Number',
      'Tenant Name',
      'Property Name',
      'Unit Number',
      'Payment Date',
      'Payment Method',
      'Reference Number',
      'Amount Paid',
      'Balance',
      'Payment Status',
    ];

    const rows = filteredPayments.map((payment: any) => [
      payment.receipt_number,
      payment.tenant_name,
      payment.property_name,
      payment.unit_number,
      formatDate(payment.payment_date),
      payment.method_name,
      payment.reference_number,
      payment.amount_paid,
      payment.balance,
      common.statuses[payment.payment_status as keyof typeof common.statuses] || payment.payment_status,
    ]);

    const csv = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const exportDate = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `payments-${exportDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Payments CSV downloaded');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{tp.title}</h2>
          <p className="text-brand-500">{tp.desc}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCsv}
            disabled={loading || !filteredPayments.length}
            className="flex items-center gap-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-800 dark:hover:bg-brand-700 text-brand-700 dark:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            <span className="hidden sm:inline">{tp.export_csv}</span>
          </button>
          <Link to="/payments/new" className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            <PlusIcon className="h-5 w-5" />
            {tp.record_payment}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border-success/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-success dark:text-green-400">{tp.total_collected}</p>
              <h3 className="text-3xl font-bold mt-2 text-brand-900 dark:text-white">
                {formatCurrency(filteredPayments.reduce((acc, payment: any) => acc + parseFloat(payment.amount_paid), 0))}
              </h3>
            </div>
            <div className="bg-success/20 p-3 rounded-xl">
              <BanknotesIcon className="h-6 w-6 text-success" />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/50 bg-white/50 dark:bg-brand-900/50 flex flex-wrap gap-4 items-center">
            <div className="relative min-w-[240px] flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenant, property, receipt, or reference"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-brand-50 dark:bg-brand-800 rounded-lg border-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-brand-50 dark:bg-brand-800 rounded-lg border-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-brand-50 dark:bg-brand-800 rounded-lg border-none focus:ring-1 focus:ring-primary w-44"
            >
              <option value="">{tp.all_methods}</option>
              {methodOptions.map((method: any) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-brand-50/50 dark:bg-brand-800/50 border-b border-border/50 text-xs uppercase tracking-wider text-brand-500">
                  <th className="px-6 py-4 font-semibold">{tp.table.receipt_no}</th>
                  <th className="px-6 py-4 font-semibold">{tp.table.tenant_property}</th>
                  <th className="px-6 py-4 font-semibold">{tp.table.date_paid}</th>
                  <th className="px-6 py-4 font-semibold">{tp.table.method}</th>
                  <th className="px-6 py-4 font-semibold text-right">{tp.table.amount_paid}</th>
                  <th className="px-6 py-4 font-semibold text-right">{tp.table.balance}</th>
                  <th className="px-6 py-4 font-semibold text-center">{tp.table.status}</th>
                </tr>
              </thead>
              <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
                {filteredPayments.length > 0 ? filteredPayments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-primary">
                      {payment.receipt_number}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-brand-900 dark:text-white leading-tight">{payment.tenant_name}</p>
                      <p className="text-[10px] text-brand-500">{payment.property_name} - Unit {payment.unit_number}</p>
                    </td>
                    <td className="px-6 py-4 font-medium">{formatDate(payment.payment_date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CreditCardIcon className="h-4 w-4 text-brand-400" />
                        <span>{payment.method_name}</span>
                      </div>
                      {payment.reference_number && <p className="text-[10px] text-brand-400 font-mono mt-0.5">Ref: {payment.reference_number}</p>}
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-brand-900 dark:text-white">
                      {formatCurrency(payment.amount_paid)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-right text-brand-500">
                      {parseFloat(payment.balance) > 0 ? (
                        <span className="text-danger">{formatCurrency(payment.balance)}</span>
                      ) : (
                        <span className="text-success">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(payment.payment_status)}`}>
                        {common.statuses[payment.payment_status as keyof typeof common.statuses] || payment.payment_status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-brand-500 bg-brand-50/20 dark:bg-brand-900/20">
                      {search || monthFilter || methodFilter ? 'No payments match the current filters.' : tp.no_payments}
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
