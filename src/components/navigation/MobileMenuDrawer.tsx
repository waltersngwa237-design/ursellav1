import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import type { AppNavRoute } from '../../types/index.ts';
import { UrsellaLogo, UrsellaAIGlyph } from '../common/UrsellaLogo.tsx';
import { BusinessSwitcher } from '../business/BusinessSwitcher.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { PWAInstallButton } from '../common/PWAInstallPrompt.tsx';
import {
  X,
  Home,
  ShoppingCart,
  Store,
  Users,
  BarChart3,
  Sparkles,
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
  const { activeBusiness, activeRole } = useBusiness();
  const { theme, isDark, toggleTheme } = useTheme();

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
      title: 'Operations & Cash Register',
      items: [
        { route: 'home' as AppNavRoute, label: 'Dashboard Home', icon: <Home className="w-5 h-5" />, desc: 'Real-time sales & cash overview' },
        { route: 'sell' as AppNavRoute, label: 'Sell / POS Register', icon: <ShoppingCart className="w-5 h-5 text-emerald-400" />, desc: 'Instant checkout & receipt generator', badge: 'Active' },
        { route: 'business' as AppNavRoute, label: 'Stock & Catalog', icon: <Store className="w-5 h-5 text-blue-400" />, desc: 'Inventory, items & low stock warnings' },
        { route: 'customers' as AppNavRoute, label: 'Customers & CRM', icon: <Users className="w-5 h-5 text-purple-400" />, desc: 'Debtors book & purchase histories' },
      ],
    },
    {
      title: 'AI & Intelligence',
      items: [
        { route: 'ai' as AppNavRoute, label: 'Ursella AI', icon: <UrsellaAIGlyph sizeClass="w-5 h-5" />, desc: 'Voice & text business strategist', badge: 'AI' },
        { route: 'insights' as AppNavRoute, label: 'Proactive Intelligence', icon: <Activity className="w-5 h-5 text-indigo-400" />, desc: 'Live alerts, dead-stock & margin audit', badge: 'Live' },
        { route: 'analytics' as AppNavRoute, label: 'Sales & Analytics', icon: <BarChart3 className="w-5 h-5 text-emerald-400" />, desc: 'Revenue velocity & margin trends' },
        { route: 'reports' as AppNavRoute, label: 'Financial & Tax Reports', icon: <FileText className="w-5 h-5 text-teal-400" />, desc: 'P&L, Cash Flow, and Tax estimates' },
      ],
    },
    {
      title: 'System & Configuration',
      items: [
        { route: 'data-io' as AppNavRoute, label: 'Data Migration Hub', icon: <Database className="w-5 h-5 text-cyan-400" />, desc: 'Import CSVs & export complete backups' },
        { route: 'billing' as AppNavRoute, label: 'Subscription & Quota', icon: <CreditCard className="w-5 h-5 text-amber-400" />, desc: 'Manage plan, MoMo payments & AI tokens' },
        { route: 'more' as AppNavRoute, label: 'Business Settings', icon: <MoreHorizontal className="w-5 h-5 text-zinc-400" />, desc: 'Currencies, taxes, staff & security' },
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
      <div className="relative w-full max-w-[340px] bg-zinc-900 h-full flex flex-col shadow-2xl border-l border-zinc-800 z-10 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div 
          className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60"
          style={{
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <div className="flex items-center gap-2">
            <UrsellaLogo size="sm" showBetaBadge={true} />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tenant Switcher Section */}
        <div className="p-3.5 bg-zinc-950/40 border-b border-zinc-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 px-1">
            Current Business Workspace
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-2 mb-1.5">
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
                          ? 'bg-blue-600/15 text-blue-200 border border-blue-500/30'
                          : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-400'}`}>
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-600'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: User Profile, Theme & Sign Out */}
        <div 
          className="p-3.5 border-t border-zinc-800 bg-zinc-950/70 space-y-3"
          style={{
            paddingBottom: 'max(0.875rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {/* PWA Install Button */}
          <PWAInstallButton variant="sidebar" />

          {/* Quick theme pill switch */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              {isDark ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {isDark ? 'Dark Theme' : 'Light Theme'}
            </span>
            <button
              onClick={toggleTheme}
              className="text-[11px] font-bold text-emerald-400 hover:underline px-2 py-0.5 rounded bg-emerald-500/10"
            >
              Switch
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0 border border-zinc-600">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-100 truncate">
                  {profile?.full_name || 'Business Owner'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                signOut();
              }}
              title="Sign Out"
              className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/30 transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
