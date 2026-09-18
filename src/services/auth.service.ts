import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type { UserProfile } from '../types/index.ts';
import { BusinessService } from './business.service.ts';

// Local storage keys for durable cross-platform & Windows session persistence
const DURABLE_AUTH_KEY = 'ursella_auth_user';
const DURABLE_SESSION_KEY = 'ursella_auth_session';
const STAY_LOGGED_IN_KEY = 'ursella_stay_logged_in';
const USER_SIGNED_OUT_KEY = 'ursella_user_signed_out';
const LOCAL_STORAGE_AUTH_KEY = 'ursella_preview_auth_user';
const LOCAL_STORAGE_PROFILE_KEY = 'ursella_preview_profile';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_USER_EMAIL = 'demo@ursella.app';

export interface AuthUser {
  id: string;
  email: string;
  is_demo?: boolean;
  stay_logged_in?: boolean;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
}

export const AuthService = {
  /**
   * Durably save user session to local and session storage to guarantee persistent login on Windows
   */
  persistUserSession(user: AuthUser, stayLoggedIn = true, profile?: UserProfile) {
    try {
      const userPayload = JSON.stringify({
        ...user,
        stay_logged_in: stayLoggedIn,
        authenticated_at: Date.now(),
      });

      // Primary persistent storage
      localStorage.setItem(DURABLE_AUTH_KEY, userPayload);
      localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, userPayload);
      localStorage.setItem(STAY_LOGGED_IN_KEY, stayLoggedIn ? 'true' : 'false');
      localStorage.removeItem(USER_SIGNED_OUT_KEY);

      // Windows multi-process / tab fallback backup in sessionStorage
      try {
        sessionStorage.setItem(DURABLE_AUTH_KEY, userPayload);
      } catch {}

      if (profile) {
        localStorage.setItem(`${LOCAL_STORAGE_PROFILE_KEY}_${user.id}`, JSON.stringify(profile));
        localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
      }
    } catch (err) {
      console.warn('[AuthService] Failed to write persistent session:', err);
    }

    // Broadcast instant auth change to all active components and browser tabs
    window.dispatchEvent(new CustomEvent('ursella_auth_change', { detail: user }));
    window.dispatchEvent(new Event('storage'));
  },

  /**
   * Clear all user session tokens and flags upon explicit sign out
   */
  clearUserSession() {
    try {
      localStorage.setItem(USER_SIGNED_OUT_KEY, 'true');
      localStorage.removeItem(DURABLE_AUTH_KEY);
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      localStorage.removeItem(DURABLE_SESSION_KEY);
      localStorage.removeItem(STAY_LOGGED_IN_KEY);
      localStorage.removeItem('ursella_is_demo_mode');
      try {
        sessionStorage.removeItem(DURABLE_AUTH_KEY);
      } catch {}
    } catch {}

    window.dispatchEvent(new CustomEvent('ursella_auth_change', { detail: null }));
    window.dispatchEvent(new Event('storage'));
  },

  /**
   * Launch an instant demo session without requiring credentials or sign in
   */
  async startInstantDemo(): Promise<AuthUser> {
    const demoUser: AuthUser = {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      is_demo: true,
      stay_logged_in: true,
      user_metadata: {
        full_name: 'Demo Business Owner',
        phone: '+237 670 000 000',
      },
    };

    localStorage.setItem('ursella_is_demo_mode', 'true');

    const profile: UserProfile = {
      id: demoUser.id,
      full_name: 'Demo Business Owner',
      phone: '+237 670 000 000',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.persistUserSession(demoUser, true, profile);

    // Ensure demo business with realistic inventory, sales, customers, and alerts is seeded immediately
    try {
      await BusinessService.ensureDemoBusinessExists(demoUser.id);
    } catch (err) {
      console.warn('Error ensuring demo business exists:', err);
    }

    return demoUser;
  },

  /**
   * Request a 6-digit email verification code via Brevo API
   */
  async requestVerificationCode(email: string, fullName?: string, phone?: string): Promise<{
    success: boolean;
    simulated: boolean;
    devCode?: string;
    message: string;
    expiresInSeconds: number;
    cooldownSeconds?: number;
  }> {
    const response = await fetch('/api/auth/send-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, phone }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to send verification code.');
    }
    return data;
  },

  /**
   * Verify an entered 6-digit code
   */
  async verifyCode(email: string, code: string): Promise<{ verified: boolean; message?: string }> {
    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Verification failed.');
    }
    return data;
  },

  /**
   * Complete registration after verifying 6-digit email code
   */
  async completeSignUpWithCode(
    email: string,
    code: string,
    password?: string,
    fullName?: string,
    phone?: string,
    stayLoggedIn = true
  ): Promise<AuthUser> {
    const response = await fetch('/api/auth/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, password, fullName, phone }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to complete registration.');
    }

    const registeredUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      stay_logged_in: stayLoggedIn,
      user_metadata: data.user.user_metadata,
    };

    // If Supabase is configured and a password was supplied, sign in client to get active Supabase session
    if (isSupabaseConfigured && password) {
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!signInError && signInData.user) {
          registeredUser.id = signInData.user.id;
        }
      } catch (err) {
        console.warn('Client Supabase session sync after code registration:', err);
      }
    }

    // Create initial profile
    const profile: UserProfile = {
      id: registeredUser.id,
      full_name: fullName || registeredUser.user_metadata?.full_name || email.split('@')[0],
      phone: phone || registeredUser.user_metadata?.phone || null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Persist user session durably across Windows restarts
    this.persistUserSession(registeredUser, stayLoggedIn, profile);
    return registeredUser;
  },

  /**
   * Listen to authentication state changes with Windows session preservation
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<AuthUser | null>;
      callback(customEvent.detail ?? null);
    };

    const checkLocal = () => {
      if (localStorage.getItem(USER_SIGNED_OUT_KEY) === 'true') {
        callback(null);
        return;
      }

      const stored =
        localStorage.getItem(DURABLE_AUTH_KEY) ||
        localStorage.getItem(LOCAL_STORAGE_AUTH_KEY) ||
        sessionStorage.getItem(DURABLE_AUTH_KEY);

      if (stored) {
        try {
          callback(JSON.parse(stored));
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    };

    window.addEventListener('ursella_auth_change', handleCustomChange);
    window.addEventListener('storage', checkLocal);

    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        // If user explicitly signed out, propagate null
        if (localStorage.getItem(USER_SIGNED_OUT_KEY) === 'true') {
          callback(null);
          return;
        }

        // If an instant demo or durable session is active, don't wipe it on transient Supabase events
        const stored =
          localStorage.getItem(DURABLE_AUTH_KEY) ||
          localStorage.getItem(LOCAL_STORAGE_AUTH_KEY) ||
          sessionStorage.getItem(DURABLE_AUTH_KEY);

        let parsedStored: AuthUser | null = null;
        if (stored) {
          try {
            parsedStored = JSON.parse(stored);
          } catch {}
        }

        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          };
          callback(authUser);
          // Keep local storage synchronized
          this.persistUserSession(authUser, true);
        } else if (parsedStored && (parsedStored.is_demo || parsedStored.stay_logged_in !== false)) {
          // On Windows, if Supabase has a transient null session during cold startup or token refresh,
          // maintain the authenticated user from storage so they stay logged in
          callback(parsedStored);
        } else {
          callback(null);
        }
      });

      return () => {
        window.removeEventListener('ursella_auth_change', handleCustomChange);
        window.removeEventListener('storage', checkLocal);
        data.subscription.unsubscribe();
      };
    } else {
      checkLocal();
      return () => {
        window.removeEventListener('ursella_auth_change', handleCustomChange);
        window.removeEventListener('storage', checkLocal);
      };
    }
  },

  /**
   * Get initial session/user - robustly handles Windows cold boot and reloads
   */
  async getInitialUser(): Promise<AuthUser | null> {
    if (localStorage.getItem(USER_SIGNED_OUT_KEY) === 'true') {
      return null;
    }

    // 1. Check if an instant demo or persistent user session exists in local or session storage
    let storedUser: AuthUser | null = null;
    const stored =
      localStorage.getItem(DURABLE_AUTH_KEY) ||
      localStorage.getItem(LOCAL_STORAGE_AUTH_KEY) ||
      sessionStorage.getItem(DURABLE_AUTH_KEY);

    if (stored) {
      try {
        storedUser = JSON.parse(stored);
        if (storedUser?.is_demo || storedUser?.id === DEMO_USER_ID) {
          return storedUser;
        }
      } catch {}
    }

    // 2. If Supabase is configured, verify session
    if (isSupabaseConfigured) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          };
          this.persistUserSession(authUser, true);
          return authUser;
        }
      } catch (err) {
        console.warn('[AuthService] Supabase getSession warning:', err);
      }

      // Windows persistence guard: If Supabase getSession returned null (e.g., cold restart,
      // browser cookie partition, or offline), but we have a valid verified user stored,
      // KEEP the user logged in!
      if (storedUser && storedUser.id && storedUser.email) {
        return storedUser;
      }
      return null;
    } else {
      return storedUser;
    }
  },

  /**
   * Sign up with email & password (legacy fallback, preserves backward compatibility)
   */
  async signUp(email: string, password: string, fullName: string, phone?: string, stayLoggedIn = true) {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || null,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw new Error(error.message);
      }

      if (data.user) {
        const user: AuthUser = {
          id: data.user.id,
          email: data.user.email || email,
          stay_logged_in: stayLoggedIn,
          user_metadata: { full_name: fullName, phone },
        };

        const profile: UserProfile = {
          id: user.id,
          full_name: fullName,
          phone: phone || null,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        this.persistUserSession(user, stayLoggedIn, profile);

        // Ensure profile is recorded in public.profiles table
        try {
          await (supabase as any).from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            phone: phone || null,
          });
        } catch (e) {
          console.warn('Profile upsert notice:', e);
        }

        return user;
      }

      return null;
    } else {
      // Local preview mode
      const user: AuthUser = {
        id: generateUUID(),
        email,
        stay_logged_in: stayLoggedIn,
        user_metadata: { full_name: fullName, phone },
      };

      const profile: UserProfile = {
        id: user.id,
        full_name: fullName,
        phone: phone || null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.persistUserSession(user, stayLoggedIn, profile);
      return user;
    }
  },

  /**
   * Sign in with email & password - ensures stay_logged_in is persisted
   */
  async signIn(email: string, password: string, stayLoggedIn = true): Promise<AuthUser> {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Invalid email or password. Please verify and try again.');
        }
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('Authentication succeeded but user profile was not returned.');
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
        stay_logged_in: stayLoggedIn,
        user_metadata: data.user.user_metadata,
      };

      this.persistUserSession(authUser, stayLoggedIn);
      return authUser;
    } else {
      // In preview mode: if already saved with this email, keep same ID; else create session
      let existing: AuthUser | null = null;
      try {
        const stored = localStorage.getItem(DURABLE_AUTH_KEY) || localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
        if (stored) existing = JSON.parse(stored);
      } catch {
        // ignore
      }

      const user: AuthUser = {
        id: existing?.id && isValidUUID(existing.id) ? existing.id : generateUUID(),
        email,
        stay_logged_in: stayLoggedIn,
        user_metadata: {
          full_name: existing?.user_metadata?.full_name || email.split('@')[0],
        },
      };

      this.persistUserSession(user, stayLoggedIn);
      return user;
    }
  },

  /**
   * Explicit sign out - clears all tokens and sets user signed out marker
   */
  async signOut() {
    this.clearUserSession();

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
  },

  /**
   * Send password reset email via Brevo with 6-digit code
   */
  async resetPasswordForEmail(email: string) {
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address to send password reset instructions.');
    }

    // Dispatch via Brevo password reset code endpoint
    return await this.requestPasswordResetCode(email);
  },

  /**
   * Request a 6-digit password reset code via Brevo
   */
  async requestPasswordResetCode(email: string): Promise<{
    success: boolean;
    simulated: boolean;
    devCode?: string;
    message: string;
    expiresInSeconds: number;
    cooldownSeconds?: number;
  }> {
    const response = await fetch('/api/auth/request-password-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to send password reset code.');
    }
    return data;
  },

  /**
   * Verify an entered 6-digit password reset code
   */
  async verifyPasswordResetCode(email: string, code: string): Promise<{ verified: boolean; message?: string }> {
    const response = await fetch('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Reset code verification failed.');
    }
    return data;
  },

  /**
   * Complete password reset using verified 6-digit code and new password
   */
  async confirmPasswordResetWithCode(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch('/api/auth/confirm-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Password reset failed.');
    }
    return data;
  },

  /**
   * Update password (after reset flow)
   */
  async updateUserPassword(newPassword: string) {
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        throw new Error(error.message);
      }
    }
    return true;
  },

  /**
   * Get user profile from public.profiles
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const localProfileKey = `${LOCAL_STORAGE_PROFILE_KEY}_${userId}`;

    if (isSupabaseConfigured && isValidUUID(userId)) {
      try {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          localStorage.setItem(localProfileKey, JSON.stringify(data));
          return data as UserProfile;
        }
      } catch (err) {
        console.warn('Network error fetching profile, falling back to local cache:', err);
      }

      // Check cached profile if offline or error
      const cached = localStorage.getItem(localProfileKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }

      return {
        id: userId,
        full_name: 'Business Owner',
        phone: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      const stored = localStorage.getItem(localProfileKey) || localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
      return {
        id: userId,
        full_name: 'Business Owner',
        phone: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const localProfileKey = `${LOCAL_STORAGE_PROFILE_KEY}_${userId}`;
    const existing = await this.getUserProfile(userId);
    const merged: UserProfile = {
      ...(existing || {
        id: userId,
        full_name: 'Business Owner',
        phone: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      ...updates,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(localProfileKey, JSON.stringify(merged));
    localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(merged));

    if (isSupabaseConfigured && isValidUUID(userId)) {
      try {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          console.warn('Supabase profile update warning:', error.message);
        } else if (data) {
          localStorage.setItem(localProfileKey, JSON.stringify(data));
          localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(data));
          return data as UserProfile;
        }
      } catch (err) {
        console.warn('Network error updating profile on Supabase:', err);
      }
    }

    return merged;
  },
};
