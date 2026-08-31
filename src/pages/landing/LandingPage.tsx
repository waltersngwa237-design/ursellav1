import React from 'react';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Button } from '../../components/common/Button.tsx';
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
  Download,
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

  const handleQuickDemo = async () => {
    try {
      await signIn('owner@ursella-demo.com', 'ursella2026!');
    } catch (err) {
      console.warn('Demo login redirected to signin:', err);
      onNavigateSignIn();
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300 overflow-x-hidden">
      {/* Background Graphic Asset for Shared Links & Visitors */}
      <div 
        className="absolute inset-0 z-0 opacity-25 pointer-events-none bg-cover bg-center bg-no-repeat fixed"
        style={{ backgroundImage: `url('/shared_link_bg.jpg')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/95 to-zinc-950 pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-30 sticky top-0 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <UrsellaLogo size="md" />

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={handleQuickDemo}
              disabled={loading}
              className="hidden sm:inline-flex text-xs font-semibold px-3 py-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
            >
              Demo Store
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateSignIn}
              className="text-xs text-zinc-300 hover:text-white"
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
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 text-center">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-emerald-500/30 text-xs text-zinc-300 mb-6 backdrop-blur-md shadow-lg shadow-emerald-950/30 animate-in fade-in duration-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">Modern Operating Co-pilot for Local Businesses</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight sm:leading-tight">
            The simple way to run sales, track stock, and manage your business.
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            <strong className="text-zinc-200 font-semibold">Ursella</strong> unites rapid POS checkout, FIFO stock audits, customer credit reminders, and daily financial intelligence in one focused workspace.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={onNavigateSignUp}
              className="w-full sm:w-auto px-7 py-3 text-sm font-bold shadow-lg shadow-emerald-950/40"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Free Account
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={handleQuickDemo}
              isLoading={loading}
              className="w-full sm:w-auto px-6 py-3 text-sm text-zinc-300 hover:text-white"
            >
              Explore Interactive Demo
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-currency support</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Offline-ready PWA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>No credit card required</span>
            </div>
          </div>
        </section>

        {/* Product Snapshot / Visual Bento */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Fast POS */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Rapid POS & Mobile Money</h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Designed for fast counter checkout, partial split payments, barcode scanner input, and instant WhatsApp receipts.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-900 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span>Record sales in &lt; 3 seconds</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Card 2: Inventory & FIFO */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Automated Stock & Margins</h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Tracks true cost of goods sold with FIFO layer calculations, low-stock threshold alerts, and expiry warnings.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-900 text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
                  <span>Zero manual stock reconciliations</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Card 3: Real-Time Cash Flow */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Daily Financial Clarity</h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Instant cash position, debtors ledger, operational expense tracking, and deterministic net profit margins.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-900 text-[11px] text-teal-400 font-semibold flex items-center gap-1">
                  <span>Real-time profit & loss</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* AI Advisor Preview Ribbon */}
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Built-in AI Financial Co-pilot
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Ask questions like <em>"What were my top sellers today?"</em> or get automated alerts when margins fluctuate.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={onNavigateSignIn}
                className="text-xs whitespace-nowrap self-end sm:self-auto"
              >
                Sign In to Ursella
              </Button>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 border-t border-zinc-800/60 pt-16">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Built for real retail, distribution, and service stores.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Everything you need to maintain healthy cash flow and stop revenue leakage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
              <Receipt className="w-5 h-5 text-emerald-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Digital Receipts</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Print via standard thermal receipt printers or share instant invoice receipts with customers via WhatsApp.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
              <Smartphone className="w-5 h-5 text-indigo-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Mobile Money & Cash</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Seamless support for local cash collections, Mobile Money transfers, and multi-tender payments.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
              <BarChart3 className="text-xs w-5 h-5 text-teal-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Profit & Loss Reports</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Deterministic calculation of gross revenue, COGS, operating expenses, and net profit margins.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Multi-Tenant Isolation</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Each store runs in a secure, isolated database tenancy with enterprise-grade row-level security.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
              <Zap className="w-5 h-5 text-amber-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Proactive Health Checks</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Continuous anomaly monitoring flags slow-moving stock, overdue debtors, and sudden expense spikes.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
              <Users className="w-5 h-5 text-rose-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Team & Role Access</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Add Cashiers, Store Managers, and Accountants with granular view and POS checkout permissions.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/80 bg-zinc-950/90 py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <UrsellaLogo size="sm" />
            <span>— Operating Intelligence Platform for Modern Commerce</span>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onNavigateSignIn} className="hover:text-white transition-colors">
              Sign In
            </button>
            <button onClick={onNavigateSignUp} className="hover:text-white transition-colors">
              Create Account
            </button>
            <button onClick={handleQuickDemo} className="hover:text-white transition-colors">
              Live Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
