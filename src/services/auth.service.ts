import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type { UserProfile } from '../types/index.ts';

// Local storage key for fallback preview mode
const LOCAL_STORAGE_AUTH_KEY = 'ursella_preview_auth_user';
const LOCAL_STORAGE_PROFILE_KEY = 'ursella_preview_profile';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
}

export const AuthService = {
  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
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
        data.subscription.unsubscribe();
      };
    } else {
      // Preview / Dev mode listener
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
      checkLocal();
      window.addEventListener('storage', checkLocal);
      return () => {
        window.removeEventListener('storage', checkLocal);
      };
    }
  },

  /**
   * Get initial session/user
   */
  async getInitialUser(): Promise<AuthUser | null> {
    if (isSupabaseConfigured) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) return null;
        return {
          id: session.user.id,
          email: session.user.email || '',
          user_metadata: session.user.user_metadata,
        };
      } catch {
        return null;
      }
    } else {
      const stored = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
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
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      window.dispatchEvent(new Event('storage'));
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
    if (isSupabaseConfigured && isValidUUID(userId)) {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
        return null;
      }
      return data as UserProfile;
    } else {
      const stored = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
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
    if (isSupabaseConfigured && isValidUUID(userId)) {
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
        throw new Error(error.message);
      }
      return data as UserProfile;
    } else {
      const existing = await this.getUserProfile(userId);
      const updated: UserProfile = {
        ...existing!,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(updated));
      return updated;
    }
  },
};
