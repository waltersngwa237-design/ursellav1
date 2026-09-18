import React, { useState } from 'react';
import { useBusiness } from '../../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { Card } from '../../../components/common/Card.tsx';
import { Button } from '../../../components/common/Button.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import { HardwarePrinterService } from '../../../services/hardware-printer.service.ts';
import {
  Receipt,
  Percent,
  Check,
  QrCode,
  Printer,
  FileText,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface TaxInvoicingSectionProps {
  onStatusMessage: (msg: string) => void;
}

export const TaxInvoicingSection: React.FC<TaxInvoicingSectionProps> = ({ onStatusMessage }) => {
  const { activeSettings, updateSettings } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  // Tax State from BusinessSettings
  const [taxEnabled, setTaxEnabled] = useState(activeSettings?.tax_enabled ?? false);
  const [taxRate, setTaxRate] = useState<number>(activeSettings?.tax_rate ?? 19.25);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(activeSettings?.low_stock_threshold ?? 5);

  // Local Receipt Customization State
  const [invoicePrefix, setInvoicePrefix] = useState<string>(() => {
    try {
      return localStorage.getItem('ursella_invoice_prefix') || 'REC-';
    } catch {
      return 'REC-';
    }
  });

  const [footerNote, setFooterNote] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('ursella_receipt_footer_note') ||
        (isFr ? 'Merci pour votre confiance ! À bientôt.' : 'Thank you for your business! See you soon.')
      );
    } catch {
      return 'Thank you for your business!';
    }
  });

  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    return HardwarePrinterService.getSettings().autoPrintOnSale;
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      // Persist to BusinessSettings in database/context
      await updateSettings({
        tax_enabled: taxEnabled,
        tax_rate: Number(taxRate),
        low_stock_threshold: Number(lowStockThreshold),
      });

      // Persist receipt customization to local storage
      try {
        localStorage.setItem('ursella_invoice_prefix', invoicePrefix.trim() || 'REC-');
        localStorage.setItem('ursella_receipt_footer_note', footerNote.trim());
        HardwarePrinterService.saveSettings({ autoPrintOnSale: autoPrint });
      } catch (err) {
        console.warn('Storage error:', err);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      onStatusMessage(isFr ? 'Paramètres fiscaux et de facturation enregistrés.' : 'Tax and receipt invoicing settings saved.');
    } catch (err: any) {
      console.error('Failed to save tax settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveTaxSettings} className="space-y-5 animate-in fade-in duration-200">
      {/* Tax Rules & VAT Card */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isFr ? 'Règles Fiscales & TVA' : 'Tax Rules & VAT Rates'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isFr
                  ? 'Appliquez la taxe sur les ventes et configurez le taux fiscal légal.'
                  : 'Enforce sales tax calculation and configure legal VAT percentage.'}
              </p>
            </div>
          </div>
          <Badge variant={taxEnabled ? 'emerald' : 'zinc'}>
            {taxEnabled ? (isFr ? 'TVA ACTIVE' : 'TAX ACTIVE') : (isFr ? 'DÉSACTIVÉE' : 'DISABLED')}
          </Badge>
        </div>

        {/* Tax Enable Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
          <div>
            <span className="text-xs font-bold text-zinc-100 block">
              {isFr ? 'Calculer la TVA lors des Ventes' : 'Apply Tax on POS Checkout'}
            </span>
            <span className="text-[11px] text-zinc-400">
              {isFr
                ? 'Affiche et calcule automatiquement la taxe dans le panier et sur les reçus.'
                : 'Automatically calculate and display tax on the checkout cart and printed receipts.'}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {taxEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Taux de Taxe / TVA (%)' : 'VAT / Tax Rate (%)'} <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">
                  %
                </span>
              </div>
              <div className="flex gap-1.5 pt-1">
                {[
                  { label: 'TVA CEMAC (19.25%)', val: 19.25 },
                  { label: 'Standard 18%', val: 18 },
                  { label: '5%', val: 5 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setTaxRate(preset.val)}
                    className="px-2 py-1 rounded-md text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-emerald-500/50 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Seuil d’Alerte Stock Faible' : 'Low Stock Alert Threshold'}
              </label>
              <input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              />
              <span className="text-[11px] text-zinc-500">
                {isFr ? 'Déclenche l’alerte quand la quantité descend sous cette valeur.' : 'Triggers alert when quantity falls below this value.'}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Invoicing & Receipt Layout Card */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isFr ? 'Personnalisation des Reçus' : 'Receipt & Invoice Customization'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isFr
                  ? 'Préfixe de numérotation, mentions de bas de page et impression automatique.'
                  : 'Numbering sequence, legal footer notes, and auto-print behavior.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              {isFr ? 'Préfixe de Facture / Ticket' : 'Invoice / Receipt Prefix'}
            </label>
            <input
              type="text"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="e.g. REC-, FAC-, INV-"
              maxLength={8}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase font-mono focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-[11px] text-zinc-500">
              {isFr ? 'Exemple : REC-8F92E310' : 'Example: REC-8F92E310'}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-zinc-400" />
              {isFr ? 'Impression Immédiate après Vente' : 'Auto-Print on Checkout'}
            </label>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between h-[42px]">
              <span className="text-xs text-zinc-300 font-medium">
                {autoPrint ? (isFr ? 'Impression auto activée' : 'Auto-print enabled') : (isFr ? 'Impression manuelle' : 'Manual print prompt')}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            {isFr ? 'Mention de Bas de Page (Pied de Ticket)' : 'Receipt Footer Legal Note'}
          </label>
          <textarea
            rows={2}
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder={
              isFr
                ? 'Ex: Merci pour votre visite ! Les articles retournés sous 48h avec ticket sont échangeables.'
                : 'E.g. Thank you for shopping with us! Exchange within 48h with receipt.'
            }
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500 leading-relaxed"
          />
        </div>
      </Card>

      {/* Digital QR Verification Notice Card */}
      <Card className="space-y-3 bg-gradient-to-r from-zinc-900 to-zinc-900/60 border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              {isFr ? 'Authentification Numérique par QR Code' : 'Digital QR Verification Enabled'}
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isFr
                ? 'Tous les reçus thermiques et PDF intègrent automatiquement un QR code officiel encodant le numéro de ticket, le montant et la boutique pour prévenir la contrefaçon.'
                : 'All thermal receipt slips and downloadable PDF invoices automatically embed an encrypted digital verification QR code containing ticket ID and total to prevent tampering.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {savedSuccess && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            {isFr ? 'Modifications enregistrées !' : 'Settings saved!'}
          </span>
        )}
        <Button
          type="submit"
          isLoading={saving}
          leftIcon={<Check className="w-3.5 h-3.5" />}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer text-xs"
        >
          {isFr ? 'Enregistrer les Règles de Facturation' : 'Save Invoicing Rules'}
        </Button>
      </div>
    </form>
  );
};
