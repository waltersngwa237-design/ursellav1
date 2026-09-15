import { generateUUID } from '../lib/uuid.ts';
import { SalesService } from './sales.service.ts';
import type { SaleWithDetails } from '../types/index.ts';

export interface CashMovement {
  id: string;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  timestamp: string;
  recorded_by?: string;
}

export interface RegisterShift {
  id: string;
  business_id: string;
  z_report_number: string; // e.g. "Z-001"
  shift_number: number;
  opened_at: string;
  opened_by: string;
  opening_float: number;
  closed_at?: string;
  closed_by?: string;
  status: 'open' | 'closed';
  // Cash movements during shift
  cash_movements: CashMovement[];
  cash_in: number;
  cash_out: number;
  // Sales aggregates
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  momo_sales: number;
  credit_sales: number;
  sales_count: number;
  total_tax: number;
  total_discounts: number;
  // Cash drawer audit
  expected_cash: number; // opening_float + cash_sales + cash_in - cash_out
  actual_cash_counted: number;
  discrepancy: number; // actual - expected
  notes?: string;
  manager_name?: string;
  manager_signed_off?: boolean;
}

const STORAGE_PREFIX = 'ursella_register_shifts_';
const Z_COUNTER_PREFIX = 'ursella_z_counter_';

export class RegisterCloseoutService {
  private static getStorageKey(businessId: string): string {
    return `${STORAGE_PREFIX}${businessId}`;
  }

  private static getCounterKey(businessId: string): string {
    return `${Z_COUNTER_PREFIX}${businessId}`;
  }

  private static getAllShifts(businessId: string): RegisterShift[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(businessId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static saveAllShifts(businessId: string, shifts: RegisterShift[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(businessId), JSON.stringify(shifts));
    } catch (err) {
      console.warn('Failed to save register shifts to local storage:', err);
    }
  }

  private static getNextZReportNumber(businessId: string): string {
    if (typeof localStorage === 'undefined') return 'Z-001';
    try {
      const current = parseInt(localStorage.getItem(this.getCounterKey(businessId)) || '0', 10);
      const next = current + 1;
      localStorage.setItem(this.getCounterKey(businessId), next.toString());
      return `Z-${String(next).padStart(3, '0')}`;
    } catch {
      return `Z-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Get the active currently open shift for the business, or create an initial open shift if none exists.
   */
  static async getCurrentShift(businessId: string, defaultCashier = 'Cashier'): Promise<RegisterShift> {
    const shifts = this.getAllShifts(businessId);
    let openShift = shifts.find((s) => s.status === 'open');

    if (!openShift) {
      // Create a starter open shift
      openShift = await this.openShift(businessId, 0, defaultCashier);
    } else {
      // Recalculate live metrics from sales
      openShift = await this.refreshShiftMetrics(businessId, openShift);
    }

    return openShift;
  }

  /**
   * Open a new register shift with a starting cash float
   */
  static async openShift(
    businessId: string,
    openingFloat: number,
    openedBy: string
  ): Promise<RegisterShift> {
    const shifts = this.getAllShifts(businessId);
    
    // Close any previous open shifts safely
    const now = new Date().toISOString();
    const updated = shifts.map((s) => (s.status === 'open' ? { ...s, status: 'closed' as const, closed_at: now } : s));

    const shiftCount = updated.length + 1;
    const newShift: RegisterShift = {
      id: generateUUID(),
      business_id: businessId,
      z_report_number: this.getNextZReportNumber(businessId),
      shift_number: shiftCount,
      opened_at: now,
      opened_by: openedBy.trim() || 'Store Cashier',
      opening_float: Math.max(0, openingFloat),
      status: 'open',
      cash_movements: [],
      cash_in: 0,
      cash_out: 0,
      total_sales: 0,
      cash_sales: 0,
      card_sales: 0,
      momo_sales: 0,
      credit_sales: 0,
      sales_count: 0,
      total_tax: 0,
      total_discounts: 0,
      expected_cash: Math.max(0, openingFloat),
      actual_cash_counted: Math.max(0, openingFloat),
      discrepancy: 0,
    };

    updated.unshift(newShift);
    this.saveAllShifts(businessId, updated);
    return newShift;
  }

  /**
   * Record petty cash paid in or paid out from cash drawer
   */
  static async recordCashMovement(
    businessId: string,
    shiftId: string,
    type: 'in' | 'out',
    amount: number,
    reason: string,
    recordedBy = 'Cashier'
  ): Promise<RegisterShift> {
    const shifts = this.getAllShifts(businessId);
    const shiftIndex = shifts.findIndex((s) => s.id === shiftId);
    if (shiftIndex === -1) throw new Error('Shift not found.');

    const shift = shifts[shiftIndex];
    const movement: CashMovement = {
      id: generateUUID(),
      type,
      amount: Math.abs(amount),
      reason: reason.trim() || (type === 'in' ? 'Cash Added to Drawer' : 'Petty Cash Payout'),
      timestamp: new Date().toISOString(),
      recorded_by: recordedBy,
    };

    const movements = [...(shift.cash_movements || []), movement];
    const cashIn = movements.filter((m) => m.type === 'in').reduce((acc, m) => acc + m.amount, 0);
    const cashOut = movements.filter((m) => m.type === 'out').reduce((acc, m) => acc + m.amount, 0);

    const updatedShift: RegisterShift = {
      ...shift,
      cash_movements: movements,
      cash_in: cashIn,
      cash_out: cashOut,
    };

    const refreshed = await this.refreshShiftMetrics(businessId, updatedShift);
    shifts[shiftIndex] = refreshed;
    this.saveAllShifts(businessId, shifts);
    return refreshed;
  }

  /**
   * Calculate live transaction totals since shift was opened
   */
  static async refreshShiftMetrics(businessId: string, shift: RegisterShift): Promise<RegisterShift> {
    try {
      const sales: SaleWithDetails[] = await SalesService.getSales(businessId, {
        startDate: shift.opened_at,
        endDate: shift.closed_at || new Date().toISOString(),
      });

      let totalSales = 0;
      let cashSales = 0;
      let cardSales = 0;
      let momoSales = 0;
      let creditSales = 0;
      let totalTax = 0;
      let totalDiscounts = 0;

      for (const sale of sales) {
        if (sale.sale_status === 'cancelled') continue;
        const total = Number(sale.total || 0);
        totalSales += total;
        totalTax += Number(sale.tax || 0);
        totalDiscounts += Number(sale.discount || 0);

        const method = (sale.payment_method || 'cash').toLowerCase();
        const paidAmount = Number(sale.amount_paid ?? total);

        if (sale.payment_status === 'unpaid' || paidAmount === 0) {
          creditSales += total;
        } else if (method === 'cash') {
          cashSales += paidAmount;
        } else if (method === 'card') {
          cardSales += paidAmount;
        } else if (method === 'mobile_money') {
          momoSales += paidAmount;
        } else {
          // bank or other electronic
          cardSales += paidAmount;
        }
      }

      const expectedCash =
        Number(shift.opening_float || 0) + cashSales + Number(shift.cash_in || 0) - Number(shift.cash_out || 0);
      const discrepancy = Number(shift.actual_cash_counted || 0) - expectedCash;

      return {
        ...shift,
        total_sales: totalSales,
        cash_sales: cashSales,
        card_sales: cardSales,
        momo_sales: momoSales,
        credit_sales: creditSales,
        sales_count: sales.length,
        total_tax: totalTax,
        total_discounts: totalDiscounts,
        expected_cash: expectedCash,
        discrepancy: discrepancy,
      };
    } catch (err) {
      console.warn('Failed to calculate shift sales metrics:', err);
      return shift;
    }
  }

  /**
   * Close the register shift and generate official End-of-Day Z-Report
   */
  static async closeShift(
    businessId: string,
    shiftId: string,
    actualCashCounted: number,
    closedBy = 'Cashier',
    notes = '',
    managerName = ''
  ): Promise<RegisterShift> {
    const shifts = this.getAllShifts(businessId);
    const index = shifts.findIndex((s) => s.id === shiftId);
    if (index === -1) throw new Error('Shift not found.');

    const current = shifts[index];
    const closedShift: RegisterShift = {
      ...current,
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: closedBy,
      actual_cash_counted: Math.max(0, actualCashCounted),
      notes: notes.trim(),
      manager_name: managerName.trim(),
      manager_signed_off: Boolean(managerName.trim()),
    };

    const finalShift = await this.refreshShiftMetrics(businessId, closedShift);
    finalShift.discrepancy = finalShift.actual_cash_counted - finalShift.expected_cash;

    shifts[index] = finalShift;
    this.saveAllShifts(businessId, shifts);
    return finalShift;
  }

  /**
   * Get all past closed shifts (Z-Reports history)
   */
  static getHistoricCloseouts(businessId: string): RegisterShift[] {
    const shifts = this.getAllShifts(businessId);
    return shifts.filter((s) => s.status === 'closed');
  }
}
