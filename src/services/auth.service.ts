import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type { UserProfile } from '../types/index.ts';
import { BusinessService } from './business.service.ts';

// Local storage key for fallback preview mode & instant demo
const LOCAL_STORAGE_AUTH_KEY = 'ursella_preview_auth_user';
const LOCAL_STORAGE_PROFILE_KEY = 'ursella_preview_profile';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_USER_EMAIL = 'demo@ursella.app';

export interface AuthUser {
  id: string;
  email: string;
  is_demo?: boolean;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
}

export const AuthService = {
  /**
   * Launch an instant demo session without requiring credentials or sign in
   */
  async startInstantDemo(): Promise<AuthUser> {
    const demoUser: AuthUser = {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      is_demo: true,
      user_metadata: {
        full_name: 'Demo Business Owner',
        phone: '+237 670 000 000',
      },
    };

    localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(demoUser));
    localStorage.setItem('ursella_is_demo_mode', 'true');

    const profile: UserProfile = {
      id: demoUser.id,
      full_name: 'Demo Business Owner',
      phone: '+237 670 000 000',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));

    // Ensure demo business with realistic inventory, sales, customers, and alerts is seeded immediately
    try {
      await BusinessService.ensureDemoBusinessExists(demoUser.id);
    } catch (err) {
      console.warn('Error ensuring demo business exists:', err);
    }

    // Broadcast instant auth change
    window.dispatchEvent(new CustomEvent('ursella_auth_change', { detail: demoUser }));
    window.dispatchEvent(new Event('storage'));

    return demoUser;
  },

  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<AuthUser | null>;
      callback(customEvent.detail ?? null);
    };

    const checkLocal = () => {
      const stored = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
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
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // If an instant demo session is active, keep demo user
        const stored = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.is_demo || parsed?.id === DEMO_USER_ID) {
              callback(parsed);
              return;
            }
          } catch {}
        }

        if (session?.user) {
          callback({
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          });
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
   * Get initial session/user
   */
  async getInitialUser(): Promise<AuthUser | null> {
    // 1. Check if an instant demo or preview user session exists in local storage
    const stored = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.is_demo || parsed?.id === DEMO_USER_ID || !isSupabaseConfigured) {
          return parsed;
        }
      } catch {}
    }

    // 2. If Supabase is configured, check real session
    if (isSupabaseConfigured) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          if (stored) {
            try { return JSON.parse(stored); } catch {}
          }
          return null;
        }
        return {
          id: session.user.id,
          email: session.user.email || '',
          user_metadata: session.user.user_metadata,
        };
      } catch {
        if (stored) {
          try { return JSON.parse(stored); } catch {}
        }
        return null;
      }
    } else {
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  /**
   * Sign up with email & password
   */
  async signUp(email: string, password: string, fullName: string, phone?: string) {
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
      }

      return data.user ? {
        id: data.user.id,
        email: data.user.email || '',
        user_metadata: { full_name: fullName, phone },
      } : null;
    } else {
      // Local preview mode
      const user: AuthUser = {
        id: generateUUID(),
        email,
        user_metadata: { full_name: fullName, phone },
      };
      localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(user));
      const profile: UserProfile = {
        id: user.id,
        full_name: fullName,
        phone: phone || null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
      // Dispatch storage event for listener
      window.dispatchEvent(new Event('storage'));
      return user;
    }
  },

  /**
   * Sign in with email & password
   */
  async signIn(email: string, password: string): Promise<AuthUser> {
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

      return {
        id: data.user.id,
        email: data.user.email || '',
        user_metadata: data.user.user_metadata,
      };
    } else {
      // In preview mode: if already saved with this email, keep same ID; else create session
      let existing: AuthUser | null = null;
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
        if (stored) existing = JSON.parse(stored);
      } catch {
        // ignore
      }

      const user: AuthUser = {
        id: (existing?.id && isValidUUID(existing.id)) ? existing.id : generateUUID(),
        email,
        user_metadata: {
          full_name: existing?.user_metadata?.full_name || email.split('@')[0],
        },
      };
      localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(user));
      window.dispatchEvent(new Event('storage'));
      return user;
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
    localStorage.removeItem('ursella_is_demo_mode');
    localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    window.dispatchEvent(new CustomEvent('ursella_auth_change', { detail: null }));
    window.dispatchEvent(new Event('storage'));

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
  },

  /**
   * Send password reset email
   */
  async resetPasswordForEmail(email: string) {
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address to send password reset instructions.');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        throw new Error(error.message);
      }
    }
    return true;
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
