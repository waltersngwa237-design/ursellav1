import React from 'react';

export type SettingsSectionId =
  | 'business'
  | 'tax-invoicing'
  | 'hardware'
  | 'security-pin'
  | 'team'
  | 'data-cloud'
  | 'general';

export interface SettingsSectionMetadata {
  id: SettingsSectionId;
  group: 'commerce' | 'pos' | 'system';
  title: string;
  titleFr: string;
  description: string;
  descriptionFr: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  getStatus: (context: SettingsStatusContext) => { text: string; textFr: string; variant: 'emerald' | 'zinc' | 'amber' | 'blue' };
}

export interface SettingsStatusContext {
  businessName?: string;
  currencyCode?: string;
  paperWidth?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  isSupabaseConfigured?: boolean;
  language?: string;
  theme?: string;
  role?: string;
  managerPinSet?: boolean;
  teamCount?: number;
}
