import React from 'react';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Button } from '../../components/common/Button.tsx';
import { ThemeToggle } from '../../components/common/ThemeToggle.tsx';
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
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const handleQuickDemo = async () => {
    try {
      await startInstantDemo();
    } catch (err) {
      console.warn('Instant demo launch warning:', err);
    }
  };

  return (
    <div className={`relative min-h-screen flex flex-col selection:bg-emerald-500/20 selection:text-emerald-500 overflow-x-hidden transition-colors ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Background Atmospheric Photography Asset */}
      <div 
        className={`fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${
          isDark ? 'opacity-30' : 'opacity-20 mix-blend-multiply'
        }`}
        style={{ backgroundImage: `url('/shared_link_bg.jpg')` }}
      />
      {/* Multi-layered cinematic gradient overlays for pristine readability + visual depth */}
      <div 
        className={`fixed inset-0 z-0 pointer-events-none transition-colors duration-500 ${
          isDark 
            ? 'bg-gradient-to-b from-zinc-950/75 via-zinc-950/90 to-zinc-950' 
            : 'bg-gradient-to-b from-slate-50/80 via-slate-50/92 to-slate-50'
        }`} 
      />
      {/* Subtle radial emerald spotlight glow */}
      <div 
        className={`fixed inset-0 z-0 pointer-events-none ${
          isDark 
            ? 'bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(16,185,129,0.14),transparent_70%)]' 
            : 'bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(16,185,129,0.08),transparent_70%)]'
        }`} 
      />

      {/* Top Navigation */}
      <header 
        className={`relative z-30 sticky top-0 w-full border-b backdrop-blur-md transition-colors ${
          isDark 
            ? 'border-zinc-800/80 bg-zinc-950/85 shadow-sm' 
            : 'border-slate-200/80 bg-white/85 shadow-xs'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <UrsellaLogo size="md" />

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Toggle */}
            <LanguageToggle variant="pill" className="shrink-0" />

            {/* Theme Toggle */}
            <ThemeToggle variant="icon" className="shrink-0" />

            <button
              onClick={handleQuickDemo}
              disabled={loading}
              className={`hidden sm:inline-flex text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                isDark 
                  ? 'text-zinc-300 hover:text-white hover:bg-zinc-900 border-zinc-800' 
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-300'
              }`}
            >
              {t.common.demoStore}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateSignIn}
              className={`text-xs ${
                isDark ? 'text-zinc-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {t.landing.signIn}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateSignUp}
              className="text-xs font-bold"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {t.landing.signUp}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 text-center">
          {/* Subtle Tag */}
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs mb-6 shadow-xs animate-in fade-in duration-500 ${
            isDark 
              ? 'bg-zinc-900 border-emerald-500/30 text-zinc-200' 
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{t.landing.heroTag}</span>
          </div>

          {/* Headline */}
          <h1 className={`text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight sm:leading-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {t.landing.heroTitle}
          </h1>

          {/* Subtitle */}
          <p className={`mt-5 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed ${
            isDark ? 'text-zinc-300' : 'text-slate-600'
          }`}>
            <strong className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>Ursella</strong> {t.landing.heroSubtitle}
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={onNavigateSignUp}
              className="w-full sm:w-auto px-7 py-3 text-sm font-bold shadow-md shadow-emerald-500/20"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {t.landing.createAccount}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={handleQuickDemo}
              isLoading={loading}
              className={`w-full sm:w-auto px-6 py-3 text-sm font-medium ${
                isDark 
                  ? 'text-zinc-200 hover:text-white bg-zinc-900 border-zinc-800' 
                  : 'text-slate-700 hover:text-slate-900 bg-white border-slate-300'
              }`}
            >
              {t.landing.exploreDemo}
            </Button>
          </div>

          <div className={`mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs ${
            isDark ? 'text-zinc-400' : 'text-slate-600'
          }`}>
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

        {/* Product Snapshot / Visual Bento */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <div className={`rounded-2xl border p-4 sm:p-6 shadow-2xl backdrop-blur-md transition-all ${
            isDark 
              ? 'border-zinc-800/80 bg-zinc-900/80 shadow-black/40' 
              : 'border-slate-200/80 bg-white/90 shadow-slate-200/60'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Fast POS */}
              <div className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark 
                  ? 'border-zinc-800/80 bg-zinc-950/70 hover:border-emerald-500/40 hover:bg-zinc-950/90' 
                  : 'border-slate-200/80 bg-slate-50/80 hover:border-emerald-400 hover:bg-white'
              }`}>
                <div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3.5 transition-transform group-hover:scale-105 ${
                    isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t.landing.posFeatureTitle}
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {t.landing.posFeatureDesc}
                  </p>
                </div>
                <div className={`mt-4 pt-3 border-t text-xs font-semibold flex items-center justify-between ${
                  isDark ? 'border-zinc-900/90 text-emerald-400' : 'border-slate-200/90 text-emerald-700'
                }`}>
                  <span>{t.landing.posFeatureMetric}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 2: Inventory & FIFO */}
              <div className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark 
                  ? 'border-zinc-800/80 bg-zinc-950/70 hover:border-indigo-500/40 hover:bg-zinc-950/90' 
                  : 'border-slate-200/80 bg-slate-50/80 hover:border-indigo-400 hover:bg-white'
              }`}>
                <div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3.5 transition-transform group-hover:scale-105 ${
                    isDark ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  }`}>
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t.landing.fifoFeatureTitle}
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {t.landing.fifoFeatureDesc}
                  </p>
                </div>
                <div className={`mt-4 pt-3 border-t text-xs font-semibold flex items-center justify-between ${
                  isDark ? 'border-zinc-900/90 text-indigo-400' : 'border-slate-200/90 text-indigo-700'
                }`}>
                  <span>{t.landing.fifoFeatureMetric}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 3: Real-Time Cash Flow */}
              <div className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 group ${
                isDark 
                  ? 'border-zinc-800/80 bg-zinc-950/70 hover:border-teal-500/40 hover:bg-zinc-950/90' 
                  : 'border-slate-200/80 bg-slate-50/80 hover:border-teal-400 hover:bg-white'
              }`}>
                <div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3.5 transition-transform group-hover:scale-105 ${
                    isDark ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20' : 'bg-teal-100 text-teal-700 border border-teal-200'
                  }`}>
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t.landing.financeFeatureTitle}
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {t.landing.financeFeatureDesc}
                  </p>
                </div>
                <div className={`mt-4 pt-3 border-t text-xs font-semibold flex items-center justify-between ${
                  isDark ? 'border-zinc-900/90 text-teal-400' : 'border-slate-200/90 text-teal-700'
                }`}>
                  <span>{t.landing.financeFeatureMetric}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>

            {/* AI Advisor Preview Ribbon */}
            <div className={`mt-4 rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition-all ${
              isDark 
                ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-zinc-900/80 to-zinc-950/70 shadow-sm' 
                : 'border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 shadow-xs'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t.landing.aiBannerTitle}
                  </h4>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    {t.landing.aiBannerDesc}
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={onNavigateSignIn}
                className="text-xs whitespace-nowrap self-end sm:self-auto font-semibold shadow-xs"
              >
                {t.landing.aiBannerBtn}
              </Button>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className={`max-w-5xl mx-auto px-4 sm:px-6 pb-20 border-t pt-14 transition-colors ${
          isDark ? 'border-zinc-800/80' : 'border-slate-200'
        }`}>
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.landing.featuresTitle}
            </h2>
            <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
              isDark 
                ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-emerald-500/30 hover:bg-zinc-900/90 shadow-sm' 
                : 'border-slate-200/80 bg-white/85 hover:border-emerald-300 hover:bg-white shadow-xs'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
              }`}>
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.landing.receiptsTitle}</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {t.landing.receiptsDesc}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
              isDark 
                ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-indigo-500/30 hover:bg-zinc-900/90 shadow-sm' 
                : 'border-slate-200/80 bg-white/85 hover:border-indigo-300 hover:bg-white shadow-xs'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-200/60'
              }`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.landing.momoTitle}</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {t.landing.momoDesc}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
              isDark 
                ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-teal-500/30 hover:bg-zinc-900/90 shadow-sm' 
                : 'border-slate-200/80 bg-white/85 hover:border-teal-300 hover:bg-white shadow-xs'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                isDark ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-50 text-teal-600 border border-teal-200/60'
              }`}>
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.landing.pnlTitle}</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {t.landing.pnlDesc}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
              isDark 
                ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-emerald-500/30 hover:bg-zinc-900/90 shadow-sm' 
                : 'border-slate-200/80 bg-white/85 hover:border-emerald-300 hover:bg-white shadow-xs'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
              }`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.landing.securityTitle}</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {t.landing.securityDesc}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
              isDark 
                ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-amber-500/30 hover:bg-zinc-900/90 shadow-sm' 
                : 'border-slate-200/80 bg-white/85 hover:border-amber-300 hover:bg-white shadow-xs'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200/60'
              }`}>
                <Zap className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.landing.proactiveTitle}</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {t.landing.proactiveDesc}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group ${
              isDark 
                ? 'border-zinc-800/80 bg-zinc-900/70 hover:border-rose-500/30 hover:bg-zinc-900/90 shadow-sm' 
                : 'border-slate-200/80 bg-white/85 hover:border-rose-300 hover:bg-white shadow-xs'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                isDark ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-rose-50 text-rose-600 border border-rose-200/60'
              }`}>
                <Users className="w-5 h-5" />
              </div>
              <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.landing.teamTitle}</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {t.landing.teamDesc}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={`relative z-10 border-t py-8 px-4 sm:px-6 transition-colors ${
        isDark ? 'border-zinc-800/80 bg-zinc-950' : 'border-slate-200 bg-white'
      }`}>
        <div className={`max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
          isDark ? 'text-zinc-400' : 'text-slate-600'
        }`}>
          <div className="flex items-center gap-2">
            <UrsellaLogo size="sm" />
            <span>{t.landing.footerTagline}</span>
          </div>

          <div className="flex items-center gap-4 font-medium">
            <LanguageToggle variant="pill" />
            <button onClick={onNavigateSignIn} className={`transition-colors ${
              isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}>
              {t.landing.signIn}
            </button>
            <button onClick={onNavigateSignUp} className={`transition-colors ${
              isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}>
              {t.landing.signUp}
            </button>
            <button onClick={handleQuickDemo} className={`transition-colors ${
              isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}>
              {t.common.demoStore}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
