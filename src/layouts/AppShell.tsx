import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useBusiness } from '../contexts/BusinessContext.tsx';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { type AppNavRoute } from '../types/index.ts';
import { UrsellaLogo, UrsellaSymbolMark, UrsellaAIGlyph } from '../components/common/UrsellaLogo.tsx';
import { BusinessSwitcher } from '../components/business/BusinessSwitcher.tsx';
import { LanguageToggle } from '../components/common/LanguageToggle.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage.tsx';
import { NotificationDrawer } from '../components/notifications/NotificationDrawer.tsx';
import { MobileMenuDrawer } from '../components/navigation/MobileMenuDrawer.tsx';
import { FloatingActionButton } from '../components/common/FloatingActionButton.tsx';
import { FeedbackModal } from '../components/feedback/FeedbackModal.tsx';
import { OfflineSyncIndicator } from '../components/common/OfflineSyncCenter.tsx';
import { PWAInstallButton } from '../components/common/PWAInstallPrompt.tsx';
import { ProactiveService } from '../services/proactive.service.ts';
import type { AppNotification } from '../types/proactive.ts';
import {
  Home,
  ShoppingCart,
  Store,
  Users,
  BarChart3,
  Sparkles,
  MoreHorizontal,
  Plus,
  LogOut,
  Bell,
  CheckCircle2,
  Package,
  Receipt,
  UserPlus,
  Zap,
  Activity,
  FileText,
  Database,
  CreditCard,
  Menu,
  MessageSquare,
  History,
  MoreVertical,
  Sun,
  Moon,
} from 'lucide-react';

interface AppShellProps {
  currentRoute: AppNavRoute;
  onNavigate: (route: AppNavRoute) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentRoute,
  onNavigate,
  children,
}) => {
  const { user, profile, signOut } = useAuth();
  const { activeBusiness } = useBusiness();
  const { isDark, toggleTheme } = useTheme();
  const { language, t } = useLanguage();

  const [isNewBusinessModalOpen, setIsNewBusinessModalOpen] = useState(false);
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return null;
  });

  // Track dynamic visual viewport height on iOS / touch devices (accounts for keyboard & address bar shifts)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
      if (currentRoute === 'ai' && (window.scrollY !== 0 || window.scrollX !== 0)) {
        window.scrollTo(0, 0);
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateViewport);
      vv.addEventListener('scroll', updateViewport);
    }
    window.addEventListener('resize', updateViewport);
    window.addEventListener('scroll', updateViewport);

    updateViewport();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateViewport);
        vv.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('scroll', updateViewport);
    };
  }, [currentRoute]);

  // Lock iOS Safari window scrolling completely when on the AI Advisor route so the top nav bar NEVER scrolls away
  useEffect(() => {
    if (currentRoute !== 'ai') return;

    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyLeft = document.body.style.left;
    const originalBodyRight = document.body.style.right;
    const originalBodyWidth = document.body.style.width;
    const originalBodyHeight = document.body.style.height;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.position = 'fixed';
    document.body.style.top = '0px';
    document.body.style.left = '0px';
    document.body.style.right = '0px';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.scrollTo(0, 0);

    const lockScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('scroll', lockScroll, { passive: true });

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.left = originalBodyLeft;
      document.body.style.right = originalBodyRight;
      document.body.style.width = originalBodyWidth;
      document.body.style.height = originalBodyHeight;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('scroll', lockScroll);
    };
  }, [currentRoute]);

  // Keyboard visibility detection for bottom navigation bar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkKeyboard = () => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
      const vv = window.visualViewport;
      if (vv) {
        const screenH = window.screen?.height || window.innerHeight;
        // On iOS / mobile: if visual viewport shrinks significantly or input is active on AI page
        const isShrunk = (window.innerHeight - vv.height > 80) || (vv.height < screenH * 0.85);
        setIsKeyboardVisible(isInputActive && (isShrunk || currentRoute === 'ai'));
      } else {
        setIsKeyboardVisible(isInputActive);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
        if (!isInputActive) {
          setIsKeyboardVisible(false);
        }
      }, 100);
    };

    window.addEventListener('focusin', checkKeyboard);
    window.addEventListener('focusout', handleFocusOut);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', checkKeyboard);
    }

    return () => {
      window.removeEventListener('focusin', checkKeyboard);
      window.removeEventListener('focusout', handleFocusOut);
      if (vv) {
        vv.removeEventListener('resize', checkKeyboard);
      }
    };
  }, [currentRoute]);

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const loadNotifications = () => {
      ProactiveService.getNotifications(activeBusiness.id).then(setNotifications);
    };

    loadNotifications();
    window.addEventListener('ursella_notification_refresh', loadNotifications);
    const interval = setInterval(loadNotifications, 30000);

    return () => {
      window.removeEventListener('ursella_notification_refresh', loadNotifications);
      clearInterval(interval);
    };
  }, [activeBusiness?.id]);

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (!activeBusiness?.id) return;
    await ProactiveService.markAllNotificationsRead(activeBusiness.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (activeBusiness?.id) {
      await ProactiveService.deleteNotification(notificationId, activeBusiness.id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const handleClearAllNotifications = async () => {
    if (activeBusiness?.id) {
      await ProactiveService.clearAllNotifications(activeBusiness.id);
    }
    setNotifications([]);
  };

  const handleToggleReadNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeBusiness?.id) {
      await ProactiveService.toggleNotificationRead(notificationId, activeBusiness.id);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: !n.is_read } : n))
    );
  };

  const navItems: Array<{ route: AppNavRoute; label: string; icon: React.ReactNode }> = [
    { route: 'home', label: language === 'fr' ? 'Accueil' : 'Home', icon: <Home className="w-5 h-5" /> },
    { route: 'sell', label: language === 'fr' ? 'Caisse / Vente' : 'Sell / POS', icon: <ShoppingCart className="w-5 h-5" /> },
    { route: 'insights', label: language === 'fr' ? 'IA Proactive' : 'Proactive AI', icon: <Activity className="w-5 h-5 text-indigo-400" /> },
    { route: 'ai', label: 'Ursella AI', icon: <UrsellaAIGlyph sizeClass="w-5 h-5" /> },
    { route: 'analytics', label: language === 'fr' ? 'Analytique' : 'Analytics', icon: <BarChart3 className="w-5 h-5 text-emerald-400" /> },
    { route: 'reports', label: language === 'fr' ? 'Rapports' : 'Reports', icon: <FileText className="w-5 h-5 text-teal-400" /> },
    { route: 'business', label: language === 'fr' ? 'Stocks & Catalogue' : 'Business & Stock', icon: <Store className="w-5 h-5" /> },
    { route: 'customers', label: language === 'fr' ? 'Clients & CRM' : 'Customers & CRM', icon: <Users className="w-5 h-5" /> },
    { route: 'data-io', label: language === 'fr' ? 'Import / Export' : 'Data Hub', icon: <Database className="w-5 h-5 text-cyan-400" /> },
    { route: 'billing', label: language === 'fr' ? 'Abonnement' : 'Billing & Plan', icon: <CreditCard className="w-5 h-5 text-amber-400" /> },
    { route: 'more', label: language === 'fr' ? 'Paramètres' : 'Settings', icon: <MoreHorizontal className="w-5 h-5" /> },
  ];

  const handleNavWithHaptic = (routeTarget: AppNavRoute) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {}
    }
    onNavigate(routeTarget);
  };

  const handleQuickAction = (routeTarget: AppNavRoute) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    setIsQuickActionModalOpen(false);
    onNavigate(routeTarget);
  };

  // Check if current route is a "menu-tier" secondary page
  const isMenuSectionActive = ['insights', 'analytics', 'reports', 'customers', 'data-io', 'billing', 'more', 'expenses'].includes(currentRoute);

  return (
    <div
      className={`bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col md:flex-row ${
        currentRoute === 'ai' ? 'h-screen md:h-screen overflow-hidden' : 'min-h-screen'
      }`}
      style={{
        paddingTop: currentRoute === 'ai' ? '0px' : 'var(--offline-banner-height, 0px)',
        transition: 'padding-top 0.2s ease-out',
      }}
    >
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (Visible on md: screens and above)                        */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white dark:bg-zinc-900/90 border-r border-slate-200 dark:border-zinc-800/80 shrink-0 h-screen sticky top-0 z-30">
        {/* Brand Header */}
        <div className="p-5 pb-4 border-b border-slate-200 dark:border-zinc-800/80 flex items-center justify-between">
          <UrsellaLogo size="md" showBetaBadge={true} />
        </div>

        {/* Business Switcher */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800/80">
          <div className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider mb-2 px-1">
            {language === 'fr' ? 'Commerce Actif' : 'Active Tenant'}
          </div>
          <BusinessSwitcher
            onOpenNewBusinessModal={() => setIsNewBusinessModalOpen(true)}
          />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider mb-2.5 px-3">
            {language === 'fr' ? 'Modules Principaux' : 'Core Modules'}
          </div>
          {navItems.map((item) => {
            const isActive = currentRoute === item.route || (item.route === 'business' && currentRoute === 'expenses');
            return (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group relative active:scale-[0.99] ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/25 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`transition-colors ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shadow-xs" />
                )}
              </button>
            );
          })}
        </nav>

        {/* PWA Install Button in Desktop Sidebar */}
        <div className="px-4 pb-2">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* User Footer Profile & Settings Bar */}
        <div className="p-3.5 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-950/40 space-y-2.5">
          {/* Quick preferences row: Language & Theme Toggle */}
          <div className="flex items-center justify-between px-1">
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

          {/* Profile info and sign out */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white shrink-0 border border-slate-300 dark:border-zinc-600">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {profile?.full_name || (language === 'fr' ? 'Gérant' : 'Business User')}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title={t.navigation.logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA & TOPBAR                                                */}
      {/* ========================================================================= */}
      <div 
        className={`flex-1 flex flex-col min-w-0 min-h-0 ${
          currentRoute === 'ai' 
            ? 'fixed inset-0 z-20 md:relative md:inset-auto md:z-auto md:h-screen overflow-hidden' 
            : 'pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-8'
        }`}
        style={{
          height: currentRoute === 'ai' && viewportHeight ? `${viewportHeight}px` : undefined,
        }}
      >
        {/* Mobile Top Bar - Solid, pinned at top, safe for iPhone dynamic island and notch; never disappears */}
        <header 
          className="md:hidden shrink-0 w-full z-30 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 px-2.5 sm:px-3.5 py-2.5 flex items-center justify-between select-none"
          style={{
            paddingTop: 'max(0.625rem, calc(0.375rem + env(safe-area-inset-top, 0px)))',
          }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {currentRoute === 'ai' ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <UrsellaAIGlyph sizeClass="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                      Ursella AI
                    </span>
                  </div>
                  {activeBusiness?.name && (
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[120px] sm:max-w-[200px]">
                      {activeBusiness.name}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="shrink-0 flex items-center">
                <UrsellaLogo size="sm" showBetaBadge={true} />
              </div>
            )}
          </div>
          
          {/* Action buttons on right: On AI Advisor, strictly omit notification bell, feedback, and unrelated functions */}
          {currentRoute === 'ai' ? (
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('ursella_ai_toggle_history'))}
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                title="Chat History"
                aria-label="Chat History"
              >
                <History className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('ursella_ai_new_chat'))}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all active:scale-95 shadow-xs"
                title="New Chat"
                aria-label="New Chat"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline text-xs font-medium">New</span>
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('ursella_ai_toggle_options'))}
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                title="Chat Options"
                aria-label="Chat Options"
              >
                <MoreVertical className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <OfflineSyncIndicator />
              <button
                onClick={() => setIsFeedbackModalOpen(true)}
                className="hidden xs:flex p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Beta Feedback"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsNotificationDrawerOpen(true)}
                className="relative p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
                )}
              </button>
            </div>
          )}
        </header>

        {/* Desktop Top Header Bar for Notifications & Feedback - Hidden on AI route for full vertical canvas */}
        {currentRoute !== 'ai' && (
          <div className="hidden md:flex items-center justify-end px-8 py-3 border-b border-slate-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/40 shrink-0">
            <div className="flex items-center gap-2.5">
              <OfflineSyncIndicator />
              <PWAInstallButton variant="outline" />
              <button
                onClick={() => setIsFeedbackModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors border border-slate-200 dark:border-zinc-800"
                title="Beta Feedback"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Feedback</span>
              </button>
              <button
                onClick={() => setIsNotificationDrawerOpen(true)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors border border-slate-200 dark:border-zinc-800"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Page Body */}
        <main className={`flex-1 w-full min-h-0 ${
          currentRoute === 'ai' 
            ? 'p-0 max-w-none flex flex-col overflow-hidden' 
            : 'p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto'
        }`}>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                onOpenMobileMenu: () => setIsMobileMenuOpen(true),
                onOpenNotifications: () => setIsNotificationDrawerOpen(true),
                onOpenFeedback: () => setIsFeedbackModalOpen(true),
                unreadNotifCount,
              });
            }
            return child;
          })}
        </main>
      </div>

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        businessId={activeBusiness?.id}
        onMarkAllRead={handleMarkAllRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAll={handleClearAllNotifications}
        onToggleRead={handleToggleReadNotification}
        onSelectNotification={(notif) => {
          setIsNotificationDrawerOpen(false);
          if (notif.action_type === 'view_daily_brief' || notif.category === 'sales') {
            onNavigate('insights');
          } else if (notif.category === 'inventory') {
            onNavigate('business');
          } else if (notif.category === 'customers') {
            onNavigate('customers');
          } else {
            onNavigate('insights');
          }
        }}
      />

      {/* Mobile Slide-Out Menu Drawer */}
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentRoute={currentRoute}
        onNavigate={onNavigate}
        onOpenNewBusinessModal={() => setIsNewBusinessModalOpen(true)}
      />

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION: 5 Essential Tabs (Comfortable 64px Touch Area)  */}
      {/* ========================================================================= */}
      <nav 
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-slate-200/90 dark:border-zinc-800/90 px-1 py-1.5 flex items-center justify-around shadow-lg dark:shadow-2xl safe-area-bottom transition-all duration-200 ${
          isKeyboardVisible && currentRoute === 'ai' ? 'translate-y-full pointer-events-none opacity-0' : 'translate-y-0 opacity-100'
        }`}
        style={{
          paddingBottom: 'max(0.375rem, calc(0.25rem + env(safe-area-inset-bottom, 0px)))',
          paddingLeft: 'max(0.25rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.25rem, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* 1. Home Tab */}
        <button
          onClick={() => handleNavWithHaptic('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'home'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'home' ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none">Home</span>
        </button>

        {/* 2. Sell / POS Tab */}
        <button
          onClick={() => handleNavWithHaptic('sell')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'sell'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'sell' ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
            <ShoppingCart className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none truncate max-w-[65px] text-center">
            <span className="hidden xs:inline">Sell (POS)</span>
            <span className="xs:hidden">Sell</span>
          </span>
        </button>

        {/* 3. Center Quick Action (+) Button - Perfectly docked in center navigation */}
        <button
          onClick={() => {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(10); } catch {}
            }
            setIsQuickActionModalOpen(true);
          }}
          className="flex-1 flex flex-col items-center justify-center -mt-3 relative group"
          aria-label="Quick Business Actions"
        >
          <div className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 border-2 border-white dark:border-zinc-900 ring-2 ring-emerald-500/20 group-active:scale-95 transition-all">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-semibold text-emerald-700 dark:text-emerald-400">Actions</span>
        </button>

        {/* 4. AI Advisor / Ursella AI Tab */}
        <button
          onClick={() => handleNavWithHaptic('ai')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'ai'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'ai' ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
            <UrsellaAIGlyph
              sizeClass="w-5 h-5"
              theme={currentRoute === 'ai' ? 'default' : isDark ? 'mono-white' : 'mono-black'}
              className={currentRoute === 'ai' ? '' : isDark ? 'opacity-60' : 'opacity-80'}
            />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-medium truncate max-w-[65px] text-center">
            <span className="hidden xs:inline">Ursella AI</span>
            <span className="xs:hidden">AI</span>
          </span>
        </button>

        {/* 5. Menu Bar Drawer Trigger */}
        <button
          onClick={() => {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(8); } catch {}
            }
            setIsMobileMenuOpen(true);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            isMenuSectionActive
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg relative ${isMenuSectionActive ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
            <Menu className="w-5 h-5" />
            {isMenuSectionActive && (
              <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-none">Menu</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* FLOATING ACTION BUTTON (SPEED-DIAL FOR INSTANT OPERATIONAL ACCESS)         */}
      {/* ========================================================================= */}
      {currentRoute !== 'ai' && (
        <FloatingActionButton
          onNavigate={handleQuickAction}
          currentRoute={currentRoute}
        />
      )}

      {/* ========================================================================= */}
      {/* MODALS: Register New Business Modal                                       */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODALS: Quick Action Modal                                                */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isQuickActionModalOpen}
        onClose={() => setIsQuickActionModalOpen(false)}
        title="Quick Business Action"
        description="Launch an operational workflow immediately"
      >
        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            onClick={() => handleQuickAction('sell')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 border border-slate-200 dark:border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">New Sale (POS)</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">Record customer order</span>
          </button>

          <button
            onClick={() => handleQuickAction('business')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/70 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-300 dark:hover:border-blue-500/30 border border-slate-200 dark:border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Add Product</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">Update inventory list</span>
          </button>

          <button
            onClick={() => handleQuickAction('expenses')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/70 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/30 border border-slate-200 dark:border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Add Expense</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">Track outgoing cash</span>
          </button>

          <button
            onClick={() => handleQuickAction('customers')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/70 hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-300 dark:hover:border-purple-500/30 border border-slate-200 dark:border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">New Customer</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">Add debt & contact</span>
          </button>
        </div>
      </Modal>

      {/* Beta Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        businessId={activeBusiness?.id || ''}
      />
    </div>
  );
};

