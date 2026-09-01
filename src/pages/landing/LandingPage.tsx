import React from 'react';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Button } from '../../components/common/Button.tsx';
import { ThemeToggle } from '../../components/common/ThemeToggle.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
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
  const { signIn, loading } = useAuth();
  const { isDark } = useTheme();

  const handleQuickDemo = async () => {
    try {
      await signIn('owner@ursella-demo.com', 'ursella2026!');
    } catch (err) {
      console.warn('Demo login redirected to signin:', err);
      onNavigateSignIn();
    }
  };

  return (
    <div className={`relative min-h-screen flex flex-col selection:bg-emerald-500/20 selection:text-emerald-500 overflow-x-hidden transition-colors ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Background Graphic Asset with clean, non-distorting layer */}
      <div 
        className={`absolute inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat transition-opacity duration-300 ${
          isDark ? 'opacity-10' : 'opacity-[0.03]'
        }`}
        style={{ backgroundImage: `url('/shared_link_bg.jpg')` }}
      />
      {/* Solid contrast wash gradient to ensure all text stays 100% crisp and readable */}
      <div 
        className={`absolute inset-0 z-0 pointer-events-none transition-colors ${
          isDark 
            ? 'bg-gradient-to-b from-zinc-950/95 via-zinc-950/98 to-zinc-950' 
            : 'bg-gradient-to-b from-slate-50/95 via-slate-50/98 to-slate-50'
        }`} 
      />

      {/* Top Navigation */}
      <header className={`relative z-30 sticky top-0 w-full border-b transition-colors ${
        isDark 
          ? 'border-zinc-800/80 bg-zinc-950/95' 
          : 'border-slate-200 bg-white/95'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <UrsellaLogo size="md" />

          <div className="flex items-center gap-2 sm:gap-3">
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
              Demo Store
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateSignIn}
              className={`text-xs ${
                isDark ? 'text-zinc-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateSignUp}
              className="text-xs font-bold"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Get Started
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
            <span className="font-medium">Modern Operating Co-pilot for Local Businesses</span>
          </div>

          {/* Headline */}
          <h1 className={`text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight sm:leading-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            The simple way to run sales, track stock, and manage your business.
          </h1>

          {/* Subtitle */}
          <p className={`mt-5 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed ${
            isDark ? 'text-zinc-300' : 'text-slate-600'
          }`}>
            <strong className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>Ursella</strong> unites rapid POS checkout, FIFO stock audits, customer credit reminders, and daily financial intelligence in one focused workspace.
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
              Create Free Account
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
              Explore Interactive Demo
            </Button>
          </div>

          <div className={`mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs ${
            isDark ? 'text-zinc-400' : 'text-slate-600'
          }`}>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Multi-currency support</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Offline-ready PWA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>No credit card required</span>
            </div>
          </div>
        </section>

        {/* Product Snapshot / Visual Bento */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <div className={`rounded-2xl border p-4 sm:p-6 shadow-xl transition-colors ${
            isDark 
              ? 'border-zinc-800 bg-zinc-900' 
              : 'border-slate-200 bg-white'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Fast POS */}
              <div className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-colors ${
                isDark 
                  ? 'border-zinc-800/90 bg-zinc-950' 
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                    isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Rapid POS & Mobile Money
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    Designed for fast counter checkout, partial split payments, barcode scanner input, and instant WhatsApp receipts.
                  </p>
                </div>
                <div className={`mt-4 pt-3 border-t text-xs font-semibold flex items-center gap-1 ${
                  isDark ? 'border-zinc-900 text-emerald-400' : 'border-slate-200 text-emerald-700'
                }`}>
                  <span>Record sales in &lt; 3 seconds</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Card 2: Inventory & FIFO */}
              <div className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-colors ${
                isDark 
                  ? 'border-zinc-800/90 bg-zinc-950' 
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                    isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Automated Stock & Margins
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    Tracks true cost of goods sold with FIFO layer calculations, low-stock threshold alerts, and expiry warnings.
                  </p>
                </div>
                <div className={`mt-4 pt-3 border-t text-xs font-semibold flex items-center gap-1 ${
                  isDark ? 'border-zinc-900 text-indigo-400' : 'border-slate-200 text-indigo-700'
                }`}>
                  <span>Zero manual stock reconciliations</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Card 3: Real-Time Cash Flow */}
              <div className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-colors ${
                isDark 
                  ? 'border-zinc-800/90 bg-zinc-950' 
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                    isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-100 text-teal-700'
                  }`}>
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Daily Financial Clarity
                  </h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    Instant cash position, debtors ledger, operational expense tracking, and deterministic net profit margins.
                  </p>
                </div>
                <div className={`mt-4 pt-3 border-t text-xs font-semibold flex items-center gap-1 ${
                  isDark ? 'border-zinc-900 text-teal-400' : 'border-slate-200 text-teal-700'
                }`}>
                  <span>Real-time profit & loss</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* AI Advisor Preview Ribbon */}
            <div className={`mt-4 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
              isDark 
                ? 'border-amber-500/30 bg-amber-950/20' 
                : 'border-amber-300 bg-amber-50/70'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Built-in AI Financial Co-pilot
                  </h4>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    Ask questions like <em>&quot;What were my top sellers today?&quot;</em> or get automated alerts when margins fluctuate.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={onNavigateSignIn}
                className="text-xs whitespace-nowrap self-end sm:self-auto font-medium"
              >
                Sign In to Ursella
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
              Built for real retail, distribution, and service stores.
            </h2>
            <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              Everything you need to maintain healthy cash flow and stop revenue leakage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border transition-colors ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <Receipt className={`w-5 h-5 mb-2.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Digital Receipts</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Print via standard thermal receipt printers or share instant invoice receipts with customers via WhatsApp.
              </p>
            </div>

            <div className={`p-4 rounded-xl border transition-colors ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <Smartphone className={`w-5 h-5 mb-2.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Mobile Money & Cash</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Seamless support for local cash collections, Mobile Money transfers, and multi-tender payments.
              </p>
            </div>

            <div className={`p-4 rounded-xl border transition-colors ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <BarChart3 className={`w-5 h-5 mb-2.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
              <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Profit & Loss Reports</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Deterministic calculation of gross revenue, COGS, operating expenses, and net profit margins.
              </p>
            </div>

            <div className={`p-4 rounded-xl border transition-colors ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <ShieldCheck className={`w-5 h-5 mb-2.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Multi-Tenant Isolation</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Each store runs in a secure, isolated database tenancy with enterprise-grade row-level security.
              </p>
            </div>

            <div className={`p-4 rounded-xl border transition-colors ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <Zap className={`w-5 h-5 mb-2.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
              <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Proactive Health Checks</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Continuous anomaly monitoring flags slow-moving stock, overdue debtors, and sudden expense spikes.
              </p>
            </div>

            <div className={`p-4 rounded-xl border transition-colors ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <Users className={`w-5 h-5 mb-2.5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
              <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Team & Role Access</h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Add Cashiers, Store Managers, and Accountants with granular view and POS checkout permissions.
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
            <span>— Operating Intelligence Platform for Modern Commerce</span>
          </div>

          <div className="flex items-center gap-4 font-medium">
            <button onClick={onNavigateSignIn} className={`transition-colors ${
              isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}>
              Sign In
            </button>
            <button onClick={onNavigateSignUp} className={`transition-colors ${
              isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}>
              Create Account
            </button>
            <button onClick={handleQuickDemo} className={`transition-colors ${
              isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}>
              Live Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
