import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, X, Sparkles } from 'lucide-react';
import type { SettingsSectionId, SettingsSectionMetadata, SettingsStatusContext } from '../types.ts';
import { SETTINGS_SECTIONS } from '../data/sectionsMeta.ts';

interface SettingsDirectoryProps {
  activeSectionId: SettingsSectionId | null;
  onSelectSection: (id: SettingsSectionId) => void;
  statusContext: SettingsStatusContext;
  isFr: boolean;
  isCompactSidebar?: boolean;
}

export const SettingsDirectory: React.FC<SettingsDirectoryProps> = ({
  activeSectionId,
  onSelectSection,
  statusContext,
  isFr,
  isCompactSidebar = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return SETTINGS_SECTIONS.filter((sec) => {
      const titleMatch = (isFr ? sec.titleFr : sec.title).toLowerCase().includes(q);
      const descMatch = (isFr ? sec.descriptionFr : sec.description).toLowerCase().includes(q);
      const keywordMatch = sec.keywords.some((k) => k.toLowerCase().includes(q));
      return titleMatch || descMatch || keywordMatch;
    });
  }, [searchQuery, isFr]);

  const groups = [
    {
      id: 'commerce',
      label: isFr ? 'Commerce & Boutique' : 'Store & Commerce',
      sections: SETTINGS_SECTIONS.filter((s) => s.group === 'commerce'),
    },
    {
      id: 'pos',
      label: isFr ? 'Point de Vente & Équipement' : 'Point of Sale & Peripherals',
      sections: SETTINGS_SECTIONS.filter((s) => s.group === 'pos'),
    },
    {
      id: 'system',
      label: isFr ? 'Système & Compte' : 'System & Preferences',
      sections: SETTINGS_SECTIONS.filter((s) => s.group === 'system'),
    },
  ];

  const renderSectionCard = (sec: SettingsSectionMetadata) => {
    const Icon = sec.icon;
    const status = sec.getStatus(statusContext);
    const isActive = activeSectionId === sec.id;

    const variantClasses = {
      emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      zinc: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
      amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      blue: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    }[status.variant];

    return (
      <button
        key={sec.id}
        onClick={() => onSelectSection(sec.id)}
        className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between gap-3 ${
          isActive
            ? 'bg-zinc-850 border-emerald-500/60 shadow-xs ring-1 ring-emerald-500/30'
            : 'bg-zinc-900/90 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-850/60'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
              isActive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 group-hover:text-emerald-400 group-hover:border-zinc-700'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`text-xs sm:text-sm font-bold truncate ${isActive ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
                {isFr ? sec.titleFr : sec.title}
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border shrink-0 ${variantClasses}`}>
                {isFr ? status.textFr : status.text}
              </span>
            </div>
            {!isCompactSidebar && (
              <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                {isFr ? sec.descriptionFr : sec.description}
              </p>
            )}
          </div>
        </div>

        <ChevronRight
          className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
            isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
          }`}
        />
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            isFr
              ? 'Rechercher un paramètre (ex: TVA, PIN, imprimante, devise)...'
              : 'Search settings (e.g. tax, PIN, printer, currency)...'
          }
          className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-emerald-500/80 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Mode */}
      {filteredSections !== null ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1 pb-1">
            <span>
              {isFr
                ? `${filteredSections.length} résultat(s) trouvé(s)`
                : `${filteredSections.length} result(s) found`}
            </span>
            <span className="text-[10px] text-zinc-500">{isFr ? 'Cliquez pour ouvrir' : 'Click to configure'}</span>
          </div>

          {filteredSections.length > 0 ? (
            <div className="space-y-2">
              {filteredSections.map(renderSectionCard)}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
              <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-300">
                {isFr ? 'Aucun paramètre trouvé' : 'No settings matching your search'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {isFr ? 'Essayez des mots-clés comme "TVA", "imprimante", "devise" ou "mot de passe".' : 'Try keywords like "tax", "printer", "currency", or "PIN".'}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Categorized Groups Mode */
        <div className="space-y-5">
          {groups.map((grp) => (
            <div key={grp.id} className="space-y-2">
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                {grp.label}
              </h3>
              <div className="space-y-2">
                {grp.sections.map(renderSectionCard)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
