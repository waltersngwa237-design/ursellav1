import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInput,
  classifyTransaction,
  compareToRecordedCost,
  createUrsellaAdapter,
  forBusiness,
  num,
  openingLotsFromProducts,
  productCostIndex,
  reconcileStock,
  runLedger,
  type UrsellaInventoryTransactionRow,
  type UrsellaProductRow,
  type UrsellaSaleItemRow,
} from '../../src/lib/fifo/index.ts';

test('postgres numeric strings are parsed', () => {
  assert.equal(num('12.50'), 12.5);
  assert.equal(num('0'), 0);
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
  assert.equal(num(42), 42);
});

test('inventory_transaction_type classification is tolerant', () => {
  assert.equal(classifyTransaction('purchase'), 'receipt');
  assert.equal(classifyTransaction('Purchase'), 'receipt');
  assert.equal(classifyTransaction('stock_in'), 'receipt');
  assert.equal(classifyTransaction('restock'), 'receipt');
  assert.equal(classifyTransaction('initial_stock'), 'receipt');
  assert.equal(classifyTransaction('sale'), 'sale');
  assert.equal(classifyTransaction('return'), 'return');
  assert.equal(classifyTransaction('adjustment'), 'adjustment');
  assert.equal(classifyTransaction('damage'), 'adjustment');
});

test('transactionTypeMap overrides the heuristic for custom enum labels', () => {
  const adapter = createUrsellaAdapter({
    transactionTypeMap: { stock_take: 'adjustment', internal_transfer: 'skip' },
  });
  const ev1 = adapter.stockMovementToEvent({
    id: 'tx1',
    product_id: 'p1',
    transaction_type: 'stock_take',
    quantity: 5,
    unit_cost: 10,
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev1?.kind, 'adjustment');

  const ev2 = adapter.stockMovementToEvent({
    id: 'tx2',
    product_id: 'p1',
    transaction_type: 'internal_transfer',
    quantity: 5,
    unit_cost: 10,
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev2, null);
});

test('receipts take cost from products.cost_price when the column is absent', () => {
  const adapter = createUrsellaAdapter({ productCostById: { p1: 15 } });
  const ev = adapter.stockMovementToEvent({
    id: 'tx1',
    product_id: 'p1',
    transaction_type: 'purchase',
    quantity: '10',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev?.kind, 'receipt');
  if (ev?.kind === 'receipt') {
    assert.equal(ev.quantity, 10);
    assert.equal(ev.unitCost, 15);
  }
});

test('receipts prefer unit_cost once the migration adds the column', () => {
  const adapter = createUrsellaAdapter({ productCostById: { p1: 15 } });
  const ev = adapter.stockMovementToEvent({
    id: 'tx1',
    product_id: 'p1',
    transaction_type: 'purchase',
    quantity: '10',
    unit_cost: '22.50',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev?.kind, 'receipt');
  if (ev?.kind === 'receipt') {
    assert.equal(ev.unitCost, 22.5);
  }
});

test('missing cost is reported as an issue, not silently zeroed', () => {
  const adapter = createUrsellaAdapter();
  adapter.stockMovementToEvent({
    id: 'tx1',
    product_id: 'p1',
    transaction_type: 'purchase',
    quantity: '10',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(adapter.issues.length, 1);
  assert.equal(adapter.issues[0].code, 'missing_cost');
});

test('sale_items with NULL product_id are skipped and reported', () => {
  const adapter = createUrsellaAdapter();
  const ev = adapter.saleLineItemToEvent({
    id: 'si1',
    sale_id: 's1',
    product_id: null,
    product_name_snapshot: 'Old Discontinued Item',
    quantity: '2',
    unit_price: '50.00',
    unit_cost: '30.00',
    subtotal: '100.00',
    total: '100.00',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev, null);
  assert.equal(adapter.issues.length, 1);
  assert.equal(adapter.issues[0].code, 'null_product_id');
});

test('revenue uses total, so discounts are respected', () => {
  const adapter = createUrsellaAdapter();
  const ev = adapter.saleLineItemToEvent({
    id: 'si1',
    sale_id: 's1',
    product_id: 'p1',
    product_name_snapshot: 'Flour 25kg',
    quantity: '2',
    unit_price: '50.00',
    discount: '10.00',
    subtotal: '100.00',
    total: '90.00',
    unit_cost: '30.00',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev?.kind, 'sale');
  if (ev?.kind === 'sale') {
    assert.equal(ev.unitPrice, 45); // 90 / 2
  }
});

test('revenueBasis "unit_price" ignores the discount when asked to', () => {
  const adapter = createUrsellaAdapter({ revenueBasis: 'unit_price' });
  const ev = adapter.saleLineItemToEvent({
    id: 'si1',
    sale_id: 's1',
    product_id: 'p1',
    product_name_snapshot: 'Flour 25kg',
    quantity: '2',
    unit_price: '50.00',
    discount: '10.00',
    subtotal: '100.00',
    total: '90.00',
    unit_cost: '30.00',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev?.kind, 'sale');
  if (ev?.kind === 'sale') {
    assert.equal(ev.unitPrice, 50);
  }
});

test('mirrored sale inventory rows are skipped so stock isn not double-consumed', () => {
  const adapter = createUrsellaAdapter();
  const ev = adapter.stockMovementToEvent({
    id: 'tx1',
    product_id: 'p1',
    transaction_type: 'sale',
    quantity: '2',
    created_at: '2026-08-28T00:00:00Z',
  });
  assert.equal(ev, null);
});

test('end-to-end on the real schema: FIFO across a price change', () => {
  const products: UrsellaProductRow[] = [
    { id: 'p1', name: 'Rice 50kg', selling_price: '60.00', cost_price: '40.00', stock_quantity: '0' },
  ];
  const stockMovements: UrsellaInventoryTransactionRow[] = [
    { id: 'tx1', product_id: 'p1', transaction_type: 'purchase', quantity: '10', unit_cost: '30.00', created_at: '2026-01-01T00:00:00Z' },
    { id: 'tx2', product_id: 'p1', transaction_type: 'purchase', quantity: '10', unit_cost: '34.00', created_at: '2026-03-01T00:00:00Z' },
  ];
  const saleLineItems: UrsellaSaleItemRow[] = [
    {
      id: 'si1',
      sale_id: 's1',
      product_id: 'p1',
      product_name_snapshot: 'Rice 50kg',
      quantity: '15',
      unit_price: '60.00',
      unit_cost: '40.00',
      subtotal: '900.00',
      total: '900.00',
      created_at: '2026-04-01T00:00:00Z',
    },
  ];

  const adapter = createUrsellaAdapter({ productCostById: productCostIndex(products) });
  const { events } = buildInput(adapter, { products, stockMovements, saleLineItems });
  const result = runLedger(events);

  // 10 @ 30 + 5 @ 34 = 470 COGS
  assert.equal(result.sales[0].cogs, 470);
  assert.equal(result.sales[0].revenue, 900);
  assert.equal(result.sales[0].grossMargin, 430);
  assert.equal(result.valuationByProduct['p1'].quantityOnHand, 5);
  assert.equal(result.valuationByProduct['p1'].inventoryValue, 170); // 5 @ 34
  assert.equal(result.valuationByProduct['p1'].averageUnitCost, 34);
});

test('compareToRecordedCost quantifies drift vs sale_items.unit_cost', () => {
  const saleItems: UrsellaSaleItemRow[] = [
    {
      id: 'si1',
      sale_id: 's1',
      product_id: 'p1',
      product_name_snapshot: 'Rice 50kg',
      quantity: '15',
      unit_price: '60.00',
      unit_cost: '40.00', // snapshot: 15 * 40 = 600
      subtotal: '900.00',
      total: '900.00',
      created_at: '2026-04-01T00:00:00Z',
    },
  ];
  const comparison = compareToRecordedCost(saleItems, [{ saleEventId: 'si1', cogs: 470 }]);

  assert.equal(comparison.totalRecorded, 600);
  assert.equal(comparison.totalFifo, 470);
  assert.equal(comparison.totalDifference, -130);
  assert.equal(comparison.rows.length, 1);
});

test('opening lots seed cost basis from cost_price x stock_quantity', () => {
  const products: UrsellaProductRow[] = [
    { id: 'p1', name: 'Oil 5L', selling_price: '25.00', cost_price: '18.00', stock_quantity: '20' },
  ];
  const lots = openingLotsFromProducts(products);
  assert.equal(lots.length, 1);
  assert.equal(lots[0].kind, 'receipt');
  if (lots[0].kind === 'receipt') {
    assert.equal(lots[0].quantity, 20);
    assert.equal(lots[0].unitCost, 18);
  }
});

test('opening lots skip zero-stock products', () => {
  const products: UrsellaProductRow[] = [
    { id: 'p1', name: 'Zero Stock', selling_price: '10.00', cost_price: '5.00', stock_quantity: '0' },
  ];
  const lots = openingLotsFromProducts(products);
  assert.equal(lots.length, 0);
});

test('multi-tenant filtering by business_id', () => {
  const products: UrsellaProductRow[] = [
    { id: 'p1', business_id: 'biz-A', name: 'A', selling_price: '10', cost_price: '5', stock_quantity: '1' },
    { id: 'p2', business_id: 'biz-B', name: 'B', selling_price: '10', cost_price: '5', stock_quantity: '1' },
  ];
  const scoped = forBusiness(products, 'biz-A');
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, 'p1');
});

test('reconcileStock flags drift and stays quiet when it agrees', () => {
  const products: UrsellaProductRow[] = [
    { id: 'p1', name: 'Agrees', selling_price: '10', cost_price: '5', stock_quantity: '10' },
    { id: 'p2', name: 'Drifted', selling_price: '10', cost_price: '5', stock_quantity: '10' },
  ];
  const valuation = {
    p1: { quantityOnHand: 10 },
    p2: { quantityOnHand: 7 },
  };
  const drifts = reconcileStock(products, valuation);
  assert.equal(drifts.length, 1);
  assert.equal(drifts[0].productId, 'p2');
  assert.equal(drifts[0].drift, -3);
});
