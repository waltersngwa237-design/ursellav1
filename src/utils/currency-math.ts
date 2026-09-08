/**
 * Currency & Financial Precision Math Utility
 * Protects against floating-point inaccuracy (e.g. 0.1 + 0.2 !== 0.3)
 * and guarantees penny-accurate totals across retail tax and split calculations.
 */

export function roundToDecimals(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface CartCalculationInputItem {
  id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface CartTotalsResult {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  tax: number;
  total: number;
  itemCount: number;
}

export function calculateCartTotals(
  items: CartCalculationInputItem[],
  taxRatePercent: number = 0,
  globalDiscount: number = 0,
  decimals: number = 2
): CartTotalsResult {
  let subtotal = 0;
  let itemDiscounts = 0;
  let itemCount = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unit_price) || 0);
    const disc = Math.max(0, Number(item.discount) || 0);

    const lineGross = qty * price;
    subtotal += lineGross;
    itemDiscounts += disc;
    itemCount += qty;
  }

  const effectiveGlobalDiscount = Math.min(
    Math.max(0, Number(globalDiscount) || 0),
    Math.max(0, subtotal - itemDiscounts)
  );

  const totalDiscount = roundToDecimals(itemDiscounts + effectiveGlobalDiscount, decimals);
  const taxableAmount = Math.max(0, roundToDecimals(subtotal - totalDiscount, decimals));
  const tax = roundToDecimals(taxableAmount * (Math.max(0, taxRatePercent) / 100), decimals);
  const total = roundToDecimals(taxableAmount + tax, decimals);

  return {
    subtotal: roundToDecimals(subtotal, decimals),
    totalDiscount,
    taxableAmount,
    tax,
    total,
    itemCount,
  };
}

export function calculateChangeDue(
  amountDue: number,
  amountPaid: number,
  decimals: number = 2
): { change: number; remainingDue: number; isPaidInFull: boolean } {
  const due = Math.max(0, roundToDecimals(amountDue, decimals));
  const paid = Math.max(0, roundToDecimals(amountPaid, decimals));

  if (paid >= due) {
    return {
      change: roundToDecimals(paid - due, decimals),
      remainingDue: 0,
      isPaidInFull: true,
    };
  }

  return {
    change: 0,
    remainingDue: roundToDecimals(due - paid, decimals),
    isPaidInFull: false,
  };
}
