import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Badge } from '../common/Badge.tsx';
import { Button } from '../common/Button.tsx';
import { Input } from '../common/Input.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { SalesService } from '../../services/sales.service.ts';
import { PDFAndPrintService } from '../../services/pdf.service.ts';
import { CURRENCY_MAP, type SaleWithDetails } from '../../types/index.ts';
import {
  Calendar,
  User,
  CreditCard,
  Ban,
  Package,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Printer,
  Download,
} from 'lucide-react';

interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  onSaleUpdated: () => void;
}

export const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSaleUpdated,
}) => {
  const { activeBusiness, currency } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  if (!sale) return null;

  const handlePrint = () => {
    PDFAndPrintService.printReceiptDirectly(sale, activeBusiness, currencyConfig);
  };

  const handleDownloadPDF = () => {
    setIsExportingPDF(true);
    try {
      PDFAndPrintService.exportReceiptPDF(sale, activeBusiness, currencyConfig);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setTimeout(() => setIsExportingPDF(false), 800);
    }
  };

  const handleCancelSale = async () => {
    if (!activeBusiness?.id) return;
    setCancelLoading(true);
    setCancelError(null);

    try {
      await SalesService.cancelSale(activeBusiness.id, sale.id, cancelReason);
      setIsCancelling(false);
      onSaleUpdated();
      onClose();
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel sale.');
    } finally {
      setCancelLoading(false);
    }
  };

  const saleStatusVariant =
    sale.sale_status === 'completed'
      ? 'emerald'
      : sale.sale_status === 'cancelled'
      ? 'rose'
      : 'amber';

  const paymentStatusVariant =
    sale.payment_status === 'paid'
      ? 'emerald'
      : sale.payment_status === 'partial'
      ? 'amber'
      : 'rose';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={`Sale Details #${sale.id.substring(0, 8).toUpperCase()}`}
      description="Authoritative transaction snapshot and stock impact"
    >
      <div className="space-y-6">
        {/* Status Highlights */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Order Status:</span>
            <Badge variant={saleStatusVariant} size="md">
              {sale.sale_status.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Payment:</span>
            <Badge variant={paymentStatusVariant} size="md">
              {sale.payment_status.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>
              {new Date(sale.sold_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-zinc-400" /> Customer Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-zinc-400">Customer Name:</p>
              <p className="font-semibold text-zinc-100">
                {sale.customers?.name || 'Walk-in Customer'}
              </p>
            </div>
            {sale.customers?.phone && (
              <div>
                <p className="text-xs text-zinc-400">Phone:</p>
                <p className="text-zinc-200">{sale.customers.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sale Items Table with Snapshot Information */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-zinc-400" /> Items Sold (Snapshot)
          </h4>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sale.sale_items.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/30">
                    <td className="py-2.5 px-3 font-medium text-zinc-200">
                      <div>{item.product_name_snapshot}</div>
                      {item.discount > 0 && (
                        <div className="text-[10px] text-emerald-400">
                          Discount: -{currencyConfig.format(item.discount)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center text-zinc-300 font-semibold">
                      {item.quantity} {item.unit_of_measure ? <span className="text-[10px] text-zinc-400 font-normal">({item.unit_of_measure})</span> : null}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-300">
                      {currencyConfig.format(item.unit_price)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-zinc-100">
                      {currencyConfig.format(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal:</span>
            <span>{currencyConfig.format(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Discount Applied:</span>
              <span>-{currencyConfig.format(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Tax / VAT:</span>
              <span>+{currencyConfig.format(sale.tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-zinc-800">
            <span>Total:</span>
            <span className="text-emerald-400">{currencyConfig.format(sale.total)}</span>
          </div>
          <div className="flex justify-between text-zinc-300">
            <span>Amount Paid:</span>
            <span className="font-semibold">{currencyConfig.format(sale.amount_paid)}</span>
          </div>
          {sale.amount_due > 0 && (
            <div className="flex justify-between text-rose-400 font-bold bg-rose-950/20 p-2 rounded-lg border border-rose-500/20">
              <span>Outstanding Debt (Due):</span>
              <span>{currencyConfig.format(sale.amount_due)}</span>
            </div>
          )}
        </div>

        {/* Cancellation Flow */}
        {sale.sale_status === 'completed' && (
          <div className="pt-2">
            {!isCancelling ? (
              <Button
                variant="outline"
                onClick={() => setIsCancelling(true)}
                className="w-full flex items-center justify-center gap-2 text-rose-400 border-rose-500/30 hover:bg-rose-950/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Cancel Sale & Reverse Inventory Stock</span>
              </Button>
            ) : (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirm Sale Cancellation & Stock Reversal</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Cancelling this sale will mark its status as cancelled, return{' '}
                  <strong className="text-white">
                    {sale.sale_items.reduce((s, i) => s + i.quantity, 0)} units
                  </strong>{' '}
                  back to product stock, and log an audit reversal in the inventory ledger.
                </p>

                <Input
                  label="Cancellation Reason"
                  placeholder="e.g., Customer return, billing mistake"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />

                {cancelError && <p className="text-xs text-rose-400 font-medium">{cancelError}</p>}

                <div className="flex items-center gap-2 justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCancelling(false)}
                    disabled={cancelLoading}
                  >
                    Keep Sale
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCancelSale}
                    isLoading={cancelLoading}
                  >
                    Confirm Cancellation
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {sale.sale_status === 'cancelled' && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <Ban className="w-4 h-4 shrink-0" />
            <span>This sale was cancelled and its inventory quantities were returned to stock.</span>
          </div>
        )}

        {/* Modal Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-400" />
              <span>Print Receipt</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadPDF}
              isLoading={isExportingPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download PDF</span>
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
