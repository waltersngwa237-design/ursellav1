// Ursella FIFO Engine — adapter mapped to Ursella PostgreSQL / Supabase schema.
import type { SourceAdapter } from './adapter.ts';
import type {
  AdjustmentEvent,
  InventoryEvent,
  Product,
  ReceiptEvent,
  ReturnEvent,
  SaleEvent,
} from './types.ts';

/** Ursella products table row shape. */
export interface UrsellaProductRow {
  id: string;
  business_id?: string;
  name: string;
  sku?: string | null;
  product_type?: string;
  unit_of_measure?: string;
  selling_price: number | string;
  cost_price: number | string;
  stock_quantity: number | string;
  is_active?: boolean;
}

/** Ursella inventory_transactions table row shape. */
export interface UrsellaInventoryTransactionRow {
  id: string;
  business_id?: string;
  product_id: string;
  transaction_type: string; // 'purchase' | 'sale' | 'adjustment' | 'return' | 'restock' | 'damage' | 'initial_stock'
  quantity: number | string;
  unit_cost?: number | string | null;
  created_at: string;
  notes?: string | null;
}

/** Ursella sale_items table row shape. */
export interface UrsellaSaleItemRow {
  id: string;
  sale_id: string;
  business_id?: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
  unit_cost: number | string;
  discount?: number | string | null;
  subtotal: number | string;
  total: number | string;
  created_at: string;
}

/** Safe numeric parsing for Postgres NUMERIC / string values. */
export function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Classify transaction_type loosely to handle enums. */
export function classifyTransaction(
  t: string
): 'receipt' | 'return' | 'adjustment' | 'sale' | 'skip' {
  const norm = t.toLowerCase().replace(/[-_ ]/g, '');
  if (
    norm === 'purchase' ||
    norm === 'receipt' ||
    norm === 'stockin' ||
    norm === 'restock' ||
    norm === 'initialstock' ||
    norm === 'in'
  ) {
    return 'receipt';
  }
  if (norm === 'return' || norm === 'customerreturn') {
    return 'return';
  }
  if (norm === 'sale' || norm === 'pos' || norm === 'checkout') {
    return 'sale';
  }
  if (
    norm === 'adjustment' ||
    norm === 'stocktake' ||
    norm === 'correction' ||
    norm === 'audit' ||
    norm === 'damage' ||
    norm === 'damaged' ||
    norm === 'shrinkage' ||
    norm === 'loss' ||
    norm === 'writeoff'
  ) {
    return 'adjustment';
  }
  return 'adjustment';
}

export type CostResolver = (
  row: UrsellaInventoryTransactionRow,
  ctx: { productCost: number | undefined }
) => number;

export interface UrsellaAdapterOptions {
  transactionTypeMap?: Record<string, 'receipt' | 'return' | 'adjustment' | 'sale' | 'skip'>;
  productCostById?: Record<string, number>;
  costResolver?: CostResolver;
  revenueBasis?: 'total' | 'subtotal' | 'unit_price';
}

export interface AdapterIssue {
  rowId: string;
  code: 'null_product_id' | 'missing_cost';
  message: string;
}

export interface UrsellaAdapter
  extends SourceAdapter<
    UrsellaProductRow,
    UrsellaInventoryTransactionRow,
    UrsellaSaleItemRow
  > {
  issues: AdapterIssue[];
}

export function createUrsellaAdapter(options: UrsellaAdapterOptions = {}): UrsellaAdapter {
  const {
    transactionTypeMap = {},
    productCostById = {},
    revenueBasis = 'total',
    costResolver,
  } = options;

  const issues: AdapterIssue[] = [];

  const resolveCost: CostResolver =
    costResolver ??
    ((row, ctx) => {
      if (row.unit_cost !== undefined && row.unit_cost !== null) return num(row.unit_cost);
      if (ctx.productCost !== undefined) return ctx.productCost;
      issues.push({
        rowId: row.id,
        code: 'missing_cost',
        message:
          'inventory_transactions has no unit_cost and no products.cost_price was supplied for product ' +
          row.product_id +
          '; costed at 0.',
      });
      return 0;
    });

  return {
    issues,
    toProduct: (r): Product => ({
      id: r.id,
      name: r.name,
      sku: r.sku ?? undefined,
    }),
    stockMovementToEvent: (r): ReceiptEvent | ReturnEvent | AdjustmentEvent | null => {
      const kind = transactionTypeMap[r.transaction_type] ?? classifyTransaction(r.transaction_type);
      // Sales are costed from sale_items to prevent double consumption
      if (kind === 'sale' || kind === 'skip') return null;

      const base = { id: r.id, productId: r.product_id, occurredAt: r.created_at };
      const rawQty = num(r.quantity);
      const productCost = productCostById[r.product_id];

      if (kind === 'receipt') {
        return {
          kind: 'receipt',
          ...base,
          quantity: Math.abs(rawQty),
          unitCost: resolveCost(r, { productCost }),
        };
      }

      if (kind === 'return') {
        return {
          kind: 'return',
          ...base,
          quantity: Math.abs(rawQty),
          unitCost: r.unit_cost === undefined || r.unit_cost === null ? undefined : num(r.unit_cost),
        };
      }

      // Adjustment: damage/shrinkage should be negative; purchase/addition positive
      const isDamage =
        r.transaction_type.toLowerCase().includes('damage') ||
        r.transaction_type.toLowerCase().includes('loss') ||
        r.transaction_type.toLowerCase().includes('shrinkage');

      const qty = isDamage ? -Math.abs(rawQty) : rawQty;

      return {
        kind: 'adjustment',
        ...base,
        quantity: qty,
        unitCost: qty > 0 ? resolveCost(r, { productCost }) : undefined,
        reason: r.notes ?? r.transaction_type ?? undefined,
      };
    },
    saleLineItemToEvent: (r): SaleEvent | null => {
      if (!r.product_id) {
        issues.push({
          rowId: r.id,
          code: 'null_product_id',
          message:
            'sale_items row has a NULL product_id (' +
            r.product_name_snapshot +
            '); cannot be costed, skipped.',
        });
        return null;
      }

      const qty = num(r.quantity);
      let effectiveUnitPrice: number;
      if (revenueBasis === 'unit_price') {
        effectiveUnitPrice = num(r.unit_price);
      } else {
        const gross = revenueBasis === 'subtotal' ? num(r.subtotal) : num(r.total);
        effectiveUnitPrice = qty !== 0 ? gross / qty : 0;
      }

      return {
        kind: 'sale',
        id: r.id,
        productId: r.product_id,
        occurredAt: r.created_at,
        quantity: qty,
        unitPrice: effectiveUnitPrice,
        saleId: r.sale_id,
      };
    },
  };
}

/** Build the products.cost_price lookup the adapter uses as its cost basis. */
export function productCostIndex(rows: UrsellaProductRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.id] = num(r.cost_price);
  return out;
}

/**
 * Seed opening cost lots from products.cost_price x stock_quantity.
 */
export function openingLotsFromProducts(
  rows: UrsellaProductRow[],
  openingDate = '1970-01-01T00:00:00Z'
): InventoryEvent[] {
  const events: InventoryEvent[] = [];
  for (const r of rows) {
    if (r.product_type === 'service') continue;
    const qty = num(r.stock_quantity);
    if (qty > 0) {
      events.push({
        kind: 'receipt',
        id: 'opening:' + r.id,
        productId: r.id,
        occurredAt: openingDate,
        quantity: qty,
        unitCost: num(r.cost_price),
      });
    }
  }
  return events;
}

/** Filter any tenant-scoped row set to one business before costing. */
export function forBusiness<T extends { business_id?: string }>(
  rows: T[],
  businessId: string
): T[] {
  return rows.filter((r) => r.business_id === undefined || r.business_id === businessId);
}

/** Compare recorded snapshot cost vs true FIFO cost. */
export function compareToRecordedCost(
  saleItems: UrsellaSaleItemRow[],
  sales: Array<{ saleEventId: string; cogs: number }>
): {
  rows: Array<{ saleItemId: string; recordedCogs: number; fifoCogs: number; difference: number }>;
  totalRecorded: number;
  totalFifo: number;
  totalDifference: number;
} {
  const fifoById = new Map(sales.map((s) => [s.saleEventId, s.cogs]));
  const rows: Array<{
    saleItemId: string;
    recordedCogs: number;
    fifoCogs: number;
    difference: number;
  }> = [];

  let totalRecorded = 0;
  let totalFifo = 0;

  for (const item of saleItems) {
    const fifoCogs = fifoById.get(item.id);
    if (fifoCogs === undefined) continue;
    const recordedCogs = num(item.unit_cost) * num(item.quantity);
    totalRecorded += recordedCogs;
    totalFifo += fifoCogs;
    const difference = Math.round((fifoCogs - recordedCogs) * 100) / 100;
    if (difference !== 0) rows.push({ saleItemId: item.id, recordedCogs, fifoCogs, difference });
  }

  return {
    rows,
    totalRecorded: Math.round(totalRecorded * 100) / 100,
    totalFifo: Math.round(totalFifo * 100) / 100,
    totalDifference: Math.round((totalFifo - totalRecorded) * 100) / 100,
  };
}

/** Reconcile computed on-hand against products.stock_quantity. */
export function reconcileStock(
  rows: UrsellaProductRow[],
  valuationByProduct: Record<string, { quantityOnHand: number }>
): Array<{ productId: string; name: string; snapshot: number; computed: number; drift: number }> {
  const out: Array<{
    productId: string;
    name: string;
    snapshot: number;
    computed: number;
    drift: number;
  }> = [];

  for (const r of rows) {
    if (r.product_type === 'service') continue;
    const snapshot = num(r.stock_quantity);
    const computed = valuationByProduct[r.id]?.quantityOnHand ?? 0;
    const drift = computed - snapshot;
    if (drift !== 0) out.push({ productId: r.id, name: r.name, snapshot, computed, drift });
  }

  return out;
}
