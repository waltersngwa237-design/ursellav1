import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { UrsellaLogo } from '../../components/common/UrsellaLogo.tsx';
import { LanguageToggle } from '../../components/common/LanguageToggle.tsx';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigateSignIn: () => void;
  onNavigateLanding?: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigateSignIn,
  onNavigateLanding,
}) => {
  const { resetPassword } = useAuth();
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email || !email.includes('@')) {
      setFormError(language === 'fr' ? 'Veuillez saisir une adresse e-mail valide.' : 'Please enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(email);
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (language === 'fr' ? 'Échec de l’envoi de l’e-mail de réinitialisation.' : 'Failed to send password reset email.');
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
              {language === 'fr' ? 'Réinitialisez votre mot de passe' : 'Reset your password'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {language === 'fr' ? 'Nous enverrons les instructions de récupération à votre adresse e-mail' : "We'll send recovery instructions to your email address"}
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-6 shadow-xl shadow-zinc-950/60">
          {isSuccess ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  {language === 'fr' ? 'Consultez votre boîte de réception' : 'Check your inbox'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {language === 'fr' ? (
                    <>Nous avons envoyé les instructions à <span className="font-semibold text-zinc-200">{email}</span>. Suivez le lien dans l’e-mail pour définir un nouveau mot de passe.</>
                  ) : (
                    <>We've sent password reset instructions to <span className="font-semibold text-zinc-200">{email}</span>. Follow the link in the email to set a new password.</>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="md"
                className="w-full mt-2"
                onClick={onNavigateSignIn}
              >
                {language === 'fr' ? 'Retour à la connexion' : 'Back to Sign In'}
              </Button>
            </div>
          ) : (
            <>
              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2.5 text-xs text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={t.auth.emailLabel}
                  type="email"
                  placeholder="owner@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  autoComplete="email"
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  isLoading={isSubmitting}
                >
                  {language === 'fr' ? 'Envoyer le lien de réinitialisation' : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="text-center space-y-2 text-xs text-zinc-400">
          <p>
            <button
              onClick={onNavigateSignIn}
              className="inline-flex items-center gap-1.5 font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{language === 'fr' ? 'Retour à la connexion' : 'Return to sign in'}</span>
            </button>
          </p>
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
