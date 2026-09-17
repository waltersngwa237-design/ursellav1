import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { isSupabaseConfigured } from '../../lib/supabase/client.ts';
import {
  CURRENCY_MAP,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  type AppNavRoute,
} from '../../types/index.ts';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { OnboardingPage } from '../onboarding/OnboardingPage.tsx';
import { FeedbackModal } from '../../components/feedback/FeedbackModal.tsx';
import { HardwareSettingsModal } from '../../components/hardware/HardwareSettingsModal.tsx';
import { HardwarePrinterService } from '../../services/hardware-printer.service.ts';
import { TeamManagementSection } from '../../components/team/TeamManagementSection.tsx';
import {
  Store,
  User,
  Users,
  Shield,
  LogOut,
  Building2,
  Plus,
  CheckCircle2,
  FileText,
  Database,
  CreditCard,
  MessageSquare,
  ChevronRight,
  Sun,
  Moon,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Edit3,
  Check,
  Phone,
  Mail,
  Printer,
  Sliders,
  Globe,
} from 'lucide-react';

interface MoreMenuPageProps {
  onNavigate: (route: AppNavRoute) => void;
  defaultTab?: 'general' | 'business' | 'team' | 'hardware' | 'data';
}

type SettingsTab = 'general' | 'business' | 'team' | 'hardware' | 'data';

export const MoreMenuPage: React.FC<MoreMenuPageProps> = ({ onNavigate, defaultTab = 'general' }) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const {
    businesses,
    activeBusiness,
    activeRole,
    currency,
    setActiveBusinessId,
    updateBusiness,
    createDemoBusiness,
    resetCurrentBusinessData,
    seedSampleCatalog,
  } = useBusiness();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isFr = language === 'fr';

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  const [isNewBusinessModalOpen, setIsNewBusinessModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isEditBusinessModalOpen, setIsEditBusinessModalOpen] = useState(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [hwSettings, setHwSettings] = useState(HardwarePrinterService.getSettings());

  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Profile Edit Form State
  const [profileName, setProfileName] = useState(profile?.full_name || '');
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Business Edit Form State
  const [bizName, setBizName] = useState(activeBusiness?.name || '');
  const [bizType, setBizType] = useState(activeBusiness?.business_type || 'Retail');
  const [bizCountry, setBizCountry] = useState(activeBusiness?.country || 'Cameroon');
  const [bizCurrency, setBizCurrency] = useState<SupportedCurrency>(currency || 'XAF');
  const [bizTimezone, setBizTimezone] = useState(activeBusiness?.timezone || 'Africa/Douala');
  const [bizDescription, setBizDescription] = useState(activeBusiness?.description || '');
  const [bizSaving, setBizSaving] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setProfileName(profile.full_name || '');
      setProfilePhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (activeBusiness) {
      setBizName(activeBusiness.name || '');
      setBizType(activeBusiness.business_type || 'Retail');
      setBizCountry(activeBusiness.country || 'Cameroon');
      setBizCurrency((activeBusiness.currency || currency || 'XAF') as SupportedCurrency);
      setBizTimezone(activeBusiness.timezone || 'Africa/Douala');
      setBizDescription(activeBusiness.description || '');
    }
  }, [activeBusiness, currency]);

  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileError(isFr ? 'Veuillez saisir votre nom complet.' : 'Please enter your full name.');
      return;
    }
    try {
      setProfileSaving(true);
      setProfileError(null);
      await updateProfile({
        full_name: profileName.trim(),
        phone: profilePhone.trim() || null,
      });
      setIsEditProfileModalOpen(false);
      setStatusMessage(isFr ? 'Profil mis à jour avec succès.' : 'Your profile information was updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : (isFr ? 'Erreur de mise à jour du profil.' : 'Failed to update profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) {
      setBizError(isFr ? 'Veuillez saisir le nom de l’entreprise.' : 'Please enter your business name.');
      return;
    }
    try {
      setBizSaving(true);
      setBizError(null);
      await updateBusiness({
        name: bizName.trim(),
        business_type: bizType.trim(),
        country: bizCountry.trim(),
        currency: bizCurrency,
        timezone: bizTimezone.trim(),
        description: bizDescription.trim() || undefined,
      });
      setIsEditBusinessModalOpen(false);
      setStatusMessage(isFr ? 'Détails de l’entreprise mis à jour avec succès.' : 'Business details were updated successfully.');
    } catch (err: unknown) {
      setBizError(err instanceof Error ? err.message : (isFr ? 'Erreur de mise à jour.' : 'Failed to update business details.'));
    } finally {
      setBizSaving(false);
    }
  };

  const handleAddDemoBusiness = async () => {
    try {
      setIsDemoLoading(true);
      await createDemoBusiness();
      setStatusMessage(isFr ? 'Boutique de démonstration créée avec succès !' : 'Demo business created successfully!');
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleResetData = async () => {
    try {
      setIsResetLoading(true);
      await resetCurrentBusinessData();
      setShowResetConfirm(false);
      setStatusMessage(isFr ? 'Données réinitialisées avec succès ! Espace prêt à l’emploi.' : 'Business data reset! You now have a clean, fresh workspace.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleSeedCatalog = async () => {
    try {
      setIsSeedLoading(true);
      await seedSampleCatalog();
      setStatusMessage(isFr ? 'Catalogue initial chargé avec succès pour vos tests.' : 'Starter catalog seeded successfully for quick testing.');
    } finally {
      setIsSeedLoading(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: isFr ? 'Général' : 'General', icon: <User className="w-4 h-4" /> },
    { id: 'business', label: isFr ? 'Profil Boutique' : 'Store Profile', icon: <Store className="w-4 h-4" /> },
    { id: 'team', label: isFr ? 'Équipe & Accès' : 'Team & Staff', icon: <Users className="w-4 h-4" /> },
    { id: 'hardware', label: isFr ? 'Matériel & Caisse' : 'POS Hardware', icon: <Printer className="w-4 h-4" /> },
    { id: 'data', label: isFr ? 'Données & Cloud' : 'Data & Cloud', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {t.navigation.settings}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            {isFr
              ? 'Gérez vos préférences de boutique, accès du personnel, imprimantes et architecture de données.'
              : 'Manage your store preferences, staff access, POS peripherals, and data architecture.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsFeedbackModalOpen(true)}
            leftIcon={<MessageSquare className="w-3.5 h-3.5 text-zinc-400" />}
            className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            {isFr ? 'Commentaires' : 'Feedback'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => signOut()}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
            className="text-xs cursor-pointer"
          >
            {isFr ? 'Déconnexion' : 'Sign Out'}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs cursor-pointer font-bold"
          >
            {isFr ? 'Fermer' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Segmented Tab Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800/80 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700/80'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
              }`}
            >
              <span className={isActive ? 'text-emerald-400' : 'text-zinc-500'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL (USER & APPEARANCE)                                        */}
      {/* ========================================================================= */}
      {activeTab === 'general' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* User Identity Profile */}
          <Card className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-100">
                      {profile?.full_name || (isFr ? 'Utilisateur' : 'Business User')}
                    </h3>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {isFr ? 'Propriétaire du Compte' : 'Account Owner'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{user?.email}</span>
                  </p>
                  {profile?.phone && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{profile.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProfileName(profile?.full_name || '');
                    setProfilePhone(profile?.phone || '');
                    setProfileError(null);
                    setIsEditProfileModalOpen(true);
                  }}
                  leftIcon={<Edit3 className="w-3.5 h-3.5 text-emerald-400" />}
                  className="text-xs cursor-pointer"
                >
                  {isFr ? 'Modifier le Profil' : 'Edit Profile'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Theme & Appearance Mode */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {isFr ? 'Apparence de l’Interface' : 'Interface Appearance'}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {theme === 'light' ? (isFr ? 'Mode Clair Actif' : 'Light Mode Active') : (isFr ? 'Mode Sombre Actif' : 'Dark Mode Active')}
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              {isFr ? 'Basculez entre le mode clair à contraste élevé et le mode sombre reposant.' : 'Switch between daylight high-contrast and low-light eye-safe night mode.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setTheme('light')}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                    : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-500">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    {isFr ? 'Mode Clair' : 'Light Mode'}
                    {theme === 'light' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-zinc-400">{isFr ? 'Thème jour net et contrasté' : 'Crisp high-contrast day theme'}</span>
                </div>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    {isFr ? 'Mode Sombre' : 'Dark Mode'}
                    {theme === 'dark' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-zinc-400">{isFr ? 'Thème nuit élégant et sobre' : 'Sleek, eye-safe night theme'}</span>
                </div>
              </button>
            </div>
          </Card>

          {/* Language & Regional Localization */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {language === 'fr' ? 'Langue de l’Application' : 'Application Language'}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {language === 'fr' ? 'Français (FR)' : 'English (EN)'}
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              {language === 'fr' 
                ? 'Basculez entre le français et l’anglais. Ursella AI adaptera aussi ses analyses et calculs en temps réel.'
                : 'Switch between English and French. Ursella AI will also adapt its financial reasoning and prompts.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setLanguage('en')}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30'
                    : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-xs">
                  EN
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    English
                    {language === 'en' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-zinc-400">Default global business language</span>
                </div>
              </button>

              <button
                onClick={() => setLanguage('fr')}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  language === 'fr'
                    ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30'
                    : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  FR
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    Français
                    {language === 'fr' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-zinc-400">Pour le commerce en Afrique francophone</span>
                </div>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BUSINESS PROFILE & STORE SWITCHER                                   */}
      {/* ========================================================================= */}
      {activeTab === 'business' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <Card className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                  {isFr ? 'Entité Commerciale Active' : 'Active Business Entity'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="emerald">{activeRole?.toUpperCase()}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBizName(activeBusiness?.name || '');
                    setBizType(activeBusiness?.business_type || 'Retail');
                    setBizCountry(activeBusiness?.country || 'Cameroon');
                    setBizCurrency((activeBusiness?.currency || currency || 'XAF') as SupportedCurrency);
                    setBizTimezone(activeBusiness?.timezone || 'Africa/Douala');
                    setBizDescription(activeBusiness?.description || '');
                    setBizError(null);
                    setIsEditBusinessModalOpen(true);
                  }}
                  leftIcon={<Edit3 className="w-3.5 h-3.5 text-emerald-400" />}
                  className="text-xs py-1 cursor-pointer"
                >
                  {isFr ? 'Modifier les Infos' : 'Edit Business Info'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 block">{isFr ? 'Nom de l’Entreprise' : 'Business Name'}</span>
                <span className="text-sm font-bold text-zinc-100">{activeBusiness?.name}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 block">{isFr ? 'Secteur d’Activité' : 'Industry'}</span>
                <span className="text-sm font-bold text-zinc-100">
                  {activeBusiness?.business_type || 'Retail'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 block">{isFr ? 'Devise & Pays' : 'Currency & Region'}</span>
                <span className="text-sm font-bold text-zinc-100">
                  {currencyConfig.code} ({currencyConfig.symbol}) • {activeBusiness?.country}
                </span>
              </div>
            </div>

            {activeBusiness?.description && (
              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-400">
                <span className="text-zinc-500 font-semibold block mb-0.5">{isFr ? 'Description :' : 'Description:'}</span>
                {activeBusiness.description}
              </div>
            )}
          </Card>

          {/* Multi-Tenant Switcher */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {isFr ? `Boutiques Gérées (${businesses.length})` : `Managed Businesses (${businesses.length})`}
                </h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewBusinessModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs cursor-pointer"
              >
                {isFr ? 'Ajouter une Boutique' : 'Add Business'}
              </Button>
            </div>

            <div className="space-y-2">
              {businesses.map((b) => (
                <div
                  key={b.business.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    b.business.id === activeBusiness?.id
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                      : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-zinc-100">
                        {b.business.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {b.business.currency} • {isFr ? 'Rôle :' : 'Role:'} {b.role.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {b.business.id === activeBusiness?.id ? (
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
                      {isFr ? 'Sélectionner' : 'Select'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddDemoBusiness}
                isLoading={isDemoLoading}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
              >
                {isFr ? '+ Créer une Boutique Démo' : '+ Create Sample Demo Business'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEAM & STAFF                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="animate-in fade-in duration-150">
          <TeamManagementSection />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: POS HARDWARE & THERMAL PRINTING                                    */}
      {/* ========================================================================= */}
      {activeTab === 'hardware' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {isFr ? 'Impression Thermique & Périphériques' : 'Thermal Receipt Printing & Peripherals'}
                </h3>
              </div>
              <Badge variant="emerald">{hwSettings.paperWidth} {isFr ? 'Thermique' : 'Thermal'}</Badge>
            </div>

            <p className="text-xs text-zinc-400">
              {isFr
                ? 'Configurez vos imprimantes thermiques ESC/POS (58mm/80mm), appairage Bluetooth et ouverture automatique du tiroir-caisse.'
                : 'Configure ESC/POS thermal printers (58mm/80mm), Bluetooth pairing, and automatic cash drawer kick commands on cash checkout.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">{isFr ? 'Format Papier' : 'Paper Format'}</span>
                <span className="text-zinc-200 font-semibold">{hwSettings.paperWidth} {isFr ? 'Rouleau' : 'Roll'}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">{isFr ? 'Tiroir-Caisse Auto' : 'Cash Drawer Trigger'}</span>
                <span className="text-zinc-200 font-semibold">
                  {hwSettings.autoKickDrawerOnCash ? (isFr ? 'Ouverture Auto Active' : 'Auto-Kick Active') : (isFr ? 'Manuel Uniquement' : 'Manual Only')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">{isFr ? 'Mode de Connexion' : 'Connection Mode'}</span>
                <span className="text-zinc-200 font-semibold truncate">
                  {hwSettings.pairedDeviceName || (isFr ? 'Navigateur / Impression Brute' : 'Browser / Raw Print')}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setHwSettings(HardwarePrinterService.getSettings());
                  setIsHardwareModalOpen(true);
                }}
                leftIcon={<Sliders className="w-3.5 h-3.5 text-emerald-400" />}
                className="text-xs cursor-pointer"
              >
                {isFr ? 'Configurer Matériel & Imprimantes' : 'Configure Hardware & Printers'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DATA & CLOUD SECURITY                                              */}
      {/* ========================================================================= */}
      {activeTab === 'data' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Quick Hub Navigation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('reports')}
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {isFr ? 'Rapports Financiers' : 'Financial Reports'}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isFr ? 'Compte de résultat, marges, ventes et trésorerie.' : 'P&L, Gross Margins, Sales, and Cash Flow.'}
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('data-io')}
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {isFr ? 'Centre d’Import & Export' : 'Data Migration Hub'}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isFr ? 'Importation Excel/CSV et sauvegarde complète de la boutique.' : 'CSV spreadsheet upload and full business export.'}
                </p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('billing')}
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {isFr ? 'Abonnement & Quotas' : 'Plan & Quota'}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isFr ? 'Statut d’utilisation et fonctionnalités de gestion complètes.' : 'Usage status and free enterprise retail capabilities.'}
                </p>
              </div>
            </button>
          </div>

          {/* Database Security & Infrastructure Status */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {isFr ? 'Sécurité Base de Données & Isolation Multi-Boutiques' : 'Database & Multi-Tenant Isolation'}
                </h3>
              </div>
              <Badge variant={isSupabaseConfigured ? 'emerald' : 'amber'}>
                {isSupabaseConfigured ? (isFr ? 'SÉCURITÉ RLS ACTIVE' : 'SUPABASE RLS ACTIVE') : (isFr ? 'MODE LOCAL / APERÇU' : 'LOCAL / PREVIEW MODE')}
              </Badge>
            </div>

            <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
              <p>
                {isFr
                  ? 'Ursella applique une politique stricte de sécurité au niveau des lignes (RLS) sur toutes les tables. Aucune entité ne peut accéder aux données d’une autre boutique.'
                  : 'Ursella enforces strict Row Level Security (RLS) across all tables, ensuring strict multi-tenant isolation. No business entity can ever access or modify records belonging to another store.'}
              </p>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                {isFr ? 'Identifiant Utilisateur :' : 'Current User ID:'} {user?.id}
              </div>
            </div>
          </Card>

          {/* Account Freshness & Data Controls */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {isFr ? 'Réinitialisation de l’Espace de Travail' : 'Workspace Reset & Clean Slate'}
                </h3>
              </div>
              <Badge variant="zinc">{isFr ? 'Contrôles Données' : 'Data Controls'}</Badge>
            </div>

            <p className="text-xs text-zinc-400">
              {isFr
                ? 'Vous pouvez effacer les données de test à tout moment pour repartir de zéro, ou charger un échantillon de produits.'
                : 'You can wipe test data at any time to return to a pristine zero-state, or load sample starter items.'}
            </p>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
              >
                {isFr ? 'Remettre la Boutique à Zéro' : 'Reset Store to Clean Slate'}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleSeedCatalog}
                isLoading={isSeedLoading}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
              >
                {isFr ? 'Charger un Catalogue Échantillon' : 'Load Starter Catalog Sample'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit User Profile Modal */}
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        title={isFr ? 'Modifier les Informations du Profil' : 'Edit Profile Information'}
        description={isFr ? 'Mettez à jour votre nom de compte et vos coordonnées personnelles.' : 'Update your personal account name and contact details.'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
          {profileError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {profileError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Nom Complet' : 'Full Name'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. Jean Dupont"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Numéro de Téléphone' : 'Phone Number'}
            </label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="e.g. +237 670 123 456"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-[11px] text-zinc-500">{isFr ? 'Utilisé pour les reçus WhatsApp et les alertes.' : 'Used for WhatsApp receipts and alerts.'}</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Adresse Email' : 'Email Address'}
            </label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
            />
            <span className="text-[11px] text-zinc-500">{isFr ? 'Adresse email de connexion au compte.' : 'Account login email address.'}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditProfileModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={profileSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              {isFr ? 'Enregistrer le Profil' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Business Information Modal */}
      <Modal
        isOpen={isEditBusinessModalOpen}
        onClose={() => setIsEditBusinessModalOpen(false)}
        title={isFr ? 'Modifier les Détails de l’Entreprise' : 'Edit Business Details'}
        description={isFr ? 'Mettez à jour le nom, le pays, la devise et le fuseau horaire de votre boutique.' : 'Update your business entity name, country, currency, and timezone.'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveBusiness} className="space-y-4 py-2">
          {bizError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {bizError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Nom de l’Entreprise' : 'Business Name'} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
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
                value={bizType}
                onChange={(e) => setBizType(e.target.value)}
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
                value={bizCountry}
                onChange={(e) => setBizCountry(e.target.value)}
                placeholder="e.g. Cameroon"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                {isFr ? 'Devise d’Exploitation' : 'Operating Currency'}
              </label>
              <select
                value={bizCurrency}
                onChange={(e) => setBizCurrency(e.target.value as SupportedCurrency)}
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
                value={bizTimezone}
                onChange={(e) => setBizTimezone(e.target.value)}
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
              value={bizDescription}
              onChange={(e) => setBizDescription(e.target.value)}
              placeholder={isFr ? 'Brève description, emplacement, numéro fiscal...' : 'Brief description, store location, or tax identification number...'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditBusinessModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={bizSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              {isFr ? 'Enregistrer les Modifications' : 'Save Business Details'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={isFr ? 'Remise à Zéro de la Boutique' : 'Reset Store Workspace'}
        description={isFr ? 'Êtes-vous sûr de vouloir effacer toutes les transactions et stocks locaux ?' : 'Are you sure you want to wipe all local transactions and inventory?'}
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{isFr ? 'Cette action effacera tous les produits, ventes, clients et dépenses de test pour cette boutique.' : 'This will erase all test products, sales, customers, and expenses for this business.'}</p>
              <p className="mt-1 text-rose-200/80">{isFr ? 'Vos paramètres d’entreprise et votre profil utilisateur seront conservés.' : 'Your business settings and login profile will remain intact.'}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleResetData}
              isLoading={isResetLoading}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {isFr ? 'Confirmer & Tout Réinitialiser' : 'Confirm & Wipe Data'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isNewBusinessModalOpen}
        onClose={() => setIsNewBusinessModalOpen(false)}
        maxWidth="lg"
      >
        <OnboardingPage
          isAdditional={true}
          onSuccess={() => setIsNewBusinessModalOpen(false)}
        />
      </Modal>

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        businessId={activeBusiness?.id || ''}
      />

      <HardwareSettingsModal
        isOpen={isHardwareModalOpen}
        onClose={() => {
          setIsHardwareModalOpen(false);
          setHwSettings(HardwarePrinterService.getSettings());
        }}
      />
    </div>
  );
};
