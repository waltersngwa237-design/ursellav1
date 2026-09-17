import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';
import { Input } from '../common/Input.tsx';
import {
  RegisterCloseoutService,
  type RegisterShift,
} from '../../services/register-closeout.service.ts';
import { HardwarePrinterService } from '../../services/hardware-printer.service.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { CURRENCY_MAP } from '../../types/index.ts';
import {
  Calculator,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  DollarSign,
  CreditCard,
  Smartphone,
  ArrowDownRight,
  ArrowUpRight,
  Key,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { verifyManagerPin } from '../../utils/rbac.ts';

interface RegisterCloseoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftToView?: RegisterShift | null;
  onShiftClosed?: (closedShift: RegisterShift) => void;
}

export const RegisterCloseoutModal: React.FC<RegisterCloseoutModalProps> = ({
  isOpen,
  onClose,
  shiftToView,
  onShiftClosed,
}) => {
  const { activeBusiness, currency, effectiveRole } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [shift, setShift] = useState<RegisterShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [countedCash, setCountedCash] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Cash movement state (Paid in / Paid out)
  const [showMovementForm, setShowMovementForm] = useState<'in' | 'out' | null>(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  // Denominations toggle
  const [showDenominations, setShowDenominations] = useState(false);
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '100': 0,
    '50': 0,
  });

  const loadActiveShift = async () => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    try {
      if (shiftToView) {
        setShift(shiftToView);
        setCountedCash(shiftToView.actual_cash_counted.toString());
      } else {
        const current = await RegisterCloseoutService.getCurrentShift(
          activeBusiness.id,
          effectiveRole === 'cashier' ? (isFr ? 'Poste Caisse' : 'Cashier Station') : (isFr ? 'Responsable Boutique' : 'Store Manager')
        );
        setShift(current);
        setCountedCash(current.actual_cash_counted > 0 ? current.actual_cash_counted.toString() : current.expected_cash.toString());
      }
    } catch (err) {
      console.error('Failed to load shift for closeout:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadActiveShift();
      setIsPinVerified(effectiveRole === 'owner' || effectiveRole === 'admin' || effectiveRole === 'manager');
      setPinError(null);
    }
  }, [isOpen, shiftToView, activeBusiness?.id]);

  // Update counted cash when denominations change
  const handleDenominationChange = (valStr: string, count: number) => {
    const updated = { ...denominations, [valStr]: Math.max(0, count) };
    setDenominations(updated);
    const sum = Object.entries(updated).reduce((acc, [denom, qty]) => acc + parseInt(denom, 10) * qty, 0);
    setCountedCash(sum.toString());
  };

  const parsedCountedCash = parseFloat(countedCash) || 0;
  const expectedCash = shift?.expected_cash || 0;
  const discrepancy = parsedCountedCash - expectedCash;

  const handleRecordMovement = async () => {
    if (!activeBusiness?.id || !shift || !showMovementForm) return;
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmittingMovement(true);
    try {
      const updated = await RegisterCloseoutService.recordCashMovement(
        activeBusiness.id,
        shift.id,
        showMovementForm,
        amount,
        movementReason,
        managerName || (isFr ? 'Caissier' : 'Register Cashier')
      );
      setShift(updated);
      setShowMovementForm(null);
      setMovementAmount('');
      setMovementReason('');
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const handleKickDrawer = async () => {
    await HardwarePrinterService.kickCashDrawer();
  };

  const handlePrintZReport = () => {
    if (!shift) return;
    HardwarePrinterService.printZReport(shift, activeBusiness, currencyConfig);
  };

  const handleCloseShift = async () => {
    if (!activeBusiness?.id || !shift) return;

    // If there is a discrepancy and user is not verified, require manager pin
    if (Math.abs(discrepancy) > 0.01 && !isPinVerified) {
      if (!verifyManagerPin(managerPin)) {
        setPinError(isFr ? 'Code PIN gérant invalide. Veuillez saisir un PIN valide pour approuver l’écart.' : 'Invalid manager PIN. Enter authorized manager PIN to approve discrepancy.');
        return;
      }
    }

    try {
      setLoading(true);
      const closed = await RegisterCloseoutService.closeShift(
        activeBusiness.id,
        shift.id,
        parsedCountedCash,
        effectiveRole === 'cashier' ? (isFr ? 'Poste Caisse' : 'Cashier Station') : (isFr ? 'Responsable Boutique' : 'Store Manager'),
        notes,
        managerName
      );
      setShift(closed);
      if (onShiftClosed) {
        onShiftClosed(closed);
      }
      // Trigger instant thermal Z-Report print
      HardwarePrinterService.printZReport(closed, activeBusiness, currencyConfig);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFr ? `Clôture de Caisse & Rapport Z (${shift?.z_report_number || 'Fin de Journée'})` : `Register Closeout & Z-Report (${shift?.z_report_number || 'EOD'})`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            {isFr ? 'Chargement des détails de clôture...' : 'Loading register audit details...'}
          </div>
        ) : !shift ? (
          <div className="py-12 text-center text-sm text-rose-500">
            {isFr ? 'Aucune session de caisse trouvée.' : 'No shift record found.'}
          </div>
        ) : (
          <>
            {/* Shift Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {isFr ? 'Session #' : 'Shift #'}{shift.shift_number} &bull; {shift.z_report_number}
                  </span>
                  <Badge variant={shift.status === 'open' ? 'amber' : 'emerald'}>
                    {shift.status === 'open' ? (isFr ? 'Session Ouverte' : 'Active Shift (Open)') : (isFr ? 'Session Scellée & Clôturée (Rapport Z)' : 'Sealed & Closed (Z-Report)')}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isFr ? 'Ouverte à ' : 'Opened: '}{new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {isFr ? 'par' : 'by'} {shift.opened_by}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleKickDrawer} title={isFr ? 'Tester l’ouverture du tiroir-caisse' : 'Test Cash Drawer Trigger'}>
                  {isFr ? 'Ouvrir Tiroir' : 'Kick Drawer'}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintZReport}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  {isFr ? 'Ticket Z' : 'Thermal Slip'}
                </Button>
              </div>
            </div>

            {/* Shift Sales Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-500" />
                  {isFr ? 'Ventes Totales' : 'Gross Sales'}
                </span>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {currencyConfig.format(shift.total_sales)}
                </p>
                <span className="text-[10px] text-zinc-400">{shift.sales_count} {isFr ? 'tickets' : 'receipts'}</span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-indigo-500" />
                  {isFr ? 'Carte & MoMo' : 'Card & Digital'}
                </span>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {currencyConfig.format(shift.card_sales + shift.momo_sales)}
                </p>
                <span className="text-[10px] text-zinc-400">{isFr ? 'Paiements digitaux' : 'Electronic Tender'}</span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3 text-emerald-500" />
                  {isFr ? 'Espèces Reçues' : 'Cash Received'}
                </span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  +{currencyConfig.format(shift.cash_sales)}
                </p>
                <span className="text-[10px] text-zinc-400">{isFr ? 'Paiement physique' : 'Physical tender'}</span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-rose-500" />
                  {isFr ? 'Sorties de Caisse' : 'Petty Payouts'}
                </span>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">
                  -{currencyConfig.format(shift.cash_out)}
                </p>
                <span className="text-[10px] text-zinc-400">{isFr ? 'Dépenses courantes' : 'Drawer expenses'}</span>
              </div>
            </div>

            {/* Cash Drawer Reconciliation Equation */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  {isFr ? 'Solde Théorique du Tiroir-Caisse' : 'Cash Drawer Expected Balance'}
                </h4>
                {shift.status === 'open' && (
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setShowMovementForm('in')}>
                      {isFr ? '+ Entrée Espèces' : '+ Cash In'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowMovementForm('out')}>
                      {isFr ? '- Sortie Espèces' : '- Cash Out'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{isFr ? 'Fond de caisse initial :' : 'Starting Opening Float:'}</span>
                  <span className="font-mono">{currencyConfig.format(shift.opening_float)}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{isFr ? '+ Espèces issues des ventes :' : '+ Cash Collected from Sales:'}</span>
                  <span className="font-mono text-emerald-600">+{currencyConfig.format(shift.cash_sales)}</span>
                </div>
                {shift.cash_in > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{isFr ? '+ Apport espèces (Recharge) :' : '+ Paid In (Additional Cash):'}</span>
                    <span className="font-mono text-emerald-600">+{currencyConfig.format(shift.cash_in)}</span>
                  </div>
                )}
                {shift.cash_out > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{isFr ? '- Sorties de caisse (Dépenses) :' : '- Paid Out (Petty Cash Payout):'}</span>
                    <span className="font-mono text-rose-600">-{currencyConfig.format(shift.cash_out)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-bold text-sm">
                  <span className="text-zinc-900 dark:text-zinc-100">{isFr ? 'Espèces attendues en caisse :' : 'Expected Physical Cash in Drawer:'}</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">
                    {currencyConfig.format(expectedCash)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Movement Inline Form */}
            {showMovementForm && (
              <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-500/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    {showMovementForm === 'in' 
                      ? (isFr ? 'Enregistrer une Entrée d’Espèces' : 'Record Cash In (Add to Drawer)') 
                      : (isFr ? 'Enregistrer une Sortie d’Espèces' : 'Record Cash Out (Petty Cash Payout)')}
                  </span>
                  <button onClick={() => setShowMovementForm(null)} className="text-xs text-zinc-500 hover:text-zinc-700 cursor-pointer">
                    {isFr ? 'Annuler' : 'Cancel'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    label={isFr ? 'Montant' : 'Amount'}
                    type="number"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <Input
                    label={isFr ? 'Motif / Bénéficiaire' : 'Reason / Recipient'}
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder={isFr ? 'Ex: Recharge monnaie, Fournitures' : 'e.g. Change replenishment, Store supplies'}
                  />
                </div>
                <Button size="sm" onClick={handleRecordMovement} disabled={isSubmittingMovement}>
                  {isSubmittingMovement ? (isFr ? 'Enregistrement...' : 'Recording...') : (isFr ? 'Confirmer le Mouvement' : 'Confirm Cash Movement')}
                </Button>
              </div>
            )}

            {/* Physical Cash Count Input */}
            {shift.status === 'open' ? (
              <div className="space-y-3 p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    {isFr ? 'Comptage Physique Réel en Caisse' : 'Actual Physical Cash Counted'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDenominations(!showDenominations)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    {showDenominations ? (isFr ? 'Masquer Coupures' : 'Hide Denominations') : (isFr ? 'Calculateur de Coupures' : 'Denominations Calculator')}
                  </button>
                </div>

                {showDenominations && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg text-xs">
                    {Object.keys(denominations).map((denom) => (
                      <div key={denom}>
                        <span className="text-[11px] text-zinc-500">{denom} {isFr ? 'billet/pièce' : 'note/coin'}</span>
                        <input
                          type="number"
                          min="0"
                          value={denominations[denom] || ''}
                          onChange={(e) => handleDenominationChange(denom, parseInt(e.target.value, 10) || 0)}
                          className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder="0.00"
                      className="text-lg font-bold font-mono"
                    />
                  </div>

                  {/* Discrepancy Badge */}
                  <div className="shrink-0">
                    {Math.abs(discrepancy) < 0.01 ? (
                      <Badge variant="emerald" className="px-3 py-2 text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {isFr ? 'Équilibré' : 'Balanced'}
                      </Badge>
                    ) : discrepancy > 0 ? (
                      <Badge variant="blue" className="px-3 py-2 text-xs">
                        +{currencyConfig.format(discrepancy)} {isFr ? 'Excédent' : 'Over'}
                      </Badge>
                    ) : (
                      <Badge variant="rose" className="px-3 py-2 text-xs flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        -{currencyConfig.format(Math.abs(discrepancy))} {isFr ? 'Manquant' : 'Short'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Variance Explanation or Notes */}
                <Input
                  label={isFr ? 'Notes de Clôture / Justification de l’Écart' : 'Closeout Notes / Variance Explanation'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isFr ? 'Détails optionnels sur la clôture de caisse' : 'Optional details regarding register closeout'}
                />

                {/* Manager PIN Override if discrepancy exists and not verified */}
                {Math.abs(discrepancy) > 0.01 && !isPinVerified && (
                  <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      <Lock className="w-3.5 h-3.5" />
                      {isFr ? 'Signature Gérant Requise pour Justifier l’Écart' : 'Manager Sign-off Required for Variance'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder={isFr ? 'Nom du Gérant' : 'Manager Name'}
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                      />
                      <Input
                        type="password"
                        placeholder={isFr ? 'PIN Gérant (défaut: 8888)' : 'Manager PIN (default: 8888)'}
                        value={managerPin}
                        onChange={(e) => {
                          setManagerPin(e.target.value);
                          setPinError(null);
                        }}
                      />
                    </div>
                    {pinError && <p className="text-xs text-rose-500 font-medium">{pinError}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{isFr ? 'Comptage Réel à la Clôture :' : 'Physical Cash Counted at Closeout:'}</span>
                  <span className="font-mono font-bold text-sm">
                    {currencyConfig.format(shift.actual_cash_counted)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{isFr ? 'Écart de Caisse :' : 'Register Variance:'}</span>
                  <span className="font-mono font-bold text-sm">
                    {shift.discrepancy === 0
                      ? (isFr ? 'Équilibré (0.00)' : 'Balanced (0.00)')
                      : shift.discrepancy > 0
                      ? `+${currencyConfig.format(shift.discrepancy)} ${isFr ? 'Excédent' : 'Over'}`
                      : `-${currencyConfig.format(Math.abs(shift.discrepancy))} ${isFr ? 'Manquant' : 'Short'}`}
                  </span>
                </div>
                {shift.notes && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                    <strong>{isFr ? 'Notes :' : 'Notes:'}</strong> {shift.notes}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
                {shift.status === 'open' ? (isFr ? 'Laisser la session ouverte' : 'Keep Shift Open') : (isFr ? 'Fermer' : 'Close')}
              </Button>

              {shift.status === 'open' && (
                <Button variant="primary" size="sm" onClick={handleCloseShift} className="w-full sm:w-auto">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {isFr ? 'Sceller & Clôturer la Session (Rapport Z)' : 'Seal & Close Shift (Print Z-Report)'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
