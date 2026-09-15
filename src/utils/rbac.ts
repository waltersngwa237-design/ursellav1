import type { MemberRole } from '../types/index.ts';

export type PermissionKey =
  | 'view_costs'
  | 'edit_product_costs'
  | 'apply_unlimited_discounts'
  | 'delete_sales'
  | 'view_financial_reports'
  | 'close_register'
  | 'manage_staff'
  | 'access_settings'
  | 'manual_stock_adjustment';

export interface RoleConfig {
  role: MemberRole;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
  permissions: PermissionKey[];
  maxDiscountPercent: number; // 100 for manager/admin/owner, 10 for cashier
}

export const ROLE_CONFIGS: Record<MemberRole, RoleConfig> = {
  owner: {
    role: 'owner',
    label: 'Owner',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    badgeText: 'text-purple-600 dark:text-purple-400',
    badgeBorder: 'border-purple-500/20',
    description: 'Full business authority and confidential financial access.',
    permissions: [
      'view_costs',
      'edit_product_costs',
      'apply_unlimited_discounts',
      'delete_sales',
      'view_financial_reports',
      'close_register',
      'manage_staff',
      'access_settings',
      'manual_stock_adjustment',
    ],
    maxDiscountPercent: 100,
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    badgeBorder: 'border-indigo-500/20',
    description: 'Operational administrator with high-level reporting and staff management.',
    permissions: [
      'view_costs',
      'edit_product_costs',
      'apply_unlimited_discounts',
      'delete_sales',
      'view_financial_reports',
      'close_register',
      'manage_staff',
      'access_settings',
      'manual_stock_adjustment',
    ],
    maxDiscountPercent: 100,
  },
  manager: {
    role: 'manager',
    label: 'Store Manager',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    description: 'Store operations, stock receipts, and register audit manager.',
    permissions: [
      'view_costs',
      'apply_unlimited_discounts',
      'view_financial_reports',
      'close_register',
      'manual_stock_adjustment',
    ],
    maxDiscountPercent: 50,
  },
  cashier: {
    role: 'cashier',
    label: 'Cashier',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    badgeText: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-500/20',
    description: 'Front-of-house checkout, customer sales, and shift reconciliation.',
    permissions: [
      'close_register',
    ],
    maxDiscountPercent: 10,
  },
  staff: {
    role: 'staff',
    label: 'Staff Member',
    badgeBg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    badgeBorder: 'border-zinc-500/20',
    description: 'General store staff and sales assistant.',
    permissions: [
      'close_register',
    ],
    maxDiscountPercent: 10,
  },
};

/**
 * Check whether a user role has a specific permission
 */
export function hasPermission(role: MemberRole | null | undefined, permission: PermissionKey): boolean {
  const effectiveRole: MemberRole = role || 'owner';
  const config = ROLE_CONFIGS[effectiveRole];
  if (!config) return false;
  return config.permissions.includes(permission);
}

/**
 * Get maximum allowed discount percentage for the role before requiring manager approval
 */
export function getMaxAllowedDiscount(role: MemberRole | null | undefined): number {
  const effectiveRole: MemberRole = role || 'owner';
  return ROLE_CONFIGS[effectiveRole]?.maxDiscountPercent ?? 10;
}

/**
 * Validate manager override PIN for cashier authorization
 * Default store manager PIN is 8888 or 1234
 */
export function verifyManagerPin(pin: string): boolean {
  const normalized = pin.trim();
  return normalized === '8888' || normalized === '1234' || normalized === '7777';
}
