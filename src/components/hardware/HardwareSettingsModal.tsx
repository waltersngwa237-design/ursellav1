import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';
import {
  HardwarePrinterService,
  type HardwareSettings,
  type ThermalPaperWidth,
} from '../../services/hardware-printer.service.ts';
import {
  Printer,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
  DollarSign,
  FileText,
  Key,
} from 'lucide-react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { CURRENCY_MAP, type SaleWithDetails } from '../../types/index.ts';

interface HardwareSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareSettingsModal: React.FC<HardwareSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeBusiness, currency } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [settings, setSettings] = useState<HardwareSettings>(HardwarePrinterService.getSettings());
  const [isConnectingBT, setIsConnectingBT] = useState(false);
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);
  const [drawerKickMessage, setDrawerKickMessage] = useState<string | null>(null);

  const capabilities = HardwarePrinterService.getCapabilities();

  useEffect(() => {
    if (isOpen) {
      setSettings(HardwarePrinterService.getSettings());
      setTestPrintSuccess(false);
      setDrawerKickMessage(null);
    }
  }, [isOpen]);

  const updateSetting = <K extends keyof HardwareSettings>(key: K, value: HardwareSettings[K]) => {
    const updated = HardwarePrinterService.saveSettings({ [key]: value });
    setSettings(updated);
  };

  const handleConnectBluetooth = async () => {
    setIsConnectingBT(true);
    setBtStatus(null);
    try {
      const result = await HardwarePrinterService.connectBluetooth();
      if (result.success) {
        setBtStatus(`Connected: ${result.deviceName}`);
        setSettings(HardwarePrinterService.getSettings());
      } else {
        setBtStatus(result.error || 'Connection canceled.');
      }
    } finally {
      setIsConnectingBT(false);
    }
  };

  const handleTestPrint = () => {
    // Generate a mock sale to test receipt layout
    const mockSale: SaleWithDetails = {
      id: 'TEST-001-' + Date.now().toString(36),
      business_id: activeBusiness?.id || 'biz',
      customer_id: null,
      subtotal: 10000,
      discount: 1000,
      tax: 500,
      total: 9500,
      amount_paid: 10000,
      amount_due: 0,
      payment_method: 'cash',
      payment_status: 'paid',
      sale_status: 'completed',
      sold_by: null,
      sold_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: 'Hardware diagnostic test print',
      sale_items: [
        {
          id: 'item-1',
          sale_id: 'test',
          business_id: activeBusiness?.id || 'biz',
          product_id: 'prod-1',
          product_name_snapshot: 'Test Product A (Sample Item)',
          quantity: 2,
          unit_price: 3500,
          unit_cost: 2000,
          unit_of_measure: 'pcs',
          discount: 0,
          subtotal: 7000,
          total: 7000,
          created_at: new Date().toISOString(),
          products: null,
        },
        {
          id: 'item-2',
          sale_id: 'test',
          business_id: activeBusiness?.id || 'biz',
          product_id: 'prod-2',
          product_name_snapshot: 'Test Product B (Retail Unit)',
          quantity: 1,
          unit_price: 3000,
          unit_cost: 1500,
          unit_of_measure: 'pcs',
          discount: 1000,
          subtotal: 3000,
          total: 2000,
          created_at: new Date().toISOString(),
          products: null,
        },
      ],
      customers: null,
    };

    HardwarePrinterService.printThermalReceiptBrowser(
      mockSale,
      activeBusiness,
      currencyConfig,
      settings.paperWidth
    );
    setTestPrintSuccess(true);
  };

  const handleKickDrawer = async () => {
    const res = await HardwarePrinterService.kickCashDrawer();
    setDrawerKickMessage(res.message);
    setTimeout(() => setDrawerKickMessage(null), 4000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                POS Hardware & Thermal Printer
              </h2>
              <p className="text-xs text-zinc-400">
                Configure ESC/POS thermal printers, receipt width, and cash drawers
              </p>
            </div>
          </div>
        </div>

        {/* Paper Width Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Receipt Paper Roll Width
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateSetting('paperWidth', '80mm')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                settings.paperWidth === '80mm'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">80mm Thermal</span>
                {settings.paperWidth === '80mm' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Standard countertop POS printers (Epson, Star, Sunmi, Xprinter)
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateSetting('paperWidth', '58mm')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                settings.paperWidth === '58mm'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">58mm Thermal</span>
                {settings.paperWidth === '58mm' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Compact mobile & handheld Bluetooth printers (32 columns)
              </p>
            </button>
          </div>
        </div>

        {/* Automation Toggles */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Automations & Peripherals
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors">
            <div>
              <span className="text-sm font-medium text-zinc-200 block">
                Auto-Kick Cash Drawer
              </span>
              <span className="text-xs text-zinc-400">
                Send ESC/POS open drawer pulse automatically on cash sales
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoKickDrawerOnCash}
              onChange={(e) => updateSetting('autoKickDrawerOnCash', e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-800 border-zinc-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors">
            <div>
              <span className="text-sm font-medium text-zinc-200 block">
                Auto-Print on Completed Sale
              </span>
              <span className="text-xs text-zinc-400">
                Trigger receipt printing dialog immediately after recording transaction
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPrintOnSale}
              onChange={(e) => updateSetting('autoPrintOnSale', e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-800 border-zinc-700"
            />
          </label>
        </div>

        {/* Bluetooth Pairing Option */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Direct ESC/POS Wireless Pairing
              </label>
              <span className="text-xs text-zinc-400">
                Pair with wireless portable ESC/POS thermal printers
              </span>
            </div>
            {settings.pairedDeviceName && (
              <Badge variant="emerald" size="sm">
                PAIRED
              </Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectBluetooth}
              isLoading={isConnectingBT}
              leftIcon={<Bluetooth className="w-4 h-4 text-emerald-400" />}
              className="text-xs"
            >
              {settings.pairedDeviceName ? 'Change Bluetooth Device' : 'Pair Bluetooth Printer'}
            </Button>

            {settings.pairedDeviceName && (
              <span className="text-xs text-zinc-300 font-mono self-center">
                Device: {settings.pairedDeviceName}
              </span>
            )}
          </div>

          {btStatus && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
              {btStatus}
            </p>
          )}
        </div>

        {/* Diagnostics & Testing */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Hardware Diagnostics
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              leftIcon={<Printer className="w-4 h-4 text-zinc-300" />}
              className="text-xs"
            >
              Test Print Receipt
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleKickDrawer}
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
              className="text-xs"
            >
              Trigger Cash Drawer Pulse
            </Button>
          </div>

          {drawerKickMessage && (
            <p className="text-xs text-zinc-300 bg-zinc-800/80 p-2 rounded-lg mt-2">
              {drawerKickMessage}
            </p>
          )}

          {testPrintSuccess && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-2">
              <CheckCircle2 className="w-4 h-4" />
              Test receipt dispatched to print pipeline in {settings.paperWidth} mode.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <Button variant="primary" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
