import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { BUSINESS_TYPES, CURRENCY_MAP, type SupportedCurrency } from '../../types/index.ts';
import { BETA_CONFIG } from '../../config/beta.ts';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Select } from '../../components/common/Select.tsx';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Store, Globe, Coins, Clock, Sparkles, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface OnboardingPageProps {
  isAdditional?: boolean;
  onSuccess?: () => void;
}

const COUNTRIES = [
  { code: 'CM', name: 'Cameroon', defaultCurrency: 'XAF', timezone: 'Africa/Douala' },
  { code: 'NG', name: 'Nigeria', defaultCurrency: 'NGN', timezone: 'Africa/Lagos' },
  { code: 'GH', name: 'Ghana', defaultCurrency: 'GHS', timezone: 'Africa/Accra' },
  { code: 'KE', name: 'Kenya', defaultCurrency: 'KES', timezone: 'Africa/Nairobi' },
  { code: 'RW', name: 'Rwanda', defaultCurrency: 'USD', timezone: 'Africa/Kigali' },
  { code: 'ZA', name: 'South Africa', defaultCurrency: 'ZAR', timezone: 'Africa/Johannesburg' },
  { code: 'CI', name: 'Côte d\'Ivoire', defaultCurrency: 'XAF', timezone: 'Africa/Abidjan' },
  { code: 'SN', name: 'Senegal', defaultCurrency: 'XAF', timezone: 'Africa/Dakar' },
  { code: 'US', name: 'United States', defaultCurrency: 'USD', timezone: 'America/New_York' },
  { code: 'FR', name: 'France / Europe', defaultCurrency: 'EUR', timezone: 'Europe/Paris' },
  { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP', timezone: 'Europe/London' },
];

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ isAdditional = false, onSuccess }) => {
  const { profile, user, signOut } = useAuth();
  const { createBusiness, createDemoBusiness } = useBusiness();

  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0]);
  const [country, setCountry] = useState('Cameroon');
  const [currency, setCurrency] = useState<SupportedCurrency>('XAF');
  const [timezone, setTimezone] = useState('Africa/Douala');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When country changes, auto-suggest currency and timezone
  const handleCountryChange = (selectedCountryName: string) => {
    setCountry(selectedCountryName);
    const matched = COUNTRIES.find((c) => c.name === selectedCountryName);
    if (matched) {
      setCurrency(matched.defaultCurrency as SupportedCurrency);
      setTimezone(matched.timezone);
    }
  };

  const handleLaunchDemo = async () => {
    try {
      setIsDemoLoading(true);
      setError(null);
      await createDemoBusiness();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch demo workspace.';
      setError(msg);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Smart fallback if name is empty
    const resolvedName = name.trim() || (profile?.full_name ? `${profile.full_name}'s Enterprise` : 'Akwa Fresh & Spices');

    try {
      setIsLoading(true);
      await createBusiness({
        name: resolvedName,
        business_type: businessType,
        country,
        currency,
        timezone,
        description: description.trim() || undefined,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register business.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrefillSample = () => {
    setName('Akwa Fresh & Spices');
    setBusinessType('Retail & Supermarket');
    setCountry('Cameroon');
    setCurrency('XAF');
    setTimezone('Africa/Douala');
    setDescription('Organic grocery, beverage, and pantry store located in Akwa, Douala.');
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <UrsellaLogo size="lg" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {isAdditional ? 'Register a New Business' : 'Set up your business'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md">
              {isAdditional
                ? 'Add another business or branch to your multi-tenant Ursella workspace.'
                : `Welcome, ${profile?.full_name || user?.email?.split('@')[0] || 'Partner'}! Let's configure your business operating profile.`}
            </p>
          </div>
        </div>

        {/* Instant Demo Quick Start Banner */}
        {!isAdditional && BETA_CONFIG.allowDemoCreation && (
          <div className="bg-gradient-to-r from-emerald-950/60 to-zinc-900 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-semibold text-white">Want to explore with pre-loaded data?</h4>
                <p className="text-xs text-zinc-400">Instantly launch with starter products, sample sales, and reports.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isDemoLoading}
              onClick={handleLaunchDemo}
              className="shrink-0 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-300 font-semibold"
            >
              1-Click Demo Launch
            </Button>
          </div>
        )}

        {/* Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 sm:p-7 shadow-xl shadow-zinc-950/60">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-800/80">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Custom Business Configuration
            </span>
            <button
              type="button"
              onClick={handlePrefillSample}
              className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-fill sample</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name */}
            <Input
              label="Business Name"
              placeholder="e.g. Douala Artisanal Roast, Bamenda Mart"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<Store className="w-4 h-4" />}
            />

            {/* Business Type */}
            <Select
              label="Industry / Business Category"
              options={BUSINESS_TYPES.map((type) => ({ value: type, label: type }))}
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />

            {/* Country & Currency Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Select
                label="Country"
                options={COUNTRIES.map((c) => ({
                  value: c.name,
                  label: c.name,
                  sublabel: c.defaultCurrency,
                }))}
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
              />

              <Select
                label="Primary Currency"
                options={Object.values(CURRENCY_MAP).map((curr) => ({
                  value: curr.code,
                  label: `${curr.code} — ${curr.name}`,
                }))}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
              />
            </div>

            {/* Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Operating Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                leftIcon={<Clock className="w-4 h-4" />}
                helperText="Used for daily sales cut-offs and financial reports."
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300 select-none">
                  Accounting Standard
                </label>
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400">
                  Daily Closing & Perpetual FIFO Inventory
                </div>
              </div>
            </div>

            {/* Optional Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 select-none">
                Short Description (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What products or services does your business provide?"
                className="w-full bg-zinc-900 text-zinc-100 text-sm placeholder-zinc-500 rounded-xl px-3.5 py-2.5 border border-zinc-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-zinc-700 transition-all focus:outline-none"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-4"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Launch Business Operating System
            </Button>
          </form>
        </div>

        {!isAdditional && (
          <div className="text-center">
            <button
              onClick={() => signOut()}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Signed in as {user?.email}. <span className="underline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
