import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { isSupabaseConfigured } from '../../lib/supabase/client.ts';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Mail, Lock, AlertCircle, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';

interface SignInPageProps {
  onNavigateSignUp: () => void;
  onNavigateForgotPassword: () => void;
  onNavigateLanding?: () => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({
  onNavigateSignUp,
  onNavigateForgotPassword,
  onNavigateLanding,
}) => {
  const { signIn, startInstantDemo, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setFormError(msg);
    }
  };

  const handleQuickDemo = async () => {
    try {
      setFormError(null);
      await startInstantDemo();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Instant demo failed to load.';
      setFormError(msg);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-zinc-950 text-zinc-100"
      style={{
        paddingTop: 'max(2rem, calc(1.5rem + env(safe-area-inset-top, 0px)))',
        paddingBottom: 'max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          {onNavigateLanding ? (
            <button
              onClick={onNavigateLanding}
              className="hover:opacity-85 transition-opacity"
              title="Back to home"
            >
              <UrsellaLogo size="lg" />
            </button>
          ) : (
            <UrsellaLogo size="lg" />
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Welcome back</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Sign in to manage your businesses and operations
            </p>
          </div>
        </div>

        {/* Status notice */}
        <div className="rounded-xl p-3 bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>{isSupabaseConfigured ? 'Connected to Supabase PostgreSQL' : 'Local Preview & Staging Mode'}</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${isSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
            {isSupabaseConfigured ? 'RLS ACTIVE' : 'PREVIEW'}
          </span>
        </div>

        {/* Card Form */}
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-6 shadow-xl shadow-zinc-950/60">
          {(formError || error) && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
            />

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
                required
              />
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={onNavigateForgotPassword}
                  className="text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-5 pt-5 border-t border-zinc-800/80 text-center">
            <p className="text-xs text-zinc-400 mb-2">Want a quick test session?</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full text-xs"
              onClick={handleQuickDemo}
              disabled={loading}
            >
              Instant Demo Sign In
            </Button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="text-center space-y-2 text-xs text-zinc-400">
          <p>
            Don't have an Ursella account?{' '}
            <button
              onClick={onNavigateSignUp}
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Create account
            </button>
          </p>
          {onNavigateLanding && (
            <p>
              <button
                onClick={onNavigateLanding}
                className="text-zinc-400 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Back to Ursella home</span>
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
