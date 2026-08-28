import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { isSupabaseConfigured } from '../../lib/supabase/client.ts';
import { CURRENCY_MAP, type SupportedCurrency, type AppNavRoute } from '../../types/index.ts';
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
} from 'lucide-react';

interface MoreMenuPageProps {
  onNavigate: (route: AppNavRoute) => void;
}

export const MoreMenuPage: React.FC<MoreMenuPageProps> = ({ onNavigate }) => {
  const { user, profile, signOut } = useAuth();
  const {
    businesses,
    activeBusiness,
    activeRole,
    activeSettings,
    currency,
    timezone,
    setActiveBusinessId,
    createDemoBusiness,
    resetCurrentBusinessData,
    seedSampleCatalog,
  } = useBusiness();
  const { theme, isDark, setTheme } = useTheme();

  const [isNewBusinessModalOpen, setIsNewBusinessModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

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
          Manage your business workspace, appearance, subscription, data migration, and profile.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Navigation Cards: Core Hubs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onNavigate('reports')}
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between"
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
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between"
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
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
              Subscription & Billing
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Plan tiers, MoMo / Card payments, and AI quota meters.
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
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
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
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                {profile?.full_name || 'Business User'}
              </h3>
              <p className="text-xs text-zinc-400">{user?.email}</p>
              {profile?.phone && (
                <p className="text-xs text-zinc-500 mt-0.5">{profile.phone}</p>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsFeedbackModalOpen(true)}
            leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Feedback
          </Button>
        </div>
      </Card>

      {/* 3. Active Business Details & Multi-Tenant Switcher */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Store className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Active Business Profile
            </h3>
          </div>
          <Badge variant="emerald">{activeRole?.toUpperCase()}</Badge>
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
              className="text-zinc-400 hover:text-zinc-200"
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
            className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
          >
            Reset Business to Clean Slate
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleSeedCatalog}
            isLoading={isSeedLoading}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
            className="text-zinc-400 hover:text-zinc-200"
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
          className="w-full sm:w-auto"
          onClick={() => signOut()}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign Out of Ursella
        </Button>
      </div>

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

