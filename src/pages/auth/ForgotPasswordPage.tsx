import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { LanguageToggle } from '../../components/common/LanguageToggle.tsx';
import {
  Mail,
  Lock,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigateSignIn: () => void;
  onNavigateLanding?: () => void;
}

type ResetStep = 'request' | 'verify-reset' | 'success';

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigateSignIn,
  onNavigateLanding,
}) => {
  const { requestPasswordResetCode, confirmPasswordResetWithCode, clearError } = useAuth();
  const { language } = useLanguage();

  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Request 6-digit code via Brevo
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);
    setDevCodeHint(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError(
        language === 'fr'
          ? 'Veuillez saisir une adresse e-mail valide.'
          : 'Please enter a valid email address.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await requestPasswordResetCode(cleanEmail);
      setStep('verify-reset');
      setResendCooldown(res.cooldownSeconds || 45);
      setInfoMessage(
        res.message ||
          (language === 'fr'
            ? `Un code de réinitialisation à 6 chiffres a été envoyé à ${cleanEmail}.`
            : `A 6-digit password reset code was sent to ${cleanEmail}.`)
      );
      if (res.devCode) {
        setDevCodeHint(res.devCode);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : language === 'fr'
          ? 'Échec de l’envoi du code de réinitialisation.'
          : 'Failed to send password reset code.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend code via Brevo
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    setFormError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    try {
      setIsResending(true);
      const res = await requestPasswordResetCode(cleanEmail);
      setResendCooldown(res.cooldownSeconds || 45);
      setInfoMessage(
        res.message ||
          (language === 'fr'
            ? 'Un nouveau code de réinitialisation vous a été transmis.'
            : 'A fresh reset code has been dispatched to your email.')
      );
      if (res.devCode) {
        setDevCodeHint(res.devCode);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : language === 'fr'
          ? 'Impossible de renvoyer le code pour le moment.'
          : 'Failed to resend reset code at this time.';
      setFormError(msg);
    } finally {
      setIsResending(false);
    }
  };

  // Step 2: Confirm code and apply new password
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    const cleanCode = code.trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setFormError(
        language === 'fr'
          ? 'Veuillez saisir un code de réinitialisation valide à 6 chiffres.'
          : 'Please enter a valid 6-digit verification code.'
      );
      return;
    }

    if (newPassword.length < 6) {
      setFormError(
        language === 'fr'
          ? 'Le nouveau mot de passe doit comporter au moins 6 caractères.'
          : 'New password must be at least 6 characters long.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError(
        language === 'fr'
          ? 'Les mots de passe ne correspondent pas.'
          : 'Passwords do not match.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await confirmPasswordResetWithCode(email.trim().toLowerCase(), cleanCode, newPassword);
      setStep('success');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : language === 'fr'
          ? 'Échec de la réinitialisation du mot de passe.'
          : 'Failed to reset password.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-zinc-950 text-zinc-100 relative"
      style={{
        paddingTop: 'max(2rem, calc(1.5rem + env(safe-area-inset-top, 0px)))',
        paddingBottom: 'max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Top right language switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle variant="pill" />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          {onNavigateLanding ? (
            <button
              onClick={onNavigateLanding}
              className="hover:opacity-85 transition-opacity"
              title={language === 'fr' ? 'Retour à l’accueil' : 'Back to home'}
            >
              <UrsellaLogo size="lg" />
            </button>
          ) : (
            <UrsellaLogo size="lg" />
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              {step === 'success'
                ? language === 'fr'
                  ? 'Mot de passe réinitialisé'
                  : 'Password Reset Complete'
                : step === 'verify-reset'
                ? language === 'fr'
                  ? 'Entrez le code & nouveau mot de passe'
                  : 'Enter Code & New Password'
                : language === 'fr'
                ? 'Mot de passe oublié ?'
                : 'Forgot your password?'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              {step === 'success'
                ? language === 'fr'
                  ? 'Votre mot de passe a été mis à jour avec succès.'
                  : 'Your account credentials have been successfully updated.'
                : step === 'verify-reset'
                ? language === 'fr'
                  ? `Saisissez le code à 6 chiffres envoyé à ${email} pour définir votre nouveau mot de passe.`
                  : `Enter the 6-digit code sent to ${email} to set a new password.`
                : language === 'fr'
                ? 'Recevez un code de réinitialisation sécurisé à 6 chiffres par e-mail.'
                : 'Receive a secure 6-digit password reset code by email.'}
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-6 shadow-xl shadow-zinc-950/60">
          {/* Error Alert */}
          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Info / Success Notice */}
          {infoMessage && step !== 'success' && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Sandbox Dev Code Quick-Fill Hint */}
          {devCodeHint && step === 'verify-reset' && (
            <div className="mb-4 p-2.5 rounded-lg bg-indigo-950/50 border border-indigo-700/40 flex items-center justify-between text-xs text-indigo-200">
              <span className="font-mono">
                {language === 'fr' ? 'Code Dev Sandbox :' : 'Sandbox Dev Code:'} <strong>{devCodeHint}</strong>
              </span>
              <button
                type="button"
                onClick={() => setCode(devCodeHint)}
                className="text-[11px] bg-indigo-600/30 hover:bg-indigo-600/50 px-2 py-0.5 rounded text-indigo-100 font-medium transition-colors cursor-pointer"
              >
                {language === 'fr' ? 'Remplir auto' : 'Auto-fill'}
              </button>
            </div>
          )}

          {/* STEP 1: Enter Email to Request Code */}
          {step === 'request' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <Input
                label={language === 'fr' ? 'Adresse e-mail du compte' : 'Account Email Address'}
                type="email"
                placeholder="owner@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
                autoFocus
              />

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <span>
                  {language === 'fr'
                    ? 'Un code de confirmation sécurisé à 6 chiffres vous sera envoyé par e-mail. Le code expirera après 15 minutes.'
                    : 'A secure 6-digit authorization code will be dispatched to your inbox. It expires in 15 minutes.'}
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {language === 'fr' ? 'Demander le code de réinitialisation' : 'Send Reset Code'}
              </Button>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit Code & Set New Password */}
          {step === 'verify-reset' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              {/* 6-Digit Code Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  {language === 'fr' ? 'Code de réinitialisation à 6 chiffres' : '6-Digit Reset Code'}
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  leftIcon={<KeyRound className="w-4 h-4 text-emerald-400" />}
                  className="text-center font-mono text-lg tracking-widest font-semibold text-emerald-400"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-zinc-400">
                  {language === 'fr'
                    ? 'Saisissez le code numérique reçu par e-mail.'
                    : 'Enter the 6-digit code received in your inbox.'}
                </p>
              </div>

              {/* New Password */}
              <Input
                label={language === 'fr' ? 'Nouveau mot de passe' : 'New Password'}
                type="password"
                placeholder={language === 'fr' ? 'Au moins 6 caractères' : 'At least 6 characters'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                showPasswordToggle={true}
                autoComplete="new-password"
                required
              />

              {/* Confirm New Password */}
              <Input
                label={language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm New Password'}
                type="password"
                placeholder={language === 'fr' ? 'Répétez votre mot de passe' : 'Re-enter your password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                showPasswordToggle={true}
                autoComplete="new-password"
                required
              />

              {/* Resend Code & Back actions */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setFormError(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Changer d’e-mail' : 'Change email'}</span>
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isResending}
                  onClick={handleResendCode}
                  className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    resendCooldown > 0 || isResending
                      ? 'text-zinc-500 cursor-not-allowed'
                      : 'text-emerald-400 hover:text-emerald-300 font-medium'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? language === 'fr'
                        ? `Renvoyer (${resendCooldown}s)`
                        : `Resend in ${resendCooldown}s`
                      : language === 'fr'
                      ? 'Renvoyer le code'
                      : 'Resend code'}
                  </span>
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isSubmitting}
                rightIcon={<ShieldCheck className="w-4 h-4" />}
              >
                {language === 'fr' ? 'Enregistrer le mot de passe' : 'Update & Save Password'}
              </Button>
            </form>
          )}

          {/* STEP 3: Success Confirmation */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-100">
                  {language === 'fr' ? 'Mot de passe réinitialisé avec succès !' : 'Password Successfully Reset!'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  {language === 'fr' ? (
                    <>Votre compte <span className="font-semibold text-zinc-200">{email}</span> est désormais protégé par votre nouveau mot de passe. Vous pouvez vous connecter immédiatement.</>
                  ) : (
                    <>Your account <span className="font-semibold text-zinc-200">{email}</span> has been updated with your new credentials. You can now sign in.</>
                  )}
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full mt-3"
                onClick={onNavigateSignIn}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {language === 'fr' ? 'Se connecter maintenant' : 'Sign In Now'}
              </Button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="text-center space-y-2 text-xs text-zinc-400">
          {step !== 'success' && (
            <p>
              <button
                onClick={onNavigateSignIn}
                className="inline-flex items-center gap-1.5 font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{language === 'fr' ? 'Retour à la connexion' : 'Return to sign in'}</span>
              </button>
            </p>
          )}

          {onNavigateLanding && (
            <p>
              <button
                onClick={onNavigateLanding}
                className="text-zinc-400 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{language === 'fr' ? 'Retour à l’accueil Ursella' : 'Back to Ursella home'}</span>
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
