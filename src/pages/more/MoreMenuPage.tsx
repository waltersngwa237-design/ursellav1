import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { isSupabaseConfigured } from '../../lib/supabase/client.ts';
import type { AppNavRoute } from '../../types/index.ts';
import { HardwarePrinterService } from '../../services/hardware-printer.service.ts';
import { FeedbackModal } from '../../components/feedback/FeedbackModal.tsx';
import { SettingsDirectory } from './components/SettingsDirectory.tsx';
import { SettingsBreadcrumb } from './components/SettingsBreadcrumb.tsx';
import { StoreProfileSection } from './sections/StoreProfileSection.tsx';
import { TaxInvoicingSection } from './sections/TaxInvoicingSection.tsx';
import { HardwarePrintingSection } from './sections/HardwarePrintingSection.tsx';
import { SecurityPinSection } from './sections/SecurityPinSection.tsx';
import { TeamAccessSection } from './sections/TeamAccessSection.tsx';
import { DataCloudSection } from './sections/DataCloudSection.tsx';
import { GeneralPreferencesSection } from './sections/GeneralPreferencesSection.tsx';
import { SETTINGS_SECTIONS } from './data/sectionsMeta.ts';
import type { SettingsSectionId, SettingsStatusContext } from './types.ts';
import { CheckCircle2, Sliders, ChevronRight } from 'lucide-react';

interface MoreMenuPageProps {
  onNavigate: (route: AppNavRoute) => void;
  defaultTab?: string;
}

export const MoreMenuPage: React.FC<MoreMenuPageProps> = ({
  onNavigate,
  defaultTab = 'business',
}) => {
  const { user } = useAuth();
  const { activeBusiness, activeRole, activeSettings, currency } = useBusiness();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  // Map legacy defaultTab to new section ids if needed
  const initialSection: SettingsSectionId = useMemo(() => {
    if (defaultTab === 'data') return 'data-cloud';
    if (defaultTab === 'general') return 'general';
    if (defaultTab === 'team') return 'team';
    if (defaultTab === 'hardware') return 'hardware';
    if (defaultTab === 'business') return 'business';
    const found = SETTINGS_SECTIONS.find((s) => s.id === defaultTab);
    return found ? found.id : 'business';
  }, [defaultTab]);

  // On mobile, activeSection can be null (meaning user is viewing the Level 1 Directory)
  // On desktop (md+), if activeSection is null, it falls back to initialSection
  const [activeSectionMobile, setActiveSectionMobile] = useState<SettingsSectionId | null>(null);
  const [activeSectionDesktop, setActiveSectionDesktop] = useState<SettingsSectionId>(initialSection);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleShowStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  const statusContext: SettingsStatusContext = {
    businessName: activeBusiness?.name,
    currencyCode: currency,
    paperWidth: HardwarePrinterService.getSettings().paperWidth,
    taxEnabled: activeSettings?.tax_enabled,
    taxRate: activeSettings?.tax_rate,
    isSupabaseConfigured: isSupabaseConfigured,
    language,
    theme,
    role: activeRole || 'owner',
    managerPinSet: true,
  };

  const currentSectionMetaDesktop =
    SETTINGS_SECTIONS.find((s) => s.id === activeSectionDesktop) || SETTINGS_SECTIONS[0];
  const currentSectionMetaMobile = activeSectionMobile
    ? SETTINGS_SECTIONS.find((s) => s.id === activeSectionMobile) || null
    : null;

  const renderSectionContent = (sectionId: SettingsSectionId) => {
    switch (sectionId) {
      case 'business':
        return <StoreProfileSection onStatusMessage={handleShowStatus} />;
      case 'tax-invoicing':
        return <TaxInvoicingSection onStatusMessage={handleShowStatus} />;
      case 'hardware':
        return <HardwarePrintingSection onStatusMessage={handleShowStatus} />;
      case 'security-pin':
        return <SecurityPinSection onStatusMessage={handleShowStatus} />;
      case 'team':
        return <TeamAccessSection />;
      case 'data-cloud':
        return (
          <DataCloudSection
            onNavigate={onNavigate}
            onStatusMessage={handleShowStatus}
          />
        );
      case 'general':
        return (
          <GeneralPreferencesSection
            onStatusMessage={handleShowStatus}
            onOpenFeedback={() => setIsFeedbackModalOpen(true)}
          />
        );
      default:
        return <StoreProfileSection onStatusMessage={handleShowStatus} />;
    }
  };

  return (
    <div className="space-y-5 pb-16 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">
              {isFr ? 'Paramètres & Configuration' : 'System & Store Settings'}
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {isFr
              ? 'Organisation hiérarchique : personnalisez votre boutique, règles fiscales, matériel et sécurité.'
              : 'Hierarchical control center: configure store profile, fiscal tax rules, POS hardware, and security.'}
          </p>
        </div>

        {/* Global Store Indicator */}
        {activeBusiness && (
          <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-white">{activeBusiness.name}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400 font-mono text-[11px]">{currency}</span>
          </div>
        )}
      </div>

      {/* Ephemeral Feedback Toast */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE DRILL-DOWN VIEW (< md)                                            */}
      {/* ========================================================================= */}
      <div className="block md:hidden">
        {activeSectionMobile === null ? (
          /* Level 1: Directory List */
          <div className="space-y-4">
            <SettingsDirectory
              activeSectionId={null}
              onSelectSection={(id) => {
                setActiveSectionMobile(id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              statusContext={statusContext}
              isFr={isFr}
            />
          </div>
        ) : (
          /* Level 2: Section Deep View */
          <div className="space-y-4">
            <SettingsBreadcrumb
              currentSection={currentSectionMetaMobile}
              onBackToDirectory={() => setActiveSectionMobile(null)}
              isFr={isFr}
            />

            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">
                {isFr ? currentSectionMetaMobile?.titleFr : currentSectionMetaMobile?.title}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isFr ? currentSectionMetaMobile?.descriptionFr : currentSectionMetaMobile?.description}
              </p>
            </div>

            {renderSectionContent(activeSectionMobile)}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP MASTER-DETAIL VIEW (>= md)                                       */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Category Directory (Master Navigation) */}
        <div className="md:col-span-4 xl:col-span-4 sticky top-20">
          <SettingsDirectory
            activeSectionId={activeSectionDesktop}
            onSelectSection={(id) => setActiveSectionDesktop(id)}
            statusContext={statusContext}
            isFr={isFr}
            isCompactSidebar={true}
          />
        </div>

        {/* Right Column: Deep Configuration Panel (Detail View) */}
        <div className="md:col-span-8 xl:col-span-8 space-y-4">
          <SettingsBreadcrumb
            currentSection={currentSectionMetaDesktop}
            onBackToDirectory={() => {}}
            isFr={isFr}
          />

          <div className="mb-3">
            <h2 className="text-xl font-black text-white">
              {isFr ? currentSectionMetaDesktop.titleFr : currentSectionMetaDesktop.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {isFr ? currentSectionMetaDesktop.descriptionFr : currentSectionMetaDesktop.description}
            </p>
          </div>

          {renderSectionContent(activeSectionDesktop)}
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        businessId={activeBusiness?.id || ''}
      />
    </div>
  );
};
