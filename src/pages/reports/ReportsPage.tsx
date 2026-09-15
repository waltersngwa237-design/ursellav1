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
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sliders,
  UserCheck,
} from 'lucide-react';
import { ClientReportingService } from '../../services/reporting.service.ts';
import { PDFAndPrintService } from '../../services/pdf.service.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { CURRENCY_MAP, type BusinessReportData, type MemberRole } from '../../types/index.ts';
import { RegisterCloseoutModal } from '../../components/reports/RegisterCloseoutModal.tsx';
import {
  RegisterCloseoutService,
  type RegisterShift,
} from '../../services/register-closeout.service.ts';
import { HardwarePrinterService } from '../../services/hardware-printer.service.ts';
import { hasPermission, ROLE_CONFIGS } from '../../utils/rbac.ts';
import { Button } from '../../components/common/Button.tsx';
import { Badge } from '../../components/common/Badge.tsx';

interface ReportsPageProps {
  businessId: string;
}

type ReportType =
  | 'z_reports'
  | 'sales'
  | 'profitability'
  | 'inventory'
  | 'expenses'
  | 'receivables'
  | 'cash_flow'
  | 'tax';
type PeriodOption = 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year';

export const ReportsPage: React.FC<ReportsPageProps> = ({ businessId }) => {
  const { activeBusiness, currency, effectiveRole, setSimulatedRole, simulatedRole } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [activeReport, setActiveReport] = useState<ReportType>('z_reports');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('30d');
  const [reportData, setReportData] = useState<BusinessReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Register Closeout & Z-Reports state
  const [activeShift, setActiveShift] = useState<RegisterShift | null>(null);
  const [historicShifts, setHistoricShifts] = useState<RegisterShift[]>([]);
  const [isCloseoutModalOpen, setIsCloseoutModalOpen] = useState(false);
  const [selectedShiftForModal, setSelectedShiftForModal] = useState<RegisterShift | null>(null);

  const loadZReports = async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const current = await RegisterCloseoutService.getCurrentShift(
        businessId,
        effectiveRole === 'cashier' ? 'Cashier Station' : 'Store Manager'
      );
      setActiveShift(current);
      const history = RegisterCloseoutService.getHistoricCloseouts(businessId);
      setHistoricShifts(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load register shifts');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    if (!businessId) return;
    if (activeReport === 'z_reports') {
      loadZReports();
      return;
    }

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

  const reportTabs: Array<{ id: ReportType; label: string; icon: React.FC<{ className?: string }>; requiresManager?: boolean }> = [
    { id: 'z_reports', label: 'Register Closeouts (Z-Reports)', icon: Receipt },
    { id: 'sales', label: 'Sales & Receipts', icon: DollarSign },
    { id: 'profitability', label: 'P&L / Profitability', icon: TrendingUp, requiresManager: true },
    { id: 'inventory', label: 'Inventory Valuation', icon: Package },
    { id: 'expenses', label: 'Expense Analysis', icon: PieChartIcon },
    { id: 'receivables', label: 'Customer Receivables', icon: CreditCard },
    { id: 'cash_flow', label: 'Cash Flow Statement', icon: ArrowDownRight, requiresManager: true },
    { id: 'tax', label: 'Tax & Compliance', icon: Landmark, requiresManager: true },
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
    if (activeReport === 'z_reports' && activeShift) {
      HardwarePrinterService.printZReport(activeShift, activeBusiness, currencyConfig);
      return;
    }
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

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeBusiness?.name || 'Business'}-${activeReport}-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRestrictedForRole =
    (activeReport === 'profitability' || activeReport === 'cash_flow' || activeReport === 'tax') &&
    !hasPermission(effectiveRole, 'view_financial_reports');

  const currentRoleConfig = ROLE_CONFIGS[effectiveRole] || ROLE_CONFIGS.owner;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Role Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <FileText className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Financial & Register Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Business Financial & Register Reports</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Auditable, GAAP-aligned financial statements, register shift closeouts (Z-Reports), and tax estimates.
          </p>
        </div>

        {/* Role Simulator Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role badge with switch popover / dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-xs">
            <span className="text-zinc-400">Role:</span>
            <span className={`font-bold uppercase text-[11px] ${
              effectiveRole === 'owner' ? 'text-purple-400' :
              effectiveRole === 'manager' ? 'text-sky-400' : 'text-emerald-400'
            }`}>
              {currentRoleConfig.label}
            </span>
            <select
              value={simulatedRole || effectiveRole}
              onChange={(e) => setSimulatedRole(e.target.value as MemberRole)}
              className="bg-transparent text-zinc-300 text-xs border-none focus:outline-none cursor-pointer pl-1 pr-1 font-semibold"
            >
              <option value="owner" className="bg-zinc-900 text-white">Owner (Full)</option>
              <option value="manager" className="bg-zinc-900 text-white">Manager (High)</option>
              <option value="cashier" className="bg-zinc-900 text-white">Cashier (Limited)</option>
            </select>
          </div>

          <button
            onClick={handlePrint}
            disabled={activeReport !== 'z_reports' && (!reportData || loading)}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-400" />
            <span>{activeReport === 'z_reports' ? 'Print Slip' : 'Print'}</span>
          </button>
          
          {activeReport !== 'z_reports' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          const isTabRestricted = tab.requiresManager && !hasPermission(effectiveRole, 'view_financial_reports');

          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              } ${isTabRestricted ? 'opacity-60' : ''}`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isTabRestricted && <Lock className="w-3 h-3 text-amber-400 ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Period Filter Selector (for general reports) */}
      {activeReport !== 'z_reports' && activeReport !== 'inventory' && activeReport !== 'receivables' && !isRestrictedForRole && (
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

      {/* Role Restriction Banner */}
      {isRestrictedForRole ? (
        <div className="p-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">Confidential Financial Report Restricted</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Access to profit margins, cash flow statements, and tax audits is limited to Store Managers and Business Owners. Your current simulated role is <strong className="text-amber-400 capitalize">{effectiveRole}</strong>.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActiveReport('z_reports')}>
              Go to Register Closeout (Z-Reports)
            </Button>
            <Button size="sm" onClick={() => setSimulatedRole('owner')}>
              Switch to Owner Role
            </Button>
          </div>
        </div>
      ) : activeReport === 'z_reports' ? (
        /* Register Closeouts & Z-Reports Dashboard */
        <div className="space-y-6">
          {/* Active Shift Card */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Live Cash Register
                  </span>
                  <Badge variant={activeShift?.status === 'open' ? 'amber' : 'emerald'}>
                    {activeShift?.status === 'open' ? 'Open & Active' : 'Shift Closed'}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Shift #{activeShift?.shift_number || 1} &bull; Expected Z-Report: {activeShift?.z_report_number || 'Z-001'}
                </h3>
                <p className="text-xs text-zinc-400">
                  Opened {activeShift?.opened_at ? new Date(activeShift.opened_at).toLocaleString() : 'Today'} by {activeShift?.opened_by || 'Store Cashier'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeShift) {
                      HardwarePrinterService.printZReport(activeShift, activeBusiness, currencyConfig);
                    }
                  }}
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Print Mid-Day X-Reading
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedShiftForModal(activeShift);
                    setIsCloseoutModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  Perform End-of-Day Closeout (Z-Report)
                </Button>
              </div>
            </div>

            {/* Live Register Balance Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Opening Float</span>
                <p className="text-base font-bold font-mono text-zinc-200 mt-1">
                  {currencyConfig.format(activeShift?.opening_float || 0)}
                </p>
                <span className="text-[10px] text-zinc-500">Drawer seed cash</span>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Cash Collected</span>
                <p className="text-base font-bold font-mono text-emerald-400 mt-1">
                  +{currencyConfig.format(activeShift?.cash_sales || 0)}
                </p>
                <span className="text-[10px] text-zinc-500">From cash sales</span>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Card / MoMo</span>
                <p className="text-base font-bold font-mono text-indigo-400 mt-1">
                  {currencyConfig.format((activeShift?.card_sales || 0) + (activeShift?.momo_sales || 0))}
                </p>
                <span className="text-[10px] text-zinc-500">Non-cash tenders</span>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Petty Payouts</span>
                <p className="text-base font-bold font-mono text-rose-400 mt-1">
                  -{currencyConfig.format(activeShift?.cash_out || 0)}
                </p>
                <span className="text-[10px] text-zinc-500">Expenses from drawer</span>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <span className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold">Expected In Drawer</span>
                <p className="text-base font-bold font-mono text-emerald-300 mt-1">
                  {currencyConfig.format(activeShift?.expected_cash || 0)}
                </p>
                <span className="text-[10px] text-emerald-400/80">Audit baseline</span>
              </div>
            </div>
          </div>

          {/* Historical Z-Reports Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Historical Z-Report Audit Records</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Permanent audit ledger of all closed shifts and cash variance counts.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Tamper-Sealed Ledger</span>
              </div>
            </div>

            {historicShifts.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm space-y-2">
                <Receipt className="w-8 h-8 text-zinc-600 mx-auto" />
                <p>No closed Z-reports yet.</p>
                <p className="text-xs text-zinc-600">Close an active shift to generate the official Z-Report record.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Report #</th>
                      <th className="px-4 py-3">Closed Date & Time</th>
                      <th className="px-4 py-3">Cashier / Staff</th>
                      <th className="px-4 py-3">Gross Sales</th>
                      <th className="px-4 py-3">Expected Cash</th>
                      <th className="px-4 py-3">Actual Count</th>
                      <th className="px-4 py-3">Discrepancy</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                    {historicShifts.map((hist) => (
                      <tr key={hist.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-emerald-400">{hist.z_report_number}</td>
                        <td className="px-4 py-3 font-sans text-zinc-400">
                          {hist.closed_at ? new Date(hist.closed_at).toLocaleString() : 'Active'}
                        </td>
                        <td className="px-4 py-3 font-sans text-zinc-300">{hist.opened_by}</td>
                        <td className="px-4 py-3 font-bold text-white">{currencyConfig.format(hist.total_sales)}</td>
                        <td className="px-4 py-3 text-zinc-400">{currencyConfig.format(hist.expected_cash)}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-200">
                          {currencyConfig.format(hist.actual_cash_counted)}
                        </td>
                        <td className="px-4 py-3">
                          {hist.discrepancy === 0 ? (
                            <span className="text-emerald-400 font-bold font-sans text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                            </span>
                          ) : hist.discrepancy > 0 ? (
                            <span className="text-sky-400 font-sans text-[11px]">
                              +{currencyConfig.format(hist.discrepancy)} Over
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold font-sans text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> -{currencyConfig.format(Math.abs(hist.discrepancy))} Short
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => HardwarePrinterService.printZReport(hist, activeBusiness, currencyConfig)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-semibold flex items-center gap-1"
                              title="Print Thermal Slip"
                            >
                              <Printer className="w-3 h-3" />
                              Slip
                            </button>
                            <button
                              onClick={() => {
                                setSelectedShiftForModal(hist);
                                setIsCloseoutModalOpen(true);
                              }}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded text-[11px] font-semibold"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : loading ? (
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

      {/* Register Closeout Modal */}
      <RegisterCloseoutModal
        isOpen={isCloseoutModalOpen}
        onClose={() => setIsCloseoutModalOpen(false)}
        shiftToView={selectedShiftForModal}
        onShiftClosed={(closedShift) => {
          loadZReports();
          setIsCloseoutModalOpen(false);
        }}
      />
    </div>
  );
};

