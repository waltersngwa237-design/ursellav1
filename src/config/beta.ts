/**
 * Ursella Real-User Beta Configuration
 * Allows toggling beta banners, debug tools, demo buttons, and feedback mechanisms
 * without requiring codebase rewrites.
 */

export interface BetaConfig {
  /** Active beta release version */
  version: string;
  /** Whether the app is currently running in beta testing mode */
  isBeta: boolean;
  /** Whether beta feedback widget/button is enabled */
  feedbackEnabled: boolean;
  /** Whether demo business 1-click seeding is enabled (hidden by default for clean real testing) */
  allowDemoCreation: boolean;
  /** Whether to strictly enforce Supabase Auth as the source of truth */
  strictSupabaseAuth: boolean;
  /** Whether to display beta release notes / onboarding tips */
  showOnboardingGuide: boolean;
  /** Maximum upload limit in MB */
  maxUploadMb: number;
}

export const BETA_CONFIG: BetaConfig = {
  version: '0.9.5-beta',
  isBeta: true,
  feedbackEnabled: true,
  allowDemoCreation: false, // Default to FALSE for real-user testing so real users start with 100% clean data
  strictSupabaseAuth: true,
  showOnboardingGuide: true,
  maxUploadMb: 10,
};
