import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { Card } from '../../../components/common/Card.tsx';
import { Button } from '../../../components/common/Button.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import { Modal } from '../../../components/common/Modal.tsx';
import { OnboardingPage } from '../../onboarding/OnboardingPage.tsx';
import {
  CURRENCY_MAP,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '../../../types/index.ts';
import {
  Store,
  Building2,
  Edit3,
  Plus,
  Check,
  Globe2,
  DollarSign,
  Clock,
  Sparkles,
  MapPin,
} from 'lucide-react';

interface StoreProfileSectionProps {
  onStatusMessage: (msg: string) => void;
}

export const StoreProfileSection: React.FC<StoreProfileSectionProps> = ({ onStatusMessage }) => {
  const {
    businesses,
    activeBusiness,
    activeRole,
    currency,
    setActiveBusinessId,
    updateBusiness,
    createDemoBusiness,
  } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // Form State
  const [name, setName] = useState(activeBusiness?.name || '');
  const [businessType, setBusinessType] = useState(activeBusiness?.business_type || 'Retail');
  const [country, setCountry] = useState(activeBusiness?.country || 'Cameroon');
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(currency || 'XAF');
  const [timezone, setTimezone] = useState(activeBusiness?.timezone || 'Africa/Douala');
  const [description, setDescription] = useState(activeBusiness?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeBusiness) {
      setName(activeBusiness.name || '');
      setBusinessType(activeBusiness.business_type || 'Retail');
      setCountry(activeBusiness.country || 'Cameroon');
      setSelectedCurrency((activeBusiness.currency || currency || 'XAF') as SupportedCurrency);
      setTimezone(activeBusiness.timezone || 'Africa/Douala');
      setDescription(activeBusiness.description || '');
    }
  }, [activeBusiness, currency]);

  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isFr ? 'Veuillez saisir le nom de l’entreprise.' : 'Please enter your business name.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await updateBusiness({
        name: name.trim(),
        business_type: businessType.trim(),
        country: country.trim(),
        currency: selectedCurrency,
        timezone: timezone.trim(),
        description: description.trim() || undefined,
      });
      setIsEditModalOpen(false);
      onStatusMessage(isFr ? 'Profil de boutique mis à jour avec succès.' : 'Store profile updated successfully.');
    } catch (err: any) {
      setError(err?.message || (isFr ? 'Erreur de mise à jour.' : 'Failed to update store details.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddDemo = async () => {
    try {
      setIsDemoLoading(true);
      await createDemoBusiness();
      onStatusMessage(isFr ? 'Boutique de démonstration créée avec succès !' : 'Sample demo business created successfully!');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Primary Store Identity Card */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  {activeBusiness?.name}
                </h3>
                <Badge variant="emerald">{activeRole?.toUpperCase()}</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {activeBusiness?.business_type || 'Retail'} · {activeBusiness?.country || 'Cameroon'}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setIsEditModalOpen(true);
            }}
            leftIcon={<Edit3 className="w-3.5 h-3.5 text-emerald-400" />}
            className="text-xs cursor-pointer shrink-0"
          >
            {isFr ? 'Modifier la Boutique' : 'Edit Store Details'}
          </Button>
        </div>

        {/* Quick Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
              {isFr ? 'Devise d’Encaissement' : 'Operating Currency'}
            </span>
            <span className="text-sm font-bold text-zinc-100 mt-1 block">
              {currencyConfig.code} ({currencyConfig.symbol})
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1">
              <Globe2 className="w-3.5 h-3.5 text-zinc-400" />
              {isFr ? 'Pays d’Exploitation' : 'Registered Country'}
            </span>
            <span className="text-sm font-bold text-zinc-100 mt-1 block">
              {activeBusiness?.country || 'Cameroon'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              {isFr ? 'Fuseau Horaire' : 'Store Timezone'}
            </span>
            <span className="text-sm font-bold text-zinc-100 mt-1 block truncate">
              {activeBusiness?.timezone || 'Africa/Douala'}
            </span>
          </div>
        </div>

        {activeBusiness?.description && (
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 text-xs text-zinc-300 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-bold text-zinc-400 block mb-0.5">
                {isFr ? 'Adresse & Description' : 'Store Address & Information'}
              </span>
              <p className="leading-relaxed">{activeBusiness.description}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Multi-Store Switcher Card */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              {isFr ? `Vos Boutiques (${businesses.length})` : `Your Stores (${businesses.length})`}
            </h4>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsNewStoreModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5 text-emerald-400" />}
            className="text-xs cursor-pointer"
          >
            {isFr ? 'Nouvelle Boutique' : 'Add Store'}
          </Button>
        </div>

        <div className="space-y-2">
          {businesses.map((b) => {
            const isSelected = b.business.id === activeBusiness?.id;
            return (
              <div
                key={b.business.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-zinc-950/40 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-900 text-zinc-400'}`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-zinc-100">
                      {b.business.name}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {b.business.currency} • {isFr ? 'Rôle :' : 'Role:'} {b.role.toUpperCase()}
                    </p>
                  </div>
                </div>

                {isSelected ? (
                  <Badge variant="emerald" size="sm">
                    {isFr ? 'ACTIF' : 'ACTIVE'}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1 cursor-pointer"
                    onClick={() => setActiveBusinessId(b.business.id)}
                  >
                    {isFr ? 'Basculer' : 'Switch'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddDemo}
            isLoading={isDemoLoading}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            className="text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
          >
            {isFr ? '+ Créer une boutique démo avec produits' : '+ Create sample demo store with catalog'}
          </Button>
        </div>
      </Card>

      {/* Edit Business Information Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={isFr ? 'Modifier les Détails de l’Entreprise' : 'Edit Business Details'}
        description={isFr ? 'Mettez à jour le nom, le pays, la devise et le fuseau horaire de votre boutique.' : 'Update your business entity name, country, currency, and timezone.'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Nom de l’Entreprise' : 'Business Name'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Douala Fresh Market"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Secteur d’Activité' : 'Industry / Business Type'}
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              >
                <option value="Retail">{isFr ? 'Boutique / Commerce de Détail' : 'Retail Store / Boutique'}</option>
                <option value="Supermarket">{isFr ? 'Supermarché & Épicerie' : 'Supermarket & Grocery'}</option>
                <option value="Food & Restaurant / Cafe">{isFr ? 'Restaurant / Café / Alimentation' : 'Restaurant / Cafe / Food'}</option>
                <option value="Wholesale & Distribution">{isFr ? 'Commerce de Gros & Distribution' : 'Wholesale & Distribution'}</option>
                <option value="Pharmacy & Health">{isFr ? 'Pharmacie & Santé' : 'Pharmacy & Health'}</option>
                <option value="Electronics & IT">{isFr ? 'Électronique & Informatique' : 'Electronics & IT'}</option>
                <option value="Services & Consulting">{isFr ? 'Services & Conseil' : 'Services & Consulting'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Pays' : 'Country'}
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Cameroon"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Devise d’Exploitation' : 'Operating Currency'}
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as SupportedCurrency)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Fuseau Horaire' : 'Timezone'}
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Africa/Douala"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Description / Adresse de la Boutique' : 'Description / Store Address'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isFr ? 'Brève description, emplacement, numéro fiscal...' : 'Brief description, store location, or tax identification number...'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={saving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              {isFr ? 'Enregistrer les Modifications' : 'Save Business Details'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add New Store Modal */}
      <Modal
        isOpen={isNewStoreModalOpen}
        onClose={() => setIsNewStoreModalOpen(false)}
        maxWidth="lg"
      >
        <OnboardingPage
          isAdditional={true}
          onSuccess={() => setIsNewStoreModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
