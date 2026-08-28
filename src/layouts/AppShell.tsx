import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useBusiness } from '../contexts/BusinessContext.tsx';
import { type AppNavRoute } from '../types/index.ts';
import { UrsellaLogo } from '../components/common/UrsellaLogo.tsx';
import { BusinessSwitcher } from '../components/business/BusinessSwitcher.tsx';
import { Modal } from '../components/common/Modal.tsx';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage.tsx';
import { NotificationDrawer } from '../components/notifications/NotificationDrawer.tsx';
import { MobileMenuDrawer } from '../components/navigation/MobileMenuDrawer.tsx';
import { FloatingActionButton } from '../components/common/FloatingActionButton.tsx';
import { FeedbackModal } from '../components/feedback/FeedbackModal.tsx';
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

  const [isNewBusinessModalOpen, setIsNewBusinessModalOpen] = useState(false);
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (activeBusiness?.id) {
      ProactiveService.getNotifications(activeBusiness.id).then(setNotifications);
    }
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: !n.is_read } : n))
    );
  };

  const navItems: Array<{ route: AppNavRoute; label: string; icon: React.ReactNode }> = [
    { route: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { route: 'sell', label: 'Sell / POS', icon: <ShoppingCart className="w-5 h-5" /> },
    { route: 'insights', label: 'Proactive AI', icon: <Activity className="w-5 h-5 text-indigo-400" /> },
    { route: 'ai', label: 'AI Advisor', icon: <Sparkles className="w-5 h-5 text-amber-400" /> },
    { route: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5 text-emerald-400" /> },
    { route: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5 text-teal-400" /> },
    { route: 'business', label: 'Business & Stock', icon: <Store className="w-5 h-5" /> },
    { route: 'customers', label: 'Customers & CRM', icon: <Users className="w-5 h-5" /> },
    { route: 'data-io', label: 'Data Hub', icon: <Database className="w-5 h-5 text-cyan-400" /> },
    { route: 'billing', label: 'Billing & Plan', icon: <CreditCard className="w-5 h-5 text-amber-400" /> },
    { route: 'more', label: 'Settings', icon: <MoreHorizontal className="w-5 h-5" /> },
  ];

  const handleQuickAction = (routeTarget: AppNavRoute) => {
    setIsQuickActionModalOpen(false);
    onNavigate(routeTarget);
  };

  // Check if current route is a "menu-tier" secondary page
  const isMenuSectionActive = ['insights', 'analytics', 'reports', 'customers', 'data-io', 'billing', 'more'].includes(currentRoute);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (Visible on md: screens and above)                        */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-zinc-900/90 border-r border-zinc-800/80 shrink-0 h-screen sticky top-0 z-30">
        {/* Brand Header */}
        <div className="p-5 pb-4 border-b border-zinc-800/80 flex items-center justify-between">
          <UrsellaLogo size="md" showBetaBadge={true} />
        </div>

        {/* Business Switcher */}
        <div className="p-4 border-b border-zinc-800/80">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
            Active Tenant
          </div>
          <BusinessSwitcher
            onOpenNewBusinessModal={() => setIsNewBusinessModalOpen(true)}
          />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-3">
            Core Modules
          </div>
          {navItems.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-950/20'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`${
                      isActive ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-200'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* User Footer Profile & Sign Out */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center text-xs font-bold text-white shrink-0 border border-zinc-600">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-100 truncate">
                  {profile?.full_name || 'Business User'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA & TOPBAR                                                */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Mobile Top Bar */}
        <header className="md:hidden sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:scale-95 transition-all"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-zinc-300" />
            </button>
            <UrsellaLogo size="sm" showBetaBadge={true} />
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Beta Feedback"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="relative p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-zinc-950" />
              )}
            </button>
          </div>
        </header>

        {/* Desktop Top Header Bar for Notifications & Feedback */}
        <div className="hidden md:flex items-center justify-end px-8 py-3 border-b border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors border border-zinc-800"
              title="Beta Feedback"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Feedback</span>
            </button>
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="relative p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors border border-zinc-800"
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

        {/* Page Body */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAll={handleClearAllNotifications}
        onToggleRead={handleToggleReadNotification}
        onSelectNotification={(notif) => {
          setIsNotificationDrawerOpen(false);
          onNavigate('insights');
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800/90 px-1 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
        {/* 1. Home Tab */}
        <button
          onClick={() => onNavigate('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'home'
              ? 'text-emerald-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'home' ? 'bg-emerald-500/10' : ''}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none">Home</span>
        </button>

        {/* 2. Sell / POS Tab */}
        <button
          onClick={() => onNavigate('sell')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'sell'
              ? 'text-emerald-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'sell' ? 'bg-emerald-500/10' : ''}`}>
            <ShoppingCart className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none">Sell (POS)</span>
        </button>

        {/* 3. Stock / Catalog Tab */}
        <button
          onClick={() => onNavigate('business')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'business'
              ? 'text-emerald-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'business' ? 'bg-emerald-500/10' : ''}`}>
            <Store className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none">Stock</span>
        </button>

        {/* 4. AI Advisor Tab */}
        <button
          onClick={() => onNavigate('ai')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            currentRoute === 'ai'
              ? 'text-amber-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentRoute === 'ai' ? 'bg-amber-500/10' : ''}`}>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none">AI Advisor</span>
        </button>

        {/* 5. Menu Bar Drawer Trigger */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            isMenuSectionActive
              ? 'text-emerald-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1 rounded-lg relative ${isMenuSectionActive ? 'bg-emerald-500/10' : ''}`}>
            <Menu className="w-5 h-5" />
            {isMenuSectionActive && (
              <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-none">Menu</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* FLOATING ACTION BUTTON (SPEED-DIAL FOR INSTANT OPERATIONAL ACCESS)         */}
      {/* ========================================================================= */}
      <FloatingActionButton
        onNavigate={handleQuickAction}
        currentRoute={currentRoute}
      />

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
            className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-800/70 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-zinc-100">New Sale (POS)</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Record customer order</span>
          </button>

          <button
            onClick={() => handleQuickAction('business')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-800/70 hover:bg-blue-500/10 hover:border-blue-500/30 border border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-zinc-100">Add Product</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Update inventory list</span>
          </button>

          <button
            onClick={() => handleQuickAction('business')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-800/70 hover:bg-amber-500/10 hover:border-amber-500/30 border border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-zinc-100">Record Expense</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Track outgoing cash</span>
          </button>

          <button
            onClick={() => handleQuickAction('customers')}
            className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-800/70 hover:bg-purple-500/10 hover:border-purple-500/30 border border-zinc-700/60 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-zinc-100">New Customer</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Add debt & contact</span>
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

