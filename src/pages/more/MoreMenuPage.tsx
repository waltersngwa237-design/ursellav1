import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
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
import {
  Store,
  User,
  Shield,
  LogOut,
  Building2,
  Plus,
  Coins,
  Globe,
  Clock,
  Sparkles,
  CheckCircle2,
  Key,
  FileText,
  Database,
  CreditCard,
  MessageSquare,
  ChevronRight,
  Zap,
  Sun,
  Moon,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Edit3,
  Check,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';

interface MoreMenuPageProps {
  onNavigate: (route: AppNavRoute) => void;
}

export const MoreMenuPage: React.FC<MoreMenuPageProps> = ({ onNavigate }) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const {
    businesses,
    activeBusiness,
    activeRole,
    activeSettings,
    currency,
    timezone,
    setActiveBusinessId,
    updateBusiness,
    createDemoBusiness,
    resetCurrentBusinessData,
    seedSampleCatalog,
  } = useBusiness();
  const { theme, isDark, setTheme } = useTheme();

  const [isNewBusinessModalOpen, setIsNewBusinessModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isEditBusinessModalOpen, setIsEditBusinessModalOpen] = useState(false);

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
      setProfileError('Please enter your full name.');
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
      setStatusMessage('Your profile information was updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) {
      setBizError('Please enter your business name.');
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
      setStatusMessage('Business details were updated successfully.');
    } catch (err: unknown) {
      setBizError(err instanceof Error ? err.message : 'Failed to update business details.');
    } finally {
      setBizSaving(false);
    }
  };

  const handleAddDemoBusiness = async () => {
    try {
      setIsDemoLoading(true);
      await createDemoBusiness();
      setStatusMessage('Demo business created successfully!');
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleResetData = async () => {
    try {
      setIsResetLoading(true);
      await resetCurrentBusinessData();
      setShowResetConfirm(false);
      setStatusMessage('Business data reset! You now have a 100% clean and fresh account.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleSeedCatalog = async () => {
    try {
      setIsSeedLoading(true);
      await seedSampleCatalog();
      setStatusMessage('Starter catalog seeded successfully for quick testing.');
    } finally {
      setIsSeedLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Settings & Business Management
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Manage your user profile, business settings, interface appearance, and workspace controls.
        </p>
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
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Navigation Cards: Core Hubs */}
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
              Financial Reports
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              GAAP-aligned P&L, Sales, Cash Flow, and Inventory reports.
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('data-io')}
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Data Migration Hub
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              CSV spreadsheet upload, validation, and full business export.
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
              Free Plan & Quota
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Full access to all POS, Inventory, and AI capabilities at zero cost.
            </p>
          </div>
        </button>
      </div>

      {/* 1. Theme & Appearance Mode */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Interface Appearance
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
            {theme === 'light' ? 'Light Mode Active' : 'Dark Mode Active'}
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          Choose between Dark and Light mode depending on your working environment and lighting conditions.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
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
                Light Mode
                {theme === 'light' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] text-zinc-400">Crisp high-contrast day theme</span>
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
                Dark Mode
                {theme === 'dark' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] text-zinc-400">Sleek, eye-safe night theme</span>
            </div>
          </button>
        </div>
      </Card>

      {/* 2. User Identity Profile */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100">
                  {profile?.full_name || 'Business User'}
                </h3>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Account Owner
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

          <div className="flex items-center gap-2 self-start sm:self-auto">
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
              Edit Profile Info
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFeedbackModalOpen(true)}
              leftIcon={<MessageSquare className="w-3.5 h-3.5 text-zinc-400" />}
              className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Feedback
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Active Business Details & Multi-Tenant Switcher */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
          <div className="flex items-center gap-2.5">
            <Store className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Active Business Profile
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
              className="text-xs py-1"
            >
              Edit Business Info
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 block">Business Name</span>
            <span className="text-sm font-bold text-zinc-100">{activeBusiness?.name}</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 block">Industry</span>
            <span className="text-sm font-bold text-zinc-100">
              {activeBusiness?.business_type || 'Retail'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 block">Currency & Country</span>
            <span className="text-sm font-bold text-zinc-100">
              {currencyConfig.code} ({currencyConfig.symbol}) • {activeBusiness?.country}
            </span>
          </div>
        </div>

        {activeBusiness?.description && (
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-400">
            <span className="text-zinc-500 font-semibold block mb-0.5">Description:</span>
            {activeBusiness.description}
          </div>
        )}

        {/* Business Switcher List */}
        <div className="pt-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Switch Managed Business ({businesses.length})
          </div>
          <div className="space-y-1.5">
            {businesses.map((b) => (
              <div
                key={b.business.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  b.business.id === activeBusiness?.id
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-zinc-100">
                      {b.business.name}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {b.business.currency} • Role: {b.role.toUpperCase()}
                    </p>
                  </div>
                </div>

                {b.business.id === activeBusiness?.id ? (
                  <Badge variant="emerald" size="sm">
                    ACTIVE
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1"
                    onClick={() => setActiveBusinessId(b.business.id)}
                  >
                    Select
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 mt-3 pt-3 border-t border-zinc-800">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsNewBusinessModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Register Another Business
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddDemoBusiness}
              isLoading={isDemoLoading}
              leftIcon={<Sparkles className="w-4 h-4 text-amber-400" />}
              className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Create Sample Demo Business
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Account Freshness & Data Controls */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Account Cleanliness & Data Freshness
            </h3>
          </div>
          <Badge variant="emerald">Clean Account Ready</Badge>
        </div>

        <p className="text-xs text-zinc-400">
          Every new business account starts 100% clean and fresh. You can wipe test data at any time to return to a pristine zero-state, or optionally populate starter items for testing.
        </p>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowResetConfirm(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
            className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
          >
            Reset Business to Clean Slate
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleSeedCatalog}
            isLoading={isSeedLoading}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
            className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            Load Starter Catalog Sample
          </Button>
        </div>
      </Card>

      {/* 5. Database Security & Infrastructure Status */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Database & Security Architecture
            </h3>
          </div>
          <Badge variant={isSupabaseConfigured ? 'emerald' : 'amber'}>
            {isSupabaseConfigured ? 'SUPABASE RLS ACTIVE' : 'PREVIEW MODE'}
          </Badge>
        </div>

        <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
          <p>
            Ursella enforces Row Level Security (RLS) across all tables, ensuring strict multi-tenant isolation. No business tenant can ever read or modify records belonging to another business.
          </p>
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 font-mono text-[11px] text-zinc-300">
            Current User ID: {user?.id}
          </div>
        </div>
      </Card>

      {/* 6. Sign Out */}
      <div className="pt-2">
        <Button
          variant="danger"
          size="md"
          className="w-full sm:w-auto cursor-pointer"
          onClick={() => signOut()}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign Out of Ursella
        </Button>
      </div>

      {/* Edit User Profile Modal */}
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        title="Edit Profile Information"
        description="Update your personal account name and contact details."
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
              Full Name <span className="text-rose-400">*</span>
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
              Phone Number
            </label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="e.g. +237 670 123 456"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-[11px] text-zinc-500">Used for WhatsApp receipts and alerts.</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Email Address
            </label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
            />
            <span className="text-[11px] text-zinc-500">Account login email address.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditProfileModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={profileSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Business Information Modal */}
      <Modal
        isOpen={isEditBusinessModalOpen}
        onClose={() => setIsEditBusinessModalOpen(false)}
        title="Edit Business Details"
        description="Update your business entity name, country, currency, and timezone."
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
                Business Name <span className="text-rose-400">*</span>
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
                Industry / Business Type
              </label>
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              >
                <option value="Retail">Retail Store / Boutique</option>
                <option value="Supermarket">Supermarket & Grocery</option>
                <option value="Food & Restaurant / Cafe">Restaurant / Cafe / Food</option>
                <option value="Wholesale & Distribution">Wholesale & Distribution</option>
                <option value="Pharmacy & Health">Pharmacy & Health</option>
                <option value="Electronics & IT">Electronics & IT</option>
                <option value="Services & Consulting">Services & Consulting</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Country
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
                Operating Currency
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
                Timezone
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
              Description / Store Address
            </label>
            <textarea
              rows={2}
              value={bizDescription}
              onChange={(e) => setBizDescription(e.target.value)}
              placeholder="Brief description, store location, or tax identification number..."
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
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={bizSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              Save Business Details
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Business Workspace"
        description="Are you sure you want to wipe all local transactions and inventory?"
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">This will erase all test products, sales, customers, and expenses for this business.</p>
              <p className="mt-1 text-rose-200/80">Your business settings and login profile will remain intact.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleResetData}
              isLoading={isResetLoading}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Confirm & Wipe Data
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
    </div>
  );
};
