import React, { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { useBusiness } from '../../../contexts/BusinessContext.tsx';
import { Card } from '../../../components/common/Card.tsx';
import { Button } from '../../../components/common/Button.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import { HardwareSettingsModal } from '../../../components/hardware/HardwareSettingsModal.tsx';
import { CURRENCY_MAP } from '../../../types/index.ts';
import {
  HardwarePrinterService,
  type HardwareSettings,
  type ThermalPaperWidth,
} from '../../../services/hardware-printer.service.ts';
import {
  Printer,
  Bluetooth,
  Sliders,
  DollarSign,
  Check,
  Usb,
  FileSpreadsheet,
} from 'lucide-react';

interface HardwarePrintingSectionProps {
  onStatusMessage: (msg: string) => void;
}

export const HardwarePrintingSection: React.FC<HardwarePrintingSectionProps> = ({ onStatusMessage }) => {
  const { language } = useLanguage();
  const { activeBusiness, currency } = useBusiness();
  const isFr = language === 'fr';

  const [hwSettings, setHwSettings] = useState<HardwareSettings>(() =>
    HardwarePrinterService.getSettings()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const capabilities = HardwarePrinterService.getCapabilities();

  const handlePaperWidthChange = (width: ThermalPaperWidth) => {
    const updated = HardwarePrinterService.saveSettings({ paperWidth: width });
    setHwSettings(updated);
    onStatusMessage(isFr ? `Largeur thermique réglée sur ${width}.` : `Thermal width updated to ${width}.`);
  };

  const handleAutoKickChange = (autoKick: boolean) => {
    const updated = HardwarePrinterService.saveSettings({ autoKickDrawerOnCash: autoKick });
    setHwSettings(updated);
    onStatusMessage(
      autoKick
        ? isFr ? 'Ouverture automatique du tiroir activée.' : 'Cash drawer auto-kick enabled.'
        : isFr ? 'Ouverture automatique du tiroir désactivée.' : 'Cash drawer auto-kick disabled.'
    );
  };

  const handleTestPrint = async () => {
    try {
      setIsTestPrinting(true);
      // Construct a minimal dummy sale object for test print
      const dummySale: any = {
        id: 'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        sold_at: new Date().toISOString(),
        total_amount: 1500,
        subtotal_amount: 1500,
        tax_amount: 0,
        discount_amount: 0,
        payment_method: 'cash',
        customers: { name: isFr ? 'Client de Test' : 'Sample Test Customer' },
        sale_items: [
          {
            id: '1',
            product_name: isFr ? 'Article de Test (Impression)' : 'Test Print Item',
            quantity: 1,
            unit_price: 1500,
            total_price: 1500,
          },
        ],
      };

      const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;
      await HardwarePrinterService.printThermalReceipt(
        dummySale,
        activeBusiness,
        currencyConfig
      );
      onStatusMessage(isFr ? 'Test d’impression envoyé à l’imprimante !' : 'Test receipt sent to printer!');
    } catch (err: any) {
      console.warn('Test print error:', err);
      onStatusMessage(err?.message || (isFr ? 'Erreur lors du test d’impression.' : 'Test print error.'));
    } finally {
      setIsTestPrinting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Primary Hardware Status Card */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  {isFr ? 'Imprimante Thermique ESC/POS' : 'ESC/POS Thermal Receipt Printer'}
                </h3>
                <Badge variant="emerald">
                  {hwSettings.paperWidth}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {hwSettings.connectionType === 'browser'
                  ? isFr ? 'Mode d’impression système standard (Navigateur)' : 'Standard browser system print dialog'
                  : hwSettings.pairedDeviceName || (isFr ? 'Périphérique appairé' : 'Direct hardware connection')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestPrint}
              isLoading={isTestPrinting}
              leftIcon={<Printer className="w-3.5 h-3.5 text-emerald-400" />}
              className="text-xs cursor-pointer"
            >
              {isFr ? 'Test d’Impression' : 'Test Print'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
              className="text-xs cursor-pointer"
            >
              {isFr ? 'Configurer' : 'Configure'}
            </Button>
          </div>
        </div>

        {/* Paper Width Selection */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-semibold text-zinc-300">
            {isFr ? 'Format du Papier Thermique' : 'Thermal Paper Width'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handlePaperWidthChange('80mm')}
              className={`p-3.5 rounded-xl border text-left flex items-start justify-between cursor-pointer transition-all ${
                hwSettings.paperWidth === '80mm'
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-white block">
                  80mm {isFr ? 'Standard (Large)' : 'Standard (Wide)'}
                </span>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  {isFr ? 'Recommandé pour supermarchés, détaillants et reçus détaillés.' : 'Recommended for supermarkets, retail shops, and itemized receipts.'}
                </span>
              </div>
              {hwSettings.paperWidth === '80mm' && (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handlePaperWidthChange('58mm')}
              className={`p-3.5 rounded-xl border text-left flex items-start justify-between cursor-pointer transition-all ${
                hwSettings.paperWidth === '58mm'
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-white block">
                  58mm {isFr ? 'Compact / Mobile' : 'Compact / Mobile POS'}
                </span>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  {isFr ? 'Idéal pour imprimantes de poche Bluetooth et petits comptoirs.' : 'Ideal for portable Bluetooth belt printers and tight kiosk counters.'}
                </span>
              </div>
              {hwSettings.paperWidth === '58mm' && (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Cash Drawer Kick Settings */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-100 block">
                {isFr ? 'Éjection Automatique du Tiroir-Caisse' : 'Auto-Kick Cash Drawer on Checkout'}
              </span>
              <span className="text-[11px] text-zinc-400">
                {isFr
                  ? 'Envoie le signal ESC/POS (pin RJ11) pour ouvrir le tiroir lors d’un paiement en espèces.'
                  : 'Sends the standard ESC/POS RJ11 pulse to release the cash drawer latch on cash payments.'}
              </span>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hwSettings.autoKickDrawerOnCash}
              onChange={(e) => handleAutoKickChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </Card>

      {/* Hardware Interface Capabilities Card */}
      <Card className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider pb-2 border-b border-zinc-800">
          {isFr ? 'Protocoles Matériels Disponibles sur ce Terminal' : 'Hardware Protocol Support on this Device'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 mb-1.5">
              <Bluetooth className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-zinc-200">Web Bluetooth</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {capabilities.bluetooth
                ? isFr ? 'Supporté sur ce navigateur' : 'Supported on this browser'
                : isFr ? 'Non supporté (utiliser Chrome/Edge)' : 'Not available (use Chrome/Edge)'}
            </p>
            <Badge variant={capabilities.bluetooth ? 'emerald' : 'zinc'} size="sm" className="mt-2">
              {capabilities.bluetooth ? 'AVAILABLE' : 'OFFLINE'}
            </Badge>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 mb-1.5">
              <Usb className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-zinc-200">Web Serial (USB)</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {capabilities.serial
                ? isFr ? 'Câble USB direct prêt' : 'Direct USB cable ready'
                : isFr ? 'Non disponible sur cette plateforme' : 'Not available on this platform'}
            </p>
            <Badge variant={capabilities.serial ? 'emerald' : 'zinc'} size="sm" className="mt-2">
              {capabilities.serial ? 'AVAILABLE' : 'OFFLINE'}
            </Badge>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 mb-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-zinc-200">Browser Fallback</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {isFr ? 'Compatible avec 100% des imprimantes système' : 'Compatible with all installed system printers'}
            </p>
            <Badge variant="emerald" size="sm" className="mt-2">
              READY
            </Badge>
          </div>
        </div>
      </Card>

      <HardwareSettingsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setHwSettings(HardwarePrinterService.getSettings());
        }}
      />
    </div>
  );
};
