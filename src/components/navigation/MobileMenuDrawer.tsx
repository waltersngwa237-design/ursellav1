import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import type { AppNavRoute } from '../../types/index.ts';
import { UrsellaLogo, UrsellaAIGlyph } from '../common/UrsellaLogo.tsx';
import { BusinessSwitcher } from '../business/BusinessSwitcher.tsx';
import { LanguageToggle } from '../common/LanguageToggle.tsx';
import { PWAInstallButton } from '../common/PWAInstallPrompt.tsx';
import {
  X,
  Home,
  ShoppingCart,
  Store,
  Users,
  BarChart3,
  FileText,
  Database,
  CreditCard,
  MoreHorizontal,
  LogOut,
  Activity,
  Sun,
  Moon,
  ChevronRight,
} from 'lucide-react';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: AppNavRoute;
  onNavigate: (route: AppNavRoute) => void;
  onOpenNewBusinessModal: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  currentRoute,
  onNavigate,
  onOpenNewBusinessModal,
}) => {
  const { user, profile, signOut } = useAuth();
  const { activeBusiness } = useBusiness();
  const { isDark, toggleTheme } = useTheme();
  const { language, t } = useLanguage();

  const onCloseRef = React.useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleItemClick = (route: AppNavRoute) => {
    onNavigate(route);
    onClose();
  };

  const navSections = [
    {
      title: language === 'fr' ? 'Opérations & Caisse' : 'Operations & Cash Register',
      items: [
        {
          route: 'home' as AppNavRoute,
          label: t.navigation.home,
          icon: <Home className="w-5 h-5" />,
          desc: language === 'fr' ? 'Vue d’ensemble des ventes & trésorerie' : 'Real-time sales & cash overview',
        },
        {
          route: 'sell' as AppNavRoute,
          label: t.navigation.sell,
          icon: <ShoppingCart className="w-5 h-5 text-emerald-400" />,
          desc: language === 'fr' ? 'Encaissement rapide & impression de reçus' : 'Instant checkout & receipt generator',
          badge: language === 'fr' ? 'Caisse' : 'Active',
        },
        {
          route: 'business' as AppNavRoute,
          label: t.navigation.inventory,
          icon: <Store className="w-5 h-5 text-blue-400" />,
          desc: language === 'fr' ? 'Articles, valorisation PEPS & alertes stock' : 'Inventory, items & low stock warnings',
        },
        {
          route: 'customers' as AppNavRoute,
          label: t.navigation.customers,
          icon: <Users className="w-5 h-5 text-purple-400" />,
          desc: language === 'fr' ? 'Carnet de dettes, relances & historiques' : 'Debtors book & purchase histories',
        },
      ],
    },
    {
      title: language === 'fr' ? 'IA & Intelligence' : 'AI & Intelligence',
      items: [
        {
          route: 'ai' as AppNavRoute,
          label: t.navigation.aiAdvisor,
          icon: <UrsellaAIGlyph sizeClass="w-5 h-5" />,
          desc: language === 'fr' ? 'Conseiller financier vocal & textuel' : 'Voice & text business strategist',
          badge: 'AI',
        },
        {
          route: 'insights' as AppNavRoute,
          label: t.navigation.proactiveAI,
          icon: <Activity className="w-5 h-5 text-indigo-400" />,
          desc: language === 'fr' ? 'Alertes directes, stock dormant & audit de marge' : 'Live alerts, dead-stock & margin audit',
          badge: 'Live',
        },
        {
          route: 'analytics' as AppNavRoute,
          label: t.navigation.analytics,
          icon: <BarChart3 className="w-5 h-5 text-emerald-400" />,
          desc: language === 'fr' ? 'Vélocité des ventes & tendances de marge' : 'Revenue velocity & margin trends',
        },
        {
          route: 'reports' as AppNavRoute,
          label: t.navigation.reports,
          icon: <FileText className="w-5 h-5 text-teal-400" />,
          desc: language === 'fr' ? 'Compte de résultat (P&L), trésorerie et taxes' : 'P&L, Cash Flow, and Tax estimates',
        },
      ],
    },
    {
      title: language === 'fr' ? 'Système & Configuration' : 'System & Configuration',
      items: [
        {
          route: 'data-io' as AppNavRoute,
          label: t.navigation.dataHub,
          icon: <Database className="w-5 h-5 text-cyan-400" />,
          desc: language === 'fr' ? 'Import CSV et sauvegardes complètes' : 'Import CSVs & export complete backups',
        },
        {
          route: 'billing' as AppNavRoute,
          label: t.navigation.billing,
          icon: <CreditCard className="w-5 h-5 text-amber-400" />,
          desc: language === 'fr' ? 'Forfait, Mobile Money & quotas IA' : 'Manage plan, MoMo payments & AI tokens',
        },
        {
          route: 'more' as AppNavRoute,
          label: t.navigation.settings,
          icon: <MoreHorizontal className="w-5 h-5 text-zinc-400" />,
          desc: language === 'fr' ? 'Devises, taxes, langue, équipe & sécurité' : 'Currencies, taxes, staff & security',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-[340px] bg-white dark:bg-zinc-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-zinc-800 z-10 overflow-hidden animate-in slide-in-from-right duration-200 text-slate-900 dark:text-zinc-100">
        {/* Drawer Header */}
        <div 
          className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-950/60"
          style={{
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <UrsellaLogo size="sm" showBetaBadge={true} />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tenant Switcher Section */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-200 dark:border-zinc-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 px-1">
            {language === 'fr' ? 'Commerce Actif' : 'Current Business Workspace'}
          </div>
          <BusinessSwitcher onOpenNewBusinessModal={() => {
            onClose();
            onOpenNewBusinessModal();
          }} />
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-2 mb-1.5">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = currentRoute === item.route || (item.route === 'business' && currentRoute === 'expenses');
                  return (
                    <button
                      key={item.route}
                      onClick={() => handleItemClick(item.route)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/70 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-600'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: User Profile, Language, Theme & Sign Out */}
        <div 
          className="p-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/70 space-y-3"
          style={{
            paddingBottom: 'max(0.875rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {/* PWA Install Button */}
          <PWAInstallButton variant="sidebar" />

          {/* Quick preferences row: Language & Theme Toggle */}
          <div className="flex items-center justify-between py-1 px-1 border-t border-b border-slate-200/60 dark:border-zinc-800/60">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              {language === 'fr' ? 'Langue & Thème' : 'Language & Theme'}
            </span>
            <div className="flex items-center gap-2">
              <LanguageToggle variant="pill" />
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title={isDark ? 'Switch to Light Mode' : 'Passer en Mode Sombre'}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white shrink-0 border border-slate-300 dark:border-zinc-600">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {profile?.full_name || (language === 'fr' ? 'Gérant' : 'Business Owner')}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                signOut();
              }}
              title={t.navigation.logout}
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
