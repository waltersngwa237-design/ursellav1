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
  Unlink,
  Radio,
  Wifi,
  Info,
} from 'lucide-react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
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
  const { language } = useLanguage();
  const isFr = language === 'fr';
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [settings, setSettings] = useState<HardwareSettings>(HardwarePrinterService.getSettings());
  const [isConnectingBT, setIsConnectingBT] = useState(false);
  const [isTestingDirectBT, setIsTestingDirectBT] = useState(false);
  const [isBTConnected, setIsBTConnected] = useState(HardwarePrinterService.isBluetoothConnected());
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);
  const [drawerKickMessage, setDrawerKickMessage] = useState<string | null>(null);

  const capabilities = HardwarePrinterService.getCapabilities();

  useEffect(() => {
    if (isOpen) {
      setSettings(HardwarePrinterService.getSettings());
      setIsBTConnected(HardwarePrinterService.isBluetoothConnected());
      setTestPrintSuccess(false);
      setDrawerKickMessage(null);
    }

    const handleBtStatusEvent = (e: any) => {
      setIsBTConnected(HardwarePrinterService.isBluetoothConnected());
      setSettings(HardwarePrinterService.getSettings());
      if (e.detail?.connected) {
        setBtStatus(isFr ? `Connecté à : ${e.detail.deviceName}` : `Connected to: ${e.detail.deviceName}`);
      } else {
        setBtStatus(isFr ? 'Périphérique Bluetooth déconnecté.' : 'Bluetooth device disconnected.');
      }
    };

    window.addEventListener('ursella_bluetooth_status_changed', handleBtStatusEvent);
    return () => {
      window.removeEventListener('ursella_bluetooth_status_changed', handleBtStatusEvent);
    };
  }, [isOpen, isFr]);

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
        setIsBTConnected(true);
        setBtStatus(
          isFr
            ? `Imprimante connectée : ${result.deviceName}`
            : `Printer connected: ${result.deviceName}`
        );
        setSettings(HardwarePrinterService.getSettings());
      } else {
        setBtStatus(result.error || (isFr ? 'Connexion annulée.' : 'Connection canceled.'));
      }
    } finally {
      setIsConnectingBT(false);
    }
  };

  const handleDisconnectBluetooth = async () => {
    await HardwarePrinterService.disconnectBluetooth();
    setIsBTConnected(false);
    setSettings(HardwarePrinterService.getSettings());
    setBtStatus(isFr ? 'Imprimante Bluetooth déconnectée.' : 'Bluetooth printer disconnected.');
  };

  const handleDirectBluetoothTestPrint = async () => {
    setIsTestingDirectBT(true);
    try {
      const res = await HardwarePrinterService.printTestReceiptBluetooth(activeBusiness);
      if (res.success) {
        setTestPrintSuccess(true);
        setBtStatus(
          isFr
            ? 'Ticket de test ESC/POS imprimé avec succès via Bluetooth !'
            : 'ESC/POS calibration ticket printed successfully via Bluetooth!'
        );
      } else {
        setBtStatus(res.error || (isFr ? 'Échec de l’impression Bluetooth.' : 'Direct Bluetooth print failed.'));
      }
    } finally {
      setIsTestingDirectBT(false);
    }
  };

  const handleBrowserTestPrint = () => {
    const mockSale: SaleWithDetails = {
      id: 'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
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
      notes: 'Diagnostic test receipt',
      sale_items: [
        {
          id: 'item-1',
          sale_id: 'test',
          business_id: activeBusiness?.id || 'biz',
          product_id: 'prod-1',
          product_name_snapshot: isFr ? 'Article de Test A' : 'Test Product A (Sample)',
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
          product_name_snapshot: isFr ? 'Article de Test B' : 'Test Product B (Retail)',
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
                {isFr ? 'Matériel & Imprimante Thermique' : 'POS Hardware & Thermal Printer'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isFr
                  ? 'Gestion ESC/POS, Bluetooth sans fil, largeur papier et tiroir-caisse'
                  : 'Configure ESC/POS Bluetooth printers, receipt width, and cash drawers'}
              </p>
            </div>
          </div>
        </div>

        {/* Paper Width Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            {isFr ? 'Largeur du Rouleau de Papier' : 'Receipt Paper Roll Width'}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateSetting('paperWidth', '80mm')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                settings.paperWidth === '80mm'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm ring-1 ring-emerald-500/30'
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
                {isFr ? 'Standard comptoir (Epson, Star, Sunmi, Xprinter - 48 col)' : 'Standard countertop POS printers (48 columns)'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateSetting('paperWidth', '58mm')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                settings.paperWidth === '58mm'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm ring-1 ring-emerald-500/30'
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
                {isFr ? 'Portables & Bluetooth de poche (Goojprt, Milestone - 32 col)' : 'Compact mobile & handheld Bluetooth printers (32 cols)'}
              </p>
            </button>
          </div>
        </div>

        {/* Bluetooth Wireless Thermal Section */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                {isFr ? 'Appairage Bluetooth Sans Fil' : 'Direct Web Bluetooth Wireless ESC/POS'}
              </label>
            </div>
            {isBTConnected ? (
              <Badge variant="emerald" size="sm" className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {isFr ? 'CONNECTÉ' : 'CONNECTED'}
              </Badge>
            ) : settings.pairedDeviceName ? (
              <Badge variant="amber" size="sm">
                {isFr ? 'MÉMORISÉ (HORS-LIGNE)' : 'PAIRED (STANDBY)'}
              </Badge>
            ) : (
              <Badge variant="zinc" size="sm">
                {isFr ? 'NON CONNECTÉ' : 'NOT CONNECTED'}
              </Badge>
            )}
          </div>

          <p className="text-xs text-zinc-400">
            {isFr
              ? 'Connectez directement votre imprimante thermique 58mm/80mm sans installer de pilote lourd.'
              : 'Connect directly to your portable 58mm or 80mm ESC/POS printer with zero external drivers required.'}
          </p>

          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isBTConnected ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {settings.pairedDeviceName || (isFr ? 'Aucune imprimante appairée' : 'No Bluetooth printer paired')}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {isBTConnected
                      ? (isFr ? 'Canal direct ESC/POS actif' : 'Active direct ESC/POS channel')
                      : (isFr ? 'Mode aperçu navigateur actif' : 'Browser print fallback active')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isBTConnected ? 'outline' : 'primary'}
                  size="sm"
                  onClick={handleConnectBluetooth}
                  isLoading={isConnectingBT}
                  leftIcon={<Bluetooth className="w-3.5 h-3.5" />}
                  className="text-xs cursor-pointer"
                >
                  {isBTConnected
                    ? (isFr ? 'Changer' : 'Change')
                    : (isFr ? 'Appairer Imprimante' : 'Pair Bluetooth Printer')}
                </Button>

                {isBTConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectBluetooth}
                    leftIcon={<Unlink className="w-3.5 h-3.5 text-rose-400" />}
                    className="text-xs text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    {isFr ? 'Déconnecter' : 'Disconnect'}
                  </Button>
                )}
              </div>
            </div>

            {/* Bluetooth direct action shortcut */}
            {isBTConnected && (
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDirectBluetoothTestPrint}
                  isLoading={isTestingDirectBT}
                  leftIcon={<Radio className="w-3.5 h-3.5 text-emerald-400" />}
                  className="text-xs cursor-pointer flex-1"
                >
                  {isFr ? 'Test Direct Bluetooth (ESC/POS)' : 'Send ESC/POS Bluetooth Test'}
                </Button>
              </div>
            )}
          </div>

          {btStatus && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{btStatus}</span>
            </div>
          )}
        </div>

        {/* Automation Toggles */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            {isFr ? 'Automatisations & Périphériques' : 'Automations & Peripherals'}
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors">
            <div>
              <span className="text-sm font-medium text-zinc-200 block">
                {isFr ? 'Éjection Auto du Tiroir-Caisse' : 'Auto-Kick Cash Drawer'}
              </span>
              <span className="text-xs text-zinc-400">
                {isFr
                  ? 'Envoie le signal ESC/POS d’ouverture de tiroir lors d’un paiement en espèces'
                  : 'Send ESC/POS open drawer pulse automatically on cash sales'}
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
                {isFr ? 'Impression Automatique après Vente' : 'Auto-Print on Completed Sale'}
              </span>
              <span className="text-xs text-zinc-400">
                {isFr
                  ? 'Déclenche immédiatement l’impression dès validation du paiement'
                  : 'Trigger receipt printing pipeline immediately after recording transaction'}
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

        {/* Diagnostics & Testing */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            {isFr ? 'Outils de Diagnostic Matériel' : 'Hardware Diagnostics'}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBrowserTestPrint}
              leftIcon={<Printer className="w-4 h-4 text-zinc-300" />}
              className="text-xs cursor-pointer"
            >
              {isFr ? 'Test Aperçu Navigateur' : 'Browser Print Preview'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleKickDrawer}
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
              className="text-xs cursor-pointer"
            >
              {isFr ? 'Tester Impulsion Tiroir (RJ11)' : 'Trigger Drawer Pulse'}
            </Button>
          </div>

          {drawerKickMessage && (
            <p className="text-xs text-zinc-300 bg-zinc-800/80 p-2.5 rounded-lg mt-2">
              {drawerKickMessage}
            </p>
          )}

          {testPrintSuccess && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-2">
              <CheckCircle2 className="w-4 h-4" />
              {isFr
                ? `Test envoyé avec succès en format ${settings.paperWidth}.`
                : `Test receipt dispatched in ${settings.paperWidth} mode.`}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <Button variant="primary" onClick={onClose} className="text-xs cursor-pointer">
            {isFr ? 'Terminer' : 'Done'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
