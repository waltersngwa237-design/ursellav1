import {
  Store,
  Receipt,
  Printer,
  ShieldCheck,
  Users,
  Database,
  Sliders,
} from 'lucide-react';
import type { SettingsSectionMetadata } from '../types.ts';

export const SETTINGS_SECTIONS: SettingsSectionMetadata[] = [
  // Commerce & Store Group
  {
    id: 'business',
    group: 'commerce',
    title: 'Store & Profile',
    titleFr: 'Profil de la Boutique',
    description: 'Store entity details, multi-store switcher, and regional currency.',
    descriptionFr: 'Identité commerciale, gestion multi-boutiques et devise régionale.',
    icon: Store,
    keywords: ['store', 'profile', 'business', 'name', 'boutique', 'nom', 'currency', 'devise', 'country', 'pays', 'timezone', 'demo', 'magasin'],
    getStatus: (ctx) => ({
      text: `${ctx.businessName || 'Store'} · ${ctx.currencyCode || 'XAF'}`,
      textFr: `${ctx.businessName || 'Boutique'} · ${ctx.currencyCode || 'XAF'}`,
      variant: 'emerald',
    }),
  },
  {
    id: 'tax-invoicing',
    group: 'commerce',
    title: 'Invoicing & Tax Rules',
    titleFr: 'Facturation & Règles Fiscales',
    description: 'VAT rates, receipt header/footer notes, and digital verification QR.',
    descriptionFr: 'Taux de TVA, mentions légales sur tickets et QR code de conformité.',
    icon: Receipt,
    keywords: ['tax', 'vat', 'tva', 'invoice', 'facture', 'receipt', 'ticket', 'notes', 'reçu', 'qr', 'prefix', 'fiscal'],
    getStatus: (ctx) => ({
      text: ctx.taxEnabled ? `VAT ${ctx.taxRate || 19.25}% Active` : 'Tax Disabled',
      textFr: ctx.taxEnabled ? `TVA ${ctx.taxRate || 19.25}% Active` : 'TVA Désactivée',
      variant: ctx.taxEnabled ? 'emerald' : 'zinc',
    }),
  },

  // POS & Hardware Group
  {
    id: 'hardware',
    group: 'pos',
    title: 'POS Hardware & Printing',
    titleFr: 'Matériel POS & Impression',
    description: 'Thermal receipt printer (58mm/80mm), cash drawer kick, and Bluetooth.',
    descriptionFr: 'Imprimantes thermiques ESC/POS, tiroir-caisse et connexion Bluetooth.',
    icon: Printer,
    keywords: ['hardware', 'printer', 'imprimante', 'thermal', 'thermique', '58mm', '80mm', 'bluetooth', 'drawer', 'tiroir', 'caisse', 'esc/pos', 'usb'],
    getStatus: (ctx) => ({
      text: `${ctx.paperWidth || '80mm'} Thermal · Ready`,
      textFr: `${ctx.paperWidth || '80mm'} Thermique · Prêt`,
      variant: 'emerald',
    }),
  },
  {
    id: 'security-pin',
    group: 'pos',
    title: 'Security & Manager PIN',
    titleFr: 'Sécurité & Code PIN Manager',
    description: 'Manager override PIN for cashier discounts, refunds, and permission levels.',
    descriptionFr: 'Code PIN pour remises en caisse, remboursements et rôles du personnel.',
    icon: ShieldCheck,
    keywords: ['security', 'pin', 'manager', 'sécurité', 'code', 'discount', 'remise', 'lock', 'cashier', 'caissier', 'rbac', 'override'],
    getStatus: () => ({
      text: 'PIN Override Active',
      textFr: 'Code PIN Actif',
      variant: 'emerald',
    }),
  },
  {
    id: 'team',
    group: 'pos',
    title: 'Team & Staff Access',
    titleFr: 'Équipe & Accès du Personnel',
    description: 'Cashier accounts, managers, role permissions, and access invitations.',
    descriptionFr: 'Comptes caissiers, gérants, permissions d’accès et invitations.',
    icon: Users,
    keywords: ['team', 'staff', 'personnel', 'équipe', 'member', 'cashier', 'caissier', 'invite', 'invitation', 'role'],
    getStatus: (ctx) => ({
      text: `${ctx.role?.toUpperCase() || 'OWNER'} Access`,
      textFr: `Rôle : ${ctx.role?.toUpperCase() || 'PROPRIÉTAIRE'}`,
      variant: 'blue',
    }),
  },

  // System & Account Group
  {
    id: 'data-cloud',
    group: 'system',
    title: 'Offline & Data Architecture',
    titleFr: 'Stockage Hors-Ligne & Cloud',
    description: 'Supabase RLS isolation, local IndexedDB cache, and workspace reset.',
    descriptionFr: 'Sécurité multi-tenant RLS, cache local IndexedDB et réinitialisation.',
    icon: Database,
    keywords: ['data', 'cloud', 'offline', 'hors-ligne', 'sync', 'synchro', 'reset', 'réinitialiser', 'supabase', 'backup', 'sauvegarde', 'indexeddb'],
    getStatus: (ctx) => ({
      text: ctx.isSupabaseConfigured ? 'Supabase RLS Active' : 'Local IndexedDB',
      textFr: ctx.isSupabaseConfigured ? 'Sécurité RLS Active' : 'Mode Local IndexedDB',
      variant: ctx.isSupabaseConfigured ? 'emerald' : 'amber',
    }),
  },
  {
    id: 'general',
    group: 'system',
    title: 'Preferences & Identity',
    titleFr: 'Préférences & Compte',
    description: 'User profile, daylight/night appearance theme, and language.',
    descriptionFr: 'Profil personnel, thème clair/sombre et langue de l’interface.',
    icon: Sliders,
    keywords: ['general', 'général', 'preferences', 'profile', 'profil', 'theme', 'thème', 'dark', 'light', 'sombre', 'clair', 'language', 'langue', 'french', 'english'],
    getStatus: (ctx) => ({
      text: `${ctx.language?.toUpperCase() || 'EN'} · ${ctx.theme === 'light' ? 'Light' : 'Dark'}`,
      textFr: `${ctx.language?.toUpperCase() || 'FR'} · ${ctx.theme === 'light' ? 'Clair' : 'Sombre'}`,
      variant: 'zinc',
    }),
  },
];
