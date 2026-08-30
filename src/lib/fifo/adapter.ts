// Ursella FIFO Engine — adapter layer.
import type {
  AdjustmentEvent,
  InventoryEvent,
  Product,
  ReceiptEvent,
  ReturnEvent,
  SaleEvent,
} from './types.ts';

/** Map source row shapes into the engine's contract. */
export interface SourceAdapter<ProductRow, MovementRow, SaleLineRow> {
  toProduct(row: ProductRow): Product;
  /** Return a receipt / return / adjustment event — or null to skip the row. */
  stockMovementToEvent(row: MovementRow): ReceiptEvent | ReturnEvent | AdjustmentEvent | null;
  /** Return a sale event — or null to skip the row. */
  saleLineItemToEvent(row: SaleLineRow): SaleEvent | null;
}

export interface SourceTables<ProductRow, MovementRow, SaleLineRow> {
  products: ProductRow[];
  stockMovements: MovementRow[];
  saleLineItems: SaleLineRow[];
}

export interface BuiltInput {
  products: Product[];
  events: InventoryEvent[];
}

/** Turn source tables into the { products, events } the engine consumes. */
export function buildInput<ProductRow, MovementRow, SaleLineRow>(
  adapter: SourceAdapter<ProductRow, MovementRow, SaleLineRow>,
  tables: SourceTables<ProductRow, MovementRow, SaleLineRow>
): BuiltInput {
  const products = tables.products.map((r) => adapter.toProduct(r));
  const events: InventoryEvent[] = [];

  for (const r of tables.stockMovements) {
    const e = adapter.stockMovementToEvent(r);
    if (e) events.push(e);
  }

  for (const r of tables.saleLineItems) {
    const e = adapter.saleLineItemToEvent(r);
    if (e) events.push(e);
  }

  return { products, events };
}
