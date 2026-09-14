import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import {
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface SignUpPageProps {
  onNavigateSignIn: () => void;
  onNavigateLanding?: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onNavigateSignIn, onNavigateLanding }) => {
  const { requestVerificationCode, signUpWithCode, loading, error, clearError } = useAuth();
  
  // Step 1 = Enter details, Step 2 = Enter 6-digit code
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  
  // Verification code state
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);
    setDevCodeHint(null);
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
      setIsSendingCode(true);
      const res = await requestVerificationCode(email.trim().toLowerCase(), fullName.trim(), phone.trim() || undefined);
      setStep('verify');
      setResendCooldown(res.cooldownSeconds || 60);
      setInfoMessage(res.message || `A 6-digit code has been sent to ${email}.`);
      if (res.devCode) {
        setDevCodeHint(res.devCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send verification code.';
      setFormError(msg);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isSendingCode) return;
    setFormError(null);
    setInfoMessage(null);
    try {
      setIsSendingCode(true);
      const res = await requestVerificationCode(email.trim().toLowerCase(), fullName.trim(), phone.trim() || undefined);
      setResendCooldown(res.cooldownSeconds || 60);
      setInfoMessage('A fresh verification code was sent to your email.');
      if (res.devCode) {
        setDevCodeHint(res.devCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code.';
      setFormError(msg);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleCompleteSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    const cleanCode = verificationCode.trim().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setFormError('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      await signUpWithCode(
        email.trim().toLowerCase(),
        cleanCode,
        password,
        fullName.trim(),
        phone.trim() || undefined,
        stayLoggedIn
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check the code and try again.';
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
            <h1 className="text-xl font-bold tracking-tight text-white">
              {step === 'details' ? 'Create your account' : 'Verify your email'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {step === 'details'
                ? 'Sign up with a verified email code — no confirmation links needed'
                : `We sent a 6-digit verification code to ${email}`}
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

          {infoMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {devCodeHint && (
            <div className="mb-4 p-2.5 rounded-lg bg-indigo-950/50 border border-indigo-700/40 flex items-center justify-between text-xs text-indigo-200">
              <span className="font-mono">Quick Dev Code: <strong>{devCodeHint}</strong></span>
              <button
                type="button"
                onClick={() => setVerificationCode(devCodeHint)}
                className="text-[11px] bg-indigo-600/30 hover:bg-indigo-600/50 px-2 py-0.5 rounded text-indigo-100 font-medium transition-colors"
              >
                Auto-fill
              </button>
            </div>
          )}

          {step === 'details' ? (
            <form onSubmit={handleRequestCode} className="space-y-3.5">
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
                showPasswordToggle={true}
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
                showPasswordToggle={true}
                autoComplete="new-password"
                required
              />

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0 transition-colors"
                  />
                  <span>Stay logged in on this device (Windows & Mobile)</span>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-3"
                isLoading={isSendingCode}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Send Verification Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCompleteSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    leftIcon={<KeyRound className="w-4 h-4 text-emerald-400" />}
                    className="text-center font-mono text-lg tracking-widest font-semibold text-emerald-400"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-zinc-400">
                  Enter the numeric code sent via Brevo email. Valid for 15 minutes.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setFormError(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit details</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isSendingCode}
                  className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                    resendCooldown > 0 || isSendingCode
                      ? 'text-zinc-500 cursor-not-allowed'
                      : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSendingCode ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend code'}
                  </span>
                </button>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  isLoading={loading}
                  rightIcon={<ShieldCheck className="w-4 h-4" />}
                >
                  Verify & Create Account
                </Button>
              </div>
            </form>
          )}
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

