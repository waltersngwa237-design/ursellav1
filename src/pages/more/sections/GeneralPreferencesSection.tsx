import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext.tsx';
import { useTheme } from '../../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { Card } from '../../../components/common/Card.tsx';
import { Button } from '../../../components/common/Button.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import { Modal } from '../../../components/common/Modal.tsx';
import {
  User,
  Sliders,
  Sun,
  Moon,
  CheckCircle2,
  Edit3,
  Check,
  LogOut,
  Mail,
  Phone,
  Volume2,
  Smartphone,
} from 'lucide-react';

interface GeneralPreferencesSectionProps {
  onStatusMessage: (msg: string) => void;
  onOpenFeedback: () => void;
}

export const GeneralPreferencesSection: React.FC<GeneralPreferencesSectionProps> = ({
  onStatusMessage,
  onOpenFeedback,
}) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isFr = language === 'fr';

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(profile?.full_name || '');
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Sound feedback preference
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ursella_sound_feedback') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (profile) {
      setProfileName(profile.full_name || '');
      setProfilePhone(profile.phone || '');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileError(isFr ? 'Veuillez saisir votre nom complet.' : 'Please enter your full name.');
      return;
    }
    try {
      setProfileSaving(true);
      setProfileError(null);
      await updateProfile({
        full_name: profileName.trim(),
        phone: profilePhone.trim() || null,
      });
      setIsEditProfileModalOpen(false);
      onStatusMessage(isFr ? 'Profil mis à jour avec succès.' : 'Your profile information was updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : (isFr ? 'Erreur de mise à jour du profil.' : 'Failed to update profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem('ursella_sound_feedback', String(enabled));
    } catch {}
    onStatusMessage(
      enabled
        ? isFr ? 'Sons et retours haptiques activés.' : 'Audio feedback enabled.'
        : isFr ? 'Sons désactivés.' : 'Audio feedback disabled.'
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Account Identity Card */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {profile?.full_name || 'Merchant Account'}
                </h3>
                <Badge variant="zinc">PRIMARY OPERATOR</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{user?.email}</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setProfileError(null);
              setIsEditProfileModalOpen(true);
            }}
            leftIcon={<Edit3 className="w-3.5 h-3.5 text-emerald-400" />}
            className="text-xs cursor-pointer shrink-0"
          >
            {isFr ? 'Modifier le Profil' : 'Edit Profile'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-3">
            <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Email</span>
              <span className="text-xs text-zinc-200 font-medium truncate block">{user?.email}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-3">
            <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">{isFr ? 'Téléphone' : 'Phone'}</span>
              <span className="text-xs text-zinc-200 font-medium truncate block">
                {profile?.phone || (isFr ? 'Non configuré' : 'Not configured')}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Theme & Appearance Card */}
      <Card className="space-y-4">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider pb-2 border-b border-zinc-800">
          {isFr ? 'Thème Visuel & Affichage' : 'Theme & Appearance'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                {isFr ? 'Mode Sombre (Par Défaut)' : 'Dark Canvas (Default)'}
                {theme === 'dark' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] text-zinc-400">
                {isFr ? 'Idéal pour économiser la batterie en caisse' : 'High-contrast eye safety for long retail shifts'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                {isFr ? 'Mode Clair' : 'Light Canvas'}
                {theme === 'light' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] text-zinc-400">
                {isFr ? 'Clarté maximale en plein soleil' : 'Maximum legibility under direct storefront lighting'}
              </span>
            </div>
          </button>
        </div>
      </Card>

      {/* Language & Regional Settings Card */}
      <Card className="space-y-4">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider pb-2 border-b border-zinc-800">
          {isFr ? 'Langue de l’Application' : 'Interface Language'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30'
                : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
              EN
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                English
                {language === 'en' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] text-zinc-400">Default global business language</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('fr')}
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              language === 'fr'
                ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30'
                : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
              FR
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                Français
                {language === 'fr' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] text-zinc-400">Pour le commerce en Afrique francophone</span>
            </div>
          </button>
        </div>
      </Card>

      {/* POS Sounds & Haptic Feedback */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-100 block">
                {isFr ? 'Retours Sonores & Vibrations en Caisse' : 'Audio & Haptic Feedback at POS'}
              </span>
              <span className="text-[11px] text-zinc-400">
                {isFr ? 'Bip sonore et vibration tactile lors de la lecture d’un code-barres.' : 'Beep audio confirmation and subtle vibration on barcode scan.'}
              </span>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => handleSoundToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </Card>

      {/* Sign Out & Feedback */}
      <div className="flex items-center justify-between pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenFeedback}
          className="text-xs cursor-pointer"
        >
          {isFr ? 'Envoyer un Avis / Suggestion' : 'Send Feedback & Suggestions'}
        </Button>

        <Button
          size="sm"
          variant="danger"
          onClick={() => signOut()}
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
          className="text-xs cursor-pointer"
        >
          {isFr ? 'Se Déconnecter' : 'Sign Out'}
        </Button>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        title={isFr ? 'Modifier les Informations du Profil' : 'Edit Profile Information'}
        description={isFr ? 'Mettez à jour votre nom d’affichage et votre numéro de téléphone pour les alertes.' : 'Update your display name and contact phone number.'}
      >
        <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
          {profileError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {profileError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Nom Complet' : 'Full Name'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. Jean Dupont"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Numéro de Téléphone' : 'Phone Number'}
            </label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="e.g. +237 690 00 00 00"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-[11px] text-zinc-500">{isFr ? 'Utilisé pour les reçus WhatsApp et les alertes.' : 'Used for WhatsApp receipts and alerts.'}</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              {isFr ? 'Adresse Email' : 'Email Address'}
            </label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditProfileModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={profileSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              {isFr ? 'Enregistrer le Profil' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
