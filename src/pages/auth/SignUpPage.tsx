import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { Mail, Lock, User, Phone, AlertCircle, ArrowRight } from 'lucide-react';

interface SignUpPageProps {
  onNavigateSignIn: () => void;
  onNavigateLanding?: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onNavigateSignIn, onNavigateLanding }) => {
  const { signUp, loading, error, clearError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      await signUp(email, password, fullName.trim(), phone.trim() || undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setFormError(msg);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-zinc-950 text-zinc-100">
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
            <h1 className="text-xl font-bold tracking-tight text-white">Create your account</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Start managing your sales, inventory, and finances
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-6 shadow-xl shadow-zinc-950/60">
          {(formError || error) && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Full Name"
              type="text"
              placeholder="Amara Kamga"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="name"
              required
            />

            <Input
              label="Email address"
              type="email"
              placeholder="owner@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
            />

            <Input
              label="Phone number (optional)"
              type="tel"
              placeholder="+237 6XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
              autoComplete="tel"
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-3"
              isLoading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Business Setup
            </Button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="text-center space-y-2 text-xs text-zinc-400">
          <p>
            Already have an account?{' '}
            <button
              onClick={onNavigateSignIn}
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Sign in
            </button>
          </p>
          {onNavigateLanding && (
            <p>
              <button
                onClick={onNavigateLanding}
                className="text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                ← Back to Ursella home
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
