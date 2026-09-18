import React, { useState } from 'react';
import { useBusiness } from '../../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { Card } from '../../../components/common/Card.tsx';
import { Button } from '../../../components/common/Button.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import {
  getCustomManagerPin,
  setCustomManagerPin,
  verifyManagerPin,
  getMaxAllowedDiscount,
} from '../../../utils/rbac.ts';
import type { MemberRole } from '../../../types/index.ts';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Lock,
  UserCheck,
} from 'lucide-react';

interface SecurityPinSectionProps {
  onStatusMessage: (msg: string) => void;
}

export const SecurityPinSection: React.FC<SecurityPinSectionProps> = ({ onStatusMessage }) => {
  const { simulatedRole, setSimulatedRole, effectiveRole, activeRole } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [currentPin, setCurrentPin] = useState(getCustomManagerPin());
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState(getCustomManagerPin());
  const [pinSaved, setPinSaved] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Quick Verification test box
  const [testPinInput, setTestPinInput] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!/^\d{4,6}$/.test(clean)) {
      setPinError(isFr ? 'Le code PIN doit comporter entre 4 et 6 chiffres.' : 'PIN must be 4 to 6 numeric digits.');
      return;
    }
    setCustomManagerPin(clean);
    setCurrentPin(clean);
    setPinError(null);
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 3000);
    onStatusMessage(isFr ? 'Code PIN Manager mis à jour avec succès.' : 'Manager PIN code updated successfully.');
  };

  const handleTestVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPinInput.trim()) return;
    const ok = verifyManagerPin(testPinInput);
    setTestResult(ok ? 'success' : 'failed');
  };

  const cashierMaxDiscount = getMaxAllowedDiscount('cashier');
  const managerMaxDiscount = getMaxAllowedDiscount('manager');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Primary Manager PIN Card */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  {isFr ? 'Code PIN de Sécurité Manager' : 'Manager Security Override PIN'}
                </h3>
                <Badge variant="amber">STORE OVERRIDE</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isFr
                  ? 'Requis en caisse pour les remises exceptionnelles, suppressions et clôtures de journée.'
                  : 'Required at checkout for high cashier discounts, voided items, and register closeouts.'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSavePin} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Nouveau Code PIN (4 à 6 chiffres)' : 'Configure Store PIN (4 to 6 digits)'}
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="8888"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest text-white focus:outline-hidden focus:border-amber-500/80"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-zinc-500">
                {isFr ? 'PIN d’usine par défaut : 8888 ou 1234.' : 'Factory default fallback PIN: 8888 or 1234.'}
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer text-xs h-[42px] px-4"
                >
                  {isFr ? 'Mettre à jour le PIN' : 'Update Manager PIN'}
                </Button>
                {pinSaved && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {isFr ? 'PIN Enregistré !' : 'PIN Saved!'}
                  </span>
                )}
              </div>
              {pinError && (
                <p className="text-xs text-rose-400 mt-1 font-medium">{pinError}</p>
              )}
            </div>
          </div>
        </form>

        {/* Quick Test Verification Form */}
        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2 mt-2">
          <span className="text-xs font-bold text-zinc-300 block">
            {isFr ? 'Tester la Validation du PIN' : 'Test PIN Verification'}
          </span>
          <form onSubmit={handleTestVerify} className="flex items-center gap-2 flex-wrap">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={testPinInput}
              onChange={(e) => {
                setTestPinInput(e.target.value.replace(/\D/g, ''));
                setTestResult(null);
              }}
              placeholder={isFr ? 'Entrez le PIN à tester...' : 'Enter PIN to test...'}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono tracking-widest focus:outline-hidden focus:border-emerald-500 w-48"
            />
            <Button type="submit" size="sm" variant="outline" className="text-xs cursor-pointer">
              {isFr ? 'Vérifier' : 'Verify'}
            </Button>
            {testResult === 'success' && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {isFr ? 'PIN Autorisé !' : 'PIN Authorized!'}
              </span>
            )}
            {testResult === 'failed' && (
              <span className="text-xs text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {isFr ? 'PIN Invalide !' : 'Invalid PIN!'}
              </span>
            )}
          </form>
        </div>
      </Card>

      {/* POS Terminal Role Simulator Card */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isFr ? 'Simulateur de Rôle en Caisse' : 'POS Terminal Role Simulation'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isFr
                  ? 'Testez l’expérience d’un caissier restreint par rapport à un gérant ou propriétaire.'
                  : 'Experience the checkout register as a restricted cashier vs store manager.'}
              </p>
            </div>
          </div>

          <Badge variant={effectiveRole === 'cashier' ? 'amber' : 'emerald'}>
            {isFr ? `RÔLE EFFECTIF : ${effectiveRole.toUpperCase()}` : `ACTIVE ROLE: ${effectiveRole.toUpperCase()}`}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              role: 'cashier' as MemberRole,
              title: isFr ? 'Caissier Restreint' : 'Restricted Cashier',
              desc: isFr ? `Remise max : ${cashierMaxDiscount}%. PIN requis au-delà.` : `Max discount: ${cashierMaxDiscount}%. PIN required beyond.`,
            },
            {
              role: 'manager' as MemberRole,
              title: isFr ? 'Gérant de Boutique' : 'Store Manager',
              desc: isFr ? `Remise max : ${managerMaxDiscount}%. Clôture et audits autorisés.` : `Max discount: ${managerMaxDiscount}%. Register closeouts enabled.`,
            },
            {
              role: 'owner' as MemberRole,
              title: isFr ? 'Propriétaire (Complet)' : 'Store Owner (Full)',
              desc: isFr ? 'Accès illimité à toutes les finances et paramètres.' : 'Unlimited access to all financial analytics and settings.',
            },
          ].map((item) => {
            const isCurrentSimulated = (simulatedRole || activeRole || 'owner') === item.role;
            return (
              <button
                key={item.role}
                type="button"
                onClick={() => {
                  setSimulatedRole(item.role === activeRole ? null : item.role);
                  onStatusMessage(isFr ? `Rôle simulé : ${item.role}.` : `Simulated role switched to ${item.role}.`);
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  isCurrentSimulated
                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{item.title}</span>
                  {isCurrentSimulated && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
