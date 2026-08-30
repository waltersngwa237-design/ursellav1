import React, { useState, useEffect } from 'react';
import {
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  ArrowDownRight,
  Download,
  Printer,
  Calendar,
  RefreshCw,
  PieChart as PieChartIcon,
  ShieldCheck,
  FileSpreadsheet,
  Landmark,
  AlertCircle,
} from 'lucide-react';
import { ClientReportingService } from '../../services/reporting.service.ts';
import { PDFAndPrintService } from '../../services/pdf.service.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { CURRENCY_MAP, type BusinessReportData } from '../../types/index.ts';

interface ReportsPageProps {
  businessId: string;
}

type ReportType = 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow' | 'tax';
type PeriodOption = 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year';

export const ReportsPage: React.FC<ReportsPageProps> = ({ businessId }) => {
  const { activeBusiness, currency } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [activeReport, setActiveReport] = useState<ReportType>('sales');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('30d');
  const [reportData, setReportData] = useState<BusinessReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const loadReport = async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ClientReportingService.fetchReport(businessId, activeReport, {
        period: selectedPeriod,
      });
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [businessId, activeReport, selectedPeriod]);

  const reportTabs: Array<{ id: ReportType; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'sales', label: 'Sales & Receipts', icon: DollarSign },
    { id: 'profitability', label: 'P&L / Profitability', icon: TrendingUp },
    { id: 'inventory', label: 'Inventory Valuation', icon: Package },
    { id: 'expenses', label: 'Expense Analysis', icon: PieChartIcon },
    { id: 'receivables', label: 'Customer Receivables', icon: CreditCard },
    { id: 'cash_flow', label: 'Cash Flow Statement', icon: ArrowDownRight },
    { id: 'tax', label: 'Tax & Compliance', icon: Landmark },
  ];

  const periodOptions: Array<{ id: PeriodOption; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  const handlePrint = () => {
    if (!reportData) return;
    PDFAndPrintService.printReportDirectly(reportData, activeBusiness?.name || 'Business', currencyConfig.symbol);
  };

  const handleDownloadPDF = () => {
    if (!reportData) return;
    setIsExportingPDF(true);
    try {
      PDFAndPrintService.exportReportPDF(reportData, activeBusiness?.name || 'Business', currencyConfig.symbol);
    } catch (err) {
      console.error('Failed to export PDF report:', err);
    } finally {
      setTimeout(() => setIsExportingPDF(false), 800);
    }
  };

  const handleExportCSV = () => {
    if (!reportData || reportData.breakdownRows.length === 0) return;
    const rows = reportData.breakdownRows;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const val = r[h];
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeBusiness?.name || 'Business'}-${activeReport}-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Financial & Tax Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Business Financial & Tax Reports</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Auditable, GAAP-aligned financial statements, tax estimates, and operational breakdowns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!reportData || loading}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-400" />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={!reportData || loading || isExportingPDF}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExportingPDF ? 'Exporting...' : 'Export PDF'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!reportData || loading}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Period Filter Selector */}
      {activeReport !== 'inventory' && activeReport !== 'receivables' && (
        <div className="flex items-center gap-2 flex-wrap bg-zinc-900/60 p-2 rounded-xl border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 px-2 font-medium">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span>Time Horizon:</span>
          </div>
          {periodOptions.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedPeriod === p.id
                  ? 'bg-zinc-800 text-emerald-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading & Error States */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Compiling financial metrics from database ledger...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-bold">Unable to load report</p>
              <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadReport}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs rounded-xl border border-rose-500/30 transition-colors cursor-pointer"
          >
            Retry Report
          </button>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(reportData.summaryMetrics).map(([key, value]) => {
              const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
              const isNumeric = typeof value === 'number';
              const formattedValue = isNumeric
                ? key.toLowerCase().includes('count') || key.toLowerCase().includes('skus')
                  ? value.toLocaleString()
                  : key.toLowerCase().includes('percent')
                  ? `${value}%`
                  : `${currencyConfig.symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                : String(value);

              return (
                <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    {formattedKey}
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">{formattedValue}</div>
                </div>
              );
            })}
          </div>

          {/* Detailed Table Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white capitalize">
                  {reportData.reportType.replace('_', ' ')} Breakdown Table
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Coverage: <span className="text-emerald-400 font-semibold">{reportData.periodLabel}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Ledger Verified</span>
              </div>
            </div>

            {reportData.breakdownRows.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No recorded entries found for this time period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
                    <tr>
                      {Object.keys(reportData.breakdownRows[0]).map((col) => (
                        <th key={col} className="px-4 py-3">
                          {col.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                    {reportData.breakdownRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                        {Object.values(row).map((val: any, colIdx) => (
                          <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                            {typeof val === 'number'
                              ? val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                              : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
