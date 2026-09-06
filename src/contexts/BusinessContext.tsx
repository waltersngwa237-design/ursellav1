import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { BusinessService, type CreateBusinessInput } from '../services/business.service.ts';
import type {
  Business,
  BusinessSettings,
  MemberRole,
  SupportedCurrency,
  UserBusinessMembership,
} from '../types/index.ts';

const ACTIVE_BIZ_KEY = 'ursella_active_business_id';

interface BusinessContextType {
  businesses: UserBusinessMembership[];
  activeBusiness: Business | null;
  activeMembership: UserBusinessMembership | null;
  activeRole: MemberRole | null;
  activeSettings: BusinessSettings | null;
  currency: SupportedCurrency;
  timezone: string;
  loading: boolean;
  error: string | null;
  setActiveBusinessId: (id: string) => void;
  createBusiness: (input: Omit<CreateBusinessInput, 'userId'>) => Promise<UserBusinessMembership>;
  updateBusiness: (updates: Partial<Business>) => Promise<Business>;
  updateSettings: (updates: Partial<BusinessSettings>) => Promise<void>;
  refreshBusinesses: () => Promise<void>;
  createDemoBusiness: () => Promise<void>;
  resetCurrentBusinessData: () => Promise<void>;
  seedSampleCatalog: () => Promise<void>;
  clearError: () => void;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);
const CACHED_MEMBERSHIPS_KEY = 'ursella_cached_memberships_v1';

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Instant synchronous hydration from local cache
  const [businesses, setBusinesses] = useState<UserBusinessMembership[]>(() => {
    try {
      const raw = localStorage.getItem(CACHED_MEMBERSHIPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return [];
  });

  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_BIZ_KEY);
  });

  const [loading, setLoading] = useState<boolean>(() => businesses.length === 0);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async (userId: string) => {
    try {
      if (businesses.length === 0) {
        setLoading(true);
      }
      setError(null);
      let list = await BusinessService.getUserBusinesses(userId);
      if (list.length === 0 && (user?.is_demo || localStorage.getItem('ursella_is_demo_mode') === 'true')) {
        try {
          const demo = await BusinessService.ensureDemoBusinessExists(userId);
          list = [demo];
        } catch (demoErr) {
          console.warn('Failed to ensure demo business on fetch:', demoErr);
        }
      }
      setBusinesses(list);

      try {
        localStorage.setItem(CACHED_MEMBERSHIPS_KEY, JSON.stringify(list));
      } catch {
        // ignore storage errors
      }

      // Determine active business
      if (list.length > 0) {
        const savedId = localStorage.getItem(ACTIVE_BIZ_KEY);
        const match = list.find((b) => b.business.id === savedId);
        if (match) {
          setActiveBusinessIdState(match.business.id);
        } else {
          // Default to first business
          const firstId = list[0].business.id;
          setActiveBusinessIdState(firstId);
          localStorage.setItem(ACTIVE_BIZ_KEY, firstId);
        }
      } else {
        setActiveBusinessIdState(null);
        localStorage.removeItem(ACTIVE_BIZ_KEY);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load business details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [businesses.length]);

  useEffect(() => {
    if (user?.id) {
      fetchBusinesses(user.id);
    } else {
      setBusinesses([]);
      setActiveBusinessIdState(null);
      setLoading(false);
    }
  }, [user?.id, fetchBusinesses]);

  // Multi-tab synchronization: keep active business aligned across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVE_BIZ_KEY && e.newValue && e.newValue !== activeBusinessId) {
        setActiveBusinessIdState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeBusinessId]);

  const setActiveBusinessId = (id: string) => {
    setActiveBusinessIdState(id);
    localStorage.setItem(ACTIVE_BIZ_KEY, id);
  };

  const createBusiness = async (input: Omit<CreateBusinessInput, 'userId'>) => {
    if (!user?.id) {
      throw new Error('You must be signed in to register a business.');
    }

    try {
      setLoading(true);
      setError(null);
      const newMembership = await BusinessService.createBusiness({
        ...input,
        userId: user.id,
      });

      setBusinesses((prev) => [
        ...prev.filter((b) => b.business.id !== newMembership.business.id),
        newMembership,
      ]);
      setActiveBusinessId(newMembership.business.id);
      return newMembership;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create business.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const createDemoBusiness = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      const demoMembership = await BusinessService.ensureDemoBusinessExists(user.id);
      setBusinesses((prev) => [
        ...prev.filter((b) => b.business.id !== demoMembership.business.id),
        demoMembership,
      ]);
      setActiveBusinessId(demoMembership.business.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize demo business.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetCurrentBusinessData = async () => {
    if (!activeBusinessId) return;
    try {
      setLoading(true);
      await BusinessService.resetBusinessData(activeBusinessId);
    } finally {
      setLoading(false);
    }
  };

  const seedSampleCatalog = async () => {
    if (!activeBusinessId) return;
    try {
      setLoading(true);
      BusinessService.seedStarterCatalogIfEmpty(activeBusinessId, currency);
    } finally {
      setLoading(false);
    }
  };

  const updateBusiness = async (updates: Partial<Business>): Promise<Business> => {
    if (!activeBusinessId) {
      throw new Error('No active business selected.');
    }
    try {
      setLoading(true);
      setError(null);
      const updated = await BusinessService.updateBusiness(activeBusinessId, updates, user?.id);
      setBusinesses((prev) =>
        prev.map((m) => {
          if (m.business.id === activeBusinessId) {
            return {
              ...m,
              business: {
                ...m.business,
                ...updates,
              },
            };
          }
          return m;
        })
      );
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update business details.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<BusinessSettings>) => {
    if (!activeBusinessId) return;
    try {
      setLoading(true);
      setError(null);
      await BusinessService.updateSettings(activeBusinessId, updates);
      setBusinesses((prev) =>
        prev.map((m) => {
          if (m.business.id === activeBusinessId) {
            return {
              ...m,
              settings: m.settings ? { ...m.settings, ...updates } : null,
            };
          }
          return m;
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update business settings.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const refreshBusinesses = async () => {
    if (user?.id) {
      await fetchBusinesses(user.id);
    }
  };

  const clearError = () => setError(null);

  // Derive active business objects
  const activeMembership = businesses.find((b) => b.business.id === activeBusinessId) || null;
  const activeBusiness = activeMembership?.business || null;
  const activeRole = activeMembership?.role || null;
  const activeSettings = activeMembership?.settings || null;
  const currency = (activeSettings?.currency || activeBusiness?.currency || 'XAF') as SupportedCurrency;
  const timezone = activeSettings?.timezone || activeBusiness?.timezone || 'Africa/Douala';

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        activeBusiness,
        activeMembership,
        activeRole,
        activeSettings,
        currency,
        timezone,
        loading,
        error,
        setActiveBusinessId,
        createBusiness,
        updateBusiness,
        updateSettings,
        refreshBusinesses,
        createDemoBusiness,
        resetCurrentBusinessData,
        seedSampleCatalog,
        clearError,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
