import React from 'react';
import { ChevronLeft, ChevronRight, Sliders } from 'lucide-react';
import type { SettingsSectionMetadata } from '../types.ts';

interface SettingsBreadcrumbProps {
  currentSection: SettingsSectionMetadata | null;
  onBackToDirectory: () => void;
  isFr: boolean;
  isMobileOnly?: boolean;
}

export const SettingsBreadcrumb: React.FC<SettingsBreadcrumbProps> = ({
  currentSection,
  onBackToDirectory,
  isFr,
  isMobileOnly = false,
}) => {
  if (!currentSection) return null;

  return (
    <div className={`flex items-center justify-between gap-2 pb-3 mb-4 border-b border-zinc-800 ${isMobileOnly ? 'md:hidden' : ''}`}>
      <button
        onClick={onBackToDirectory}
        className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-emerald-400 cursor-pointer transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-zinc-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>{isFr ? 'Tous les Paramètres' : 'All Settings'}</span>
      </button>

      <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
        <span>{isFr ? 'Paramètres' : 'Settings'}</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-zinc-200 font-semibold truncate max-w-[160px] sm:max-w-none">
          {isFr ? currentSection.titleFr : currentSection.title}
        </span>
      </div>
    </div>
  );
};
