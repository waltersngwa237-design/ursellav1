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
  refreshBusinesses: () => Promise<void>;
  createDemoBusiness: () => Promise<void>;
  resetCurrentBusinessData: () => Promise<void>;
  seedSampleCatalog: () => Promise<void>;
  clearError: () => void;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<UserBusinessMembership[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_BIZ_KEY);
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const list = await BusinessService.getUserBusinesses(userId);
      setBusinesses(list);

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
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchBusinesses(user.id);
    } else {
      setBusinesses([]);
      setActiveBusinessIdState(null);
      setLoading(false);
    }
  }, [user?.id, fetchBusinesses]);

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
      const demoMembership = await BusinessService.createDemoBusiness(user.id);
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
