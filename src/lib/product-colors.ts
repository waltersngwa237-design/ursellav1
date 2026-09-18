/**
 * Color system and theme resolver for product cards, categories, and inventory states.
 * Designed with mathematically tuned low-saturation dark-mode tints to maximize readability,
 * scanning speed, and visual hierarchy.
 */

export interface CategoryColorTheme {
  id: string;
  name: string;
  bg: string;             // Card background tint
  border: string;         // Card border
  hoverBorder: string;    // Hover state
  badgeBg: string;        // Category badge background
  badgeText: string;      // Category badge text
  badgeBorder: string;    // Category badge border
  accentDot: string;      // Dot indicator color
  activeChipBg: string;   // Active category filter chip
  activeChipText: string;
  iconColor: string;
}

export const CATEGORY_PALETTES: CategoryColorTheme[] = [
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    bg: 'bg-cyan-950/20 hover:bg-cyan-950/30',
    border: 'border-cyan-500/20',
    hoverBorder: 'hover:border-cyan-500/50',
    badgeBg: 'bg-cyan-950/60',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-800/60',
    accentDot: 'bg-cyan-400',
    activeChipBg: 'bg-cyan-600',
    activeChipText: 'text-white',
    iconColor: 'text-cyan-400',
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    bg: 'bg-amber-950/20 hover:bg-amber-950/30',
    border: 'border-amber-500/20',
    hoverBorder: 'hover:border-amber-500/50',
    badgeBg: 'bg-amber-950/60',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-800/60',
    accentDot: 'bg-amber-400',
    activeChipBg: 'bg-amber-600',
    activeChipText: 'text-white',
    iconColor: 'text-amber-400',
  },
  {
    id: 'violet',
    name: 'Soft Violet',
    bg: 'bg-violet-950/20 hover:bg-violet-950/30',
    border: 'border-violet-500/20',
    hoverBorder: 'hover:border-violet-500/50',
    badgeBg: 'bg-violet-950/60',
    badgeText: 'text-violet-300',
    badgeBorder: 'border-violet-800/60',
    accentDot: 'bg-violet-400',
    activeChipBg: 'bg-violet-600',
    activeChipText: 'text-white',
    iconColor: 'text-violet-400',
  },
  {
    id: 'emerald',
    name: 'Emerald Mint',
    bg: 'bg-emerald-950/20 hover:bg-emerald-950/30',
    border: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-500/50',
    badgeBg: 'bg-emerald-950/60',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-800/60',
    accentDot: 'bg-emerald-400',
    activeChipBg: 'bg-emerald-600',
    activeChipText: 'text-white',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'rose',
    name: 'Berry Rose',
    bg: 'bg-rose-950/20 hover:bg-rose-950/30',
    border: 'border-rose-500/20',
    hoverBorder: 'hover:border-rose-500/50',
    badgeBg: 'bg-rose-950/60',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-800/60',
    accentDot: 'bg-rose-400',
    activeChipBg: 'bg-rose-600',
    activeChipText: 'text-white',
    iconColor: 'text-rose-400',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    bg: 'bg-indigo-950/20 hover:bg-indigo-950/30',
    border: 'border-indigo-500/20',
    hoverBorder: 'hover:border-indigo-500/50',
    badgeBg: 'bg-indigo-950/60',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-800/60',
    accentDot: 'bg-indigo-400',
    activeChipBg: 'bg-indigo-600',
    activeChipText: 'text-white',
    iconColor: 'text-indigo-400',
  },
  {
    id: 'teal',
    name: 'Deep Teal',
    bg: 'bg-teal-950/20 hover:bg-teal-950/30',
    border: 'border-teal-500/20',
    hoverBorder: 'hover:border-teal-500/50',
    badgeBg: 'bg-teal-950/60',
    badgeText: 'text-teal-300',
    badgeBorder: 'border-teal-800/60',
    accentDot: 'bg-teal-400',
    activeChipBg: 'bg-teal-600',
    activeChipText: 'text-white',
    iconColor: 'text-teal-400',
  },
  {
    id: 'orange',
    name: 'Tangerine Orange',
    bg: 'bg-orange-950/20 hover:bg-orange-950/30',
    border: 'border-orange-500/20',
    hoverBorder: 'hover:border-orange-500/50',
    badgeBg: 'bg-orange-950/60',
    badgeText: 'text-orange-300',
    badgeBorder: 'border-orange-800/60',
    accentDot: 'bg-orange-400',
    activeChipBg: 'bg-orange-600',
    activeChipText: 'text-white',
    iconColor: 'text-orange-400',
  },
  {
    id: 'sky',
    name: 'Sky Blue',
    bg: 'bg-sky-950/20 hover:bg-sky-950/30',
    border: 'border-sky-500/20',
    hoverBorder: 'hover:border-sky-500/50',
    badgeBg: 'bg-sky-950/60',
    badgeText: 'text-sky-300',
    badgeBorder: 'border-sky-800/60',
    accentDot: 'bg-sky-400',
    activeChipBg: 'bg-sky-600',
    activeChipText: 'text-white',
    iconColor: 'text-sky-400',
  },
  {
    id: 'fuchsia',
    name: 'Electric Fuchsia',
    bg: 'bg-fuchsia-950/20 hover:bg-fuchsia-950/30',
    border: 'border-fuchsia-500/20',
    hoverBorder: 'hover:border-fuchsia-500/50',
    badgeBg: 'bg-fuchsia-950/60',
    badgeText: 'text-fuchsia-300',
    badgeBorder: 'border-fuchsia-800/60',
    accentDot: 'bg-fuchsia-400',
    activeChipBg: 'bg-fuchsia-600',
    activeChipText: 'text-white',
    iconColor: 'text-fuchsia-400',
  },
];

const DEFAULT_THEME: CategoryColorTheme = {
  id: 'zinc',
  name: 'Neutral Slate',
  bg: 'bg-zinc-900/80 hover:bg-zinc-800/50',
  border: 'border-zinc-800',
  hoverBorder: 'hover:border-zinc-700',
  badgeBg: 'bg-zinc-800/80',
  badgeText: 'text-zinc-300',
  badgeBorder: 'border-zinc-700/60',
  accentDot: 'bg-zinc-400',
  activeChipBg: 'bg-zinc-100',
  activeChipText: 'text-zinc-950 font-bold',
  iconColor: 'text-zinc-400',
};

const CATEGORY_COLOR_OVERRIDE_KEY = 'ursella_category_color_overrides_';

/**
 * Get manually saved color override map for a business
 */
export function getCategoryColorOverrides(businessId?: string): Record<string, string> {
  if (!businessId || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${CATEGORY_COLOR_OVERRIDE_KEY}${businessId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist a category color theme choice for a category
 */
export function setCategoryColorOverride(businessId: string, categoryIdOrName: string, colorId: string): void {
  if (!businessId || !categoryIdOrName || typeof localStorage === 'undefined') return;
  try {
    const current = getCategoryColorOverrides(businessId);
    current[categoryIdOrName.toLowerCase()] = colorId;
    localStorage.setItem(`${CATEGORY_COLOR_OVERRIDE_KEY}${businessId}`, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to save category color override:', err);
  }
}

/**
 * Remove a category color override
 */
export function removeCategoryColorOverride(businessId: string, categoryIdOrName: string): void {
  if (!businessId || !categoryIdOrName || typeof localStorage === 'undefined') return;
  try {
    const current = getCategoryColorOverrides(businessId);
    delete current[categoryIdOrName.toLowerCase()];
    localStorage.setItem(`${CATEGORY_COLOR_OVERRIDE_KEY}${businessId}`, JSON.stringify(current));
  } catch {
    // ignore
  }
}

/**
 * Deterministically pick a curated theme or look up user-assigned color
 */
export function getCategoryTheme(
  categoryNameOrId?: string | null,
  businessId?: string,
  preferredColorId?: string | null
): CategoryColorTheme {
  // If explicitly requested by color ID
  if (preferredColorId) {
    const match = CATEGORY_PALETTES.find((p) => p.id === preferredColorId);
    if (match) return match;
  }

  if (!categoryNameOrId || !categoryNameOrId.trim()) {
    return DEFAULT_THEME;
  }

  const normalized = categoryNameOrId.trim().toLowerCase();

  // Check manual overrides if businessId is supplied or from global storage
  if (businessId) {
    const overrides = getCategoryColorOverrides(businessId);
    if (overrides[normalized]) {
      const match = CATEGORY_PALETTES.find((p) => p.id === overrides[normalized]);
      if (match) return match;
    }
  }

  // Semantic mappings for standard retail/commercial categories
  if (/drink|boisson|beverage|jus|juice|eau|water|biere|beer|bar|wine|vin|coffee|cafe/.test(normalized)) {
    return CATEGORY_PALETTES[0]; // cyan
  }
  if (/food|nourriture|snack|boulangerie|bakery|pain|bread|repas|meal|restaurant|patisserie/.test(normalized)) {
    return CATEGORY_PALETTES[1]; // amber
  }
  if (/beauty|beaute|cosmetic|cosmetique|soin|care|parfum|perfume|spa|salon/.test(normalized)) {
    return CATEGORY_PALETTES[2]; // violet
  }
  if (/fresh|frais|bio|organic|fruit|legume|vegetable|plante|grocery|epicerie/.test(normalized)) {
    return CATEGORY_PALETTES[3]; // emerald
  }
  if (/fashion|mode|vetement|clothes|chaussure|shoes|accessoire|bijoux|jewelry/.test(normalized)) {
    return CATEGORY_PALETTES[4]; // rose
  }
  if (/tech|electronique|electronic|phone|telephone|ordi|computer|cable|device/.test(normalized)) {
    return CATEGORY_PALETTES[5]; // indigo
  }
  if (/sante|health|pharmacie|pharmacy|medicament|medicine|medical/.test(normalized)) {
    return CATEGORY_PALETTES[6]; // teal
  }
  if (/hardware|quincaillerie|outil|tool|construction|auto|piece/.test(normalized)) {
    return CATEGORY_PALETTES[7]; // orange
  }
  if (/service|prestation|consulting|maintenance|digital|reparation|repair/.test(normalized)) {
    return CATEGORY_PALETTES[8]; // sky
  }

  // Hash-based deterministic distribution for any custom user category
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % CATEGORY_PALETTES.length;
  return CATEGORY_PALETTES[index];
}
