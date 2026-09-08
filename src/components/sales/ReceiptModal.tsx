import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Badge } from '../common/Badge.tsx';
import { Button } from '../common/Button.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { PDFAndPrintService } from '../../services/pdf.service.ts';
import { HardwarePrinterService } from '../../services/hardware-printer.service.ts';
import { HardwareSettingsModal } from '../hardware/HardwareSettingsModal.tsx';
import { CURRENCY_MAP, type SaleWithDetails } from '../../types/index.ts';
import {
  Printer,
  Download,
  CheckCircle2,
  Calendar,
  User,
  CreditCard,
  Receipt as ReceiptIcon,
  X,
  PlusCircle,
  FileDown,
  Sliders,
  DollarSign,
  Sparkles,
} from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  onNewSale,
}) => {
  const { activeBusiness, currency } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!sale) return null;

  const handlePrint = () => {
    PDFAndPrintService.printReceiptDirectly(sale, activeBusiness, currencyConfig);
  };

  const handleThermalPrint = async () => {
    const res = await HardwarePrinterService.printThermalReceipt(
      sale,
      activeBusiness,
      currencyConfig
    );
    if (res.message) {
      setActionFeedback(res.message);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handleKickDrawer = async () => {
    const res = await HardwarePrinterService.kickCashDrawer();
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleDownloadPDF = () => {
    setIsExportingPDF(true);
    try {
      PDFAndPrintService.exportReceiptPDF(sale, activeBusiness, currencyConfig);
    } catch (err) {
      console.error('Failed to export PDF receipt:', err);
    } finally {
      setTimeout(() => setIsExportingPDF(false), 800);
    }
  };

  const paymentStatusVariant =
    sale.payment_status === 'paid'
      ? 'emerald'
      : sale.payment_status === 'partial'
      ? 'amber'
      : 'rose';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-6">
        {/* Header Ribbon */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-2">Sale Completed</h2>
          <p className="text-xs text-zinc-400">Transaction recorded to ledger & stock deducted</p>
        </div>

        {/* Printable Receipt Paper Visual Container */}
        <div
          id="ursella-printable-receipt"
          className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 font-mono text-xs text-zinc-300 shadow-xl relative overflow-hidden"
        >
          {/* Top Receipt Notch Decorator */}
          <div className="border-b border-dashed border-zinc-700 pb-3 text-center space-y-1">
            <p className="font-sans font-extrabold text-sm uppercase tracking-wider text-white">
              {activeBusiness?.name}
            </p>
            <p className="text-[11px] text-zinc-400 font-sans">
              {activeBusiness?.description || 'Official Sales Receipt'}
            </p>
            <p className="text-[10px] text-zinc-400">
              Receipt #{sale.id.substring(0, 8).toUpperCase()}
            </p>
          </div>

          {/* Sale Metadata */}
          <div className="space-y-1.5 text-[11px] pb-3 border-b border-zinc-800">
            <div className="flex justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date:
              </span>
              <span className="text-zinc-200">
                {new Date(sale.sold_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Customer:
              </span>
              <span className="text-zinc-200 font-semibold">
                {sale.customers?.name || 'Walk-in Customer'}
              </span>
            </div>
            {sale.payment_method && (
              <div className="flex justify-between">
                <span className="text-zinc-400 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Method:
                </span>
                <span className="text-zinc-200 uppercase">{sale.payment_method.replace('_', ' ')}</span>
              </div>
            )}
          </div>

          {/* Purchased Line Items */}
          <div className="space-y-2 py-1">
            <div className="flex justify-between font-bold text-[10px] uppercase tracking-wider text-zinc-400 pb-1 border-b border-zinc-800">
              <span>Item & Qty</span>
              <span>Amount</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {sale.sale_items.map((item, idx) => (
                <div key={item.id || idx} className="flex justify-between items-start text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="text-zinc-200 truncate font-sans text-xs">
                      {item.product_name_snapshot}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {item.quantity} {item.unit_of_measure ? `${item.unit_of_measure} ` : ''}x {currencyConfig.format(item.unit_price)}
                      {item.discount > 0 ? ` (-${currencyConfig.format(item.discount)})` : ''}
                    </p>
                  </div>
                  <span className="text-zinc-100 font-semibold whitespace-nowrap">
                    {currencyConfig.format(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Balance Calculation */}
          <div className="pt-3 border-t border-dashed border-zinc-700 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal:</span>
              <span>{currencyConfig.format(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount:</span>
                <span>-{currencyConfig.format(sale.discount)}</span>
              </div>
            )}
            {sale.tax > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Tax:</span>
                <span>+{currencyConfig.format(sale.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-zinc-800">
              <span>Grand Total:</span>
              <span className="text-emerald-400">{currencyConfig.format(sale.total)}</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Amount Paid:</span>
              <span className="font-semibold">{currencyConfig.format(sale.amount_paid)}</span>
            </div>
            {sale.amount_due > 0 ? (
              <div className="flex justify-between text-rose-400 font-bold bg-rose-950/20 p-1.5 rounded-lg border border-rose-500/20">
                <span>Balance Due (Debt):</span>
                <span>{currencyConfig.format(sale.amount_due)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-emerald-400 text-[11px]">
                <span>Status:</span>
                <span className="uppercase font-bold">Paid in Full</span>
              </div>
            )}
          </div>

          {sale.notes && (
            <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 italic">
              Note: {sale.notes}
            </div>
          )}
        </div>

        {/* Feedback Message */}
        {actionFeedback && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionFeedback}
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={handleThermalPrint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Thermal Print (ESC/POS)</span>
              </Button>

              <Button
                variant="secondary"
                onClick={handlePrint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span>Full Page</span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleDownloadPDF}
                isLoading={isExportingPDF}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>PDF</span>
              </Button>

              {sale.payment_method === 'cash' && (
                <Button
                  variant="outline"
                  onClick={handleKickDrawer}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs text-zinc-300"
                  title="Pulse Cash Drawer Trigger"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Drawer</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsHardwareModalOpen(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Configure Thermal Hardware"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {onNewSale && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onClose();
                    onNewSale();
                  }}
                  className="flex items-center justify-center gap-1.5 text-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Next Sale</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={onClose}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>

        {/* Hardware Settings Modal */}
        <HardwareSettingsModal
          isOpen={isHardwareModalOpen}
          onClose={() => setIsHardwareModalOpen(false)}
        />
      </div>
    </Modal>
  );
};
