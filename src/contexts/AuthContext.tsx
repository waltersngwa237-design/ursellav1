import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthService, type AuthUser } from '../services/auth.service.ts';
import type { UserProfile } from '../types/index.ts';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, fullName: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPass: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const userProfile = await AuthService.getUserProfile(userId);
      setProfile(userProfile);
    } catch (err: unknown) {
      console.warn('Failed to load profile for user:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Initial user fetch
    AuthService.getInitialUser().then(async (initialUser) => {
      if (!isMounted) return;
      setUser(initialUser);
      if (initialUser) {
        await loadUserProfile(initialUser.id);
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // Subscribe to auth state changes
    const unsubscribe = AuthService.onAuthStateChange(async (authUser) => {
      if (!isMounted) return;
      setUser(authUser);
      if (authUser) {
        await loadUserProfile(authUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadUserProfile]);

  const signIn = async (email: string, pass: string) => {
    try {
      setError(null);
      setLoading(true);
      const authUser = await AuthService.signIn(email, pass);
      setUser(authUser);
      await loadUserProfile(authUser.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pass: string, fullName: string, phone?: string) => {
    try {
      setError(null);
      setLoading(true);
      const authUser = await AuthService.signUp(email, pass, fullName, phone);
      if (authUser) {
        setUser(authUser);
        await loadUserProfile(authUser.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await AuthService.signOut();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      await AuthService.resetPasswordForEmail(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset email.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const updatePassword = async (newPass: string) => {
    try {
      setError(null);
      await AuthService.updateUserPassword(newPass);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
