import React, { useState } from 'react';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Button } from '../../components/common/Button.tsx';
import { LanguageToggle } from '../../components/common/LanguageToggle.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import {
  ShoppingCart,
  Boxes,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Receipt,
  Smartphone,
  BarChart3,
  CheckCircle2,
  Activity,
  TrendingUp,
  CreditCard,
  Send,
  MessageSquare,
  Check,
  ChevronRight,
  Store,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.tsx';

interface LandingPageProps {
  onNavigateSignIn: () => void;
  onNavigateSignUp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateSignIn,
  onNavigateSignUp,
}) => {
  const { startInstantDemo, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isFr = language === 'fr';

  const [activeTab, setActiveTab] = useState<'pos' | 'health' | 'ai'>('pos');

  const handleQuickDemo = async () => {
    try {
      await startInstantDemo();
    } catch (err) {
      console.warn('Instant demo launch warning:', err);
    }
  };

  return (
    <div
      className={`relative min-h-screen flex flex-col selection:bg-emerald-500/20 selection:text-emerald-500 overflow-x-hidden transition-colors ${
        isDark ? 'bg-[#090D16] text-zinc-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Background Atmospheric Photography Asset */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-700 ${
          isDark ? 'opacity-25' : 'opacity-40 mix-blend-multiply'
        }`}
        style={{
          backgroundImage: isDark
            ? `url('/shared_link_bg.jpg')`
            : `url('/light_theme_bg.jpg')`,
        }}
      />
      {/* Multi-layered cinematic gradient overlays */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none transition-colors duration-500 ${
          isDark
            ? 'bg-gradient-to-b from-[#090D16]/80 via-[#090D16]/95 to-[#090D16]'
            : 'bg-gradient-to-b from-white/70 via-slate-50/85 to-slate-50'
        }`}
      />
      {/* Subtle radial emerald spotlight glow */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none ${
          isDark
            ? 'bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%)]'
            : 'bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(16,185,129,0.06),transparent_70%)]'
        }`}
      />

      {/* Top Navigation */}
      <header
        className={`relative z-30 sticky top-0 w-full border-b backdrop-blur-md transition-colors ${
          isDark
            ? 'border-zinc-800/80 bg-[#090D16]/85 shadow-xs'
            : 'border-slate-200/80 bg-white/85 shadow-xs'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand on Far Left */}
          <div className="shrink-0 flex items-center">
            <UrsellaLogo size="sm" />
          </div>

          {/* Unified Actions on Far Right */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Single Compact Globe Toggle */}
            <LanguageToggle variant="compact" />

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs transition-all active:scale-95 cursor-pointer shrink-0 ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 shadow-xs'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </button>

            {/* Quick Demo - Large screens only */}
            <button
              onClick={handleQuickDemo}
              disabled={loading}
              className={`hidden lg:inline-flex text-xs font-semibold px-3 h-8 items-center rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/70 border-zinc-800'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
              }`}
            >
              {t.common.demoStore}
            </button>

            {/* Sign In - Medium & desktop screens only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateSignIn}
              className={`hidden md:inline-flex text-xs font-medium px-2.5 sm:px-3 h-8 shrink-0 ${
                isDark ? 'text-zinc-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {t.landing.signIn}
            </Button>

            {/* Get Started CTA */}
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateSignUp}
              className="text-xs font-bold shadow-xs shrink-0 whitespace-nowrap px-3 sm:px-3.5 h-8 rounded-lg"
              rightIcon={<ArrowRight className="w-3.5 h-3.5 shrink-0" />}
            >
              {t.landing.signUp}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-18 pb-10 text-center">
          {/* Subtle Live Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs mb-6 shadow-xs ${
              isDark
                ? 'bg-zinc-900/90 border-emerald-500/30 text-zinc-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{t.landing.heroTag}</span>
          </div>

          {/* Headline */}
          <h1
            className={`text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] sm:leading-[1.15] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {t.landing.heroTitle}
          </h1>

          {/* Subtitle */}
          <p
            className={`mt-5 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            <strong className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>
              Ursella
            </strong>{' '}
            {t.landing.heroSubtitle}
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={onNavigateSignUp}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold shadow-md shadow-emerald-500/20"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {t.landing.createAccount}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={handleQuickDemo}
              isLoading={loading}
              className={`w-full sm:w-auto px-7 py-3.5 text-sm font-medium ${
                isDark
                  ? 'text-zinc-200 hover:text-white bg-zinc-900/90 border-zinc-800'
                  : 'text-slate-700 hover:text-slate-900 bg-white border-slate-300'
              }`}
            >
              {t.landing.exploreDemo}
            </Button>
          </div>

          {/* Mobile Sign In helper */}
          <div className="mt-3.5 text-center sm:hidden">
            <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {isFr ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
              <button
                onClick={onNavigateSignIn}
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {t.landing.signIn}
              </button>
            </span>
          </div>

          {/* Trust Value Badges */}
          <div
            className={`mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t.landing.multiCurrency}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t.landing.offlinePwa}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t.landing.noCard}</span>
            </div>
          </div>
        </section>

        {/* High-Craft Interactive In-App Showcase */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <div
            className={`rounded-2xl border p-3 sm:p-5 shadow-2xl backdrop-blur-md transition-all ${
              isDark
                ? 'border-zinc-800/90 bg-zinc-900/80 shadow-black/50'
                : 'border-slate-200/90 bg-white/95 shadow-slate-200/70'
            }`}
          >
            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3 mb-4 gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('pos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'pos'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{isFr ? 'Caisse & Paiements' : 'POS & Payments'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('health')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'health'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{isFr ? 'Indicateur de Santé' : 'Business Health'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'ai'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isFr ? 'Conseiller IA' : 'AI Advisor'}</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{isFr ? 'Synchronisation En Direct' : 'Live Sync Active'}</span>
              </div>
            </div>

            {/* Panel 1: POS Terminal Preview */}
            {activeTab === 'pos' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                  {/* Left: Product Selector */}
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400 px-1">
                      <span>{isFr ? 'Catalogue Rapide (XAF)' : 'Quick Catalog (XAF)'}</span>
                      <span className="text-[11px] text-emerald-500">3 {isFr ? 'articles au panier' : 'items in cart'}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { name: isFr ? 'Huile de Palme 1L' : 'Palm Oil 1L', price: '2,200 XAF', stock: '24 en stock', added: true },
                        { name: isFr ? 'Savon de Marseille' : 'Laundry Soap', price: '750 XAF', stock: '80 en stock', added: true },
                        { name: isFr ? 'Riz Parfumé 5kg' : 'Perfumed Rice 5kg', price: '4,500 XAF', stock: '12 en stock', added: true },
                        { name: isFr ? 'Sucre en Morceaux' : 'Sugar Cubes 1kg', price: '950 XAF', stock: '45 en stock', added: false },
                        { name: isFr ? 'Lait Concentré' : 'Evaporated Milk', price: '600 XAF', stock: '60 en stock', added: false },
                        { name: isFr ? 'Farine de Blé 1kg' : 'Wheat Flour 1kg', price: '850 XAF', stock: '30 en stock', added: false },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border text-left transition-all relative ${
                            item.added
                              ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10'
                              : 'border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60'
                          }`}
                        >
                          {item.added && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">{item.price}</p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{item.stock}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Cart & Payment Breakdown */}
                  <div className="lg:col-span-5 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-950/80 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-zinc-800 text-xs font-bold text-slate-900 dark:text-white">
                        <span>{isFr ? 'Ticket de Vente #1042' : 'Order Ticket #1042'}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">XAF</span>
                      </div>

                      <div className="space-y-1.5 py-2.5 text-xs">
                        <div className="flex justify-between text-slate-700 dark:text-zinc-300">
                          <span>1x Huile de Palme 1L</span>
                          <span className="font-semibold">2,200 XAF</span>
                        </div>
                        <div className="flex justify-between text-slate-700 dark:text-zinc-300">
                          <span>2x Savon de Marseille</span>
                          <span className="font-semibold">1,500 XAF</span>
                        </div>
                        <div className="flex justify-between text-slate-700 dark:text-zinc-300">
                          <span>1x Riz Parfumé 5kg</span>
                          <span className="font-semibold">4,500 XAF</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800 space-y-1">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400">
                          <span>{isFr ? 'Sous-total' : 'Subtotal'}</span>
                          <span>8,200 XAF</span>
                        </div>
                        <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white">
                          <span>Total</span>
                          <span className="text-emerald-600 dark:text-emerald-400">8,200 XAF</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold text-center">
                        <span className="p-1.5 rounded-lg border border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Espèces (Cash)
                        </span>
                        <span className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400">
                          MTN MoMo
                        </span>
                        <span className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400">
                          Orange Money
                        </span>
                      </div>

                      <button
                        onClick={onNavigateSignUp}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isFr ? 'Encaisser & Reçu WhatsApp' : 'Complete Sale & WhatsApp Receipt'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel 2: Business Health Indicator Preview */}
            {activeTab === 'health' && (
              <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/70 space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Ursella Business Health Indicator
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {isFr ? 'Score déterministe basé sur vos transactions vérifiées' : 'Deterministic score derived from verified store ledger'}
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    88/100 • {isFr ? 'Excellente Santé' : 'Strong Health'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <span>{isFr ? 'Index Global' : 'Overall Index'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">88%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                  </div>
                </div>

                {/* Mathematical Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
                  {[
                    { label: isFr ? 'Marge Brute (FIFO)' : 'Gross Margin (FIFO)', val: '34.2%', status: 'Optimal', ok: true },
                    { label: isFr ? 'Trésorerie & MoMo' : 'Cash & MoMo Ratio', val: '92/100', status: 'Optimal', ok: true },
                    { label: isFr ? 'Rotation des Stocks' : 'Stock Velocity', val: '86/100', status: 'Optimal', ok: true },
                    { label: isFr ? 'Créances Clients' : 'Receivables Aged', val: '45,000 XAF', status: isFr ? 'Vigilance' : 'Watch', ok: false },
                  ].map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex flex-col justify-between"
                    >
                      <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">{p.label}</span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{p.val}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            p.ok
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel 3: AI Business Advisor Preview */}
            {activeTab === 'ai' && (
              <div className="p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-zinc-950/70 space-y-3.5 animate-in fade-in duration-300">
                <div className="flex items-center gap-2.5 pb-2 border-b border-amber-500/20">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {isFr ? 'Conseiller d’Exploitation Ursella AI' : 'Ursella AI Operational Intelligence'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {isFr ? 'Analyse en continu vos ventes, stocks et bénéfices réels' : 'Continuously audits FIFO margins, reorders, and customer balances'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* User Question */}
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 flex items-start gap-2.5">
                    <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {isFr ? '« Dois-je recommander de l’huile de palme avant ce week-end ? »' : '“Should I reorder palm oil before this weekend?”'}
                      </p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 space-y-2">
                    <p className="leading-relaxed">
                      {isFr
                        ? '✅ Recommandation : Commandez 25 unités aujourd’hui. Votre vitesse d’écoulement sur 14 jours est de 18 bouteilles/semaine et votre stock actuel est à 4 unités. Sans réassort, vous subirez une rupture dès samedi matin.'
                        : '✅ Recommendation: Reorder 25 units today. Your 14-day velocity is 18 bottles/week and current stock is down to 4 units. Without restocking, you will experience a stockout by Saturday morning.'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {isFr ? 'Calcul FIFO Certifié' : 'FIFO Cost Verified'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700">
                        {isFr ? 'Devise : XAF (FCFA)' : 'Currency: XAF'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Feature Grid */}
        <section
          className={`max-w-5xl mx-auto px-4 sm:px-6 pb-20 border-t pt-14 transition-colors ${
            isDark ? 'border-zinc-800/80' : 'border-slate-200'
          }`}
        >
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.landing.featuresTitle}
            </h2>
            <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-emerald-500/30 hover:bg-zinc-900/90 shadow-xs'
                  : 'border-slate-200/80 bg-white/85 hover:border-emerald-300 hover:bg-white shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                }`}
              >
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.landing.receiptsTitle}
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {t.landing.receiptsDesc}
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-indigo-500/30 hover:bg-zinc-900/90 shadow-xs'
                  : 'border-slate-200/80 bg-white/85 hover:border-indigo-300 hover:bg-white shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'bg-indigo-50 text-indigo-600 border border-indigo-200/60'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.landing.momoTitle}
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {t.landing.momoDesc}
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-teal-500/30 hover:bg-zinc-900/90 shadow-xs'
                  : 'border-slate-200/80 bg-white/85 hover:border-teal-300 hover:bg-white shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'bg-teal-50 text-teal-600 border border-teal-200/60'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.landing.pnlTitle}
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {t.landing.pnlDesc}
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-emerald-500/30 hover:bg-zinc-900/90 shadow-xs'
                  : 'border-slate-200/80 bg-white/85 hover:border-emerald-300 hover:bg-white shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.landing.securityTitle}
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {t.landing.securityDesc}
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-amber-500/30 hover:bg-zinc-900/90 shadow-xs'
                  : 'border-slate-200/80 bg-white/85 hover:border-amber-300 hover:bg-white shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.landing.proactiveTitle}
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {t.landing.proactiveDesc}
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark
                  ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-rose-500/30 hover:bg-zinc-900/90 shadow-xs'
                  : 'border-slate-200/80 bg-white/85 hover:border-rose-300 hover:bg-white shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.landing.teamTitle}
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {t.landing.teamDesc}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className={`relative z-10 border-t py-8 px-4 sm:px-6 transition-colors ${
          isDark ? 'border-zinc-800/80 bg-[#090D16]' : 'border-slate-200 bg-white'
        }`}
      >
        <div
          className={`max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
            isDark ? 'text-zinc-400' : 'text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <UrsellaLogo size="sm" />
            <span>{t.landing.footerTagline}</span>
          </div>

          <div className="flex items-center gap-4 font-medium">
            <button
              onClick={onNavigateSignIn}
              className={`transition-colors cursor-pointer ${
                isDark ? 'hover:text-white' : 'hover:text-slate-900'
              }`}
            >
              {t.landing.signIn}
            </button>
            <button
              onClick={onNavigateSignUp}
              className={`transition-colors cursor-pointer ${
                isDark ? 'hover:text-white' : 'hover:text-slate-900'
              }`}
            >
              {t.landing.signUp}
            </button>
            <button
              onClick={handleQuickDemo}
              className={`transition-colors cursor-pointer ${
                isDark ? 'hover:text-white' : 'hover:text-slate-900'
              }`}
            >
              {t.common.demoStore}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

