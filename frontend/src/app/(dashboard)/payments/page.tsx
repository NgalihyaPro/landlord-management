import { useEffect, useMemo, useState } from 'react';
import api, { cachedGet, getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  CreditCardIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  TrashIcon,
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
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<number | null>(null);
  const [methodOptions, setMethodOptions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const tp = t('payments');
  const common = t('tenants');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const methodsPromise = cachedGet<any[]>('/payments/methods');

        const payments: any[] = [];
        let page = 1;
        let pages = 1;
        const limit = 200;

        do {
          const paymentsRes = await cachedGet<{ payments: any[]; total: number; page: number; pages: number }>(
            `/payments?page=${page}&limit=${limit}`,
            { force: true }
          );
          payments.push(...(paymentsRes.payments || []));
          pages = paymentsRes.pages || 1;
          page += 1;
        } while (page <= pages);

        const methodsRes = await methodsPromise;
        setAllPayments(payments);
        setMethodOptions(methodsRes);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load payments');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, monthFilter, methodFilter]);

  const filteredPayments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return allPayments.filter((payment: any) => {
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
  }, [allPayments, search, monthFilter, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + pageSize);
  const showingFrom = filteredPayments.length ? startIndex + 1 : 0;
  const showingTo = Math.min(startIndex + pageSize, filteredPayments.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
      'Payment Received',
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

  const handleDownloadReceipt = async (paymentId: number) => {
    try {
      setReceiptLoadingId(paymentId);
      const { data } = await api.get(`/payments/${paymentId}/receipt`);
      const { payment, settings } = data;
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      const orgName = settings?.business_name || settings?.organization_name || 'LandlordPro';
      const orgAddress = settings?.business_address || payment?.address || 'Address not set';
      const footerMessage = settings?.receipt_footer || settings?.footer_message || '';

      doc.setFontSize(16);
      doc.text(orgName, 14, 20);
      doc.setFontSize(10);
      doc.text(orgAddress, 14, 27);
      doc.line(14, 31, 196, 31);

      doc.setFontSize(13);
      doc.text('PAYMENT RECEIPT', 14, 40);
      doc.setFontSize(10);

      const rows: Array<[string, string]> = [
        ['Receipt Number', payment.receipt_number || '-'],
        ['Tenant Name', payment.tenant_name || '-'],
        ['Unit', payment.unit_number ? `Unit ${payment.unit_number}` : '-'],
        ['Property', payment.property_name || '-'],
        ['Payment Date', formatDate(payment.payment_date)],
        ['Payment Received', formatCurrency(Number(payment.amount_paid || 0))],
        ['Payment Method', payment.method_name || '-'],
        ['Balance Remaining', formatCurrency(Number(payment.balance || 0))],
      ];

      let y = 50;
      rows.forEach(([label, value]) => {
        doc.setTextColor(90, 90, 90);
        doc.text(`${label}:`, 14, y);
        doc.setTextColor(20, 20, 20);
        doc.text(String(value), 70, y);
        y += 8;
      });

      if (footerMessage) {
        y += 4;
        doc.setTextColor(90, 90, 90);
        doc.text(footerMessage, 14, y, { maxWidth: 182 });
        y += 12;
      }

      doc.setTextColor(16, 185, 129);
      doc.text('Thank you for your payment.', 14, y);
      doc.save(`receipt-${payment.receipt_number || payment.id}.pdf`);
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to download receipt.'));
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const handleDeletePayment = async (payment: any) => {
    const confirmed = window.confirm(`Delete payment ${payment.receipt_number}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeletingId(payment.id);
      await api.delete(`/payments/${payment.id}`);
      setAllPayments((current) => current.filter((item) => item.id !== payment.id));
      invalidateGetCache('/payments');
      invalidateGetCache('/dashboard');
      invalidateGetCache('/tenants');
      invalidateGetCache('/notifications');
      invalidateGetCache('/reports');
      toast.success('Payment deleted successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete payment.'));
    } finally {
      setDeletingId(null);
    }
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
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
                {paginatedPayments.length > 0 ? paginatedPayments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors group">
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
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => void handleDownloadReceipt(payment.id)}
                          disabled={receiptLoadingId === payment.id}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-60"
                        >
                          <DocumentTextIcon className="h-4 w-4" />
                          {receiptLoadingId === payment.id ? 'Loading...' : 'Receipt'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePayment(payment)}
                          disabled={deletingId === payment.id}
                          className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger hover:text-white disabled:opacity-60"
                        >
                          <TrashIcon className="h-4 w-4" />
                          {deletingId === payment.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-brand-500 bg-brand-50/20 dark:bg-brand-900/20">
                      {search || monthFilter || methodFilter ? 'No payments match the current filters.' : tp.no_payments}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-2 pt-2 text-center text-xs text-brand-500 md:hidden">&lt;- Scroll to see more -&gt;</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-brand-500">
          Page {activePage} of {totalPages} - Showing {showingFrom}-{showingTo} of {filteredPayments.length} records
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={activePage <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={activePage >= totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
