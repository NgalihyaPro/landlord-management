import { useEffect, useState } from 'react';
import { cachedGet } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { jsPDF as JsPdfInstance } from 'jspdf';
import { 
  ChartBarIcon, DocumentArrowDownIcon, 
  ArrowTrendingUpIcon, HomeModernIcon, ExclamationTriangleIcon, ClockIcon
} from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

type ReportTab = 'overview' | 'occupancy' | 'overdue' | 'duesoon';

type PropertyIncome = {
  id: number;
  name: string;
  total_collected: number | string;
  total_expected: number | string;
  total_outstanding: number | string;
  payment_count: number | string;
};

type TrendPoint = {
  period_month: string;
  collected: number | string;
  expected: number | string;
  transactions: number | string;
};

type OccupancyRow = {
  id: number;
  name: string;
  total_units: number | string;
  actual_units: number | string;
  occupied: number | string;
  vacant: number | string;
  maintenance: number | string;
  occupancy_rate: number | string | null;
};

type TenantRow = {
  id: number;
  full_name: string;
  phone: string;
  next_due_date: string;
  monthly_rent: number | string;
  outstanding_balance?: number | string;
  payment_status?: string;
  unit_number: string;
  property_name: string;
  days_overdue?: number | string;
  days_until_due?: number | string;
};

type ReportData = {
  period: string;
  income_by_property: PropertyIncome[];
  paid_tenants: unknown[];
  unpaid_tenants: unknown[];
  overdue_tenants: TenantRow[];
  due_soon_tenants: TenantRow[];
  occupancy: OccupancyRow[];
  monthly_trend: TrendPoint[];
};

const REPORT_TABS: ReportTab[] = ['overview', 'occupancy', 'overdue', 'duesoon'];

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getValidTab = (value: string | null): ReportTab =>
  REPORT_TABS.includes(value as ReportTab) ? (value as ReportTab) : 'overview';

const getPdfFileName = (tab: ReportTab, period: string) =>
  `landlordpro-${tab}-report-${period}.pdf`;

export default function ReportsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const tabParam = getValidTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<ReportTab>(tabParam);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const result = await cachedGet<ReportData>(`/reports/overview?month=${month}`);
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [month]);

  const handleExportPdf = async () => {
    if (!data) return;

    try {
      setExporting(true);

      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new JsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const periodLabel = month || data.period;

      doc.setFontSize(18);
      doc.text('LandlordPro Report', 14, 18);
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(`Report type: ${activeTab}`, 14, 26);
      doc.text(`Period: ${periodLabel}`, 14, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 42, pageWidth - 14, 42);

      if (activeTab === 'overview') {
        const totalCollected = data.income_by_property.reduce(
          (sum, property) => sum + toNumber(property.total_collected),
          0
        );
        const totalExpected = data.income_by_property.reduce(
          (sum, property) => sum + toNumber(property.total_expected),
          0
        );
        const totalOutstanding = data.income_by_property.reduce(
          (sum, property) => sum + toNumber(property.total_outstanding),
          0
        );

        doc.setFontSize(13);
        doc.setTextColor(20, 20, 20);
        doc.text('Overview Summary', 14, 52);
        doc.setFontSize(11);
        doc.text(`Properties: ${data.income_by_property.length}`, 14, 60);
        doc.text(`Collected: ${formatCurrency(totalCollected)}`, 14, 66);
        doc.text(`Expected: ${formatCurrency(totalExpected)}`, 80, 66);
        doc.text(`Outstanding: ${formatCurrency(totalOutstanding)}`, 145, 66);

        autoTable(doc, {
          startY: 74,
          head: [['Property', 'Collected', 'Expected', 'Outstanding', 'Payments']],
          body: data.income_by_property.map((property) => [
            property.name,
            formatCurrency(toNumber(property.total_collected)),
            formatCurrency(toNumber(property.total_expected)),
            formatCurrency(toNumber(property.total_outstanding)),
            String(property.payment_count ?? 0),
          ]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [30, 64, 175] },
        });

        const docWithTableState = doc as JsPdfInstance & { lastAutoTable?: { finalY: number } };

        autoTable(doc, {
          startY: docWithTableState.lastAutoTable?.finalY
            ? docWithTableState.lastAutoTable.finalY + 12
            : 140,
          head: [['Month', 'Collected', 'Expected', 'Transactions']],
          body: data.monthly_trend.map((entry) => [
            entry.period_month,
            formatCurrency(toNumber(entry.collected)),
            formatCurrency(toNumber(entry.expected)),
            String(entry.transactions ?? 0),
          ]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [22, 163, 74] },
        });
      }

      if (activeTab === 'occupancy') {
        autoTable(doc, {
          startY: 52,
          head: [['Property', 'Units', 'Occupied', 'Vacant', 'Maintenance', 'Occupancy %']],
          body: data.occupancy.map((property) => [
            property.name,
            String(property.total_units ?? property.actual_units ?? 0),
            String(property.occupied ?? 0),
            String(property.vacant ?? 0),
            String(property.maintenance ?? 0),
            `${toNumber(property.occupancy_rate).toFixed(1)}%`,
          ]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [8, 145, 178] },
        });
      }

      if (activeTab === 'overdue') {
        autoTable(doc, {
          startY: 52,
          head: [['Tenant', 'Property / Unit', 'Due Date', 'Days Late', 'Outstanding']],
          body: data.overdue_tenants.map((tenant) => [
            tenant.full_name,
            `${tenant.property_name} / ${tenant.unit_number}`,
            formatDate(tenant.next_due_date),
            String(tenant.days_overdue ?? 0),
            formatCurrency(toNumber(tenant.outstanding_balance ?? tenant.monthly_rent)),
          ]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [220, 38, 38] },
        });
      }

      if (activeTab === 'duesoon') {
        autoTable(doc, {
          startY: 52,
          head: [['Tenant', 'Property / Unit', 'Due Date', 'Days Remaining', 'Rent']],
          body: data.due_soon_tenants.map((tenant) => [
            tenant.full_name,
            `${tenant.property_name} / ${tenant.unit_number}`,
            formatDate(tenant.next_due_date),
            String(tenant.days_until_due ?? 0),
            formatCurrency(toNumber(tenant.monthly_rent)),
          ]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [217, 119, 6] },
        });
      }

      doc.save(getPdfFileName(activeTab, periodLabel));
      toast.success('PDF report downloaded');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export PDF report');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-900 to-brand-600 dark:from-white dark:to-brand-300">
            Analytics & Reports
          </h2>
          <p className="text-sm text-brand-500">Comprehensive insights into your property portfolio</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-semibold text-brand-700 dark:text-brand-300 transition-all" 
          />
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex space-x-1 bg-brand-100/50 dark:bg-brand-800/50 p-1 rounded-xl w-max min-w-full sm:min-w-0">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white dark:bg-brand-900 text-brand-900 dark:text-white shadow-sm'
                  : 'text-brand-500 hover:text-brand-700 dark:hover:text-brand-300'
              }`}
            >
              {tab.replace('due', 'due ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {activeTab === 'overview' && (
          <>
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-success/10 blur-2xl group-hover:bg-success/20 transition-all" />
              <div className="flex justify-between items-center mb-6 relative">
                <h3 className="text-lg font-bold text-brand-900 dark:text-white flex items-center gap-2">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-success" /> Revenue by Property
                </h3>
              </div>
              <div className="space-y-4 relative">
                {data.income_by_property.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center bg-brand-50/50 dark:bg-brand-800/50 p-3 rounded-xl border border-border/50">
                    <span className="font-semibold text-brand-900 dark:text-white">{p.name}</span>
                    <span className="font-bold text-success text-lg">{formatCurrency(p.total_collected)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-all" />
              <div className="flex justify-between items-center mb-6 relative">
                <h3 className="text-lg font-bold text-brand-900 dark:text-white flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-primary" /> 6-Month Trend
                </h3>
              </div>
              <div className="space-y-4 relative">
                {data.monthly_trend.slice(-6).map((m: any) => (
                  <div key={m.period_month} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-brand-500">{m.period_month}</span>
                      <span className="text-brand-900 dark:text-white">{formatCurrency(m.collected)}</span>
                    </div>
                    <div className="w-full bg-brand-100 dark:bg-brand-800 rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round((m.collected / Math.max(m.expected, 1)) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'occupancy' && (
          <div className="col-span-full glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-brand-900 dark:text-white flex items-center gap-2 mb-6">
              <HomeModernIcon className="h-5 w-5 text-info" /> Property Occupancy Rates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.occupancy.map((p: any) => (
                <div key={p.id} className="border border-border/50 bg-white/30 dark:bg-brand-900/30 p-4 rounded-xl">
                  <h4 className="font-bold text-brand-900 dark:text-white mb-2">{p.name}</h4>
                  <div className="flex items-end gap-2 mb-4">
                    <span className="text-3xl font-extrabold text-info">{p.occupancy_rate}%</span>
                    <span className="text-sm font-medium text-brand-500 mb-1">Occupied</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-500 font-medium">Units: <span className="text-brand-900 dark:text-white font-bold">{p.total_units}</span></span>
                    <span className="text-success font-medium">Full: <span className="font-bold">{p.occupied}</span></span>
                    <span className="text-brand-400 font-medium">Empty: <span className="font-bold">{p.vacant}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'overdue' && (
          <div className="col-span-full glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-brand-900 dark:text-white flex items-center gap-2 mb-6">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger" /> Overdue Tenants
            </h3>
            {data.overdue_tenants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-brand-50/50 dark:bg-brand-800/50 border-b border-border/50 text-xs uppercase tracking-wider text-brand-500">
                      <th className="px-4 py-3 font-semibold">Tenant</th>
                      <th className="px-4 py-3 font-semibold">Property</th>
                      <th className="px-4 py-3 font-semibold">Due Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Days Late</th>
                      <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
                    {data.overdue_tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-brand-900 dark:text-white">{tenant.full_name}</td>
                        <td className="px-4 py-3">
                          {tenant.property_name}
                          <span className="block text-xs text-brand-500">Unit {tenant.unit_number}</span>
                        </td>
                        <td className="px-4 py-3">{formatDate(tenant.next_due_date)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-danger">{tenant.days_overdue}</td>
                        <td className="px-4 py-3 text-right font-bold text-danger">
                          {formatCurrency(toNumber(tenant.outstanding_balance ?? tenant.monthly_rent))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-brand-500">No overdue tenants for this period.</p>
            )}
          </div>
        )}

        {activeTab === 'duesoon' && (
          <div className="col-span-full glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-brand-900 dark:text-white flex items-center gap-2 mb-6">
              <ClockIcon className="h-5 w-5 text-warning" /> Due Soon Tenants
            </h3>
            {data.due_soon_tenants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-brand-50/50 dark:bg-brand-800/50 border-b border-border/50 text-xs uppercase tracking-wider text-brand-500">
                      <th className="px-4 py-3 font-semibold">Tenant</th>
                      <th className="px-4 py-3 font-semibold">Property</th>
                      <th className="px-4 py-3 font-semibold">Due Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Days Remaining</th>
                      <th className="px-4 py-3 font-semibold text-right">Rent</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
                    {data.due_soon_tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-brand-900 dark:text-white">{tenant.full_name}</td>
                        <td className="px-4 py-3">
                          {tenant.property_name}
                          <span className="block text-xs text-brand-500">Unit {tenant.unit_number}</span>
                        </td>
                        <td className="px-4 py-3">{formatDate(tenant.next_due_date)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-warning">{tenant.days_until_due}</td>
                        <td className="px-4 py-3 text-right font-bold text-brand-900 dark:text-white">
                          {formatCurrency(toNumber(tenant.monthly_rent))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-brand-500">No tenants due soon for this period.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
