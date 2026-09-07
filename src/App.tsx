import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { BusinessProvider, useBusiness } from './contexts/BusinessContext.tsx';
import type { AppNavRoute } from './types/index.ts';

// Pages
import { LandingPage } from './pages/landing/LandingPage.tsx';
import { SignInPage } from './pages/auth/SignInPage.tsx';
import { SignUpPage } from './pages/auth/SignUpPage.tsx';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.tsx';
import { OnboardingPage } from './pages/onboarding/OnboardingPage.tsx';
import { HomePage } from './pages/dashboard/HomePage.tsx';
import { SellPage } from './pages/sell/SellPage.tsx';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage.tsx';
import { BusinessPage } from './pages/business/BusinessPage.tsx';
import { CustomersPage } from './pages/customers/CustomersPage.tsx';
import { UrsellaAIPage } from './pages/ai/UrsellaAIPage.tsx';
import { InsightsView } from './components/insights/InsightsView.tsx';
import { ReportsPage } from './pages/reports/ReportsPage.tsx';
import { DataImportExportPage } from './pages/data/DataImportExportPage.tsx';
import { BillingPage } from './pages/subscription/BillingPage.tsx';
import { MoreMenuPage } from './pages/more/MoreMenuPage.tsx';

// Layout & Common
import { AppShell } from './layouts/AppShell.tsx';
import { OfflineBanner } from './components/common/OfflineBanner.tsx';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt.tsx';
import { UrsellaEngineLoader } from './components/common/UrsellaEngineLoader.tsx';

type AuthView = 'landing' | 'signin' | 'signup' | 'forgot-password';

const MainRouter: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { businesses, activeBusiness, loading: bizLoading } = useBusiness();

  const [authView, setAuthView] = useState<AuthView>('landing');
  const [currentRoute, setCurrentRoute] = useState<AppNavRoute>('home');
  const [aiPrompt, setAiPrompt] = useState<string | undefined>(undefined);

  // Handle URL hash routing if present
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (['home', 'sell', 'analytics', 'reports', 'business', 'customers', 'data-io', 'billing', 'ai', 'insights', 'more'].includes(hash)) {
        // Any hash change navigation should clear one-time prompt state
        setAiPrompt(undefined);
        setCurrentRoute(hash as AppNavRoute);
      } else if (['landing', 'signin', 'signup', 'forgot-password'].includes(hash)) {
        setAuthView(hash as AuthView);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route: AppNavRoute, prompt?: string) => {
    // Only set aiPrompt if an explicit prompt is provided; otherwise clear any lingering prompt
    setAiPrompt(prompt ? prompt.trim() : undefined);
    setCurrentRoute(route);
    window.location.hash = `#/${route}`;
  };

  const handlePromptConsumed = useCallback(() => {
    setAiPrompt(undefined);
  }, []);

  const navigateAuth = (view: AuthView) => {
    setAuthView(view);
    window.location.hash = `#/${view}`;
  };

  // 1. Initial global engine loading state
  if (authLoading) {
    return (
      <>
        <OfflineBanner />
        <UrsellaEngineLoader />
      </>
    );
  }

  // 2. Unauthenticated flows
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <OfflineBanner />
        {authView === 'landing' && (
          <LandingPage
            onNavigateSignIn={() => navigateAuth('signin')}
            onNavigateSignUp={() => navigateAuth('signup')}
          />
        )}
        {authView === 'signup' && (
          <SignUpPage
            onNavigateSignIn={() => navigateAuth('signin')}
            onNavigateLanding={() => navigateAuth('landing')}
          />
        )}
        {authView === 'forgot-password' && (
          <ForgotPasswordPage
            onNavigateSignIn={() => navigateAuth('signin')}
            onNavigateLanding={() => navigateAuth('landing')}
          />
        )}
        {authView === 'signin' && (
          <SignInPage
            onNavigateSignUp={() => navigateAuth('signup')}
            onNavigateForgotPassword={() => navigateAuth('forgot-password')}
            onNavigateLanding={() => navigateAuth('landing')}
          />
        )}
      </div>
    );
  }

  // 3. Authenticated but business workspace initializing
  if (bizLoading) {
    return (
      <>
        <OfflineBanner />
        <UrsellaEngineLoader />
      </>
    );
  }

  // 4. Authenticated but no business registered yet -> Onboarding flow
  if (businesses.length === 0 || !activeBusiness) {
    return (
      <>
        <OfflineBanner />
        <OnboardingPage />
      </>
    );
  }

  // 5. Authenticated & Business active -> Application Shell
  return (
    <>
      <OfflineBanner />
      <AppShell currentRoute={currentRoute} onNavigate={navigateTo}>
        {currentRoute === 'home' && <HomePage onNavigate={navigateTo} />}
        {currentRoute === 'sell' && <SellPage />}
        {currentRoute === 'analytics' && <AnalyticsPage onNavigate={navigateTo} />}
        {currentRoute === 'reports' && <ReportsPage businessId={activeBusiness.id} />}
        {currentRoute === 'business' && <BusinessPage />}
        {currentRoute === 'customers' && <CustomersPage />}
        {currentRoute === 'data-io' && <DataImportExportPage businessId={activeBusiness.id} />}
        {currentRoute === 'billing' && <BillingPage businessId={activeBusiness.id} />}
        {currentRoute === 'insights' && <InsightsView />}
        {currentRoute === 'ai' && (
          <UrsellaAIPage
            initialPrompt={aiPrompt}
            onPromptConsumed={handlePromptConsumed}
          />
        )}
        {currentRoute === 'more' && <MoreMenuPage onNavigate={navigateTo} />}
      </AppShell>
      <PWAInstallPrompt />
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BusinessProvider>
          <MainRouter />
        </BusinessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
