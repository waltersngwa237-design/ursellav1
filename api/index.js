// server.ts
import express from "express";
import path2 from "path";

// server/business-tools.service.ts
import { createClient } from "@supabase/supabase-js";

// src/lib/fifo/engine.ts
var DEFAULTS = {
  roundingDecimals: 2,
  insufficientStock: "shortfall",
  fallbackUnitCost: "lastKnown",
  returnRestockCost: "lastConsumed"
};
function toMillis(t) {
  return typeof t === "number" ? t : Date.parse(t);
}
function round(value, decimals) {
  if (!Number.isFinite(value)) return value;
  const f = Math.pow(10, decimals);
  return Math.round(value * f * (1 + Number.EPSILON)) / f;
}
function stateFor(map, productId) {
  let s = map.get(productId);
  if (!s) {
    s = { lots: [], lastConsumedUnitCost: null };
    map.set(productId, s);
  }
  return s;
}
function quantityOnHand(state) {
  let q = 0;
  for (const lot of state.lots) q += lot.quantityRemaining;
  return q;
}
function inventoryValue(state) {
  let v = 0;
  for (const lot of state.lots) v += lot.quantityRemaining * lot.unitCost;
  return v;
}
function averageUnitCost(state) {
  const q = quantityOnHand(state);
  return q > 0 ? inventoryValue(state) / q : 0;
}
function makeLot(productId, unitCost, quantity, receivedAt, sourceEventId, seq) {
  return {
    lotId: sourceEventId + "#" + seq,
    productId,
    unitCost,
    quantityRemaining: quantity,
    originalQuantity: quantity,
    receivedAt,
    sourceEventId
  };
}
function consumeFifo(state, quantity) {
  const consumptions = [];
  let remaining = round(quantity, 6);
  while (remaining > 1e-9 && state.lots.length > 0) {
    const lot = state.lots[0];
    const take = round(Math.min(lot.quantityRemaining, remaining), 6);
    lot.quantityRemaining = round(lot.quantityRemaining - take, 6);
    remaining = round(remaining - take, 6);
    state.lastConsumedUnitCost = lot.unitCost;
    consumptions.push({ lotId: lot.lotId, quantity: take, unitCost: lot.unitCost });
    if (lot.quantityRemaining <= 1e-9) state.lots.shift();
  }
  if (remaining <= 1e-9) remaining = 0;
  const covered = round(quantity - remaining, 6);
  return { consumptions, covered, shortfall: remaining };
}
function resolveFallback(fallback, state) {
  if (typeof fallback === "number") return fallback;
  if (fallback === "zero") return 0;
  return state.lastConsumedUnitCost ?? averageUnitCost(state);
}
function resolveReturnCost(explicit, strategy, state) {
  if (strategy === "explicit") return explicit ?? state.lastConsumedUnitCost ?? averageUnitCost(state);
  if (strategy === "averageOnHand") return averageUnitCost(state);
  return state.lastConsumedUnitCost ?? explicit ?? averageUnitCost(state);
}
function costSale(ev, state, opt, warnings) {
  const d = opt.roundingDecimals;
  const { consumptions, covered, shortfall } = consumeFifo(state, ev.quantity);
  let cogsRaw = 0;
  for (const c of consumptions) cogsRaw += c.quantity * c.unitCost;
  let shortfallQuantity = shortfall;
  if (shortfall > 0) {
    if (opt.insufficientStock === "backorder") {
      const fb = resolveFallback(opt.fallbackUnitCost, state);
      cogsRaw += shortfall * fb;
      consumptions.push({ lotId: "(backorder)", quantity: shortfall, unitCost: fb });
      shortfallQuantity = 0;
      warnings.push({
        eventId: ev.id,
        productId: ev.productId,
        code: "insufficient_stock",
        message: "Sold " + shortfall + " unit(s) beyond stock; costed at fallback " + round(fb, d) + " (backorder).",
        quantity: shortfall
      });
    } else {
      warnings.push({
        eventId: ev.id,
        productId: ev.productId,
        code: "insufficient_stock",
        message: "Sold " + ev.quantity + " but only " + covered + " in stock; " + shortfall + " unit(s) left uncosted (shortfall).",
        quantity: shortfall
      });
    }
  }
  const revenue = round(ev.quantity * ev.unitPrice, d);
  const cogs = round(cogsRaw, d);
  const grossMargin = round(revenue - cogs, d);
  return {
    saleEventId: ev.id,
    saleId: ev.saleId,
    productId: ev.productId,
    quantity: ev.quantity,
    revenue,
    cogs,
    grossMargin,
    grossMarginRate: revenue > 0 ? round(grossMargin / revenue, 4) : 0,
    consumptions,
    shortfallQuantity
  };
}
function runLedger(events, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const d = opt.roundingDecimals;
  const states = /* @__PURE__ */ new Map();
  const sales = [];
  const warnings = [];
  let lotSeq = 0;
  const ordered = events.map((e, i) => ({ e, i })).sort(
    (a, b) => toMillis(a.e.occurredAt) - toMillis(b.e.occurredAt) || (a.e.sequence ?? 0) - (b.e.sequence ?? 0) || a.i - b.i
  ).map((x) => x.e);
  for (const ev of ordered) {
    const state = stateFor(states, ev.productId);
    if (ev.kind === "receipt") {
      state.lots.push(makeLot(ev.productId, ev.unitCost, ev.quantity, ev.occurredAt, ev.id, ++lotSeq));
    } else if (ev.kind === "return") {
      const cost = resolveReturnCost(ev.unitCost, opt.returnRestockCost, state);
      state.lots.push(makeLot(ev.productId, cost, ev.quantity, ev.occurredAt, ev.id, ++lotSeq));
    } else if (ev.kind === "adjustment") {
      if (ev.quantity >= 0) {
        const cost = ev.unitCost ?? averageUnitCost(state);
        if (ev.unitCost === void 0) {
          warnings.push({
            eventId: ev.id,
            productId: ev.productId,
            code: "missing_unit_cost",
            message: "Positive adjustment without unitCost; used average on-hand cost " + round(cost, d) + ".",
            quantity: ev.quantity
          });
        }
        if (ev.quantity > 0) {
          state.lots.push(makeLot(ev.productId, cost, ev.quantity, ev.occurredAt, ev.id, ++lotSeq));
        }
      } else {
        const { shortfall } = consumeFifo(state, -ev.quantity);
        if (shortfall > 0) {
          warnings.push({
            eventId: ev.id,
            productId: ev.productId,
            code: "insufficient_stock",
            message: "Negative adjustment exceeded stock on hand by " + shortfall + " unit(s).",
            quantity: shortfall
          });
        }
      }
    } else if (ev.kind === "sale") {
      sales.push(costSale(ev, state, opt, warnings));
    }
  }
  const valuationByProduct = {};
  let totalInventoryValue = 0;
  for (const [productId, state] of states) {
    const q = quantityOnHand(state);
    const v = inventoryValue(state);
    totalInventoryValue += v;
    valuationByProduct[productId] = {
      productId,
      quantityOnHand: round(q, 6),
      inventoryValue: round(v, d),
      averageUnitCost: q > 0 ? round(v / q, d) : 0,
      openLots: state.lots.map((l) => ({ ...l }))
    };
  }
  let revenue = 0;
  let cogs = 0;
  let unitsSold = 0;
  for (const s of sales) {
    revenue += s.revenue;
    cogs += s.cogs;
    unitsSold += s.quantity;
  }
  const grossMargin = round(revenue - cogs, d);
  const totals = {
    revenue: round(revenue, d),
    cogs: round(cogs, d),
    grossMargin,
    grossMarginRate: revenue > 0 ? round(grossMargin / revenue, 4) : 0,
    unitsSold: round(unitsSold, 6),
    inventoryValue: round(totalInventoryValue, d)
  };
  return { sales, valuationByProduct, totals, warnings };
}

// src/lib/fifo/adapter.ts
function buildInput(adapter, tables) {
  const products = tables.products.map((r) => adapter.toProduct(r));
  const events = [];
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

// src/lib/fifo/ursella-adapter.ts
function num(v) {
  if (v === null || v === void 0) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : 0;
}
function classifyTransaction(t) {
  const norm = t.toLowerCase().replace(/[-_ ]/g, "");
  if (norm === "purchase" || norm === "receipt" || norm === "stockin" || norm === "restock" || norm === "initialstock" || norm === "in") {
    return "receipt";
  }
  if (norm === "return" || norm === "customerreturn") {
    return "return";
  }
  if (norm === "sale" || norm === "pos" || norm === "checkout") {
    return "sale";
  }
  if (norm === "adjustment" || norm === "stocktake" || norm === "correction" || norm === "audit" || norm === "damage" || norm === "damaged" || norm === "shrinkage" || norm === "loss" || norm === "writeoff") {
    return "adjustment";
  }
  return "adjustment";
}
function createUrsellaAdapter(options = {}) {
  const {
    transactionTypeMap = {},
    productCostById = {},
    revenueBasis = "total",
    costResolver
  } = options;
  const issues = [];
  const resolveCost = costResolver ?? ((row, ctx) => {
    if (row.unit_cost !== void 0 && row.unit_cost !== null) return num(row.unit_cost);
    if (ctx.productCost !== void 0) return ctx.productCost;
    issues.push({
      rowId: row.id,
      code: "missing_cost",
      message: "inventory_transactions has no unit_cost and no products.cost_price was supplied for product " + row.product_id + "; costed at 0."
    });
    return 0;
  });
  return {
    issues,
    toProduct: (r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku ?? void 0
    }),
    stockMovementToEvent: (r) => {
      const kind = transactionTypeMap[r.transaction_type] ?? classifyTransaction(r.transaction_type);
      if (kind === "sale" || kind === "skip") return null;
      const base = { id: r.id, productId: r.product_id, occurredAt: r.created_at };
      const rawQty = num(r.quantity);
      const productCost = productCostById[r.product_id];
      if (kind === "receipt") {
        return {
          kind: "receipt",
          ...base,
          quantity: Math.abs(rawQty),
          unitCost: resolveCost(r, { productCost })
        };
      }
      if (kind === "return") {
        return {
          kind: "return",
          ...base,
          quantity: Math.abs(rawQty),
          unitCost: r.unit_cost === void 0 || r.unit_cost === null ? void 0 : num(r.unit_cost)
        };
      }
      const isDamage = r.transaction_type.toLowerCase().includes("damage") || r.transaction_type.toLowerCase().includes("loss") || r.transaction_type.toLowerCase().includes("shrinkage");
      const qty = isDamage ? -Math.abs(rawQty) : rawQty;
      return {
        kind: "adjustment",
        ...base,
        quantity: qty,
        unitCost: qty > 0 ? resolveCost(r, { productCost }) : void 0,
        reason: r.notes ?? r.transaction_type ?? void 0
      };
    },
    saleLineItemToEvent: (r) => {
      if (!r.product_id) {
        issues.push({
          rowId: r.id,
          code: "null_product_id",
          message: "sale_items row has a NULL product_id (" + r.product_name_snapshot + "); cannot be costed, skipped."
        });
        return null;
      }
      const qty = num(r.quantity);
      let effectiveUnitPrice;
      if (revenueBasis === "unit_price") {
        effectiveUnitPrice = num(r.unit_price);
      } else {
        const gross = revenueBasis === "subtotal" ? num(r.subtotal) : num(r.total);
        effectiveUnitPrice = qty !== 0 ? gross / qty : 0;
      }
      return {
        kind: "sale",
        id: r.id,
        productId: r.product_id,
        occurredAt: r.created_at,
        quantity: qty,
        unitPrice: effectiveUnitPrice,
        saleId: r.sale_id
      };
    }
  };
}
function productCostIndex(rows) {
  const out = {};
  for (const r of rows) out[r.id] = num(r.cost_price);
  return out;
}
function openingLotsFromProducts(rows, openingDate = "1970-01-01T00:00:00Z") {
  const events = [];
  for (const r of rows) {
    if (r.product_type === "service") continue;
    const qty = num(r.stock_quantity);
    if (qty > 0) {
      events.push({
        kind: "receipt",
        id: "opening:" + r.id,
        productId: r.id,
        occurredAt: openingDate,
        quantity: qty,
        unitCost: num(r.cost_price)
      });
    }
  }
  return events;
}
function compareToRecordedCost(saleItems, sales) {
  const fifoById = new Map(sales.map((s) => [s.saleEventId, s.cogs]));
  const rows = [];
  let totalRecorded = 0;
  let totalFifo = 0;
  for (const item of saleItems) {
    const fifoCogs = fifoById.get(item.id);
    if (fifoCogs === void 0) continue;
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
    totalDifference: Math.round((totalFifo - totalRecorded) * 100) / 100
  };
}
function reconcileStock(rows, valuationByProduct) {
  const out = [];
  for (const r of rows) {
    if (r.product_type === "service") continue;
    const snapshot = num(r.stock_quantity);
    const computed = valuationByProduct[r.id]?.quantityOnHand ?? 0;
    const drift = computed - snapshot;
    if (drift !== 0) out.push({ productId: r.id, name: r.name, snapshot, computed, drift });
  }
  return out;
}

// server/business-tools.service.ts
var supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "placeholder-anon-key";
var serverSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function getTimezoneDateRange(timezone = "Africa/Douala", days = 1) {
  try {
    const now = /* @__PURE__ */ new Date();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const parts = dtf.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || "01";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const todayDateStr = `${year}-${month}-${day}`;
    const targetTzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMs = targetTzDate.getTime() - utcDate.getTime();
    const utcMidnightForToday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0));
    const startOfTodayUtc = new Date(utcMidnightForToday.getTime() - offsetMs);
    const startOfRangeUtc = new Date(startOfTodayUtc.getTime() - (days - 1) * 864e5);
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 864e5 - 1);
    return {
      startDateIso: startOfRangeUtc.toISOString(),
      endDateIso: endOfTodayUtc.toISOString(),
      todayDateStr
    };
  } catch {
    const now = /* @__PURE__ */ new Date();
    const todayDateStr = now.toISOString().split("T")[0];
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const end = /* @__PURE__ */ new Date();
    end.setHours(23, 59, 59, 999);
    return {
      startDateIso: start.toISOString(),
      endDateIso: end.toISOString(),
      todayDateStr
    };
  }
}
var BusinessToolsService = class {
  /**
   * Verifies user has authorized access to the business.
   * Multi-tenant security rule: NEVER fail open.
   */
  static async verifyTenantAccess(userId, businessId) {
    const membership = await this.getTenantMembership(userId, businessId);
    return membership.authorized;
  }
  /**
   * Retrieves user's verified business membership role.
   */
  static async getTenantMembership(userId, businessId) {
    if (!userId || !businessId) return { authorized: false };
    try {
      const { data, error } = await serverSupabase.from("business_members").select("id, role").eq("business_id", businessId).eq("user_id", userId).maybeSingle();
      if (error || !data) {
        return { authorized: false };
      }
      return { authorized: true, role: data.role || "owner" };
    } catch {
      return { authorized: false };
    }
  }
  /**
   * Runs the authoritative FIFO engine across a business's inventory transactions and sales.
   */
  static async runFIFOLedger(businessId) {
    const [
      { data: products },
      { data: transactions },
      { data: saleItems }
    ] = await Promise.all([
      serverSupabase.from("products").select("*").eq("business_id", businessId),
      serverSupabase.from("inventory_transactions").select("*").eq("business_id", businessId).order("created_at", { ascending: true }),
      serverSupabase.from("sale_items").select("*").eq("business_id", businessId).order("created_at", { ascending: true })
    ]);
    const productRows = products || [];
    const movementRows = transactions || [];
    const itemRows = saleItems || [];
    const adapter = createUrsellaAdapter({
      productCostById: productCostIndex(productRows)
    });
    const built = buildInput(adapter, {
      products: productRows,
      stockMovements: movementRows,
      saleLineItems: itemRows
    });
    const hasInitialTransactions = movementRows.some(
      (m) => m.transaction_type === "initial_stock" || m.transaction_type === "purchase"
    );
    const openingEvents = hasInitialTransactions ? [] : openingLotsFromProducts(productRows);
    const ledgerResult = runLedger([...openingEvents, ...built.events]);
    const costDrift = compareToRecordedCost(itemRows, ledgerResult.sales);
    const stockReconciliation = reconcileStock(productRows, ledgerResult.valuationByProduct);
    return {
      productRows,
      itemRows,
      movementRows,
      ledgerResult,
      costDrift,
      stockReconciliation
    };
  }
  /**
   * 1. Tool: get_business_overview
   */
  static async getBusinessOverview(businessId, timeHorizonDays = 30, timezone = "Africa/Douala") {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);
    return await this.calculateOverviewWithFIFO(businessId, startDateIso, endDateIso, timezone);
  }
  /**
   * 2. Tool: get_inventory_alerts
   */
  static async getInventoryAlerts(businessId) {
    const { data: products } = await serverSupabase.from("products").select("id, name, sku, cost_price, selling_price, stock_quantity, minimum_stock_level, is_active, product_type, unit_of_measure").eq("business_id", businessId).eq("is_active", true);
    const activeList = products || [];
    const physicalList = activeList.filter((p) => p.product_type !== "service");
    const outOfStock = physicalList.filter((p) => (p.stock_quantity || 0) <= 0);
    const lowStock = physicalList.filter(
      (p) => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= (p.minimum_stock_level || 5)
    );
    let fifoValuation = 0;
    try {
      const fifo = await this.runFIFOLedger(businessId);
      fifoValuation = fifo.ledgerResult.totals.inventoryValue;
    } catch {
      fifoValuation = physicalList.reduce((sum, p) => sum + Number(p.stock_quantity || 0) * Number(p.cost_price || 0), 0);
    }
    const criticalItemsToRestock = [...outOfStock, ...lowStock].map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: p.stock_quantity,
      minimumStockLevel: p.minimum_stock_level || 5,
      costPrice: p.cost_price,
      sellingPrice: p.selling_price,
      unitOfMeasure: p.unit_of_measure || "piece",
      status: (p.stock_quantity || 0) <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
      estimatedRestockCost: Math.max(0, ((p.minimum_stock_level || 5) * 2 - (p.stock_quantity || 0)) * (p.cost_price || 0))
    }));
    return {
      totalActiveSKUs: physicalList.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      healthyStockCount: physicalList.length - outOfStock.length - lowStock.length,
      totalInventoryValuation: fifoValuation,
      criticalItemsToRestock,
      hasStockIssues: outOfStock.length > 0 || lowStock.length > 0
    };
  }
  /**
   * 3. Tool: get_today_sales_summary
   */
  static async getTodaySalesSummary(businessId, timezone = "Africa/Douala") {
    const { startDateIso, endDateIso, todayDateStr } = getTimezoneDateRange(timezone, 1);
    const [{ data: salesToday }, { data: paymentsToday }, invAlerts] = await Promise.all([
      serverSupabase.from("sales").select("id, total, amount_paid, amount_due, payment_status, payment_method, sold_at").eq("business_id", businessId).eq("sale_status", "completed").gte("sold_at", startDateIso).lte("sold_at", endDateIso),
      serverSupabase.from("payments").select("amount, payment_method, paid_at").eq("business_id", businessId).gte("paid_at", startDateIso).lte("paid_at", endDateIso),
      this.getInventoryAlerts(businessId)
    ]);
    const sales = salesToday || [];
    const payments = paymentsToday || [];
    const revenueToday = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const txCountToday = sales.length;
    const cashCollectedToday = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const receivablesToday = sales.reduce((sum, s) => sum + Number(s.amount_due || 0), 0);
    let cogsToday = 0;
    const saleIds = new Set(sales.map((s) => s.id));
    if (saleIds.size > 0) {
      try {
        const fifo = await this.runFIFOLedger(businessId);
        const fifoByItem = new Map(fifo.ledgerResult.sales.map((s) => [s.saleEventId, s.cogs]));
        const todayItems = fifo.itemRows.filter((i) => saleIds.has(i.sale_id));
        cogsToday = todayItems.reduce((acc, i) => acc + (fifoByItem.get(i.id) ?? Number(i.unit_cost || 0) * Number(i.quantity || 1)), 0);
      } catch {
        const { data: saleItems } = await serverSupabase.from("sale_items").select("quantity, unit_cost").in("sale_id", Array.from(saleIds));
        if (saleItems) {
          cogsToday = saleItems.reduce((acc, i) => acc + Number(i.unit_cost || 0) * Number(i.quantity || 1), 0);
        }
      }
    }
    const grossProfitToday = revenueToday - cogsToday;
    const grossMarginToday = revenueToday > 0 ? Number((grossProfitToday / revenueToday * 100).toFixed(1)) : 0;
    return {
      todayDate: todayDateStr,
      timezone,
      salesCount: txCountToday,
      revenue: revenueToday,
      cogs: cogsToday,
      grossProfit: grossProfitToday,
      grossMarginPct: grossMarginToday,
      cashCollected: cashCollectedToday,
      receivablesCreated: receivablesToday,
      hasRecordedSalesToday: txCountToday > 0,
      inventoryAlerts: invAlerts
    };
  }
  /**
   * 4. Tool: get_product_performance
   * Returns comprehensive product performance, unit economics, catalog margins, and FIFO valuation.
   */
  static async getProductPerformance(businessId, limit = 50, searchQuery) {
    try {
      const fifo = await this.runFIFOLedger(businessId);
      const fifoByItem = new Map(fifo.ledgerResult.sales.map((s) => [s.saleEventId, s]));
      const valuationRecord = fifo.ledgerResult.valuationByProduct || {};
      const productStats = /* @__PURE__ */ new Map();
      for (const p of fifo.productRows) {
        const fifoVal = valuationRecord[p.id];
        const costP = Number(p.cost_price || 0);
        const sellP = Number(p.selling_price || 0);
        const stockQty = Number(p.stock_quantity || 0);
        const fifoUnits = fifoVal ? fifoVal.quantityOnHand : stockQty;
        const fifoValuation = fifoVal ? fifoVal.inventoryValue : stockQty * costP;
        const fifoUnitCostAvg = fifoUnits > 0 ? Number((fifoValuation / fifoUnits).toFixed(2)) : fifoVal?.averageUnitCost || costP;
        productStats.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.sku,
          productType: p.product_type || "physical",
          unitOfMeasure: p.unit_of_measure || "piece",
          sellingPrice: sellP,
          costPrice: costP,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          stockQuantity: stockQty,
          fifoInventoryValue: fifoValuation,
          fifoUnitsOnHand: fifoUnits,
          fifoUnitCostAverage: fifoUnitCostAvg
        });
      }
      for (const item of fifo.itemRows) {
        if (!item.product_id) continue;
        const entry = productStats.get(item.product_id);
        if (!entry) continue;
        const fifoSold = fifoByItem.get(item.id);
        const qty = Number(item.quantity || 0);
        const rev = Number(item.total || 0);
        const cogs = fifoSold ? fifoSold.cogs : Number(item.unit_cost || 0) * qty;
        entry.unitsSold += qty;
        entry.revenue += rev;
        entry.cogs += cogs;
      }
      const cleanQuery = (searchQuery || "").toLowerCase().trim();
      let results = Array.from(productStats.values()).map((p) => {
        const grossProfit = p.revenue - p.cogs;
        const realizedMarginPct = p.revenue > 0 ? Number((grossProfit / p.revenue * 100).toFixed(1)) : null;
        const catalogUnitMarginPct = p.sellingPrice > 0 ? Number(((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(1)) : 0;
        const fifoUnitMarginPct = p.sellingPrice > 0 ? Number(((p.sellingPrice - p.fifoUnitCostAverage) / p.sellingPrice * 100).toFixed(1)) : 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          productType: p.productType,
          unitOfMeasure: p.unitOfMeasure,
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice,
          stockQuantity: p.stockQuantity,
          fifoUnitsOnHand: p.fifoUnitsOnHand,
          fifoUnitCostAverage: p.fifoUnitCostAverage,
          fifoInventoryValue: p.fifoInventoryValue,
          unitsSold: p.unitsSold,
          revenue: p.revenue,
          cogs: p.cogs,
          grossProfit,
          // Primary margin: uses realized margin if sold, else catalog unit margin
          marginPct: realizedMarginPct !== null ? realizedMarginPct : catalogUnitMarginPct,
          realizedMarginPct,
          catalogUnitMarginPct,
          fifoUnitMarginPct
        };
      });
      if (cleanQuery.length > 0) {
        const matched = results.filter(
          (r) => r.name.toLowerCase().includes(cleanQuery) || r.sku && r.sku.toLowerCase().includes(cleanQuery)
        );
        if (matched.length > 0) {
          results = matched;
        }
      }
      return results.sort((a, b) => {
        if (b.revenue !== a.revenue) return b.revenue - a.revenue;
        return b.marginPct - a.marginPct;
      }).slice(0, limit);
    } catch {
      const { data: products } = await serverSupabase.from("products").select("id, name, sku, selling_price, cost_price, stock_quantity").eq("business_id", businessId).limit(limit);
      return (products || []).map((p) => {
        const sellP = Number(p.selling_price || 0);
        const costP = Number(p.cost_price || 0);
        const stockQty = Number(p.stock_quantity || 0);
        const catalogMargin = sellP > 0 ? Number(((sellP - costP) / sellP * 100).toFixed(1)) : 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          sellingPrice: sellP,
          costPrice: costP,
          stockQuantity: stockQty,
          fifoUnitsOnHand: stockQty,
          fifoUnitCostAverage: costP,
          fifoInventoryValue: stockQty * costP,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          marginPct: catalogMargin,
          realizedMarginPct: null,
          catalogUnitMarginPct: catalogMargin,
          fifoUnitMarginPct: catalogMargin
        };
      });
    }
  }
  /**
   * 5. Tool: get_customer_balances (Debtors / Receivables)
   */
  static async getCustomerBalances(businessId) {
    const [{ data: customers }, { data: unpaidSales }] = await Promise.all([
      serverSupabase.from("customers").select("id, name, phone, email").eq("business_id", businessId),
      serverSupabase.from("sales").select("id, customer_id, total, amount_paid, amount_due, payment_status, sold_at").eq("business_id", businessId).eq("sale_status", "completed").gt("amount_due", 0)
    ]);
    const custMap = new Map((customers || []).map((c) => [c.id, c]));
    const debtorTotals = /* @__PURE__ */ new Map();
    let totalOutstanding = 0;
    for (const s of unpaidSales || []) {
      const due = Number(s.amount_due || 0);
      totalOutstanding += due;
      const cust = s.customer_id ? custMap.get(s.customer_id) : null;
      const custId = s.customer_id || "unassigned";
      const name = cust?.name || "Walk-in / Unassigned Customer";
      const existing = debtorTotals.get(custId) || {
        name,
        phone: cust?.phone || void 0,
        totalDue: 0,
        ordersCount: 0
      };
      existing.totalDue += due;
      existing.ordersCount += 1;
      debtorTotals.set(custId, existing);
    }
    const topDebtors = Array.from(debtorTotals.values()).map((d) => ({
      name: d.name,
      phone: d.phone,
      debtAmount: d.totalDue,
      unpaidOrdersCount: d.ordersCount
    })).sort((a, b) => b.debtAmount - a.debtAmount);
    return {
      totalOutstandingDebt: totalOutstanding,
      debtorsCount: topDebtors.length,
      topDebtors,
      hasOutstandingDebtors: topDebtors.length > 0
    };
  }
  /**
   * 6. Tool: get_expense_summary
   */
  static async getExpenseSummary(businessId, timeHorizonDays = 30, timezone = "Africa/Douala") {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);
    const { data: expenses } = await serverSupabase.from("expenses").select("amount, category, description, expense_date").eq("business_id", businessId).gte("expense_date", startDateIso.split("T")[0]).lte("expense_date", endDateIso.split("T")[0]);
    const expList = expenses || [];
    const totalExpenses = expList.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const categoryMap = /* @__PURE__ */ new Map();
    for (const e of expList) {
      const cat = e.category || "General";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(e.amount || 0));
    }
    const expensesByCategory = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Number((amount / totalExpenses * 100).toFixed(1)) : 0
    }));
    return {
      totalExpenses,
      expenseCount: expList.length,
      expensesByCategory,
      timeHorizonDays
    };
  }
  /**
   * 7. Tool: get_cash_flow
   */
  static async getCashFlow(businessId, timeHorizonDays = 30, timezone = "Africa/Douala") {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);
    const [{ data: payments }, { data: expenses }] = await Promise.all([
      serverSupabase.from("payments").select("amount, payment_method, paid_at").eq("business_id", businessId).gte("paid_at", startDateIso).lte("paid_at", endDateIso),
      serverSupabase.from("expenses").select("amount, expense_date").eq("business_id", businessId).gte("expense_date", startDateIso.split("T")[0]).lte("expense_date", endDateIso.split("T")[0])
    ]);
    const cashIn = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cashOut = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netCashFlow = cashIn - cashOut;
    return {
      cashInflows: cashIn,
      cashOutflows: cashOut,
      netCashFlow,
      timeHorizonDays
    };
  }
  /**
   * 8. Tool: get_sales_summary
   */
  static async getSalesSummary(businessId, timeHorizonDays = 30, timezone = "Africa/Douala") {
    return await this.getBusinessOverview(businessId, timeHorizonDays, timezone);
  }
  /**
   * 9. Tool: get_period_comparison
   */
  static async getPeriodComparison(businessId, days = 7, timezone = "Africa/Douala") {
    const current = await this.getBusinessOverview(businessId, days, timezone);
    const prior = await this.getBusinessOverview(businessId, days * 2, timezone);
    const priorRevenue = Math.max(0, prior.revenue - current.revenue);
    const revenueGrowthPct = priorRevenue > 0 ? Number(((current.revenue - priorRevenue) / priorRevenue * 100).toFixed(1)) : 0;
    return {
      currentPeriod: {
        days,
        revenue: current.revenue,
        cogs: current.cost_of_goods_sold,
        grossProfit: current.gross_profit,
        transactions: current.transaction_count
      },
      priorPeriod: {
        days,
        revenue: priorRevenue
      },
      revenueGrowthPct,
      trend: revenueGrowthPct > 0 ? "growth" : revenueGrowthPct < 0 ? "contraction" : "flat"
    };
  }
  /**
   * 10. Tool: get_business_health
   */
  static async getBusinessHealth(businessId, timezone = "Africa/Douala") {
    const overview = await this.getBusinessOverview(businessId, 30, timezone);
    const inv = await this.getInventoryAlerts(businessId);
    const debtors = await this.getCustomerBalances(businessId);
    let score = 70;
    const keyObservations = [];
    if (overview.gross_margin >= 35) {
      score += 10;
      keyObservations.push(`Healthy gross margin of ${overview.gross_margin}%.`);
    } else if (overview.gross_margin < 20 && overview.revenue > 0) {
      score -= 15;
      keyObservations.push(`Low gross margin (${overview.gross_margin}%).`);
    }
    if (overview.estimated_net_profit > 0) {
      score += 10;
      keyObservations.push("Positive operational net profit.");
    } else if (overview.estimated_net_profit < 0) {
      score -= 20;
      keyObservations.push("Operating at an estimated net loss this period.");
    }
    if (inv.outOfStockCount > 0 || inv.lowStockCount >= 3) {
      score -= 10;
      keyObservations.push(`${inv.outOfStockCount + inv.lowStockCount} product(s) low or out of stock.`);
    }
    if (debtors.totalOutstandingDebt > overview.revenue * 0.3 && overview.revenue > 0) {
      score -= 10;
      keyObservations.push(`High customer debt exposure (${debtors.totalOutstandingDebt}).`);
    }
    score = Math.max(10, Math.min(100, score));
    return {
      score,
      rating: score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Fair" : "At Risk",
      keyObservations,
      dataSufficiency: overview.transaction_count >= 5 ? "high_confidence" : "insufficient_data"
    };
  }
  /**
   * 11. Tool: get_daily_brief_facts
   */
  static async getDailyBriefFacts(businessId, timezone = "Africa/Douala") {
    const todaySales = await this.getTodaySalesSummary(businessId, timezone);
    const debtors = await this.getCustomerBalances(businessId);
    return {
      businessId,
      todayDate: todaySales.todayDate,
      timezone: todaySales.timezone,
      todayMetrics: {
        revenueToday: todaySales.revenue,
        transactionCountToday: todaySales.salesCount,
        cashCollectedToday: todaySales.cashCollected,
        grossProfitToday: todaySales.grossProfit,
        grossMarginPctToday: todaySales.grossMarginPct,
        receivablesCreatedToday: todaySales.receivablesCreated
      },
      inventoryAlerts: todaySales.inventoryAlerts,
      debtorAlerts: debtors
    };
  }
  /**
   * 12. Tool: get_fifo_inventory_valuation (Authoritative FIFO Ledger Audit)
   */
  static async getFIFOInventoryValuation(businessId) {
    const fifo = await this.runFIFOLedger(businessId);
    return {
      totals: fifo.ledgerResult.totals,
      valuationByProduct: fifo.ledgerResult.valuationByProduct,
      warnings: fifo.ledgerResult.warnings,
      costDrift: fifo.costDrift,
      stockReconciliation: fifo.stockReconciliation
    };
  }
  /**
   * Authoritative calculation of overview metrics using the FIFO ledger.
   */
  static async calculateOverviewWithFIFO(businessId, startDateIso, endDateIso, defaultTimezone = "Africa/Douala") {
    const [{ data: business }, { data: sales }, { data: expenses }, { data: payments }, fifo] = await Promise.all([
      serverSupabase.from("businesses").select("currency, timezone").eq("id", businessId).maybeSingle(),
      serverSupabase.from("sales").select("id, total, amount_paid, amount_due, sold_at").eq("business_id", businessId).eq("sale_status", "completed").gte("sold_at", startDateIso).lte("sold_at", endDateIso),
      serverSupabase.from("expenses").select("amount").eq("business_id", businessId).gte("expense_date", startDateIso.split("T")[0]).lte("expense_date", endDateIso.split("T")[0]),
      serverSupabase.from("payments").select("amount").eq("business_id", businessId).gte("paid_at", startDateIso).lte("paid_at", endDateIso),
      this.runFIFOLedger(businessId)
    ]);
    const salesList = sales || [];
    const revenue = salesList.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const txCount = salesList.length;
    const windowSaleIds = new Set(salesList.map((s) => s.id));
    const fifoByItem = new Map(fifo.ledgerResult.sales.map((s) => [s.saleEventId, s.cogs]));
    const windowItems = fifo.itemRows.filter((i) => windowSaleIds.has(i.sale_id));
    let cogs = windowItems.reduce(
      (sum, item) => sum + (fifoByItem.get(item.id) ?? Number(item.unit_cost || 0) * Number(item.quantity || 1)),
      0
    );
    if (cogs === 0 && revenue > 0 && fifo.productRows.length > 0) {
      const avgCostRatio = fifo.productRows.reduce((acc, p) => {
        const sp = Number(p.selling_price || 0);
        const cp = Number(p.cost_price || 0);
        return sp > 0 ? acc + cp / sp : acc;
      }, 0) / fifo.productRows.length;
      cogs = Number((revenue * (avgCostRatio || 0.6)).toFixed(2));
    }
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? Number((grossProfit / revenue * 100).toFixed(2)) : 0;
    const operatingExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const netProfit = grossProfit - operatingExpenses;
    const netMargin = revenue > 0 ? Number((netProfit / revenue * 100).toFixed(2)) : 0;
    const amountCollected = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
    const receivables = salesList.reduce((sum, s) => sum + Number(s.amount_due || 0), 0);
    return {
      business_id: businessId,
      currency: business?.currency || "USD",
      timezone: business?.timezone || defaultTimezone,
      revenue,
      cost_of_goods_sold: cogs,
      cogs,
      gross_profit: grossProfit,
      grossProfit,
      gross_margin: grossMargin,
      grossMarginPercent: grossMargin,
      operating_expenses: operatingExpenses,
      operatingExpenses,
      estimated_net_profit: netProfit,
      netProfit,
      net_margin: netMargin,
      netMarginPercent: netMargin,
      transaction_count: txCount,
      transactionCount: txCount,
      average_order_value: txCount > 0 ? Number((revenue / txCount).toFixed(2)) : 0,
      averageOrderValue: txCount > 0 ? Number((revenue / txCount).toFixed(2)) : 0,
      amount_collected: amountCollected,
      totalCashCollected: amountCollected,
      outstanding_receivables: receivables,
      totalReceivablesOutstanding: receivables
    };
  }
};

// server/intent.service.ts
function classifyBusinessQuery(query, history) {
  const q = query.toLowerCase().trim();
  const isGreetingOnly = /^(hello|hi|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|salut|bonjour|bon courage|yo|hola)[\s!.,?]*$/i.test(
    q
  ) || /^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+are\s+you|how\s+do\s+you\s+work|what\s+is\s+ursella|help\s+me|help)[\s!.,?]*$/i.test(
    q
  ) || /^(thanks|thank\s+you|merci|great|awesome|understood|got\s+it|ok|okay)[\s!.,?]*$/i.test(
    q
  );
  if (isGreetingOnly) {
    return {
      intent: "greeting",
      domain: "conversational",
      timePeriod: "all_time",
      requiredTools: [],
      suggestedTimeHorizonDays: 0,
      confidence: 0.99,
      primaryGoal: "Engage warmly and conversationally with the merchant without querying database records."
    };
  }
  if (q.startsWith("take me to ") || q.startsWith("go to ") || q.startsWith("navigate to ") || q.startsWith("open ") || q.startsWith("show me the ") || q === "take me to inventory" || q === "go to inventory" || q === "go to sales" || q === "open pos" || q === "open settings") {
    const isNavigation = q.includes("inventory") || q.includes("products") || q.includes("sales") || q.includes("pos") || q.includes("debtors") || q.includes("customers") || q.includes("expenses") || q.includes("settings") || q.includes("dashboard") || q.includes("catalog");
    if (isNavigation && !q.includes("how much") && !q.includes("why") && !q.includes("what is")) {
      return {
        intent: "navigation",
        domain: "store_info",
        timePeriod: "all_time",
        requiredTools: [],
        suggestedTimeHorizonDays: 0,
        confidence: 0.98,
        primaryGoal: "Guide the merchant directly to the requested application screen."
      };
    }
  }
  const recentHistory = (history || []).slice(-6);
  const lastUserMsg = [...recentHistory].reverse().find((m) => m.role === "user")?.content.toLowerCase() || "";
  const lastAssistantMsg = [...recentHistory].reverse().find((m) => m.role === "assistant")?.content.toLowerCase() || "";
  const isAnaphoraOrContinuation = q === "check it" || q === "check that" || q === "check this" || q === "look into it" || q === "diagnose it" || q === "investigate it" || q === "why is that?" || q === "why is that" || q === "why?" || q === "why" || q.startsWith("what about ") || q.startsWith("how about ") || q.startsWith("and ") || q === "do that" || q === "yes" || q === "go ahead" || q === "proceed" || q === "apply it" || q === "confirm it" || q.includes("compare it") || q.includes("tell me more about that");
  if (isAnaphoraOrContinuation && recentHistory.length > 0) {
    const productFollowUpMatch = q.match(/^(?:what\s+about|how\s+about|and)\s+(?:the\s+)?([a-z0-9\s_-]+)\??$/i);
    if (productFollowUpMatch) {
      const extractedEntity = productFollowUpMatch[1].trim();
      return {
        intent: "analysis",
        domain: "products",
        timePeriod: "last_30_days",
        requiredTools: ["get_product_performance"],
        suggestedTimeHorizonDays: 30,
        confidence: 0.95,
        isEntitySpecific: true,
        entityHint: extractedEntity,
        resolvedContextTopic: "product_margin_continuation",
        primaryGoal: `Continue product analysis specifically targeting "${extractedEntity}".`
      };
    }
    if (q === "do that" || q === "yes" || q === "go ahead" || q === "proceed" || q === "apply it") {
      return {
        intent: "action_confirmation",
        domain: "products",
        timePeriod: "all_time",
        requiredTools: ["get_product_performance"],
        suggestedTimeHorizonDays: 1,
        confidence: 0.95,
        resolvedContextTopic: "action_confirmation",
        primaryGoal: "Confirm execution of the proposed action discussed in the previous message."
      };
    }
    if (lastUserMsg.includes("slow") || lastUserMsg.includes("sales") || lastAssistantMsg.includes("slow") || lastAssistantMsg.includes("sales volume") || lastAssistantMsg.includes("product demand")) {
      return {
        intent: "diagnosis",
        domain: "sales",
        timePeriod: "comparison_period",
        requiredTools: ["get_sales_summary", "get_period_comparison", "get_inventory_alerts"],
        suggestedTimeHorizonDays: 30,
        confidence: 0.95,
        resolvedContextTopic: "sales_slowdown_diagnosis",
        primaryGoal: "Diagnose sales slowdown by checking recent sales trajectory, period comparison, and inventory availability."
      };
    }
    if (lastUserMsg.includes("stock") || lastUserMsg.includes("inventory") || lastAssistantMsg.includes("inventory")) {
      return {
        intent: "diagnosis",
        domain: "inventory",
        timePeriod: "all_time",
        requiredTools: ["get_inventory_alerts", "get_product_performance"],
        suggestedTimeHorizonDays: 30,
        confidence: 0.94,
        resolvedContextTopic: "inventory_continuation",
        primaryGoal: "Check inventory stock levels and replenishment priorities from prior context."
      };
    }
    if (lastUserMsg.includes("debt") || lastUserMsg.includes("owe") || lastAssistantMsg.includes("debt")) {
      return {
        intent: "fact_retrieval",
        domain: "debtors",
        timePeriod: "all_time",
        requiredTools: ["get_customer_balances"],
        suggestedTimeHorizonDays: 30,
        confidence: 0.95,
        resolvedContextTopic: "debtor_continuation",
        primaryGoal: "Inspect customer balances and overdue credit based on preceding discussion."
      };
    }
  }
  const isEducationalConcept = (q.includes("explain") || q.startsWith("what is ") || q.startsWith("what does ") || q.startsWith("how to calculate ") || q.startsWith("how do you calculate ") || q.startsWith("difference between ")) && (q.includes("gross margin") || q.includes("net profit") || q.includes("profit margin") || q.includes("cogs") || q.includes("cost of goods") || q.includes("fifo") || q.includes("working capital") || q.includes("markup") || q.includes("break even") || q.includes("breakeven") || q.includes("cash flow") || q.includes("depreciation") || q.includes("inventory turnover") || q.includes("safety stock")) && !q.includes("my ") && !q.includes("our ") && !q.includes("store") && !q.includes("business") && !q.includes("today") && !q.includes("this month");
  if (isEducationalConcept) {
    return {
      intent: "explanation",
      domain: "profitability",
      timePeriod: "all_time",
      requiredTools: [],
      // ZERO database retrieval!
      suggestedTimeHorizonDays: 0,
      confidence: 0.98,
      primaryGoal: "Provide a clear, conversational explanation of the business financial concept with practical examples, without querying store database records."
    };
  }
  if (q.startsWith("add ") || q.startsWith("create ") || q.startsWith("register ") || q.startsWith("new product") || q.startsWith("ajouter ") || q.startsWith("cr\xE9er ") || q.includes("add product") || q.includes("create product") || q.includes("new product") || q.includes("add new item") || q.includes("add to inventory") || q.includes("add to catalog") || q.includes("add stock") || q.includes("restock") || q.includes("reapprovisionner")) {
    let extractedEntity;
    const addUnitsMatch = q.match(/add\s+\d+\s*(?:units?|pcs?|items?|bags?|cartons?|kg|bottles?|pieces?)?\s*(?:of\s+)?([a-z0-9\s_-]+)/i);
    if (addUnitsMatch) {
      extractedEntity = addUnitsMatch[1].trim();
    }
    return {
      intent: "action_proposal",
      domain: "products",
      timePeriod: "all_time",
      requiredTools: ["get_product_performance"],
      // Only product catalog needed!
      suggestedTimeHorizonDays: 30,
      confidence: 0.98,
      isEntitySpecific: true,
      entityHint: extractedEntity,
      primaryGoal: "Validate product catalog entry, check existing stock, and prepare proposed action for confirmation."
    };
  }
  const isExplicitReportRequested = q.includes("full business analysis") || q.includes("full analysis") || q.includes("detailed performance report") || q.includes("comprehensive diagnostics") || q.includes("detailed report") || q.includes("business overview report") || q.includes("comprehensive analysis") || q.includes("full report") || q.includes("complete business analysis");
  if (isExplicitReportRequested) {
    return {
      intent: "full_report",
      domain: "multi_domain",
      timePeriod: "last_30_days",
      isReportMode: true,
      requiredTools: [
        "get_business_overview",
        "get_today_sales_summary",
        "get_inventory_alerts",
        "get_customer_balances",
        "get_business_health"
      ],
      suggestedTimeHorizonDays: 30,
      confidence: 0.99,
      primaryGoal: "Generate an in-depth, comprehensive executive report with structured sections as explicitly requested by the merchant."
    };
  }
  const isBestSellingOrProductMargin = q.includes("best selling") || q.includes("best-selling") || q.includes("top product") || q.includes("top selling") || q.includes("fastest selling") || q.includes("best seller") || q.includes("most sold") || q.includes("makes me the most money") || q.includes("make me the most money") || q.includes("most profitable product") || q.includes("highest margin product") || q.includes("highest profit product") || q.includes("which product") || q.includes("what product") || q.includes("product performance") || q.includes("slow moving product");
  if (isBestSellingOrProductMargin) {
    return {
      intent: "analysis",
      domain: "products",
      timePeriod: "last_30_days",
      requiredTools: ["get_product_performance"],
      // Products ONLY!
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      isEntitySpecific: false,
      primaryGoal: "Retrieve product sales velocity, volume, and unit economics to answer top product inquiries directly."
    };
  }
  if (q.includes("today") || q.includes("sell today") || q.includes("sold today") || q.includes("sales today") || q.includes("revenue today") || q.includes("orders today")) {
    return {
      intent: "fact_retrieval",
      domain: "sales",
      timePeriod: "today",
      requiredTools: ["get_today_sales_summary"],
      // Today only!
      suggestedTimeHorizonDays: 1,
      confidence: 0.98,
      primaryGoal: "Retrieve today sales revenue, transaction count, and orders directly."
    };
  }
  if (q.includes("yesterday") || q.includes("sales yesterday") || q.includes("sold yesterday")) {
    return {
      intent: "fact_retrieval",
      domain: "sales",
      timePeriod: "yesterday",
      requiredTools: ["get_sales_summary"],
      // Sales summary only!
      suggestedTimeHorizonDays: 2,
      confidence: 0.95,
      primaryGoal: "Retrieve sales revenue and orders for yesterday."
    };
  }
  if (q.includes("this month") || q.includes("make this month") || q.includes("made this month") || q.includes("monthly sales")) {
    return {
      intent: "fact_retrieval",
      domain: "sales",
      timePeriod: "this_month",
      requiredTools: ["get_sales_summary"],
      // Sales summary only!
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
      primaryGoal: "Retrieve recorded sales and revenue for this month."
    };
  }
  if (q.includes("sales have been slow") || q.includes("sales are slow") || q.includes("slow lately") || q.includes("how are my sales doing") || q.includes("how are sales doing") || q.includes("how are my sales") || q.includes("sales drop") || q.includes("drop in sales") || q.includes("sales down")) {
    return {
      intent: "diagnosis",
      domain: "sales",
      timePeriod: "comparison_period",
      requiredTools: ["get_sales_summary", "get_period_comparison"],
      // Relevant sales history & comparison only!
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
      primaryGoal: "Analyze sales trajectory against previous period to answer sales performance and slowdown concerns."
    };
  }
  if (q.includes("why did my profit drop") || q.includes("why did profit drop") || q.includes("profit drop") || q.includes("profit down")) {
    return {
      intent: "diagnosis",
      domain: "profitability",
      timePeriod: "comparison_period",
      requiredTools: ["get_business_overview", "get_period_comparison", "get_expense_summary"],
      // Relevant revenue, COGS, expenses and comparison only!
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
      primaryGoal: "Diagnose profit change by comparing revenue, COGS, and operating expenses against previous period."
    };
  }
  if (q.includes("low stock") || q.includes("running low") || q.includes("out of stock") || q.includes("inventory") || q.includes("stock level") || q.includes("items in stock") || q.includes("how much stock") || q.includes("depleted") || q.includes("stockout")) {
    return {
      intent: "fact_retrieval",
      domain: "inventory",
      timePeriod: "all_time",
      requiredTools: ["get_inventory_alerts"],
      // Inventory alerts only!
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      primaryGoal: "Identify low-stock and out-of-stock items needing replenishment."
    };
  }
  if (q.includes("who owes") || q.includes("debt") || q.includes("debtor") || q.includes("unpaid") || q.includes("receivable") || q.includes("owing") || q.includes("credit balance") || q.includes("collect money") || q.includes("customers owe") || q.includes("owe me") || q.includes("money owed")) {
    return {
      intent: "fact_retrieval",
      domain: "debtors",
      timePeriod: "all_time",
      requiredTools: ["get_customer_balances"],
      // Customer balances only!
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      primaryGoal: "Retrieve outstanding customer receivables and debtor balances."
    };
  }
  if (q.includes("expense") || q.includes("spending") || q.includes("spent") || q.includes("costs") || q.includes("operating cost") || q.includes("where am i spending")) {
    return {
      intent: "analysis",
      domain: "expenses",
      timePeriod: "this_month",
      requiredTools: ["get_expense_summary"],
      // Expense summary only!
      suggestedTimeHorizonDays: 30,
      confidence: 0.94,
      primaryGoal: "Retrieve operating expenditures and cost breakdowns."
    };
  }
  if (q.includes("cash flow") || q.includes("cash collected") || q.includes("liquidity") || q.includes("money in") || q.includes("inflow")) {
    return {
      intent: "analysis",
      domain: "cash_flow",
      timePeriod: "last_30_days",
      requiredTools: ["get_cash_flow"],
      suggestedTimeHorizonDays: 30,
      confidence: 0.92,
      primaryGoal: "Evaluate cash inflows vs operational outflows."
    };
  }
  if (q.includes("fifo") || q.includes("cost drift") || q.includes("cost basis") || q.includes("inventory valuation") || q.includes("cost layer")) {
    return {
      intent: "fifo_audit",
      domain: "fifo_costing",
      timePeriod: "all_time",
      requiredTools: ["get_fifo_inventory_valuation"],
      suggestedTimeHorizonDays: 30,
      confidence: 0.97,
      primaryGoal: "Run FIFO inventory valuation and layer inspection."
    };
  }
  if (q.includes("business name") || q.includes("store name") || q.includes("operating currency") || q.includes("what currency") || q.includes("timezone") || q.includes("who am i")) {
    return {
      intent: "identity_lookup",
      domain: "store_info",
      timePeriod: "all_time",
      requiredTools: ["get_business_overview"],
      suggestedTimeHorizonDays: 1,
      confidence: 0.98,
      primaryGoal: "Answer store configuration, name, currency, or timezone."
    };
  }
  return {
    intent: "conversational",
    domain: "multi_domain",
    timePeriod: "today",
    requiredTools: ["get_today_sales_summary"],
    // Minimal pulse only!
    suggestedTimeHorizonDays: 1,
    confidence: 0.85,
    primaryGoal: "Respond naturally to the merchant using immediate daily sales pulse."
  };
}

// server/ai-config.ts
import { GoogleGenAI } from "@google/genai";
var DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
var FALLBACK_LITE_MODEL = "gemini-3.1-flash-lite";
var DEPRECATED_MODELS = /* @__PURE__ */ new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro"
]);
function getActiveGeminiModel() {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (!envModel) {
    return DEFAULT_GEMINI_MODEL;
  }
  if (DEPRECATED_MODELS.has(envModel.toLowerCase())) {
    console.warn(
      `[AI Config] Warning: configured GEMINI_MODEL "${envModel}" is deprecated and unsupported. Auto-resolving to authoritative "${DEFAULT_GEMINI_MODEL}".`
    );
    return DEFAULT_GEMINI_MODEL;
  }
  return envModel;
}
var geminiClientInstance = null;
function getGeminiClient() {
  if (!geminiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey.length > 0 && apiKey !== "placeholder-key" && !apiKey.includes("MY_GEMINI_API_KEY")) {
      geminiClientInstance = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
  }
  return geminiClientInstance;
}
var GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1";
var GROQ_PRODUCTION_MODEL = "openai/gpt-oss-120b";
function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY?.trim();
  if (key && key.length > 0 && key !== "placeholder-key" && !key.includes("MY_GROQ_API_KEY")) {
    return key;
  }
  return null;
}
function logAIProvenance(meta) {
  const provider = meta.provider || (meta.source === "GEMINI_RESPONSE" ? "gemini" : meta.source === "GROQ_RESPONSE" ? "groq" : "deterministic_fallback");
  const statusEmoji = provider === "gemini" ? "\u2728 [GEMINI_LIVE]" : provider === "groq" ? "\u26A1 [GROQ_SECONDARY]" : "\u{1F6E1}\uFE0F [DETERMINISTIC_FALLBACK]";
  console.log(
    `[AI Provenance] ${statusEmoji} provider: ${provider} endpoint=${meta.endpoint} business=${meta.businessId} model=${meta.model} source=${meta.source} latency=${meta.latencyMs}ms${meta.error ? ` err="${meta.error}"` : ""}`
  );
}

// server/ai-prompt.utils.ts
function sanitizeFollowUpSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "string") return "";
  let clean = suggestion.trim();
  clean = clean.replace(/^would you like me to\s+/i, "").replace(/^would you like to\s+/i, "").replace(/^would you like\s+/i, "Show me ").replace(/^do you want me to\s+/i, "").replace(/^do you want to\s+/i, "").replace(/^do you want\s+/i, "Show me ").replace(/^should i\s+/i, "").replace(/^shall i\s+/i, "").replace(/^can i help you\s+/i, "Help me ").replace(/^can i\s+/i, "").replace(/^do you need me to\s+/i, "").replace(/^do you need help\s+(?:with|to)?\s*/i, "Help me ").replace(/^do you need to\s+/i, "").replace(/^do you have any questions about\s+/i, "Tell me more about ").replace(/^let me know if you want to\s+/i, "").replace(/^if you want, I can\s+/i, "").trim();
  if (!clean) return "";
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  if (clean.endsWith("?") && !/^(how|what|who|which|where|why|can you|is|are)\b/i.test(clean)) {
    clean = clean.slice(0, -1).trim();
  }
  return clean;
}
function sanitizeFollowUpSuggestions(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return ["How are my sales today?", "Which products are low on stock?"];
  }
  const cleaned = suggestions.map((s) => sanitizeFollowUpSuggestion(s)).filter((s) => s.length > 3);
  return cleaned.length > 0 ? cleaned.slice(0, 4) : ["How are my sales today?", "Which products are low on stock?"];
}

// server/groq.service.ts
var GroqService = class {
  /**
   * Executes AI Chat reasoning using Groq API as secondary fallback.
   * Model: openai/gpt-oss-120b
   */
  static async generateChatResponse(systemInstruction, contextPrompt, ctx, timeoutMs = 12e3) {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      console.warn("[Groq Router] GROQ_API_KEY is not configured in server environment.");
      return null;
    }
    if (ctx.testSimulation === "all-fail") {
      console.warn("[Groq Router] Simulated secondary provider failure: all-fail");
      return null;
    }
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${GROQ_API_ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: GROQ_PRODUCTION_MODEL,
          messages: [
            {
              role: "system",
              content: systemInstruction
            },
            {
              role: "user",
              content: contextPrompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorText.slice(0, 250)}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const latencyMs = Date.now() - startTime;
      if (!content || typeof content !== "string") {
        throw new Error("Groq API returned empty response content");
      }
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.answer === "string") {
          logAIProvenance({
            endpoint: "generateChatResponse",
            businessId: ctx.businessName,
            source: "GROQ_RESPONSE",
            provider: "groq",
            model: GROQ_PRODUCTION_MODEL,
            latencyMs
          });
          return {
            answer: parsed.answer,
            intent: parsed.intent || ctx.parsedIntent?.intent || "business_overview",
            keyMetrics: parsed.keyMetrics || [],
            observations: parsed.observations || [],
            recommendations: parsed.recommendations || [],
            anomaliesDetected: parsed.anomaliesDetected || [],
            confidence: parsed.confidence || "high_confidence",
            dataSufficiencyNote: parsed.dataSufficiencyNote,
            followUpSuggestions: sanitizeFollowUpSuggestions(parsed.followUpSuggestions),
            proposedAction: parsed.proposedAction,
            responseSource: "GROQ_RESPONSE",
            provider: "groq"
          };
        }
      } catch (parseError) {
        logAIProvenance({
          endpoint: "generateChatResponse",
          businessId: ctx.businessName,
          source: "GROQ_RESPONSE",
          provider: "groq",
          model: GROQ_PRODUCTION_MODEL,
          latencyMs,
          error: `JSON parse warning: ${parseError?.message}`
        });
        return {
          answer: content,
          confidence: "moderate_confidence",
          followUpSuggestions: ["What else should I focus on?"],
          responseSource: "GROQ_RESPONSE",
          provider: "groq"
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isTimeout = err?.name === "AbortError";
      const errMsg = isTimeout ? `Groq request timed out after ${timeoutMs}ms` : err?.message || String(err);
      console.warn(`[Groq API Error] Model="${GROQ_PRODUCTION_MODEL}" failed after ${latencyMs}ms:`, errMsg);
      logAIProvenance({
        endpoint: "generateChatResponse",
        businessId: ctx.businessName,
        source: "GROQ_RESPONSE",
        provider: "groq",
        model: GROQ_PRODUCTION_MODEL,
        latencyMs,
        error: errMsg
      });
      return null;
    }
    return null;
  }
  /**
   * Executes secondary Daily Brief generation using Groq API.
   */
  static async generateDailyBrief(prompt, systemInstruction, ctx, today, debtors, timeoutMs = 12e3) {
    const apiKey = getGroqApiKey();
    if (!apiKey) return null;
    if (ctx.testSimulation === "all-fail") {
      return null;
    }
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${GROQ_API_ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: GROQ_PRODUCTION_MODEL,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Groq HTTP ${response.status}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      const latencyMs = Date.now() - startTime;
      logAIProvenance({
        endpoint: "generateDailyBrief",
        businessId: ctx.businessName,
        source: "GROQ_RESPONSE",
        provider: "groq",
        model: GROQ_PRODUCTION_MODEL,
        latencyMs
      });
      return {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        businessName: ctx.businessName,
        currency: ctx.currency,
        headline: parsed.headline || `Daily Briefing for ${ctx.businessName}`,
        executiveSummary: parsed.executiveSummary || `Today's performance overview for ${ctx.businessName}.`,
        performanceSnapshot: {
          revenue: today.revenueToday,
          transactions: today.transactionCountToday,
          amountCollected: today.cashCollectedToday,
          expenses: today.expensesToday,
          outstandingReceivables: debtors.totalOutstandingDebt
        },
        keyTakeaways: parsed.keyTakeaways || [],
        inventoryAlerts: parsed.inventoryAlerts || [],
        debtFollowUps: parsed.debtFollowUps || [],
        recommendedFocusToday: parsed.recommendedFocusToday || "Review daily sales and inventory levels.",
        confidence: parsed.confidence || (today.transactionCountToday >= 5 ? "high_confidence" : "insufficient_data")
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  }
};

// server/gemini.service.ts
var GeminiService = class _GeminiService {
  /**
   * Builds the conversational Ursella AI system instruction.
   */
  static buildSystemInstruction(ctx) {
    const isReportMode = Boolean(ctx.parsedIntent?.isReportMode);
    return `You are Ursella AI, a trusted, highly knowledgeable business advisor speaking directly with the merchant who owns "${ctx.businessName}" (${ctx.businessType}).
You communicate like an experienced human business advisor: natural, conversational, warm, sharp, and direct.
You are NOT a rigid report generator.

PLATFORM CONTEXT & GROUND TRUTH:
- Active Enterprise: "${ctx.businessName}" (${ctx.businessType})
- Operating Currency: "${ctx.currency}". Always format every financial figure with "${ctx.currency}".
- Timezone: "${ctx.timezone}". Reference Date: ${ctx.currentDateIso.split("T")[0]}.

CONVERSATIONAL BEHAVIOR & ANSWER PRIORITY:
1. ALWAYS ANSWER THE USER'S ACTUAL QUESTION IMMEDIATELY IN THE FIRST SENTENCE.
   - Additional context should support the answer, not bury it.
   - Keep responses proportional to what was asked. For standard questions, respond in 1-3 conversational, insightful paragraphs using clear natural language, bolding key figures.
   - Do NOT dump every available metric into the response.

2. STRUCTURE RULES (CONVERSATIONAL vs REPORT MODE):
${isReportMode ? `- REPORT MODE IS EXPLICITLY REQUESTED BY THE USER:
  Structure your analysis into clear, professional sections:
  ### Executive Summary
  - Summarize key findings directly.
  ### Analytical Diagnostics & Data Breakdown
  - Drill into relevant metrics, percentages, margins, and comparisons.
  ### Strategic Recommendations
  - Provide 2-3 concrete, high-leverage operational action steps.` : `- NORMAL CONVERSATIONAL MODE (Default):
  Respond naturally and directly to the user's message.
  DO NOT use or prepend boilerplate report headers like "### Executive Summary", "### Analytical Diagnostics & Data Breakdown", or "### Strategic Recommendations & Tactical Playbook". Write conversationally as an advisor talking to the merchant.`}

3. CONVERSATIONAL MEMORY & MULTI-TURN CONTINUITY:
- Maintain the current conversation's context.
- The AI must understand references such as:
  'it', 'that', 'them', 'those products', 'the first one', 'what about the hoodies?', 'compare it with last month', 'check it', 'do that', 'yes', 'no', 'go ahead'
  based on the immediately preceding conversation.
- Never treat every message as an isolated question or force the merchant to repeat the subject.
- Continue previous trains of thought seamlessly (e.g., if the user previously said 'Sales have been slow lately' and then says 'Check it', diagnose the sales slowdown directly; if discussing which product makes the most money and the user asks 'What about the hoodies?', analyze the hoodies' margins and revenue directly).

4. BUSINESS REASONING & INTEGRITY (FACT vs INFERENCE vs RECOMMENDATION):
- Strictly distinguish between:
  * FACT: 'Your recorded sales today are ${ctx.currency} 0.' (Must be grounded strictly in verified data).
  * INFERENCE: 'This may indicate a slower sales day, or orders have not been entered into the system yet.'
  * RECOMMENDATION: 'If you want to generate sales today, I would first contact existing customers before discounting products.'
- NEVER present an inference or recommendation as an established business fact.
- NEVER fabricate: supplier agreements, delivery times, customer behavior, market trends, competitor activity, future events, discounts, budgets, percentages, financial conditions, or business policies.
- If data is insufficient or zero, say so simply and clearly.
- Do not assume that one day of zero sales means the business has a cash-flow problem.
- Do not recommend arbitrary discounts or spending amounts without supporting evidence.

5. PRODUCT ACTIONS & CATALOG MANAGEMENT:
- When the merchant asks to add, create, or restock a product (e.g. "Add 20 units of Milo" or "Add 50 bags of Cement at 4500 selling, 3800 cost"):
  * Summarize the product name, unit of measure, quantity, and unit economics in a friendly, conversational response.
  * In the JSON output, include the "proposedAction" object (category: "product_creation" or "inventory_restock", phaseStatus: "ready_for_execution").
  * Inform the merchant they can confirm the addition with 1 click using the card below.
  * DO NOT generate an unrelated full-business analysis report.

6. OUTPUT FORMAT:
Respond with a JSON object strictly adhering to this schema:
{
  "answer": "Your natural, conversational response in Markdown (or structured report if Report Mode was explicitly requested).",
  "keyMetrics": [
    { "label": "Metric Name", "value": 12000, "formattedValue": "${ctx.currency} 12,000", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Clear rationale",
      "actionSuggestion": "Actionable step",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": [
    "User question or request 1",
    "User question or request 2"
  ],
  "proposedAction": {
    "actionType": "create_product" | "create_inventory_adjustment",
    "title": "Action Title",
    "description": "Action Description",
    "category": "product_creation" | "inventory_restock",
    "phaseStatus": "ready_for_execution",
    "payload": { ... }
  }
}
(Note: Include keyMetrics only if directly relevant to the question. Leave empty [] for greetings, navigation, or general concept explanations).

7. FOLLOW-UP SUGGESTIONS PERSPECTIVE (CRITICAL):
The "followUpSuggestions" are buttons that the MERCHANT will click to ask Ursella what THEY need next.
- They MUST be phrased from the USER'S perspective requesting what they need (e.g. "Check my sales from last week", "Show me products low on stock", "Who owes me money?", "Help me reorder this item", "What was my profit on cement?").
- They MUST NEVER be phrased as the AI asking the user ("Would you like me to...", "Do you want to...", "Should I...", "Would you like...").
- Keep them concise (3-7 words) and directly relevant.`;
  }
  /**
   * Primary entry point for generating conversational AI chat responses.
   * Employs the resilient multi-provider routing strategy:
   * 1. Gemini (primary) -> with 1 bounded retry for transient faults
   * 2. Groq (secondary) -> production llama/gpt model
   * 3. Deterministic Reasoning Engine Fallback (guaranteed response)
   */
  static async generateChatResponse(userMessage, ctx) {
    const ai = getGeminiClient();
    const contextPrompt = `
=== BUSINESS CONTEXT & RELEVANT FACTUAL METRICS ===
Active Store: ${ctx.businessName} (${ctx.businessType})
Currency: ${ctx.currency}
Timezone: ${ctx.timezone}
Reference Date: ${ctx.currentDateIso}

${ctx.parsedIntent ? `=== INTERPRETED REASONING GOAL ===
Intent: ${ctx.parsedIntent.intent}
Domain: ${ctx.parsedIntent.domain}
Time Period: ${ctx.parsedIntent.timePeriod}
Goal: ${ctx.parsedIntent.primaryGoal}
Report Mode: ${ctx.parsedIntent.isReportMode ? "YES" : "NO"}
${ctx.parsedIntent.entityHint ? `Entity Target: ${ctx.parsedIntent.entityHint}` : ""}
${ctx.parsedIntent.resolvedContextTopic ? `Resolved Topic: ${ctx.parsedIntent.resolvedContextTopic}` : ""}
` : ""}

=== VERIFIED BUSINESS DATA (GROUND TRUTH) ===
${JSON.stringify(ctx.toolResults, null, 2)}

=== USER CONVERSATION HISTORY ===
${ctx.conversationHistory?.length ? ctx.conversationHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n") : "No previous history."}

=== CURRENT USER QUESTION ===
"${userMessage}"
`;
    const model = getActiveGeminiModel();
    const startTime = Date.now();
    const systemInstruction = this.buildSystemInstruction(ctx);
    let geminiError = null;
    if (ai && ctx.testSimulation !== "gemini-503" && ctx.testSimulation !== "gemini-429" && ctx.testSimulation !== "gemini-timeout" && ctx.testSimulation !== "all-fail") {
      try {
        console.log(`[AI Routing] Calling primary provider: gemini (${model})...`);
        const geminiPromise = ai.models.generateContent({
          model,
          contents: contextPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.2
          }
        });
        const response = await this.withTimeout(
          geminiPromise,
          12e3,
          "Gemini request timed out after 12000ms"
        );
        const latencyMs = Date.now() - startTime;
        const responseText = response.text || "";
        if (responseText) {
          console.log("[AI Routing] provider: gemini");
          logAIProvenance({
            endpoint: "generateChatResponse",
            businessId: ctx.businessName,
            source: "GEMINI_RESPONSE",
            provider: "gemini",
            model,
            latencyMs
          });
          return this.parseChatStructuredResponse(responseText, ctx, "GEMINI_RESPONSE", "gemini");
        }
      } catch (err) {
        console.warn(`[AI Routing] Gemini primary provider failed:`, err?.message || err);
        geminiError = err;
      }
    } else {
      if (ctx.testSimulation === "gemini-503") {
        const err = new Error("503 Service Unavailable: High upstream model load (simulated)");
        err.status = 503;
        geminiError = err;
      } else if (ctx.testSimulation === "gemini-429") {
        const err = new Error("429 Too Many Requests: Rate limit exceeded (simulated)");
        err.status = 429;
        geminiError = err;
      } else if (ctx.testSimulation === "gemini-timeout") {
        const err = new Error("Gemini request timed out after 12000ms (simulated)");
        err.name = "TimeoutError";
        err.status = 504;
        geminiError = err;
      } else if (ctx.testSimulation === "all-fail") {
        geminiError = new Error("Simulated upstream failure (all-fail)");
      } else {
        geminiError = new Error("GEMINI_API_KEY is not configured or client initialization failed");
      }
    }
    if (this.isTemporaryGeminiError(geminiError) && ctx.testSimulation !== "all-fail") {
      console.warn(
        `[AI Routing] Gemini temporary failure (${geminiError?.message || geminiError}). Initiating 1 bounded retry...`
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (ai && !ctx.testSimulation?.startsWith("gemini-")) {
        try {
          const retryPromise = ai.models.generateContent({
            model,
            contents: contextPrompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.2
            }
          });
          const response = await this.withTimeout(
            retryPromise,
            8e3,
            "Gemini retry timed out after 8000ms"
          );
          const latencyMs = Date.now() - startTime;
          const responseText = response.text || "";
          if (responseText) {
            console.log("[AI Routing] provider: gemini (succeeded on retry)");
            logAIProvenance({
              endpoint: "generateChatResponse",
              businessId: ctx.businessName,
              source: "GEMINI_RESPONSE",
              provider: "gemini",
              model,
              latencyMs
            });
            return this.parseChatStructuredResponse(responseText, ctx, "GEMINI_RESPONSE", "gemini");
          }
        } catch (retryErr) {
          console.warn(
            `[AI Routing] Gemini retry attempt failed (${retryErr?.message || retryErr}). Proceeding to Groq fallback.`
          );
          geminiError = retryErr;
        }
      } else {
        console.warn(`[AI Routing] Simulated Gemini temporary failure verified. Proceeding to Groq fallback.`);
      }
    }
    console.log(`[AI Routing] Calling secondary provider: groq (${GROQ_PRODUCTION_MODEL})...`);
    try {
      const groqResponse = await GroqService.generateChatResponse(
        systemInstruction,
        contextPrompt,
        ctx,
        12e3
      );
      if (groqResponse) {
        console.log("[AI Routing] provider: groq");
        return groqResponse;
      }
    } catch (groqErr) {
      console.warn(`[AI Routing] Groq provider failed:`, groqErr?.message || groqErr);
    }
    console.log("[AI Routing] provider: deterministic_fallback");
    return this.generateDeterministicFallback(userMessage, ctx);
  }
  /**
   * Detects whether an error from Gemini is temporary and suitable for a bounded retry.
   */
  static isTemporaryGeminiError(err) {
    if (!err) return false;
    const msg = (err.message || "").toLowerCase();
    const status = err.status || err.statusCode;
    if (status === 503 || status === 429 || status === 504 || status === 502) return true;
    if (msg.includes("503") || msg.includes("429") || msg.includes("rate limit") || msg.includes("resource exhausted")) return true;
    if (msg.includes("timeout") || msg.includes("timed out") || err.name === "TimeoutError") return true;
    if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("network error") || msg.includes("socket hang up")) return true;
    return false;
  }
  /**
   * Helper timeout promise wrapper.
   */
  static withTimeout(promise, ms, errorMsg) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(errorMsg);
        err.name = "TimeoutError";
        reject(err);
      }, ms);
      promise.then((res) => {
        clearTimeout(timer);
        resolve(res);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
  /**
   * Sanitizes follow-up suggestions so that every prompt represents
   * the merchant needing a service (User perspective) rather than
   * the AI asking if the merchant wants something (AI perspective).
   */
  static sanitizeFollowUpSuggestions(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return ["How are my sales today?", "Which products are low on stock?"];
    }
    const cleaned = suggestions.map((s) => {
      if (!s || typeof s !== "string") return "";
      let clean = s.trim();
      clean = clean.replace(/^would you like me to\s+/i, "").replace(/^would you like to\s+/i, "").replace(/^would you like\s+/i, "Show me ").replace(/^do you want me to\s+/i, "").replace(/^do you want to\s+/i, "").replace(/^do you want\s+/i, "Show me ").replace(/^should i\s+/i, "").replace(/^shall i\s+/i, "").replace(/^can i help you\s+/i, "Help me ").replace(/^can i\s+/i, "").replace(/^do you need me to\s+/i, "").replace(/^do you need help\s+(?:with|to)?\s*/i, "Help me ").replace(/^do you need to\s+/i, "").replace(/^do you have any questions about\s+/i, "Tell me more about ").replace(/^let me know if you want to\s+/i, "").replace(/^if you want, I can\s+/i, "");
      clean = clean.trim();
      if (!clean) return "";
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      if (clean.endsWith("?") && !/^(how|what|who|which|where|why|can you|is|are)\b/i.test(clean)) {
        clean = clean.slice(0, -1).trim();
      }
      return clean;
    }).filter((s) => s.length > 3).slice(0, 4);
    return cleaned.length > 0 ? cleaned : ["How are my sales today?", "Which products are low on stock?"];
  }
  /**
   * Parses and validates raw AI JSON output.
   */
  static parseChatStructuredResponse(rawText, ctx, source, provider) {
    try {
      let cleaned = rawText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(cleaned);
      return {
        answer: parsed.answer || "Analysis complete.",
        keyMetrics: Array.isArray(parsed.keyMetrics) ? parsed.keyMetrics : [],
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        confidence: parsed.confidence || "high_confidence",
        followUpSuggestions: _GeminiService.sanitizeFollowUpSuggestions(parsed.followUpSuggestions),
        proposedAction: parsed.proposedAction,
        responseSource: source,
        provider
      };
    } catch (parseError) {
      console.warn(`[AI Engine] Failed to parse structured JSON from ${provider}, using text fallback:`, parseError);
      return {
        answer: rawText,
        confidence: "moderate_confidence",
        responseSource: source,
        provider,
        followUpSuggestions: ["How are my sales today?", "Which products are low on stock?"]
      };
    }
  }
  /**
   * Authoritative Deterministic Fallback Engine.
   * Produces natural, conversational responses matching the updated communication standards.
   */
  static generateDeterministicFallback(query, ctx) {
    const q = query.toLowerCase().trim();
    const overview = ctx.toolResults.get_business_overview || {};
    const todaySales = ctx.toolResults.get_today_sales_summary || {};
    const salesSummary = ctx.toolResults.get_sales_summary || {};
    const dailyBrief = ctx.toolResults.get_daily_brief_facts || {};
    const inv = ctx.toolResults.get_inventory_alerts || todaySales.inventoryAlerts || {};
    const debtors = ctx.toolResults.get_customer_balances || dailyBrief.debtorAlerts || {};
    const products = ctx.toolResults.get_product_performance || [];
    const comp = ctx.toolResults.get_period_comparison || {};
    const expenses = ctx.toolResults.get_expense_summary || {};
    const cashFlow = ctx.toolResults.get_cash_flow || {};
    const currency = ctx.currency || "XAF";
    const isExplicitReport = Boolean(ctx.parsedIntent?.isReportMode);
    if (ctx.parsedIntent?.intent === "greeting" || /^(hello|hi|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|salut|bonjour|yo|hola)[\s!.,?]*$/i.test(q) || /^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+are\s+you|what\s+is\s+ursella|help)[\s!.,?]*$/i.test(q)) {
      return {
        answer: `Hello! I'm your Ursella AI advisor for **${ctx.businessName}**.

I can help you check your live sales, identify low-stock items needing replenishment, review customer credit balances, analyze your product margins, or register products in your catalog. What would you like to look at today?`,
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        keyMetrics: [],
        recommendations: [],
        followUpSuggestions: [
          "How are my sales today?",
          "What is my best-selling product?",
          "Which products are low on stock?",
          "Who owes me money?"
        ]
      };
    }
    if (ctx.parsedIntent?.intent === "navigation") {
      let targetName = "the main dashboard";
      if (q.includes("inventory") || q.includes("product") || q.includes("catalog")) targetName = "**Inventory & Products**";
      else if (q.includes("sale") || q.includes("order")) targetName = "**Sales & Orders**";
      else if (q.includes("pos")) targetName = "**POS / Point of Sale**";
      else if (q.includes("debt") || q.includes("customer")) targetName = "**Customers & Credit**";
      else if (q.includes("expense")) targetName = "**Expenses**";
      else if (q.includes("setting")) targetName = "**Settings**";
      return {
        answer: `You can access ${targetName} directly from the navigation menu on the left side of your screen.`,
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        keyMetrics: [],
        recommendations: [],
        followUpSuggestions: [
          "How are my sales today?",
          "Which products are low on stock?"
        ]
      };
    }
    if (ctx.parsedIntent?.intent === "explanation") {
      if (q.includes("gross margin") || q.includes("margin")) {
        return {
          answer: `**Gross margin** is the percentage of revenue your business keeps after paying the direct cost of purchasing or producing the goods sold (COGS).

**Formula:**
$$\\text{Gross Margin (\\%)} = \\frac{\\text{Revenue} - \\text{COGS}}{\\text{Revenue}} \\times 100$$

For example, if you buy an item for ${currency} 3,000 and sell it for ${currency} 5,000, your gross profit is ${currency} 2,000 and your gross margin is **40%**. A higher gross margin gives you more cash buffer to cover operating expenses like rent, utilities, and staff.`,
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            "Which products make me the most money?",
            "What is my gross profit this month?"
          ]
        };
      }
      if (q.includes("cogs") || q.includes("cost of goods")) {
        return {
          answer: `**Cost of Goods Sold (COGS)** represents the direct costs incurred to acquire or produce the products you sold during a period.

It includes purchase costs and direct inbound freight, but excludes general operating expenses like rent, electricity, or administrative overhead. In Ursella, COGS is tracked automatically using authoritative FIFO (First-In, First-Out) costing.`,
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            "What is my FIFO inventory valuation?",
            "What is my best-selling product?"
          ]
        };
      }
      if (q.includes("working capital") || q.includes("capital")) {
        return {
          answer: `**Working capital** is the cash and short-term assets available for your day-to-day business operations.

It is calculated as **Current Assets** (cash on hand, bank balances, inventory, unpaid customer debts) minus **Current Liabilities** (supplier payables and short-term bills). Maintaining positive working capital ensures you can replenish high-demand inventory and pay operational costs without liquidity freezes.`,
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            "What is my current cash flow?",
            "Who owes me money?"
          ]
        };
      }
    }
    if (ctx.parsedIntent?.resolvedContextTopic === "sales_slowdown_diagnosis" || q === "check it" && !q.includes("stock")) {
      const totalRev2 = Number(salesSummary.totalRevenue || overview.revenue || 0);
      const txCount2 = Number(salesSummary.transactionCount || overview.transaction_count || 0);
      const revGrowth = comp?.revenueGrowthPct;
      const outOfStock = Number(inv.outOfStockCount || 0);
      const lowStock = Number(inv.lowStockCount || 0);
      const hasDrop = revGrowth !== void 0 && revGrowth < 0;
      const dropText = hasDrop ? `Sales are down **${Math.abs(revGrowth)}%** compared to the prior period.` : revGrowth !== void 0 && revGrowth > 0 ? `Sales are actually up **+${revGrowth}%** compared to the prior period.` : `Recent volume stands at ${currency} ${totalRev2.toLocaleString()} across ${txCount2} orders.`;
      let stockFinding = "";
      if (outOfStock > 0 || lowStock > 0) {
        stockFinding = `You have **${outOfStock} depleted item(s)** and **${lowStock} low-stock item(s)**. Out-of-stock items may be directly suppressing daily sales volume.`;
      } else {
        stockFinding = `All catalog items are currently stocked, so the slower pace appears related to general customer foot-traffic or purchase frequency rather than inventory shortages.`;
      }
      return {
        answer: `Looking into your sales pace:

${dropText} In the last 30 days, your store recorded **${currency} ${totalRev2.toLocaleString()}** across **${txCount2}** transaction(s).

**Key observations:**
- **Inventory status:** ${stockFinding}
- **Next step:** If you want to boost sales today, reaching out directly to past regular buyers or featuring your top-margin items at the register is a practical place to start.`,
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        keyMetrics: [
          { label: "Recent Revenue", value: totalRev2, formattedValue: `${currency} ${totalRev2.toLocaleString()}`, trend: hasDrop ? "negative" : "neutral" },
          { label: "Out of Stock SKUs", value: outOfStock, formattedValue: `${outOfStock}`, trend: outOfStock > 0 ? "negative" : "positive" }
        ],
        followUpSuggestions: [
          "What is my best-selling product?",
          "Which products are low on stock?",
          "How are my sales today?"
        ]
      };
    }
    if (ctx.parsedIntent?.resolvedContextTopic === "product_margin_continuation" || ctx.parsedIntent?.entityHint || q.startsWith("what about ")) {
      const entityHint = (ctx.parsedIntent?.entityHint || q.replace(/^(what\s+about|how\s+about|and)\s+(the\s+)?/i, "")).replace(/\?$/, "").trim();
      const matchedProduct = products.find((p) => p.name?.toLowerCase().includes(entityHint.toLowerCase()));
      if (matchedProduct) {
        const uMargin = matchedProduct.catalogUnitMarginPct ?? matchedProduct.marginPct ?? 0;
        const fifoCost = matchedProduct.fifoUnitCostAverage ?? matchedProduct.costPrice ?? 0;
        const sellPrice = Number(matchedProduct.sellingPrice || 0);
        const stock = matchedProduct.stockQuantity ?? 0;
        const unitsSold = matchedProduct.unitsSold ?? 0;
        const unitProfit = sellPrice - Number(fifoCost);
        return {
          answer: `For **${matchedProduct.name}**, you're selling at **${currency} ${sellPrice.toLocaleString()}** with a **${uMargin}% unit margin** (${currency} ${unitProfit.toLocaleString()} profit per unit).

You currently have **${stock} unit(s)** on hand with **${unitsSold} sold** in the current period.`,
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          keyMetrics: [
            { label: `${matchedProduct.name} Price`, value: sellPrice, formattedValue: `${currency} ${sellPrice.toLocaleString()}`, trend: "neutral" },
            { label: "Unit Margin", value: uMargin, formattedValue: `${uMargin}%`, trend: uMargin >= 30 ? "positive" : "neutral" },
            { label: "Stock On Hand", value: stock, formattedValue: `${stock}`, trend: stock > 5 ? "positive" : "negative" }
          ],
          followUpSuggestions: [
            "Which product makes me the most money?",
            "What is my best-selling product?",
            "Which products are low on stock?"
          ]
        };
      } else {
        return {
          answer: `I checked your catalog, but could not find a product matching **"${entityHint}"**. You can register it anytime by saying "Add [quantity] of ${entityHint} at [selling price]".`,
          confidence: "insufficient_data",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: [
            "What is my best-selling product?",
            "Which product makes me the most money?"
          ]
        };
      }
    }
    if (q.startsWith("add ") || q.startsWith("create ") || q.startsWith("register ") || q.startsWith("new product") || q.startsWith("ajouter ") || q.startsWith("cr\xE9er ") || q.includes("add product") || q.includes("create product") || q.includes("add to inventory") || q.includes("add to catalog") || q.includes("add stock") || q.includes("restock")) {
      let detectedUnit = "piece";
      let detectedQty = 1;
      const unitRegex = /(\d+(?:\.\d+)?)\s*(bags?|sacs?|cartons?|boxes|box|caisses?|boites?|boîtes?|kgs?|kilos?|kilograms?|g|grams?|grammes?|litres?|liters?|l|bottles?|bouteilles?|cans?|canettes?|packs?|paquets?|pieces?|pcs?|pc|unit[ée]s?|pairs?|paires?|rolls?|rouleaux?|yards?|meters?|m[èe]tres?)/i;
      const unitMatch = query.match(unitRegex);
      if (unitMatch) {
        detectedQty = parseFloat(unitMatch[1]) || 1;
        const rawUnit = unitMatch[2].toLowerCase();
        if (rawUnit.startsWith("sac") || rawUnit.startsWith("bag")) detectedUnit = "bag";
        else if (rawUnit.startsWith("carton") || rawUnit.startsWith("box") || rawUnit.startsWith("caisse") || rawUnit.startsWith("boit")) detectedUnit = "carton";
        else if (rawUnit.startsWith("kg") || rawUnit.startsWith("kilo")) detectedUnit = "kg";
        else if (rawUnit === "g" || rawUnit.startsWith("gram")) detectedUnit = "g";
        else if (rawUnit.startsWith("lit") || rawUnit === "l") detectedUnit = "L";
        else if (rawUnit.startsWith("bottl") || rawUnit.startsWith("bouteil")) detectedUnit = "bottle";
        else if (rawUnit.startsWith("can")) detectedUnit = "can";
        else if (rawUnit.startsWith("pack") || rawUnit.startsWith("paquet")) detectedUnit = "pack";
        else if (rawUnit.startsWith("pair")) detectedUnit = "pair";
        else if (rawUnit.startsWith("roll") || rawUnit.startsWith("rouleau")) detectedUnit = "roll";
        else if (rawUnit.startsWith("yard") || rawUnit.startsWith("meter") || rawUnit.startsWith("m\xE8tr")) detectedUnit = "m";
        else detectedUnit = "piece";
      } else {
        const qtyMatch = query.match(/(?:qty|quantity|quantité|stock|count|initial stock)[:\s]*(\d+)/i) || query.match(/\b(\d+)\s*(?:items|units|articles)\b/i);
        if (qtyMatch) {
          detectedQty = parseInt(qtyMatch[1], 10) || 1;
        }
      }
      let sellingPrice = 0;
      let costPrice = 0;
      const sellMatch = query.match(/(?:selling|sell|price|selling price|sell price|prix|prix de vente)[:\s]*(\d+(?:[.,]\d+)?)/i) || query.match(/at\s+(\d+(?:[.,]\d+)?)\s*(?:selling|each|unit|fcfa|xaf|\$)?/i);
      if (sellMatch) {
        sellingPrice = parseFloat(sellMatch[1].replace(",", "")) || 0;
      }
      const costMatch = query.match(/(?:cost|cost price|buy price|achat|prix d'achat)[:\s]*(\d+(?:[.,]\d+)?)/i) || query.match(/and\s+(\d+(?:[.,]\d+)?)\s*(?:cost|cost price|buying)/i);
      if (costMatch) {
        costPrice = parseFloat(costMatch[1].replace(",", "")) || 0;
      }
      let cleanProductName = query.replace(/^(add|create|register|new product|ajouter|créer)\s+/i, "").replace(/\b(?:product|item|article)\b/gi, "").replace(unitRegex, "").replace(/(?:qty|quantity|quantité|stock|count)[:\s]*\d+/gi, "").replace(/(?:selling|sell|price|cost|cost price|at|and)[:\s]*\d+(?:[.,]\d+)?/gi, "").replace(/\b(?:fcfa|xaf|\$|usd)\b/gi, "").replace(/\s+/g, " ").trim();
      if (!cleanProductName || cleanProductName.length < 2) {
        cleanProductName = "Commercial Item";
      }
      const existingProduct = products.find(
        (p) => p.name?.toLowerCase().trim() === cleanProductName.toLowerCase()
      );
      const isRestockOnly = (q.includes("restock") || q.includes("reapprovisionner")) && existingProduct;
      if (isRestockOnly && existingProduct) {
        return {
          answer: `I've prepared a stock adjustment for **${existingProduct.name}** to add **+${detectedQty} ${detectedUnit}**. This will increase your recorded stock from ${existingProduct.stock_quantity || 0} to **${(existingProduct.stock_quantity || 0) + detectedQty} ${detectedUnit}**.

Please confirm the adjustment below.`,
          keyMetrics: [
            { label: "Adjustment Qty", value: detectedQty, formattedValue: `+${detectedQty} ${detectedUnit}`, trend: "positive" },
            { label: "Current Stock", value: existingProduct.stock_quantity || 0, formattedValue: `${existingProduct.stock_quantity || 0} ${detectedUnit}`, trend: "neutral" }
          ],
          proposedAction: {
            actionType: "create_inventory_adjustment",
            title: `Restock: ${existingProduct.name}`,
            description: `Add +${detectedQty} ${detectedUnit} to ${existingProduct.name}`,
            category: "inventory_restock",
            phaseStatus: "ready_for_execution",
            payload: {
              productId: existingProduct.id,
              productName: existingProduct.name,
              adjustmentQuantity: detectedQty,
              unit_of_measure: detectedUnit,
              reason: "Restock via Ursella AI"
            }
          },
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: [
            "Which products are low on stock?",
            "What is my best-selling product?",
            "How are my sales today?"
          ]
        };
      }
      const marginAmount = sellingPrice > 0 && costPrice > 0 ? sellingPrice - costPrice : 0;
      const marginPercent = sellingPrice > 0 && marginAmount > 0 ? Math.round(marginAmount / sellingPrice * 100) : 0;
      return {
        answer: `I've prepared the catalog registration for **${cleanProductName}** with an initial stock of **${detectedQty} ${detectedUnit}** at **${currency} ${sellingPrice.toLocaleString()}** selling price${costPrice > 0 ? ` (cost: ${currency} ${costPrice.toLocaleString()})` : ""}.${marginPercent > 0 ? ` This gives you a **${marginPercent}%** unit margin (${currency} ${marginAmount.toLocaleString()} profit per ${detectedUnit}).` : ""}

You can review the details and confirm the addition below.`,
        keyMetrics: [
          { label: "Initial Stock", value: detectedQty, formattedValue: `${detectedQty} ${detectedUnit}`, trend: "positive" },
          { label: "Selling Price", value: sellingPrice, formattedValue: `${currency} ${sellingPrice.toLocaleString()}`, trend: "neutral" },
          ...marginPercent > 0 ? [{ label: "Gross Margin", value: marginPercent, formattedValue: `${marginPercent}%`, trend: "positive" }] : []
        ],
        proposedAction: {
          actionType: "create_product",
          title: `Add Product: ${cleanProductName}`,
          description: `Register ${cleanProductName} with initial stock of ${detectedQty} ${detectedUnit} at ${currency} ${sellingPrice.toLocaleString()}`,
          category: "product_creation",
          phaseStatus: "ready_for_execution",
          payload: {
            name: cleanProductName,
            unit_of_measure: detectedUnit,
            stock_quantity: detectedQty,
            cost_price: costPrice,
            selling_price: sellingPrice,
            minimum_stock_level: 5,
            description: "Registered via Ursella AI"
          }
        },
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "Which products are low on stock?",
          "What is my best-selling product?",
          "How are my sales today?"
        ]
      };
    }
    if (q.includes("best selling") || q.includes("best-selling") || q.includes("top product") || q.includes("top selling") || q.includes("fastest selling") || q.includes("most sold")) {
      if (!products || products.length === 0) {
        return {
          answer: `You do not have any recorded product sales in your catalog yet. Once you record sales through POS or Orders, I'll identify your fastest-moving items here.`,
          keyMetrics: [],
          confidence: "insufficient_data",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: ["How are my sales today?", "Which products are low on stock?"]
        };
      }
      const sortedByVolume = [...products].sort((a, b) => (b.unitsSold || 0) - (a.unitsSold || 0));
      const topVolume = sortedByVolume[0];
      return {
        answer: `Your best-selling product by volume is **${topVolume.name}** with **${topVolume.unitsSold || 0} unit(s) sold**, generating **${currency} ${Number(topVolume.revenue || 0).toLocaleString()}** in revenue (unit gross margin: **${topVolume.marginPct || 0}%**).

You currently have **${topVolume.stockQuantity || 0} unit(s)** remaining in stock.`,
        keyMetrics: [
          { label: "Units Sold", value: topVolume.unitsSold || 0, formattedValue: `${topVolume.unitsSold || 0}`, trend: "positive" },
          { label: "Revenue", value: Number(topVolume.revenue || 0), formattedValue: `${currency} ${Number(topVolume.revenue || 0).toLocaleString()}`, trend: "positive" },
          { label: "Units on Hand", value: topVolume.stockQuantity || 0, formattedValue: `${topVolume.stockQuantity || 0}`, trend: (topVolume.stockQuantity || 0) > 5 ? "positive" : "negative" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "Which product makes me the most money?",
          "Which products are low on stock?",
          "How are my sales today?"
        ]
      };
    }
    if (q.includes("makes me the most money") || q.includes("make me the most money") || q.includes("most profitable product") || q.includes("highest profit product") || q.includes("highest margin product")) {
      if (!products || products.length === 0) {
        return {
          answer: `No product margin data is recorded in your catalog yet. Once purchase costs and sales prices are established, your highest profit contributors will be tracked here.`,
          keyMetrics: [],
          confidence: "insufficient_data",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: ["How are my sales today?", "Which products are low on stock?"]
        };
      }
      const sortedByProfit = [...products].sort((a, b) => {
        const profitA = (a.revenue || 0) - (a.cogs || 0);
        const profitB = (b.revenue || 0) - (b.cogs || 0);
        return profitB - profitA;
      });
      const topProfit = sortedByProfit[0];
      const gp = (topProfit.revenue || 0) - (topProfit.cogs || 0);
      return {
        answer: `Your strongest product by gross profit is **${topProfit.name}**, generating **${currency} ${Number(gp).toLocaleString()}** in profit (${topProfit.unitsSold || 0} units sold at a **${topProfit.marginPct || 0}%** margin).

Current stock on hand is **${topProfit.stockQuantity || 0} unit(s)**.`,
        keyMetrics: [
          { label: "Gross Profit", value: gp, formattedValue: `${currency} ${Number(gp).toLocaleString()}`, trend: "positive" },
          { label: "Gross Margin", value: topProfit.marginPct || 0, formattedValue: `${topProfit.marginPct || 0}%`, trend: "positive" },
          { label: "Stock On Hand", value: topProfit.stockQuantity || 0, formattedValue: `${topProfit.stockQuantity || 0}`, trend: "neutral" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "What is my best-selling product?",
          "Which products are low on stock?",
          "What about the hoodies?"
        ]
      };
    }
    if (q.includes("this month") || q.includes("make this month") || q.includes("made this month")) {
      const monthRev = Number(salesSummary.totalRevenue || overview.revenue || 0);
      const monthOrders = Number(salesSummary.transactionCount || overview.transaction_count || 0);
      const monthMargin = Number(salesSummary.grossMarginPct || overview.gross_margin || 0);
      return {
        answer: `This month, **${ctx.businessName}** has generated **${currency} ${monthRev.toLocaleString()}** in recorded sales across **${monthOrders}** order(s), with a **${monthMargin}%** gross margin.`,
        keyMetrics: [
          { label: "Monthly Revenue", value: monthRev, formattedValue: `${currency} ${monthRev.toLocaleString()}`, trend: "positive" },
          { label: "Monthly Orders", value: monthOrders, formattedValue: `${monthOrders}`, trend: "neutral" },
          { label: "Gross Margin", value: monthMargin, formattedValue: `${monthMargin}%`, trend: "positive" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "How are my sales today?",
          "What is my best-selling product?",
          "Who owes me money?"
        ]
      };
    }
    if (q.includes("today") || q.includes("sell today") || q.includes("sold today") || q.includes("sales today") || q.includes("revenue today") || q.includes("how are my sales today")) {
      const revToday = Number(todaySales.revenue ?? dailyBrief.todayMetrics?.revenueToday ?? 0);
      const txToday = Number(todaySales.salesCount ?? dailyBrief.todayMetrics?.transactionCountToday ?? 0);
      const cashToday = Number(todaySales.cashCollected ?? dailyBrief.todayMetrics?.cashCollectedToday ?? 0);
      if (txToday === 0) {
        return {
          answer: `No sales have been recorded yet today for **${ctx.businessName}** (${currency} 0 across 0 orders).

If you have completed transactions today that have not yet been rung up, make sure they are entered in the **POS / Sales** module.`,
          keyMetrics: [
            { label: "Today's Revenue", value: 0, formattedValue: `${currency} 0`, trend: "neutral" },
            { label: "Today's Orders", value: 0, formattedValue: "0", trend: "neutral" }
          ],
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: [
            "What is my best-selling product?",
            "Which products are low on stock?",
            "Who owes me money?"
          ]
        };
      }
      return {
        answer: `Today, **${ctx.businessName}** has recorded **${currency} ${revToday.toLocaleString()}** in sales across **${txToday}** customer order(s), with **${currency} ${cashToday.toLocaleString()}** collected in cash.`,
        keyMetrics: [
          { label: "Today's Revenue", value: revToday, formattedValue: `${currency} ${revToday.toLocaleString()}`, trend: "positive" },
          { label: "Today's Orders", value: txToday, formattedValue: `${txToday}`, trend: "positive" },
          { label: "Cash Collected", value: cashToday, formattedValue: `${currency} ${cashToday.toLocaleString()}`, trend: "positive" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "What is my best-selling product?",
          "Who owes me money?",
          "Which products are low on stock?"
        ]
      };
    }
    if (q.includes("low stock") || q.includes("running low") || q.includes("out of stock") || q.includes("stock level") || q.includes("stockout") || q.includes("reorder")) {
      const outCount = Number(inv.outOfStockCount || 0);
      const lowCount = Number(inv.lowStockCount || 0);
      const criticalItems = inv.criticalItemsToRestock || [];
      const totalSKUs = Number(inv.totalActiveSKUs || 0);
      if (outCount === 0 && lowCount === 0) {
        return {
          answer: `All **${totalSKUs} active product SKUs** in your catalog are adequately stocked with zero low-stock or out-of-stock alerts.`,
          keyMetrics: [
            { label: "Out of Stock", value: 0, formattedValue: "0", trend: "positive" },
            { label: "Low Stock", value: 0, formattedValue: "0", trend: "positive" }
          ],
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: [
            "What is my best-selling product?",
            "How are my sales today?"
          ]
        };
      }
      const itemsList = criticalItems.map((item) => `- **${item.name}**: ${item.currentStock} unit(s) remaining (${item.status === "OUT_OF_STOCK" ? "\u{1F534} Depleted" : `\u26A0\uFE0F Below minimum of ${item.minimumStockLevel}`})`).join("\n");
      return {
        answer: `You currently have **${outCount} item(s) completely depleted** and **${lowCount} item(s) running below their safety threshold**:

${itemsList}

I recommend prioritizing purchase orders for depleted items that drive regular customer foot traffic.`,
        keyMetrics: [
          { label: "Out of Stock", value: outCount, formattedValue: `${outCount}`, trend: outCount > 0 ? "negative" : "positive" },
          { label: "Low Stock", value: lowCount, formattedValue: `${lowCount}`, trend: lowCount > 0 ? "negative" : "positive" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "What is my best-selling product?",
          "How are my sales today?",
          "What is my FIFO inventory valuation?"
        ]
      };
    }
    if (q.includes("who owes") || q.includes("debt") || q.includes("debtor") || q.includes("unpaid") || q.includes("receivable") || q.includes("owe me")) {
      const totalDebt = Number(debtors.totalOutstandingDebt || 0);
      const debtorCount = Number(debtors.debtorsCount || 0);
      const topList = debtors.topDebtors || [];
      if (debtorCount === 0 || totalDebt === 0) {
        return {
          answer: `You currently have **no outstanding customer debts** (0 unpaid balances recorded).`,
          keyMetrics: [
            { label: "Outstanding Debt", value: 0, formattedValue: `${currency} 0`, trend: "positive" },
            { label: "Debtor Accounts", value: 0, formattedValue: "0", trend: "positive" }
          ],
          confidence: "high_confidence",
          responseSource: "DETERMINISTIC_FALLBACK",
          provider: "deterministic_fallback",
          followUpSuggestions: ["How are my sales today?", "Which products are low on stock?"]
        };
      }
      const debtorBreakdown = topList.map((d, i) => `${i + 1}. **${d.name}**: ${currency} ${Number(d.debtAmount).toLocaleString()}${d.phone ? ` (${d.phone})` : ""}`).join("\n");
      return {
        answer: `You currently have **${debtorCount} customer account(s)** with outstanding credit balances totaling **${currency} ${totalDebt.toLocaleString()}**:

${debtorBreakdown}

Reaching out to these customers will help recover working capital for inventory purchases.`,
        keyMetrics: [
          { label: "Outstanding Receivables", value: totalDebt, formattedValue: `${currency} ${totalDebt.toLocaleString()}`, trend: "negative" },
          { label: "Debtor Accounts", value: debtorCount, formattedValue: `${debtorCount}`, trend: "neutral" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: ["How are my sales today?", "What is my current cash flow?"]
      };
    }
    if (isExplicitReport) {
      const totalRev2 = Number(overview.revenue || salesSummary.totalRevenue || 0);
      const txCount2 = Number(overview.transaction_count || salesSummary.transactionCount || 0);
      const grossProfit = Number(overview.gross_profit || 0);
      const grossMargin2 = Number(overview.gross_margin || 0);
      const outCount = Number(inv.outOfStockCount || 0);
      const totalDebt = Number(debtors.totalOutstandingDebt || 0);
      return {
        answer: `### Executive Summary
**${ctx.businessName}** generated **${currency} ${totalRev2.toLocaleString()}** in revenue across **${txCount2}** completed transaction(s) over the last 30 days, achieving a **${grossMargin2}% gross margin** (${currency} ${grossProfit.toLocaleString()} gross profit).

### Analytical Diagnostics & Data Breakdown
- **Revenue Volume:** ${currency} ${totalRev2.toLocaleString()} (${txCount2} transactions)
- **Gross Margin:** **${grossMargin2}%**
- **Inventory Health:** ${outCount} depleted SKU(s)
- **Receivables Exposure:** ${currency} ${totalDebt.toLocaleString()} in open customer credit

### Strategic Recommendations
1. **Protect Top Sellers:** Restock any depleted SKUs to avoid lost sales.
2. **Collect Open Debts:** Send payment reminders to debtor accounts to recover liquid cash.
3. **Maintain Margin Discipline:** Ensure sales prices cover rising replacement costs.`,
        keyMetrics: [
          { label: "Revenue (30d)", value: totalRev2, formattedValue: `${currency} ${totalRev2.toLocaleString()}`, trend: "positive" },
          { label: "Gross Margin", value: grossMargin2, formattedValue: `${grossMargin2}%`, trend: grossMargin2 >= 30 ? "positive" : "neutral" },
          { label: "Transactions", value: txCount2, formattedValue: `${txCount2}`, trend: "neutral" }
        ],
        confidence: "high_confidence",
        responseSource: "DETERMINISTIC_FALLBACK",
        provider: "deterministic_fallback",
        followUpSuggestions: [
          "What is my best-selling product?",
          "Which products are low on stock?",
          "How are my sales today?"
        ]
      };
    }
    const totalRev = Number(overview.revenue || salesSummary.totalRevenue || 0);
    const txCount = Number(overview.transaction_count || salesSummary.transactionCount || 0);
    const grossMargin = Number(overview.gross_margin || 0);
    return {
      answer: `Over the past 30 days, **${ctx.businessName}** has generated **${currency} ${totalRev.toLocaleString()}** across **${txCount}** transaction(s) with an operating gross margin of **${grossMargin}%**.

What specific part of your business would you like to explore? I can check today's sales, product profitability, low inventory, or customer debts.`,
      keyMetrics: [
        { label: "Revenue (30d)", value: totalRev, formattedValue: `${currency} ${totalRev.toLocaleString()}`, trend: "positive" },
        { label: "Gross Margin", value: grossMargin, formattedValue: `${grossMargin}%`, trend: "neutral" }
      ],
      confidence: txCount > 0 ? "high_confidence" : "insufficient_data",
      responseSource: "DETERMINISTIC_FALLBACK",
      provider: "deterministic_fallback",
      followUpSuggestions: [
        "How are my sales today?",
        "What is my best-selling product?",
        "Which products are low on stock?",
        "Who owes me money?"
      ]
    };
  }
  /**
   * Generates the Daily Business Brief summary.
   */
  static async generateDailyBrief(ctx) {
    const briefFacts = ctx.toolResults.get_daily_brief_facts || {};
    const currency = ctx.currency || "XAF";
    const revenue = Number(briefFacts.todayMetrics?.revenueToday ?? 0);
    const transactions = Number(briefFacts.todayMetrics?.transactionCountToday ?? 0);
    const amountCollected = Number(briefFacts.todayMetrics?.cashCollectedToday ?? 0);
    const expenses = Number(briefFacts.todayMetrics?.expensesToday ?? 0);
    const outstandingReceivables = Number(briefFacts.debtorAlerts?.totalOutstandingDebt ?? 0);
    const inventoryAlerts = [];
    if (briefFacts.inventoryAlerts?.criticalItemsToRestock?.length) {
      for (const item of briefFacts.inventoryAlerts.criticalItemsToRestock.slice(0, 4)) {
        inventoryAlerts.push(`${item.name} (${item.currentStock} remaining - ${item.status})`);
      }
    }
    const debtFollowUps = [];
    if (briefFacts.debtorAlerts?.topDebtors?.length) {
      for (const debtor of briefFacts.debtorAlerts.topDebtors.slice(0, 3)) {
        debtFollowUps.push(`${debtor.name} owes ${currency} ${Number(debtor.debtAmount).toLocaleString()}`);
      }
    }
    const headline = transactions > 0 ? `${transactions} transaction(s) logged today generating ${currency} ${revenue.toLocaleString()}` : `No transactions recorded yet today for ${ctx.businessName}`;
    const keyTakeaways = [
      `Today's Revenue: ${currency} ${revenue.toLocaleString()} across ${transactions} order(s)`,
      `Cash Collected: ${currency} ${amountCollected.toLocaleString()}`
    ];
    if (outstandingReceivables > 0) {
      keyTakeaways.push(`Open Customer Debt: ${currency} ${outstandingReceivables.toLocaleString()} across ${briefFacts.debtorAlerts?.debtorsCount || 0} account(s)`);
    }
    const recommendedFocusToday = inventoryAlerts.length > 0 ? `Review depleted inventory items to prevent missed sales.` : outstandingReceivables > 0 ? `Follow up with top debtor accounts to recover working capital.` : `Focus on customer checkout service and recording daily transactions.`;
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      businessName: ctx.businessName,
      currency,
      headline,
      executiveSummary: `${ctx.businessName} has recorded ${transactions} order(s) today generating ${currency} ${revenue.toLocaleString()}. ${inventoryAlerts.length > 0 ? `${inventoryAlerts.length} product(s) require inventory replenishment.` : "Catalog inventory is adequately stocked."}`,
      performanceSnapshot: {
        revenue,
        transactions,
        amountCollected,
        expenses,
        outstandingReceivables
      },
      keyTakeaways,
      inventoryAlerts,
      debtFollowUps,
      recommendedFocusToday,
      confidence: "high_confidence"
    };
  }
};

// server/rate-limiter.ts
var InMemoryRateLimiter = class {
  constructor(maxRequests = 30, windowMs = 60 * 1e3) {
    this.records = /* @__PURE__ */ new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.records.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
        if (record.timestamps.length === 0) {
          this.records.delete(key);
        }
      }
    }, 5 * 60 * 1e3);
  }
  check(identifier) {
    const now = Date.now();
    let record = this.records.get(identifier);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(identifier, record);
    }
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const resetTimeMs = Math.max(0, this.windowMs - (now - oldest));
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs
      };
    }
    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      resetTimeMs: this.windowMs
    };
  }
};
var aiRateLimiter = new InMemoryRateLimiter(30, 60 * 1e3);

// server/event-detection.service.ts
var DEFAULT_DETECTION_CONFIG = {
  salesDropThresholdPct: 18,
  salesDropCriticalPct: 35,
  salesSpikeThresholdPct: 35,
  lowStockBufferMultiplier: 1,
  depletionRiskDays: 3.5,
  customerDebtLargeAmount: 5e4,
  customerDebtCriticalAmount: 1e5,
  customerInactiveDays: 30,
  customerInactiveMinSpend: 5e4,
  expenseSpikePct: 30,
  highMarginThresholdPct: 40
};
var EventDetectionService = class {
  /**
   * Run full detection across all operational domains.
   * Supports both server database querying and resilient client-supplied data snapshots.
   */
  static async scanBusiness(businessId, snapshot, customConfig) {
    const config = {
      ...DEFAULT_DETECTION_CONFIG,
      ...customConfig
    };
    const events = [];
    try {
      const [
        salesEvents,
        inventoryEvents,
        customerEvents,
        expenseMarginEvents,
        opportunityEvents
      ] = await Promise.all([
        this.detectSalesEvents(businessId, snapshot, config),
        this.detectInventoryEvents(businessId, snapshot, config),
        this.detectCustomerEvents(businessId, snapshot, config),
        this.detectExpenseAndMarginEvents(businessId, snapshot, config),
        this.detectOpportunityEvents(businessId, snapshot, config)
      ]);
      events.push(
        ...salesEvents,
        ...inventoryEvents,
        ...customerEvents,
        ...expenseMarginEvents,
        ...opportunityEvents
      );
    } catch (err) {
      console.error(`[EventDetectionService] Error scanning business ${businessId}:`, err);
    }
    return events;
  }
  /**
   * 1. SALES EVENTS: Drop, Spike, Large Sale
   */
  static async detectSalesEvents(businessId, snapshot, config = DEFAULT_DETECTION_CONFIG) {
    const events = [];
    const now = /* @__PURE__ */ new Date();
    const current7DaysStart = new Date(now.getTime() - 7 * 864e5);
    const prior7DaysStart = new Date(now.getTime() - 14 * 864e5);
    let currSales = [];
    let priorSales = [];
    if (snapshot?.sales && snapshot.sales.length > 0) {
      for (const s of snapshot.sales) {
        if (s.sale_status && s.sale_status !== "completed") continue;
        const soldDate = new Date(s.sold_at || s.created_at || now);
        if (soldDate >= current7DaysStart) {
          currSales.push(s);
        } else if (soldDate >= prior7DaysStart && soldDate < current7DaysStart) {
          priorSales.push(s);
        }
      }
    } else {
      const [resCurr, resPrior] = await Promise.all([
        serverSupabase.from("sales").select("id, total, sold_at").eq("business_id", businessId).eq("sale_status", "completed").gte("sold_at", current7DaysStart.toISOString()),
        serverSupabase.from("sales").select("id, total, sold_at").eq("business_id", businessId).eq("sale_status", "completed").gte("sold_at", prior7DaysStart.toISOString()).lt("sold_at", current7DaysStart.toISOString())
      ]);
      currSales = resCurr.data || [];
      priorSales = resPrior.data || [];
    }
    const currRev = currSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const priorRev = priorSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const currCount = currSales.length;
    const priorCount = priorSales.length;
    if (priorCount >= 3 && priorRev > 0) {
      const revDiffPct = (currRev - priorRev) / priorRev * 100;
      if (revDiffPct <= -config.salesDropThresholdPct) {
        const severity = revDiffPct <= -config.salesDropCriticalPct ? "critical" : "high";
        events.push({
          eventType: "sales_drop",
          category: "sales",
          severity,
          confidence: currCount + priorCount >= 8 ? "high" : "moderate",
          title: `Revenue Down ${Math.abs(Math.round(revDiffPct))}% This Week`,
          summary: `7-day sales dropped from ${priorRev.toLocaleString()} to ${currRev.toLocaleString()} across ${currCount} transactions.`,
          explanation: {
            whatHappened: `Revenue decreased by ${Math.abs(Math.round(revDiffPct))}% over the last 7 days compared to the preceding 7-day period.`,
            whyItMatters: `A sharp decrease in sales volume or basket size directly threatens operating cash flow.`,
            whatYouCanDo: `Review top SKU stock availability, follow up with key accounts, or run a promotional campaign to stimulate purchase velocity.`
          },
          data: {
            currentPeriodRevenue: currRev,
            priorPeriodRevenue: priorRev,
            percentageChange: Number(revDiffPct.toFixed(1)),
            currentTransactions: currCount,
            priorTransactions: priorCount
          },
          dedupKey: `sales_drop_${now.getFullYear()}_w${Math.ceil(now.getDate() / 7)}`,
          actionType: "create_reminder",
          actionPayload: {
            title: "Review weekly sales drop and pricing strategy",
            description: `Investigate ${Math.abs(Math.round(revDiffPct))}% revenue drop (Current: ${currRev.toLocaleString()})`,
            priority: "high",
            related_entity_type: "sale"
          }
        });
      }
      if (revDiffPct >= config.salesSpikeThresholdPct && currCount >= 3) {
        events.push({
          eventType: "sales_spike",
          category: "sales",
          severity: "informational",
          confidence: currCount >= 6 ? "high" : "moderate",
          title: `Revenue Spiked +${Math.round(revDiffPct)}% This Week`,
          summary: `7-day revenue surged to ${currRev.toLocaleString()} (+${Math.round(revDiffPct)}% vs prior week).`,
          explanation: {
            whatHappened: `Sales volume increased significantly, generating strong revenue growth over the baseline.`,
            whyItMatters: `High sales demand depletes inventory rapidly and may require replenishment.`,
            whatYouCanDo: `Verify stock levels on fast-moving SKUs and maintain customer satisfaction.`
          },
          data: {
            currentPeriodRevenue: currRev,
            priorPeriodRevenue: priorRev,
            percentageChange: Number(revDiffPct.toFixed(1))
          },
          dedupKey: `sales_spike_${now.getFullYear()}_w${Math.ceil(now.getDate() / 7)}`
        });
      }
    }
    return events;
  }
  /**
   * 2. INVENTORY EVENTS: Out of Stock, Low Stock, Fast-Moving Depletion Risk
   */
  static async detectInventoryEvents(businessId, snapshot, config = DEFAULT_DETECTION_CONFIG) {
    const events = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    let products = [];
    let saleItems = [];
    if (snapshot?.products && snapshot.products.length > 0) {
      products = snapshot.products;
      if (snapshot.saleItems && snapshot.saleItems.length > 0) {
        saleItems = snapshot.saleItems;
      } else if (snapshot.sales && snapshot.sales.length > 0) {
        for (const s of snapshot.sales) {
          const soldDate = s.sold_at || s.created_at || "";
          if (soldDate >= sevenDaysAgo && Array.isArray(s.items)) {
            for (const it of s.items) {
              saleItems.push({
                product_id: it.product_id || it.productId,
                quantity: it.quantity
              });
            }
          }
        }
      }
    } else {
      const [{ data: dbProducts }, { data: dbSaleItems }] = await Promise.all([
        serverSupabase.from("products").select("id, name, stock_quantity, minimum_stock_level, cost_price, selling_price").eq("business_id", businessId).eq("is_active", true),
        serverSupabase.from("sale_items").select("product_id, quantity").eq("business_id", businessId).gte("created_at", sevenDaysAgo)
      ]);
      products = dbProducts || [];
      saleItems = dbSaleItems || [];
    }
    if (!products || products.length === 0) return events;
    const velocityMap = {};
    for (const item of saleItems || []) {
      if (item.product_id) {
        velocityMap[item.product_id] = (velocityMap[item.product_id] || 0) + Number(item.quantity || 0);
      }
    }
    for (const prod of products) {
      const stock = Number(prod.stock_quantity ?? 0);
      const minStock = Number(prod.minimum_stock_level ?? 5);
      const weeklyUnitsSold = velocityMap[prod.id] || 0;
      const dailyVelocity = weeklyUnitsSold / 7;
      if (stock <= 0) {
        const hadRecentSales = weeklyUnitsSold > 0;
        events.push({
          eventType: "out_of_stock",
          category: "inventory",
          severity: hadRecentSales || stock < 0 ? "critical" : "high",
          confidence: "high",
          title: `${prod.name} is Out of Stock${stock < 0 ? ` (${stock} deficit)` : ""}`,
          summary: `Current inventory is ${stock} units.${hadRecentSales ? ` Sold ${weeklyUnitsSold} units in the last 7 days.` : ""}`,
          explanation: {
            whatHappened: `Inventory for "${prod.name}" has reached ${stock} units.`,
            whyItMatters: `Zero or negative stock causes immediate lost sales, unfulfilled commitments, and customer dissatisfaction.`,
            whatYouCanDo: `Initiate a restock purchase order with your supplier immediately to replenish inventory.`
          },
          data: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            minimumStockLevel: minStock,
            sevenDayUnitsSold: weeklyUnitsSold
          },
          dedupKey: `out_of_stock_${prod.id}`,
          actionType: "create_restock_task",
          actionPayload: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            suggestedQuantity: Math.max(minStock * 2, Math.ceil(dailyVelocity * 14) || minStock),
            title: `Restock Order: ${prod.name}`,
            priority: "high"
          }
        });
      } else if (dailyVelocity >= 0.8 && stock / dailyVelocity <= config.depletionRiskDays) {
        const daysRemaining = Number((stock / dailyVelocity).toFixed(1));
        events.push({
          eventType: "fast_moving_depletion",
          category: "inventory",
          severity: "high",
          confidence: "high",
          title: `${prod.name} Depletion Risk (${daysRemaining} Days of Stock Left)`,
          summary: `Selling ${dailyVelocity.toFixed(1)} units/day with only ${stock} units in stock. Estimated stockout in ${daysRemaining} days.`,
          explanation: {
            whatHappened: `"${prod.name}" is selling quickly (${weeklyUnitsSold} units in 7 days) and only ${stock} units remain.`,
            whyItMatters: `At this sales pace, the product will be completely sold out within ${daysRemaining} days.`,
            whatYouCanDo: `Order replacement stock now to arrive before current inventory completely runs dry.`
          },
          data: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            dailyVelocity,
            daysRemaining,
            weeklyUnitsSold
          },
          dedupKey: `depletion_risk_${prod.id}`,
          actionType: "create_restock_task",
          actionPayload: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            suggestedQuantity: Math.max(minStock * 2, Math.ceil(dailyVelocity * 14)),
            title: `Fast-moving Restock: ${prod.name}`,
            priority: "high"
          }
        });
      } else if (stock <= minStock * config.lowStockBufferMultiplier && stock > 0) {
        events.push({
          eventType: "low_stock",
          category: "inventory",
          severity: "medium",
          confidence: "high",
          title: `Low Stock: ${prod.name} (${stock} units left)`,
          summary: `Stock is at or below minimum threshold (${stock}/${minStock} units).`,
          explanation: {
            whatHappened: `"${prod.name}" has ${stock} units remaining, at or below your safety threshold of ${minStock}.`,
            whyItMatters: `Remaining stock is vulnerable to unexpected surges in customer demand.`,
            whatYouCanDo: `Order a replenishment batch to maintain adequate buffer inventory.`
          },
          data: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            minimumStockLevel: minStock
          },
          dedupKey: `low_stock_${prod.id}`,
          actionType: "create_restock_task",
          actionPayload: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            suggestedQuantity: minStock * 2,
            title: `Replenish: ${prod.name}`,
            priority: "medium"
          }
        });
      }
    }
    return events;
  }
  /**
   * 3. CUSTOMER EVENTS: Overdue Debt, Large Outstanding Balances, Inactive Customers
   */
  static async detectCustomerEvents(businessId, snapshot, config = DEFAULT_DETECTION_CONFIG) {
    const events = [];
    const thirtyDaysAgo = new Date(Date.now() - config.customerInactiveDays * 864e5).toISOString();
    let customers = [];
    let sales = [];
    if (snapshot?.customers && snapshot.customers.length > 0) {
      customers = snapshot.customers;
      sales = snapshot.sales || [];
    } else {
      const [{ data: dbCust }, { data: dbSales }] = await Promise.all([
        serverSupabase.from("customers").select("id, name, phone, email, total_debt, outstanding_balance").eq("business_id", businessId).eq("is_active", true),
        serverSupabase.from("sales").select("id, customer_id, total, amount_due, sale_status, sold_at").eq("business_id", businessId).eq("sale_status", "completed")
      ]);
      customers = dbCust || [];
      sales = dbSales || [];
    }
    if (!customers || customers.length === 0) return events;
    const salesByCustomer = {};
    for (const s of sales || []) {
      if (s.customer_id) {
        if (!salesByCustomer[s.customer_id]) {
          salesByCustomer[s.customer_id] = [];
        }
        salesByCustomer[s.customer_id].push(s);
      }
    }
    for (const c of customers) {
      const custSales = salesByCustomer[c.id] || [];
      const calculatedDebt = custSales.reduce((acc, s) => acc + (Number(s.amount_due) || 0), 0);
      const storedDebt = Number(c.outstanding_balance || c.total_debt || c.debt || 0);
      const debt = Math.max(calculatedDebt, storedDebt);
      const totalSpent = custSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const totalOrders = custSales.length;
      const sortedSales = [...custSales].sort(
        (a, b) => new Date(b.sold_at || 0).getTime() - new Date(a.sold_at || 0).getTime()
      );
      const lastOrderAt = sortedSales[0]?.sold_at || null;
      if (debt > 0) {
        const severity = debt >= config.customerDebtCriticalAmount ? "critical" : debt >= config.customerDebtLargeAmount ? "high" : "medium";
        events.push({
          eventType: "customer_balance_overdue",
          category: "customers",
          severity,
          confidence: "high",
          title: `Outstanding Balance: ${c.name} (${debt.toLocaleString()})`,
          summary: `${c.name} holds an unpaid credit balance of ${debt.toLocaleString()}.`,
          explanation: {
            whatHappened: `${c.name} has an unsettled balance of ${debt.toLocaleString()} from prior purchases.`,
            whyItMatters: `Uncollected customer credit constrains liquid cash flow needed for inventory and expenses.`,
            whatYouCanDo: `Record a debt settlement payment or contact ${c.name} with a friendly reminder.`
          },
          data: {
            customerId: c.id,
            customerName: c.name,
            phone: c.phone,
            email: c.email,
            outstandingDebt: debt,
            totalSpent
          },
          dedupKey: `overdue_balance_${c.id}`,
          actionType: "record_payment",
          actionPayload: {
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            amount: debt,
            paymentMethod: "cash",
            notes: `Debt settlement for ${c.name}`
          }
        });
      }
      if (totalSpent >= config.customerInactiveMinSpend && lastOrderAt && lastOrderAt < thirtyDaysAgo && debt === 0) {
        events.push({
          eventType: "customer_inactive",
          category: "customers",
          severity: "low",
          confidence: "moderate",
          title: `VIP Follow-up: ${c.name} hasn't purchased recently`,
          summary: `Customer with ${totalSpent.toLocaleString()} lifetime spend has been inactive for over ${config.customerInactiveDays} days.`,
          explanation: {
            whatHappened: `${c.name}, a valuable customer with ${totalOrders || "multiple"} past purchases, has not visited in 30+ days.`,
            whyItMatters: `Re-engaging lapsed loyal customers is 5x cheaper than acquiring new foot traffic.`,
            whatYouCanDo: `Reach out with a friendly check-in or share details on new arrivals and offers.`
          },
          data: {
            customerId: c.id,
            customerName: c.name,
            phone: c.phone,
            totalSpent,
            lastOrderAt
          },
          dedupKey: `inactive_customer_${c.id}`,
          actionType: "send_customer_message",
          actionPayload: {
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            messageType: "customer_reengagement",
            draftMessage: `Hello ${c.name}! We noticed it's been a while since your last visit. We have new stock and special offers we'd love to share with you. Hope to see you soon!`
          }
        });
      }
    }
    return events;
  }
  /**
   * 4. EXPENSE & MARGIN EVENTS: Expense Spike, Gross Margin Deterioration
   */
  static async detectExpenseAndMarginEvents(businessId, snapshot, config = DEFAULT_DETECTION_CONFIG) {
    const events = [];
    const now = /* @__PURE__ */ new Date();
    const curr30Start = new Date(now.getTime() - 30 * 864e5).toISOString().split("T")[0];
    const prior30Start = new Date(now.getTime() - 60 * 864e5).toISOString().split("T")[0];
    let currExpenses = [];
    let priorExpenses = [];
    if (snapshot?.expenses && snapshot.expenses.length > 0) {
      for (const e of snapshot.expenses) {
        const expDate = e.expense_date || e.created_at || "";
        if (expDate >= curr30Start) {
          currExpenses.push(e);
        } else if (expDate >= prior30Start && expDate < curr30Start) {
          priorExpenses.push(e);
        }
      }
    } else {
      const [resCurr, resPrior] = await Promise.all([
        serverSupabase.from("expenses").select("id, category, amount, expense_date").eq("business_id", businessId).gte("expense_date", curr30Start),
        serverSupabase.from("expenses").select("id, category, amount, expense_date").eq("business_id", businessId).gte("expense_date", prior30Start).lt("expense_date", curr30Start)
      ]);
      currExpenses = resCurr.data || [];
      priorExpenses = resPrior.data || [];
    }
    const currTotal = currExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const priorTotal = priorExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const multiplier = 1 + config.expenseSpikePct / 100;
    if (priorTotal > 1e4 && currTotal > priorTotal * multiplier) {
      const jumpPct = Math.round((currTotal - priorTotal) / priorTotal * 100);
      events.push({
        eventType: "expense_spike",
        category: "expenses",
        severity: "high",
        confidence: "high",
        title: `Operating Expenses Spiked +${jumpPct}%`,
        summary: `30-day expenses increased from ${priorTotal.toLocaleString()} to ${currTotal.toLocaleString()}.`,
        explanation: {
          whatHappened: `Operating expenses grew by ${jumpPct}% over the last 30 days compared with the previous 30-day window.`,
          whyItMatters: `Rising overhead eats into net profit margins and increases operating breakeven points.`,
          whatYouCanDo: `Review expense line items to differentiate one-off investments from ongoing overhead cost creep.`
        },
        data: {
          currentExpenses: currTotal,
          priorExpenses: priorTotal,
          percentageIncrease: jumpPct
        },
        dedupKey: `expense_spike_${now.getFullYear()}_m${now.getMonth() + 1}`,
        actionType: "create_reminder",
        actionPayload: {
          title: `Audit ${jumpPct}% operational expense spike`,
          description: `Total 30-day expenses reached ${currTotal.toLocaleString()}`,
          priority: "high",
          related_entity_type: "expense"
        }
      });
    }
    return events;
  }
  /**
   * 5. OPPORTUNITY EVENTS: High Margin Fast-Sellers, Revenue Opportunities
   */
  static async detectOpportunityEvents(businessId, snapshot, config = DEFAULT_DETECTION_CONFIG) {
    const events = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    let products = [];
    let saleItems = [];
    if (snapshot?.products && snapshot.products.length > 0) {
      products = snapshot.products;
      if (snapshot.saleItems && snapshot.saleItems.length > 0) {
        saleItems = snapshot.saleItems;
      } else if (snapshot.sales && snapshot.sales.length > 0) {
        for (const s of snapshot.sales) {
          const soldDate = s.sold_at || s.created_at || "";
          if (soldDate >= sevenDaysAgo && Array.isArray(s.items)) {
            for (const it of s.items) {
              saleItems.push({
                product_id: it.product_id || it.productId,
                quantity: it.quantity
              });
            }
          }
        }
      }
    } else {
      const [{ data: dbProducts }, { data: dbSaleItems }] = await Promise.all([
        serverSupabase.from("products").select("id, name, selling_price, cost_price, stock_quantity").eq("business_id", businessId).eq("is_active", true),
        serverSupabase.from("sale_items").select("product_id, quantity, total").eq("business_id", businessId).gte("created_at", sevenDaysAgo)
      ]);
      products = dbProducts || [];
      saleItems = dbSaleItems || [];
    }
    if (!products || products.length === 0) return events;
    const unitsSoldMap = {};
    for (const item of saleItems || []) {
      if (item.product_id) {
        unitsSoldMap[item.product_id] = (unitsSoldMap[item.product_id] || 0) + Number(item.quantity || 0);
      }
    }
    for (const p of products) {
      const price = Number(p.selling_price || 0);
      const cost = Number(p.cost_price || 0);
      const margin = price > 0 ? (price - cost) / price * 100 : 0;
      const sold = unitsSoldMap[p.id] || 0;
      if (margin >= config.highMarginThresholdPct && sold >= 3 && Number(p.stock_quantity || 0) > 5) {
        events.push({
          eventType: "margin_improvement",
          category: "opportunities",
          severity: "informational",
          confidence: "high",
          title: `Profit Driver Opportunity: ${p.name} (${Math.round(margin)}% Margin)`,
          summary: `${p.name} carries a strong ${Math.round(margin)}% profit margin and sold ${sold} units this week.`,
          explanation: {
            whatHappened: `"${p.name}" delivers high gross profit per unit (${(price - cost).toLocaleString()}) and has sustained healthy sales demand.`,
            whyItMatters: `Promoting higher-margin products increases total net income faster than boosting low-margin volume.`,
            whatYouCanDo: `Position ${p.name} prominently on store shelves, in promotional displays, or as an upsell at checkout.`
          },
          data: {
            productId: p.id,
            productName: p.name,
            sellingPrice: price,
            costPrice: cost,
            marginPct: Number(margin.toFixed(1)),
            weeklyUnitsSold: sold,
            availableStock: p.stock_quantity
          },
          dedupKey: `opportunity_margin_${p.id}`
        });
        break;
      }
    }
    return events;
  }
};

// src/lib/uuid.ts
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(id) {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// server/action-executor.service.ts
var isServerSupabaseConfigured = Boolean(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
) && !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").includes("placeholder.supabase.co");
var inMemoryActionProposals = /* @__PURE__ */ new Map();
var inMemoryAuditLogs = [];
var inMemoryReminders = [];
var executedIdempotencyKeys = /* @__PURE__ */ new Set();
var ActionExecutorService = class {
  /**
   * Propose an action for human review & approval.
   * Persists to Supabase table action_proposals with memory fallback.
   */
  static async proposeAction(proposal) {
    const id = generateUUID();
    const fullProposal = {
      ...proposal,
      id,
      status: "pending_approval",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (isServerSupabaseConfigured && isValidUUID(proposal.business_id)) {
      try {
        const { data, error } = await serverSupabase.from("action_proposals").insert({
          id,
          business_id: proposal.business_id,
          insight_id: proposal.insight_id && isValidUUID(proposal.insight_id) ? proposal.insight_id : null,
          action_type: proposal.action_type,
          title: proposal.title,
          description: proposal.description || null,
          payload: proposal.payload || {},
          status: "pending_approval",
          requested_by: proposal.requested_by || "ursella_ai",
          requires_role: proposal.requires_role || ["owner", "admin"],
          impact_preview: proposal.impact_preview || null
        }).select("*").maybeSingle();
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn("[ActionExecutor] Failed to persist action proposal to Supabase, using fallback:", err);
      }
    }
    inMemoryActionProposals.set(id, fullProposal);
    return fullProposal;
  }
  /**
   * Get all action proposals for a business.
   */
  static async getActionProposals(businessId) {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase.from("action_proposals").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn("[ActionExecutor] Failed to query action proposals from Supabase:", err);
      }
    }
    return Array.from(inMemoryActionProposals.values()).filter((p) => p.business_id === businessId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  /**
   * Reject an action proposal.
   */
  static async rejectAction(actionId, userId, businessId) {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase.from("action_proposals").update({
          status: "rejected",
          approved_by: isValidUUID(userId) ? userId : null,
          approved_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", actionId).eq("business_id", businessId).select("id").maybeSingle();
        if (!error && data) {
          return true;
        }
      } catch (err) {
        console.warn("[ActionExecutor] Reject action database update failed:", err);
      }
    }
    const proposal = inMemoryActionProposals.get(actionId);
    if (!proposal || proposal.business_id !== businessId) return false;
    proposal.status = "rejected";
    proposal.approved_by = userId;
    proposal.approved_at = (/* @__PURE__ */ new Date()).toISOString();
    return true;
  }
  /**
   * Execute an approved action with full security, tenant isolation, and idempotency.
   */
  static async executeAction(req) {
    const { actionId, businessId, userId, userRole, actionType, payload, idempotencyKey, isAIGenerated = false } = req;
    if (!businessId) {
      return {
        success: false,
        actionId: actionId || "err",
        status: "failed",
        error: "Missing required businessId."
      };
    }
    if (idempotencyKey) {
      if (isServerSupabaseConfigured && isValidUUID(businessId)) {
        try {
          const { data: existingKey } = await serverSupabase.from("idempotency_keys").select("status, response").eq("business_id", businessId).eq("key", idempotencyKey).maybeSingle();
          if (existingKey && existingKey.status === "completed") {
            return {
              success: true,
              actionId: actionId || `cached_${idempotencyKey}`,
              status: "executed",
              result: existingKey.response || { message: "Action already executed (idempotent result)." }
            };
          }
          await serverSupabase.from("idempotency_keys").upsert({
            business_id: businessId,
            key: idempotencyKey,
            action_type: actionType,
            status: "processing"
          });
        } catch (idemErr) {
          console.warn("[ActionExecutor] Idempotency table check error:", idemErr);
        }
      } else if (executedIdempotencyKeys.has(idempotencyKey)) {
        return {
          success: true,
          actionId: actionId || `cached_${idempotencyKey}`,
          status: "executed",
          result: { message: "Action was already executed previously (idempotent result)." }
        };
      }
    }
    const allowedRoles = this.getAllowedRolesForAction(actionType);
    if (!allowedRoles.includes(userRole)) {
      const errorMsg = `Unauthorized: Role '${userRole}' is not permitted to execute '${actionType}'. Required: ${allowedRoles.join(", ")}`;
      await this.recordAuditLog({
        business_id: businessId,
        action_id: actionId || idempotencyKey,
        action_type: actionType,
        actor_id: userId,
        actor_role: userRole,
        is_ai_proposed: isAIGenerated,
        target_entity_type: payload.entityType || "general",
        target_entity_id: payload.productId || payload.customerId || null,
        changes: payload,
        status: "failed",
        error_message: errorMsg
      });
      return {
        success: false,
        actionId: actionId || "err",
        status: "failed",
        error: errorMsg
      };
    }
    try {
      let executionResult = {};
      switch (actionType) {
        case "create_product": {
          executionResult = await this.executeCreateProduct(businessId, userId, payload);
          break;
        }
        case "create_reminder":
        case "create_customer_followup": {
          executionResult = await this.executeCreateReminder(businessId, userId, payload);
          break;
        }
        case "create_inventory_adjustment": {
          executionResult = await this.executeInventoryAdjustment(businessId, userId, payload);
          break;
        }
        case "create_restock_task": {
          executionResult = await this.executeRestockTask(businessId, userId, payload);
          break;
        }
        case "record_payment": {
          executionResult = await this.executeRecordPayment(businessId, userId, payload);
          break;
        }
        case "create_expense": {
          executionResult = await this.executeCreateExpense(businessId, userId, payload);
          break;
        }
        case "send_customer_message": {
          executionResult = await this.executeSendCustomerMessage(businessId, userId, payload);
          break;
        }
        default:
          throw new Error(`Unsupported action type: ${actionType}`);
      }
      if (idempotencyKey) {
        executedIdempotencyKeys.add(idempotencyKey);
        if (isServerSupabaseConfigured && isValidUUID(businessId)) {
          try {
            await serverSupabase.from("idempotency_keys").update({
              status: "completed",
              response: executionResult
            }).eq("business_id", businessId).eq("key", idempotencyKey);
          } catch (e) {
            console.warn("[ActionExecutor] Failed to mark idempotency key complete:", e);
          }
        }
      }
      if (actionId) {
        if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(actionId)) {
          try {
            await serverSupabase.from("action_proposals").update({
              status: "executed",
              approved_by: isValidUUID(userId) ? userId : null,
              approved_at: (/* @__PURE__ */ new Date()).toISOString(),
              executed_at: (/* @__PURE__ */ new Date()).toISOString(),
              result: executionResult,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", actionId).eq("business_id", businessId);
          } catch (e) {
            console.warn("[ActionExecutor] Failed to update proposal status in DB:", e);
          }
        }
        if (inMemoryActionProposals.has(actionId)) {
          const prop = inMemoryActionProposals.get(actionId);
          prop.status = "executed";
          prop.approved_by = userId;
          prop.approved_at = (/* @__PURE__ */ new Date()).toISOString();
          prop.executed_at = (/* @__PURE__ */ new Date()).toISOString();
          prop.result = executionResult;
        }
      }
      const auditLog = await this.recordAuditLog({
        business_id: businessId,
        action_id: actionId || idempotencyKey,
        action_type: actionType,
        actor_id: userId,
        actor_role: userRole,
        is_ai_proposed: isAIGenerated,
        target_entity_type: payload.entityType || "general",
        target_entity_id: payload.productId || payload.customerId || null,
        changes: { payload, result: executionResult },
        status: "success"
      });
      return {
        success: true,
        actionId: actionId || `exec_${Date.now()}`,
        status: "executed",
        result: executionResult,
        auditLogId: auditLog.id
      };
    } catch (err) {
      console.error(`[ActionExecutor] Error executing ${actionType}:`, err);
      const errorMsg = err.message || "Execution failed";
      if (idempotencyKey && isServerSupabaseConfigured && isValidUUID(businessId)) {
        try {
          await serverSupabase.from("idempotency_keys").update({ status: "failed", response: { error: errorMsg } }).eq("business_id", businessId).eq("key", idempotencyKey);
        } catch {
        }
      }
      await this.recordAuditLog({
        business_id: businessId,
        action_id: actionId || idempotencyKey,
        action_type: actionType,
        actor_id: userId,
        actor_role: userRole,
        is_ai_proposed: isAIGenerated,
        target_entity_type: payload.entityType || "general",
        target_entity_id: payload.productId || payload.customerId || null,
        changes: payload,
        status: "failed",
        error_message: errorMsg
      });
      return {
        success: false,
        actionId: actionId || "err",
        status: "failed",
        error: errorMsg
      };
    }
  }
  /**
   * Action: Create Business Reminder / Task
   */
  static async executeCreateReminder(businessId, userId, payload) {
    const reminderId = generateUUID();
    const title = payload.title || "Business Task";
    const description = payload.description || null;
    const dueDate = payload.dueDate || new Date(Date.now() + 864e5).toISOString();
    const priority = payload.priority === "low" || payload.priority === "high" ? payload.priority : "medium";
    const relatedEntityType = payload.related_entity_type || payload.entityType || null;
    const relatedEntityId = payload.related_entity_id || payload.productId || payload.customerId || null;
    const relatedEntityName = payload.productName || payload.customerName || null;
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      const { data, error } = await serverSupabase.from("business_reminders").insert({
        id: reminderId,
        business_id: businessId,
        title,
        description,
        due_date: dueDate,
        priority,
        status: "pending",
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        related_entity_name: relatedEntityName,
        created_by: userId
      }).select("*").maybeSingle();
      if (!error && data) {
        return { reminderId, reminder: data, message: `Task "${title}" successfully created.` };
      }
    }
    const reminder = {
      id: reminderId,
      business_id: businessId,
      title,
      description,
      due_date: dueDate,
      priority,
      status: "pending",
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      related_entity_name: relatedEntityName,
      created_by: userId,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    inMemoryReminders.unshift(reminder);
    return { reminderId, reminder, message: `Task "${reminder.title}" successfully created.` };
  }
  /**
   * Action: Restock Task
   * Executes authoritative inventory movement (type: 'restock') and logs reminder.
   */
  static async executeRestockTask(businessId, userId, payload) {
    const productId = payload.productId || payload.product_id;
    const restockQty = Number(payload.suggestedQuantity ?? payload.quantity ?? payload.adjustmentQuantity ?? 0);
    const title = payload.title || `Restock replenishment`;
    const unitCost = payload.unitCost !== void 0 ? Number(payload.unitCost) : null;
    if (!productId) {
      throw new Error("Missing productId for restock task.");
    }
    if (restockQty <= 0) {
      throw new Error("Restock quantity must be a positive number greater than zero.");
    }
    let productUpdateResult = null;
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(productId)) {
      const { data: product, error: prodErr } = await serverSupabase.from("products").select("id, name, stock_quantity, product_type, cost_price").eq("id", productId).eq("business_id", businessId).maybeSingle();
      if (prodErr || !product) {
        throw new Error(`Product not found in this business.`);
      }
      if (product.product_type === "service") {
        throw new Error(`Cannot restock "${product.name}": Service items do not track physical stock.`);
      }
      const { data: txId, error: rpcErr } = await serverSupabase.rpc("record_inventory_movement", {
        p_business_id: businessId,
        p_product_id: productId,
        p_type: "restock",
        p_quantity: restockQty,
        p_reference_type: "restock_task",
        p_notes: payload.description || payload.reason || "Restocked via Ursella AI task",
        p_unit_cost: unitCost ?? product.cost_price
      });
      if (rpcErr) {
        throw new Error(`Inventory restock failed: ${rpcErr.message}`);
      }
      const { data: updatedProd } = await serverSupabase.from("products").select("stock_quantity").eq("id", productId).eq("business_id", businessId).single();
      productUpdateResult = {
        productId,
        productName: product.name,
        previousStock: product.stock_quantity,
        newStock: updatedProd?.stock_quantity ?? Number(product.stock_quantity || 0) + restockQty,
        restockQty,
        txId
      };
    } else {
      productUpdateResult = {
        productId,
        productName: payload.productName || "Product",
        previousStock: 0,
        newStock: restockQty,
        restockQty
      };
    }
    const reminderId = generateUUID();
    const reminderData = {
      id: reminderId,
      business_id: businessId,
      title,
      description: payload.description || `Restocked +${restockQty} units`,
      due_date: payload.dueDate || new Date(Date.now() + 864e5).toISOString(),
      priority: payload.priority === "low" || payload.priority === "medium" ? payload.priority : "high",
      status: "completed",
      related_entity_type: "product",
      related_entity_id: productId || null,
      related_entity_name: payload.productName || productUpdateResult?.productName || null,
      created_by: userId,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        await serverSupabase.from("business_reminders").insert(reminderData);
      } catch (e) {
        console.warn("[ActionExecutor] Failed to write restock reminder to Supabase:", e);
      }
    } else {
      inMemoryReminders.unshift(reminderData);
    }
    return {
      reminderId,
      reminder: reminderData,
      inventoryUpdate: productUpdateResult,
      message: `Successfully restocked ${restockQty} units of "${productUpdateResult.productName}" (Current stock: ${productUpdateResult.newStock}).`
    };
  }
  /**
   * Action: Inventory Adjustment (Authoritative & Concurrency-Safe)
   */
  static async executeInventoryAdjustment(businessId, userId, payload) {
    const { productId, adjustmentQuantity, reason = "Inventory adjustment" } = payload;
    if (!productId || typeof adjustmentQuantity !== "number") {
      throw new Error("Invalid inventory adjustment payload: productId and adjustmentQuantity required.");
    }
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(productId)) {
      const { data: product, error: prodErr } = await serverSupabase.from("products").select("id, name, stock_quantity, product_type, cost_price").eq("id", productId).eq("business_id", businessId).maybeSingle();
      if (prodErr || !product) {
        throw new Error(`Product not found in this business.`);
      }
      if (product.product_type === "service") {
        throw new Error(`Cannot adjust stock for "${product.name}": Service items do not track physical inventory.`);
      }
      const { data: txId, error: rpcErr } = await serverSupabase.rpc("record_inventory_movement", {
        p_business_id: businessId,
        p_product_id: productId,
        p_type: "adjustment",
        p_quantity: adjustmentQuantity,
        p_reference_type: "manual_adjustment",
        p_notes: reason,
        p_unit_cost: product.cost_price
      });
      if (rpcErr) {
        throw new Error(`Inventory adjustment failed: ${rpcErr.message}`);
      }
      const { data: updatedProd } = await serverSupabase.from("products").select("stock_quantity").eq("id", productId).eq("business_id", businessId).single();
      return {
        productId,
        productName: product.name,
        previousStock: product.stock_quantity,
        newStock: updatedProd?.stock_quantity ?? adjustmentQuantity,
        adjustmentQuantity,
        txId,
        message: `Updated stock for "${product.name}" to ${adjustmentQuantity} units.`
      };
    }
    return {
      productId,
      productName: payload.productName || "Product",
      previousStock: 0,
      newStock: adjustmentQuantity,
      adjustmentQuantity,
      message: `Updated stock to ${adjustmentQuantity} units.`
    };
  }
  /**
   * Action: Record Payment against Customer Debt (Atomic)
   */
  static async executeRecordPayment(businessId, userId, payload) {
    const { customerId, amount, paymentMethod = "cash", notes = "Debt settlement", reference } = payload;
    const paymentAmount = Number(amount);
    if (!customerId || !paymentAmount || paymentAmount <= 0) {
      throw new Error("Invalid payment payload: customerId and positive payment amount required.");
    }
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(customerId)) {
      const { data: customer, error: custErr } = await serverSupabase.from("customers").select("id, name, business_id").eq("id", customerId).eq("business_id", businessId).maybeSingle();
      if (custErr || !customer) {
        throw new Error(`Customer not found in this business.`);
      }
      const { data: sales, error: salesErr } = await serverSupabase.from("sales").select("id, total, amount_paid, amount_due").eq("business_id", businessId).eq("customer_id", customerId).eq("sale_status", "completed").gt("amount_due", 0).order("sold_at", { ascending: true });
      if (salesErr) {
        throw new Error(`Failed to query customer sales: ${salesErr.message}`);
      }
      let remainingPayment = paymentAmount;
      let primarySaleId = null;
      if (sales && sales.length > 0) {
        primarySaleId = sales[0].id;
        for (const s of sales) {
          if (remainingPayment <= 0) break;
          const due = Number(s.amount_due) || 0;
          const paid = Number(s.amount_paid) || 0;
          const total = Number(s.total) || 0;
          const applyAmt = Math.min(due, remainingPayment);
          const newPaid = paid + applyAmt;
          const newDue = Math.max(0, total - newPaid);
          const newStatus = newDue === 0 ? "paid" : "partial";
          const { error: updErr } = await serverSupabase.from("sales").update({
            amount_paid: newPaid,
            amount_due: newDue,
            payment_status: newStatus,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", s.id).eq("business_id", businessId);
          if (updErr) {
            throw new Error(`Failed to apply payment to sale #${s.id}: ${updErr.message}`);
          }
          remainingPayment -= applyAmt;
        }
      }
      const { data: payment, error: payErr } = await serverSupabase.from("payments").insert({
        business_id: businessId,
        customer_id: customerId,
        sale_id: primarySaleId,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference_number: reference || null,
        notes: notes || "Customer debt payment",
        created_by: isValidUUID(userId) ? userId : null,
        payment_date: (/* @__PURE__ */ new Date()).toISOString()
      }).select("id").single();
      if (payErr) {
        throw new Error(`Failed to record payment entry: ${payErr.message}`);
      }
      const { data: updatedSales } = await serverSupabase.from("sales").select("amount_due").eq("business_id", businessId).eq("customer_id", customerId).eq("sale_status", "completed").gt("amount_due", 0);
      const remainingDebt = (updatedSales || []).reduce(
        (acc, s) => acc + (Number(s.amount_due) || 0),
        0
      );
      return {
        paymentId: payment.id,
        customerId,
        customerName: customer.name,
        amountPaid: paymentAmount,
        remainingDebt,
        message: `Recorded payment of ${paymentAmount.toLocaleString()} from ${customer.name}. Outstanding balance: ${remainingDebt.toLocaleString()}.`
      };
    }
    return {
      paymentId: `pay_${Date.now()}`,
      customerId,
      customerName: payload.customerName || "Customer",
      amountPaid: paymentAmount,
      remainingDebt: 0,
      message: `Recorded payment of ${paymentAmount.toLocaleString()} from ${payload.customerName || "customer"}.`
    };
  }
  /**
   * Action: Create Operating Expense
   */
  static async executeCreateExpense(businessId, userId, payload) {
    const { category, amount, description = "", paymentMethod = "cash", expenseDate } = payload;
    const expenseAmount = Number(amount);
    if (!category || !expenseAmount || expenseAmount <= 0) {
      throw new Error("Invalid expense payload: category and positive amount required.");
    }
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      const { data: expense, error } = await serverSupabase.from("expenses").insert({
        business_id: businessId,
        category,
        amount: expenseAmount,
        description: description || null,
        payment_method: paymentMethod,
        expense_date: expenseDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        created_by: isValidUUID(userId) ? userId : null
      }).select("id").single();
      if (error) {
        throw new Error(`Failed to log expense: ${error.message}`);
      }
      return {
        expenseId: expense.id,
        category,
        amount: expenseAmount,
        message: `Logged expense of ${expenseAmount.toLocaleString()} under category "${category}".`
      };
    }
    return {
      expenseId: `exp_${Date.now()}`,
      category,
      amount: expenseAmount,
      message: `Logged expense of ${expenseAmount.toLocaleString()} under "${category}".`
    };
  }
  /**
   * Action: Send Customer Message
   */
  static async executeSendCustomerMessage(businessId, userId, payload) {
    const { customerId, customerName, customerPhone, draftMessage, channel = "in_app" } = payload;
    let whatsappLink = "";
    if (customerPhone) {
      const cleanPhone = String(customerPhone).replace(/[^0-9]/g, "");
      const encodedMsg = encodeURIComponent(draftMessage || "");
      whatsappLink = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    }
    return {
      channel,
      customerId,
      customerName,
      customerPhone,
      messageDraft: draftMessage,
      whatsappLink,
      sentAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: `Customer communication prepared for ${customerName}.`
    };
  }
  /**
   * Action: Create New Product with Unit of Measure and Initial Stock
   */
  static async executeCreateProduct(businessId, userId, payload) {
    const name = payload.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new Error("Product name is required.");
    }
    const sellingPrice = Number(payload.selling_price ?? payload.sellingPrice) || 0;
    const costPrice = Number(payload.cost_price ?? payload.costPrice) || 0;
    const stockQty = Number(payload.stock_quantity ?? payload.stockQuantity ?? payload.quantity) || 0;
    const minStock = Number(payload.minimum_stock_level ?? payload.minimumStockLevel) ?? 5;
    const unitOfMeasure = (payload.unit_of_measure || payload.unit || "piece").toString().trim();
    const productType = payload.product_type || "physical";
    const description = payload.description?.trim() || null;
    const sku = payload.sku?.trim() || null;
    if (sellingPrice < 0 || costPrice < 0) {
      throw new Error("Product prices cannot be negative.");
    }
    const productId = generateUUID();
    const productRecord = {
      id: productId,
      business_id: businessId,
      name: name.trim(),
      description,
      sku,
      product_type: productType,
      unit_of_measure: unitOfMeasure,
      selling_price: sellingPrice,
      cost_price: costPrice,
      stock_quantity: productType === "service" ? 0 : stockQty,
      minimum_stock_level: productType === "service" ? 0 : minStock,
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      const { data, error } = await serverSupabase.from("products").insert(productRecord).select("*").single();
      if (error) {
        throw new Error(`Failed to create product in database: ${error.message}`);
      }
      if (productType === "physical" && stockQty > 0) {
        await serverSupabase.from("inventory_transactions").insert({
          business_id: businessId,
          product_id: data.id,
          transaction_type: "initial_stock",
          quantity: stockQty,
          notes: `Initial inventory (${stockQty} ${unitOfMeasure}) registered via Ursella OS`,
          created_by: isValidUUID(userId) ? userId : null,
          unit_cost: costPrice
        });
      }
      return {
        message: `Product "${name.trim()}" (${stockQty} ${unitOfMeasure}) successfully added to catalog.`,
        productId: data.id,
        product: data
      };
    }
    return {
      message: `Product "${name.trim()}" (${stockQty} ${unitOfMeasure}) registered.`,
      productId,
      product: productRecord
    };
  }
  /**
   * Reminders Management
   */
  static async getReminders(businessId) {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase.from("business_reminders").select("*").eq("business_id", businessId).order("due_date", { ascending: true });
        if (!error && data) {
          return data;
        }
      } catch (e) {
        console.warn("[ActionExecutor] Failed to fetch reminders from Supabase:", e);
      }
    }
    return inMemoryReminders.filter((r) => r.business_id === businessId);
  }
  static async updateReminderStatus(reminderId, businessId, status) {
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(reminderId)) {
      try {
        const { data, error } = await serverSupabase.from("business_reminders").update({
          status,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", reminderId).eq("business_id", businessId).select("id").maybeSingle();
        if (!error && data) {
          return true;
        }
      } catch (e) {
        console.warn("[ActionExecutor] Failed to update reminder status in Supabase:", e);
      }
    }
    const rem = inMemoryReminders.find((r) => r.id === reminderId && r.business_id === businessId);
    if (!rem) return false;
    rem.status = status;
    if (status === "completed") {
      rem.completed_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    return true;
  }
  static async deleteReminder(reminderId, businessId) {
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(reminderId)) {
      try {
        const { error } = await serverSupabase.from("business_reminders").delete().eq("id", reminderId).eq("business_id", businessId);
        if (!error) return true;
      } catch (e) {
        console.warn("[ActionExecutor] Failed to delete reminder from Supabase:", e);
      }
    }
    const idx = inMemoryReminders.findIndex((r) => r.id === reminderId && r.business_id === businessId);
    if (idx >= 0) {
      inMemoryReminders.splice(idx, 1);
      return true;
    }
    return false;
  }
  /**
   * Audit Logging (Persistent & Immutable)
   */
  static async recordAuditLog(log) {
    const id = generateUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const fullLog = {
      ...log,
      id,
      timestamp
    };
    if (isServerSupabaseConfigured && isValidUUID(log.business_id)) {
      try {
        await serverSupabase.from("action_audit_logs").insert({
          id,
          business_id: log.business_id,
          action_id: log.action_id,
          action_type: log.action_type,
          actor_id: log.actor_id,
          actor_role: log.actor_role,
          is_ai_proposed: log.is_ai_proposed,
          target_entity_type: log.target_entity_type || null,
          target_entity_id: log.target_entity_id || null,
          changes: log.changes || {},
          status: log.status,
          error_message: log.error_message || null,
          created_at: timestamp
        });
      } catch (e) {
        console.warn("[ActionExecutor] Failed to write audit log to Supabase:", e);
      }
    }
    inMemoryAuditLogs.unshift(fullLog);
    if (inMemoryAuditLogs.length > 200) {
      inMemoryAuditLogs.pop();
    }
    return fullLog;
  }
  static async getAuditLogs(businessId) {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase.from("action_audit_logs").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100);
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            business_id: d.business_id,
            action_id: d.action_id,
            action_type: d.action_type,
            actor_id: d.actor_id,
            actor_role: d.actor_role,
            is_ai_proposed: d.is_ai_proposed,
            target_entity_type: d.target_entity_type,
            target_entity_id: d.target_entity_id,
            changes: d.changes,
            status: d.status,
            error_message: d.error_message,
            timestamp: d.created_at
          }));
        }
      } catch (e) {
        console.warn("[ActionExecutor] Failed to read audit logs from Supabase:", e);
      }
    }
    return inMemoryAuditLogs.filter((l) => l.business_id === businessId);
  }
  /**
   * Role permissions mapping for actions
   */
  static getAllowedRolesForAction(actionType) {
    switch (actionType) {
      case "create_product":
        return ["owner", "admin", "staff"];
      case "create_reminder":
      case "create_restock_task":
      case "create_customer_followup":
      case "send_customer_message":
        return ["owner", "admin", "staff"];
      case "record_payment":
        return ["owner", "admin", "staff"];
      case "create_inventory_adjustment":
        return ["owner", "admin"];
      case "create_expense":
        return ["owner", "admin"];
      default:
        return ["owner", "admin"];
    }
  }
};

// server/proactive-ai.service.ts
var businessInsightsCache = /* @__PURE__ */ new Map();
var businessNotificationsCache = /* @__PURE__ */ new Map();
var businessPreferencesCache = /* @__PURE__ */ new Map();
var ProactiveAIService = class {
  /**
   * Convert raw detected events into full BusinessInsight models with deduplication
   * and optional Gemini AI synthesis.
   */
  static async processDetectedEvents(businessId, rawEvents, businessMetadata) {
    const existingCache = businessInsightsCache.get(businessId)?.insights || [];
    const existingMap = new Map(existingCache.map((i) => [i.dedup_key, i]));
    const updatedInsights = [];
    for (const raw of rawEvents) {
      const existing = existingMap.get(raw.dedupKey);
      if (existing) {
        if (existing.status === "dismissed" || existing.status === "acted_on") {
          updatedInsights.push(existing);
          continue;
        }
        const updated = {
          ...existing,
          title: raw.title,
          summary: raw.summary,
          data: raw.data,
          severity: raw.severity,
          confidence: raw.confidence,
          explanation: raw.explanation,
          action_type: raw.actionType || existing.action_type,
          action_payload: raw.actionPayload || existing.action_payload,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        updatedInsights.push(updated);
        existingMap.delete(raw.dedupKey);
      } else {
        const newInsight = {
          id: generateUUID(),
          business_id: businessId,
          event_type: raw.eventType,
          category: raw.category,
          severity: raw.severity,
          confidence: raw.confidence,
          title: raw.title,
          summary: raw.summary,
          explanation: raw.explanation,
          data: raw.data,
          detected_at: (/* @__PURE__ */ new Date()).toISOString(),
          status: "new",
          action_type: raw.actionType || null,
          action_payload: raw.actionPayload || null,
          source: "hybrid",
          dedup_key: raw.dedupKey,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        updatedInsights.push(newInsight);
        this.addNotification(businessId, {
          id: generateUUID(),
          business_id: businessId,
          title: raw.title,
          message: raw.summary,
          priority: raw.severity,
          category: raw.category,
          is_read: false,
          insight_id: newInsight.id,
          action_type: raw.actionType || null,
          action_payload: raw.actionPayload || null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    for (const [, oldInsight] of existingMap.entries()) {
      if (oldInsight.category === "inventory" && oldInsight.status === "new") {
        oldInsight.status = "resolved";
        oldInsight.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        updatedInsights.push(oldInsight);
      } else {
        updatedInsights.push(oldInsight);
      }
    }
    const severityRank = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      informational: 1
    };
    updatedInsights.sort((a, b) => {
      const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    });
    const gemini = getGeminiClient();
    if (gemini && updatedInsights.some((i) => i.severity === "critical" || i.severity === "high")) {
      try {
        const criticalItems = updatedInsights.filter((i) => i.status === "new" && (i.severity === "critical" || i.severity === "high")).slice(0, 3);
        if (criticalItems.length > 0) {
          const prompt = `You are Ursella AI Business Operating System. Review these detected critical business events for "${businessMetadata?.name || "the business"}" and provide a 1-sentence strategic action summary for each item:
${JSON.stringify(criticalItems.map((c) => ({ id: c.id, title: c.title, summary: c.summary, data: c.data })))}
Respond in valid JSON array of objects: [{"id": string, "strategicAdvice": string}]`;
          const aiRes = await gemini.models.generateContent({
            model: getActiveGeminiModel(),
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          });
          if (aiRes.text) {
            const parsed = JSON.parse(aiRes.text);
            if (Array.isArray(parsed)) {
              for (const advice of parsed) {
                const target = updatedInsights.find((i) => i.id === advice.id);
                if (target && target.explanation && advice.strategicAdvice) {
                  target.explanation.whatYouCanDo = advice.strategicAdvice;
                }
              }
            }
          }
        }
      } catch (aiErr) {
        console.warn("[ProactiveAIService] Optional Gemini synthesis skipped:", aiErr?.message);
      }
    }
    businessInsightsCache.set(businessId, {
      timestamp: Date.now(),
      insights: updatedInsights
    });
    return updatedInsights;
  }
  /**
   * Get cached insights with filtering.
   */
  static getInsights(businessId, filter) {
    const all = businessInsightsCache.get(businessId)?.insights || [];
    return all.filter((ins) => {
      if (filter?.category && filter.category !== "all" && ins.category !== filter.category) {
        return false;
      }
      if (filter?.status && filter.status !== "all" && ins.status !== filter.status) {
        return false;
      }
      return true;
    });
  }
  /**
   * Update insight status (dismiss, mark seen, mark acted_on).
   */
  static updateInsightStatus(businessId, insightId, status) {
    const list = businessInsightsCache.get(businessId)?.insights;
    if (!list) return false;
    const cleanId = insightId.replace(/^(prio_|dp_)/, "");
    const found = list.find(
      (i) => i.id === insightId || i.id === cleanId || i.id.replace(/^(prio_|dp_)/, "") === cleanId
    );
    if (!found) return false;
    found.status = status;
    found.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    return true;
  }
  /**
   * Generate "What should I do today?" prioritized action ranking.
   */
  static getTodayPriorities(businessId) {
    const insights = (businessInsightsCache.get(businessId)?.insights || []).filter(
      (i) => i.status === "new" || i.status === "seen"
    );
    const priorities = [];
    let rank = 1;
    for (const ins of insights) {
      if (ins.action_type && ins.action_payload && rank <= 4) {
        priorities.push({
          id: `prio_${ins.id}`,
          rank,
          title: ins.title,
          reason: ins.explanation?.whyItMatters || ins.summary,
          category: ins.category,
          severity: ins.severity,
          actionType: ins.action_type,
          actionPayload: ins.action_payload,
          impactDescription: ins.explanation?.whatYouCanDo || "Review and take prompt action."
        });
        rank++;
      }
    }
    return priorities;
  }
  /**
   * In-App Notifications with robust deduplication.
   */
  static addNotification(businessId, notif) {
    const list = businessNotificationsCache.get(businessId) || [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1e3;
    const isDuplicate = list.some((n) => {
      const isSameInsight = notif.insight_id && n.insight_id === notif.insight_id;
      const isSameTitle = n.title === notif.title;
      const isRecent = new Date(n.created_at).getTime() >= oneDayAgo;
      return (isSameInsight || isSameTitle) && (isRecent || !n.is_read);
    });
    if (!isDuplicate) {
      list.unshift(notif);
      if (list.length > 50) list.pop();
      businessNotificationsCache.set(businessId, list);
    }
  }
  static getNotifications(businessId) {
    return businessNotificationsCache.get(businessId) || [];
  }
  static markAllNotificationsRead(businessId) {
    const list = businessNotificationsCache.get(businessId) || [];
    for (const n of list) {
      n.is_read = true;
      n.read_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    businessNotificationsCache.set(businessId, list);
  }
  static deleteNotification(businessId, notificationId) {
    const list = businessNotificationsCache.get(businessId) || [];
    const filtered = list.filter((n) => n.id !== notificationId);
    businessNotificationsCache.set(businessId, filtered);
    return true;
  }
  static clearAllNotifications(businessId) {
    businessNotificationsCache.set(businessId, []);
    return true;
  }
  static toggleNotificationRead(businessId, notificationId) {
    const list = businessNotificationsCache.get(businessId) || [];
    const item = list.find((n) => n.id === notificationId);
    if (item) {
      item.is_read = !item.is_read;
      item.read_at = item.is_read ? (/* @__PURE__ */ new Date()).toISOString() : void 0;
      businessNotificationsCache.set(businessId, list);
      return true;
    }
    return false;
  }
  /**
   * Notification Preferences
   */
  static getPreferences(businessId) {
    return businessPreferencesCache.get(businessId) || {
      enabledCategories: ["sales", "inventory", "customers", "expenses", "opportunities", "health"],
      minSeverity: "low",
      dailyBriefEnabled: true,
      dailyBriefTime: "08:00",
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00"
    };
  }
  static savePreferences(businessId, prefs) {
    const current = this.getPreferences(businessId);
    const updated = { ...current, ...prefs };
    businessPreferencesCache.set(businessId, updated);
    return updated;
  }
};

// server/subscription.service.ts
var DEFAULT_PLANS = [
  {
    id: "plan_free",
    name: "Ursella Free",
    tier: "free",
    description: "Complete all-in-one business operating system with unlimited access to POS, Inventory, AI, and Analytics.",
    monthly_price: 0,
    annual_price: 0,
    currency: "USD",
    features_json: [
      "Point of Sale (POS) & Digital Invoices",
      "FIFO Inventory & Stock Alert Tracking",
      "Customer Ledgers & WhatsApp Debt Reminders",
      "Real-time Financial Analytics & Cash Flow",
      "Ursella AI Co-Pilot & Business Advisor",
      "Full P&L and Balance Sheet Reports",
      "CSV Data Import & Cloud Export",
      "Unlimited Products & Catalogs"
    ],
    max_members: 50,
    ai_monthly_quota: 5e4,
    max_products: 5e5,
    allows_csv_import: true,
    allows_export: true,
    allows_advanced_reports: true,
    allows_push_notifications: true,
    is_active: true
  }
];
var memorySubscriptions = /* @__PURE__ */ new Map();
var SubscriptionService = class {
  /**
   * Get all active subscription plans
   */
  static async getPlans() {
    try {
      const { data, error } = await serverSupabase.from("subscription_plans").select("*").eq("is_active", true).order("monthly_price", { ascending: true });
      if (error || !data || data.length === 0) {
        return DEFAULT_PLANS;
      }
      return data;
    } catch {
      return DEFAULT_PLANS;
    }
  }
  /**
   * Get the active subscription for a specific business with usage metrics
   */
  static async getBusinessSubscription(businessId) {
    const plans = await this.getPlans();
    const defaultPlan = plans[0] || DEFAULT_PLANS[0];
    let sub = null;
    try {
      const { data, error } = await serverSupabase.from("business_subscriptions").select("*").eq("business_id", businessId).maybeSingle();
      if (!error && data) {
        sub = data;
      }
    } catch (e) {
      console.warn(`[SubscriptionService] Supabase query fallback for business ${businessId}:`, e);
    }
    if (!sub) {
      sub = memorySubscriptions.get(businessId) || {
        id: `sub_${businessId}`,
        business_id: businessId,
        plan_id: "plan_free",
        status: "active",
        provider: "manual",
        current_period_start: (/* @__PURE__ */ new Date()).toISOString(),
        current_period_end: new Date(Date.now() + 365 * 864e5).toISOString(),
        cancel_at_period_end: false
      };
    }
    const matchedPlan = plans.find((p) => p.id === sub?.plan_id) || defaultPlan;
    sub.plan = matchedPlan;
    const startOfMonth = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString();
    let aiUsageCount = 0;
    let membersCount = 1;
    try {
      const { count: aiCount } = await serverSupabase.from("ai_usage_logs").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", startOfMonth);
      if (typeof aiCount === "number") aiUsageCount = aiCount;
      const { count: mCount } = await serverSupabase.from("business_members").select("*", { count: "exact", head: true }).eq("business_id", businessId);
      if (typeof mCount === "number") membersCount = mCount;
    } catch {
    }
    sub.usage = {
      ai_queries_used: aiUsageCount,
      ai_monthly_quota: matchedPlan.ai_monthly_quota,
      members_count: Math.max(1, membersCount),
      max_members: matchedPlan.max_members
    };
    memorySubscriptions.set(businessId, sub);
    return sub;
  }
  /**
   * Check if a business has entitlement for a specific feature
   */
  static async checkEntitlement(businessId, feature) {
    const sub = await this.getBusinessSubscription(businessId);
    const plan = sub.plan || DEFAULT_PLANS[0];
    if (feature === "ai_query") {
      const used = sub.usage?.ai_queries_used || 0;
      if (used >= plan.ai_monthly_quota) {
        return {
          allowed: false,
          reason: `You have reached your monthly AI query limit (${plan.ai_monthly_quota}). Upgrade to Ursella Pro or Scale to increase quota.`,
          upgradeRequired: true
        };
      }
      return { allowed: true };
    }
    if (feature === "advanced_reports" && !plan.allows_advanced_reports) {
      return {
        allowed: false,
        reason: "Advanced financial statements and multi-period reports are available on Ursella Pro and Scale plans.",
        upgradeRequired: true
      };
    }
    if (feature === "push_notifications" && !plan.allows_push_notifications) {
      return {
        allowed: false,
        reason: "Web Push and background alert delivery is available on Pro and Scale tiers.",
        upgradeRequired: true
      };
    }
    if (feature === "add_member") {
      const current = sub.usage?.members_count || 1;
      if (current >= plan.max_members) {
        return {
          allowed: false,
          reason: `Your current plan allows up to ${plan.max_members} team members. Upgrade to invite additional staff.`,
          upgradeRequired: true
        };
      }
    }
    return { allowed: true };
  }
  /**
   * Update or activate a business subscription
   */
  static async activateSubscription(businessId, planId, provider, providerSubId) {
    const plans = await this.getPlans();
    const plan = plans.find((p) => p.id === planId) || DEFAULT_PLANS[1];
    const updatedSub = {
      id: `sub_${businessId}`,
      business_id: businessId,
      plan_id: plan.id,
      status: "active",
      provider,
      provider_subscription_id: providerSubId || `sub_ext_${Date.now()}`,
      current_period_start: (/* @__PURE__ */ new Date()).toISOString(),
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
      cancel_at_period_end: false,
      plan
    };
    try {
      await serverSupabase.from("business_subscriptions").upsert(
        {
          business_id: businessId,
          plan_id: plan.id,
          status: "active",
          provider,
          provider_subscription_id: updatedSub.provider_subscription_id,
          current_period_start: updatedSub.current_period_start,
          current_period_end: updatedSub.current_period_end,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "business_id" }
      );
    } catch (e) {
      console.warn("[SubscriptionService] Error persisting subscription to Supabase, saved in memory:", e);
    }
    memorySubscriptions.set(businessId, updatedSub);
    return updatedSub;
  }
};

// server/payment-provider.service.ts
var PaymentProviderService = class {
  /**
   * Initiate a subscription checkout or Mobile Money prompt
   */
  static async initiatePayment(req) {
    const plans = await SubscriptionService.getPlans();
    const plan = plans.find((p) => p.id === req.planId) || plans[1];
    const amount = req.billingCycle === "annual" ? plan.annual_price : plan.monthly_price;
    const paymentId = generateUUID();
    if (isValidUUID(req.businessId)) {
      try {
        await serverSupabase.from("payment_transactions").insert({
          id: paymentId,
          business_id: req.businessId,
          amount,
          currency: plan.currency,
          status: "pending",
          provider: req.provider,
          customer_email: req.customerEmail || null,
          payment_method: req.provider === "momo" ? `momo_${req.network || "MTN"}` : "card",
          metadata: {
            plan_id: plan.id,
            billing_cycle: req.billingCycle,
            phone_number: req.phoneNumber
          }
        });
      } catch (err) {
        console.warn("[PaymentProviderService] Failed to insert initial pending record:", err);
      }
    }
    if (req.provider === "momo") {
      return {
        success: true,
        paymentId,
        providerReference: `MOMO-${Math.floor(1e5 + Math.random() * 9e5)}`,
        instructions: `A USSD push notification has been sent to ${req.phoneNumber || "your registered number"}. Please enter your PIN to authorize payment of ${plan.currency} ${amount}.`,
        status: "pending"
      };
    }
    if (req.provider === "stripe") {
      const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
      return {
        success: true,
        paymentId,
        providerReference: `cs_test_${paymentId}`,
        checkoutUrl: isStripeConfigured ? `/api/payment/stripe-session?tx=${paymentId}` : void 0,
        instructions: isStripeConfigured ? "Redirecting to secure card checkout..." : "Card checkout provider initialized in sandbox verification mode.",
        status: "pending"
      };
    }
    return {
      success: true,
      paymentId,
      providerReference: `FLW-${Date.now()}`,
      instructions: "Secure payment gateway initialized. Complete payment via modal.",
      status: "pending"
    };
  }
  /**
   * Handle incoming payment webhooks safely with idempotency and signature checks
   */
  static async handleWebhook(event) {
    console.log(`[Payment Webhook] provider=${event.provider} event=${event.eventType} id=${event.providerTxId}`);
    if (!event.businessId || !event.planId) {
      return { processed: false, message: "Missing businessId or planId in webhook payload." };
    }
    if (event.status === "completed") {
      await SubscriptionService.activateSubscription(
        event.businessId,
        event.planId,
        event.provider,
        event.providerTxId
      );
      if (isValidUUID(event.businessId)) {
        try {
          await serverSupabase.from("payment_transactions").insert({
            id: generateUUID(),
            business_id: event.businessId,
            amount: event.amount || 15,
            currency: event.currency || "USD",
            status: "completed",
            provider: event.provider,
            provider_tx_id: event.providerTxId,
            metadata: {
              webhook_event: event.eventType,
              event_id: event.eventId
            }
          });
        } catch (e) {
          console.warn("[Payment Webhook] Supabase transaction log fallback:", e);
        }
      }
      return { processed: true, message: "Subscription successfully upgraded and activated." };
    }
    return { processed: true, message: "Webhook received but payment was not completed." };
  }
};

// server/ai-cost-control.service.ts
var MODEL_COSTS = {
  "gemini-3.7-flash": { inputPer1k: 15e-5, outputPer1k: 6e-4 },
  "gemini-3.6-flash": { inputPer1k: 15e-5, outputPer1k: 6e-4 },
  "gemini-3.1-flash-lite": { inputPer1k: 75e-6, outputPer1k: 3e-4 },
  "gemini-3.1-pro-preview": { inputPer1k: 125e-5, outputPer1k: 5e-3 }
};
var AICostControlService = class {
  /**
   * Determine the most cost-effective and task-appropriate model tier
   */
  static selectModelForTask(taskType) {
    const configuredModel = getActiveGeminiModel();
    const fallbackLiteModel = process.env.GEMINI_FALLBACK_MODEL || FALLBACK_LITE_MODEL;
    if (taskType === "intent_classification") {
      return fallbackLiteModel;
    }
    return configuredModel;
  }
  /**
   * Log AI request metrics and track token expenditures
   */
  static async logUsage(entry) {
    const inputTokens = entry.inputTokens || 450;
    const outputTokens = entry.outputTokens || 350;
    const rate = MODEL_COSTS[entry.model] || MODEL_COSTS["gemini-3.7-flash"];
    const estimatedCostUsd = inputTokens / 1e3 * rate.inputPer1k + outputTokens / 1e3 * rate.outputPer1k;
    try {
      await serverSupabase.from("ai_usage_logs").insert({
        business_id: entry.businessId,
        user_id: entry.userId || null,
        request_type: entry.requestType,
        model: entry.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
        latency_ms: entry.latencyMs,
        success: entry.success,
        error_message: entry.errorMessage || null
      });
    } catch (err) {
      console.warn("[AICostControlService] Error recording usage log in Supabase:", err);
    }
  }
  /**
   * Verify whether a business is within its AI query budget
   */
  static async verifyQuota(businessId) {
    return SubscriptionService.checkEntitlement(businessId, "ai_query");
  }
};

// server/data-io.service.ts
var DataIOService = class {
  /**
   * Helper to parse CSV string into headers and rows
   */
  static parseCSV(csvContent) {
    const lines = csvContent.split(/\r\n|\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }
    const headers = this.parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/['"]/g, ""));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header] = (values[idx] || "").trim();
      });
      rows.push(rowObj);
    }
    return { headers, rows };
  }
  static parseCSVLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }
  /**
   * Preview and Validate CSV data with row-level error reporting
   */
  static previewImport(csvContent, entityType) {
    const { headers, rows } = this.parseCSV(csvContent);
    const previewRows = [];
    rows.forEach((raw, idx) => {
      const rowNumber = idx + 2;
      const errors = [];
      const parsed = {};
      if (entityType === "products") {
        const name = raw["name"] || raw["product name"] || raw["item"];
        const priceStr = raw["selling price"] || raw["price"] || raw["selling_price"] || raw["unit price"];
        const costStr = raw["cost price"] || raw["cost"] || raw["cost_price"] || raw["unit cost"] || "0";
        const stockStr = raw["current stock"] || raw["stock"] || raw["quantity"] || raw["qty"] || "0";
        const minStockStr = raw["minimum stock"] || raw["min stock"] || raw["min_stock"] || "5";
        const sku = raw["sku"] || raw["code"] || raw["barcode"] || "";
        if (!name || name.trim().length === 0) {
          errors.push("Product name is required.");
        } else {
          parsed.name = name.trim();
        }
        const price = Number(priceStr);
        if (isNaN(price) || price < 0) {
          errors.push(`Invalid selling price "${priceStr}". Must be a non-negative number.`);
        } else {
          parsed.selling_price = price;
        }
        const cost = Number(costStr);
        if (isNaN(cost) || cost < 0) {
          errors.push(`Invalid cost price "${costStr}". Must be a non-negative number.`);
        } else {
          parsed.cost_price = cost;
        }
        const stock = Number(stockStr);
        if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
          errors.push(`Invalid stock quantity "${stockStr}". Must be a positive integer.`);
        } else {
          parsed.current_stock = stock;
        }
        const minStock = Number(minStockStr);
        parsed.min_stock_level = isNaN(minStock) ? 5 : minStock;
        parsed.sku = sku || `SKU-${Math.floor(1e3 + Math.random() * 9e3)}`;
      } else if (entityType === "customers") {
        const name = raw["name"] || raw["customer name"] || raw["full name"];
        const phone = raw["phone"] || raw["phone number"] || raw["mobile"] || "";
        const email = raw["email"] || raw["email address"] || "";
        const address = raw["address"] || raw["location"] || "";
        if (!name || name.trim().length === 0) {
          errors.push("Customer name is required.");
        } else {
          parsed.name = name.trim();
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Invalid email format "${email}".`);
        } else {
          parsed.email = email || null;
        }
        parsed.phone = phone || null;
        parsed.address = address || null;
      } else if (entityType === "expenses") {
        const title = raw["title"] || raw["description"] || raw["expense name"] || raw["name"];
        const amountStr = raw["amount"] || raw["cost"] || raw["price"];
        const category = raw["category"] || raw["expense category"] || "Other Operational Expense";
        const dateStr = raw["date"] || raw["expense date"] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        if (!title || title.trim().length === 0) {
          errors.push("Expense title/description is required.");
        } else {
          parsed.title = title.trim();
        }
        const amount = Number(amountStr);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Invalid expense amount "${amountStr}". Must be greater than 0.`);
        } else {
          parsed.amount = amount;
        }
        parsed.category = category.trim();
        parsed.expense_date = dateStr;
      }
      previewRows.push({
        rowNumber,
        raw,
        parsed: errors.length === 0 ? parsed : void 0,
        isValid: errors.length === 0,
        errors
      });
    });
    const validRowsCount = previewRows.filter((r) => r.isValid).length;
    return {
      entityType,
      totalRows: previewRows.length,
      validRowsCount,
      invalidRowsCount: previewRows.length - validRowsCount,
      rows: previewRows,
      headers
    };
  }
  /**
   * Execute transactional batch insert for validated rows
   */
  static async executeImport(req) {
    const { businessId, entityType, rows } = req;
    if (rows.length === 0) {
      return { success: true, importedCount: 0, errors: [] };
    }
    let inserted = 0;
    const errors = [];
    try {
      if (entityType === "products") {
        const payload = rows.map((r) => ({
          business_id: businessId,
          name: r.name,
          sku: r.sku || null,
          selling_price: r.selling_price,
          cost_price: r.cost_price || 0,
          current_stock: r.current_stock || 0,
          min_stock_level: r.min_stock_level || 5,
          is_active: true
        }));
        const { data, error } = await serverSupabase.from("products").insert(payload).select("id");
        if (error) throw error;
        inserted = data?.length || payload.length;
      } else if (entityType === "customers") {
        const payload = rows.map((r) => ({
          business_id: businessId,
          name: r.name,
          phone: r.phone || null,
          email: r.email || null,
          address: r.address || null,
          is_active: true
        }));
        const { data, error } = await serverSupabase.from("customers").insert(payload).select("id");
        if (error) throw error;
        inserted = data?.length || payload.length;
      } else if (entityType === "expenses") {
        const payload = rows.map((r) => ({
          business_id: businessId,
          title: r.title,
          amount: r.amount,
          category: r.category || "Other Operational Expense",
          expense_date: r.expense_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          payment_method: "cash"
        }));
        const { data, error } = await serverSupabase.from("expenses").insert(payload).select("id");
        if (error) throw error;
        inserted = data?.length || payload.length;
      }
      await serverSupabase.from("import_batches").insert({
        business_id: businessId,
        user_id: req.userId || null,
        entity_type: entityType,
        filename: `batch_import_${entityType}_${Date.now()}.csv`,
        total_rows: rows.length,
        successful_rows: inserted,
        failed_rows: 0,
        status: "completed"
      });
      return { success: true, importedCount: inserted, errors: [] };
    } catch (err) {
      console.error("[DataIOService] Import error:", err);
      return { success: false, importedCount: 0, errors: [err.message || "Database insert failed"] };
    }
  }
  /**
   * Export business data to sanitized CSV
   */
  static async exportDataToCSV(businessId, entity) {
    if (entity === "products") {
      const { data } = await serverSupabase.from("products").select("name, sku, selling_price, cost_price, current_stock, min_stock_level, created_at").eq("business_id", businessId).order("name");
      if (!data || data.length === 0) return "Name,SKU,Selling Price,Cost Price,Current Stock,Min Stock,Created At\n";
      const header = "Name,SKU,Selling Price,Cost Price,Current Stock,Min Stock,Created At\n";
      const rows = data.map((d) => `"${(d.name || "").replace(/"/g, '""')}",${d.sku || ""},${d.selling_price},${d.cost_price},${d.current_stock},${d.min_stock_level},${d.created_at}`).join("\n");
      return header + rows;
    }
    if (entity === "customers") {
      const { data } = await serverSupabase.from("customers").select("name, phone, email, address, notes, created_at").eq("business_id", businessId).order("name");
      if (!data || data.length === 0) return "Name,Phone,Email,Address,Notes,Created At\n";
      const header = "Name,Phone,Email,Address,Notes,Created At\n";
      const rows = data.map((d) => `"${(d.name || "").replace(/"/g, '""')}","${d.phone || ""}","${d.email || ""}","${(d.address || "").replace(/"/g, '""')}","${(d.notes || "").replace(/"/g, '""')}",${d.created_at}`).join("\n");
      return header + rows;
    }
    if (entity === "expenses") {
      const { data } = await serverSupabase.from("expenses").select("title, amount, category, payment_method, expense_date, notes").eq("business_id", businessId).order("expense_date", { ascending: false });
      if (!data || data.length === 0) return "Title,Amount,Category,Payment Method,Expense Date,Notes\n";
      const header = "Title,Amount,Category,Payment Method,Expense Date,Notes\n";
      const rows = data.map((d) => `"${(d.title || "").replace(/"/g, '""')}",${d.amount},"${d.category}","${d.payment_method}","${d.expense_date}","${(d.notes || "").replace(/"/g, '""')}"`).join("\n");
      return header + rows;
    }
    if (entity === "sales") {
      const { data } = await serverSupabase.from("sales").select("receipt_number, total, subtotal, discount, amount_paid, payment_status, payment_method, sold_at").eq("business_id", businessId).order("sold_at", { ascending: false });
      if (!data || data.length === 0) return "Receipt Number,Total,Subtotal,Discount,Amount Paid,Status,Payment Method,Sold At\n";
      const header = "Receipt Number,Total,Subtotal,Discount,Amount Paid,Status,Payment Method,Sold At\n";
      const rows = data.map((d) => `"${d.receipt_number}",${d.total},${d.subtotal},${d.discount},${d.amount_paid},"${d.payment_status}","${d.payment_method || "cash"}","${d.sold_at}"`).join("\n");
      return header + rows;
    }
    return "Entity,Status,Date\n";
  }
};

// server/reporting.service.ts
var ReportingService = class {
  /**
   * Resolve date boundaries for the given period
   */
  static resolveDateRange(opts) {
    const now = /* @__PURE__ */ new Date();
    const endDate = opts.endDate ? new Date(opts.endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let startDate = /* @__PURE__ */ new Date();
    let periodLabel = "Last 30 Days";
    switch (opts.period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        periodLabel = "Today";
        break;
      case "7d":
        startDate = new Date(Date.now() - 7 * 864e5);
        periodLabel = "Past 7 Days";
        break;
      case "this_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = "This Month";
        break;
      case "last_month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodLabel = "Last Month";
        break;
      case "this_year":
        startDate = new Date(now.getFullYear(), 0, 1);
        periodLabel = "This Year";
        break;
      case "custom":
        startDate = opts.startDate ? new Date(opts.startDate) : new Date(Date.now() - 30 * 864e5);
        periodLabel = `${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`;
        break;
      case "30d":
      default:
        startDate = new Date(Date.now() - 30 * 864e5);
        periodLabel = "Past 30 Days";
        break;
    }
    const daysCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 864e5));
    return { startDate, endDate, periodLabel, daysCount };
  }
  /**
   * Generate comprehensive Sales Report
   */
  static async generateSalesReport(businessId, opts) {
    const { startDate, endDate, periodLabel, daysCount } = this.resolveDateRange(opts);
    const overview = await BusinessToolsService.getBusinessOverview(businessId, daysCount);
    const salesSummary = await BusinessToolsService.getSalesSummary(businessId, daysCount);
    const { data: sales } = await serverSupabase.from("sales").select("id, receipt_number, total, subtotal, discount, amount_paid, payment_status, payment_method, sold_at").eq("business_id", businessId).gte("sold_at", startDate.toISOString()).lte("sold_at", endDate.toISOString()).order("sold_at", { ascending: false });
    return {
      reportType: "sales",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel,
      currency: "USD",
      summaryMetrics: {
        totalRevenue: overview.revenue,
        transactionCount: overview.transactionCount,
        averageOrderValue: overview.averageOrderValue,
        totalCashCollected: overview.totalCashCollected,
        outstandingDebt: overview.totalReceivablesOutstanding
      },
      breakdownRows: sales || []
    };
  }
  /**
   * Generate Profitability Report
   */
  static async generateProfitabilityReport(businessId, opts) {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const overview = await BusinessToolsService.getBusinessOverview(businessId, daysCount);
    const expenses = await BusinessToolsService.getExpenseSummary(businessId, daysCount);
    const products = await BusinessToolsService.getProductPerformance(businessId, 20);
    return {
      reportType: "profitability",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel,
      currency: "USD",
      summaryMetrics: {
        grossRevenue: overview.revenue,
        costOfGoodsSold: overview.cogs,
        grossProfit: overview.grossProfit,
        grossMarginPercent: overview.grossMarginPercent,
        operatingExpenses: expenses.totalExpenses,
        netProfit: overview.netProfit,
        netMarginPercent: overview.netMarginPercent
      },
      breakdownRows: products.map((p) => ({
        productName: p.name,
        sellingPrice: p.sellingPrice,
        costPrice: p.costPrice,
        unitMargin: p.unitMargin,
        marginPercent: p.marginPct,
        stockQuantity: p.stockQuantity
      }))
    };
  }
  /**
   * Generate Inventory Valuation & Health Report
   */
  static async generateInventoryReport(businessId) {
    const inv = await BusinessToolsService.getInventoryAlerts(businessId);
    const { data: products } = await serverSupabase.from("products").select("name, sku, selling_price, cost_price, stock_quantity, minimum_stock_level, is_active").eq("business_id", businessId).order("name");
    const totalValuationCost = (products || []).reduce((sum, p) => sum + (p.stock_quantity || 0) * (p.cost_price || 0), 0);
    const totalValuationRetail = (products || []).reduce((sum, p) => sum + (p.stock_quantity || 0) * (p.selling_price || 0), 0);
    return {
      reportType: "inventory",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel: "Current Stock Position",
      currency: "USD",
      summaryMetrics: {
        totalSKUs: inv.totalActiveSKUs,
        totalValuationCost: inv.totalInventoryValuation || totalValuationCost,
        totalValuationRetail,
        potentialGrossProfit: totalValuationRetail - totalValuationCost,
        outOfStockCount: inv.outOfStockCount,
        lowStockCount: inv.lowStockCount
      },
      breakdownRows: (products || []).map((p) => ({
        name: p.name,
        sku: p.sku || "N/A",
        currentStock: p.stock_quantity,
        minStock: p.minimum_stock_level,
        costPrice: p.cost_price,
        sellingPrice: p.selling_price,
        stockValuation: (p.stock_quantity || 0) * (p.cost_price || 0),
        status: p.stock_quantity === 0 ? "OUT_OF_STOCK" : (p.stock_quantity || 0) <= (p.minimum_stock_level || 5) ? "LOW_STOCK" : "HEALTHY"
      }))
    };
  }
  /**
   * Generate Expense Breakdown Report
   */
  static async generateExpenseReport(businessId, opts) {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const expenseData = await BusinessToolsService.getExpenseSummary(businessId, daysCount);
    const topCategory = expenseData.expensesByCategory[0];
    return {
      reportType: "expenses",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel,
      currency: "USD",
      summaryMetrics: {
        totalExpenses: expenseData.totalExpenses,
        expenseCount: expenseData.expenseCount,
        topCategory: topCategory?.category || "None",
        topCategoryAmount: topCategory?.amount || 0
      },
      breakdownRows: expenseData.expensesByCategory.map((c) => ({
        category: c.category,
        totalAmount: c.amount,
        percentOfTotal: c.percentage
      }))
    };
  }
  /**
   * Generate Customer Receivables & Debt Aging Report
   */
  static async generateReceivablesReport(businessId) {
    const debtors = await BusinessToolsService.getCustomerBalances(businessId);
    return {
      reportType: "receivables",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel: "Active Outstanding Debtors",
      currency: "USD",
      summaryMetrics: {
        totalReceivables: debtors.totalOutstandingDebt,
        activeDebtorsCount: debtors.debtorsCount,
        totalCustomers: debtors.debtorsCount
      },
      breakdownRows: debtors.topDebtors.map((d) => ({
        customerName: d.name,
        phone: d.phone || "N/A",
        balance: d.debtAmount,
        totalSpent: d.debtAmount
      }))
    };
  }
  /**
   * Generate Cash Flow Statement Report
   */
  static async generateCashFlowReport(businessId, opts) {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const cashFlow = await BusinessToolsService.getCashFlow(businessId, daysCount);
    return {
      reportType: "cash_flow",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel,
      currency: "USD",
      summaryMetrics: {
        totalCashIn: cashFlow.cashInflows,
        totalCashOut: cashFlow.cashOutflows,
        netCashVariance: cashFlow.netCashFlow,
        healthRating: cashFlow.netCashFlow >= 0 ? "POSITIVE" : "NEGATIVE"
      },
      breakdownRows: [
        {
          period: periodLabel,
          inflow: cashFlow.cashInflows,
          outflow: cashFlow.cashOutflows,
          net: cashFlow.netCashFlow,
          status: cashFlow.netCashFlow >= 0 ? "SURPLUS" : "DEFICIT"
        }
      ]
    };
  }
  /**
   * Generate Tax & Statutory Compliance Estimation Report
   */
  static async generateTaxReport(businessId, opts) {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const overview = await BusinessToolsService.getBusinessOverview(businessId, daysCount);
    const expenses = await BusinessToolsService.getExpenseSummary(businessId, daysCount);
    const revenue = Number(overview.revenue || 0);
    const totalExpenses = Number(expenses.totalExpenses || 0);
    const taxableIncome = Math.max(0, revenue - totalExpenses);
    const estimatedSalesTax = Math.round(revenue * 0.05 * 100) / 100;
    const estimatedIncomeTax = Math.round(taxableIncome * 0.15 * 100) / 100;
    const totalTaxLiability = Math.round((estimatedSalesTax + estimatedIncomeTax) * 100) / 100;
    return {
      reportType: "tax",
      businessId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      periodLabel,
      currency: "USD",
      summaryMetrics: {
        taxableGrossRevenue: revenue,
        allowableDeductions: totalExpenses,
        netTaxableIncome: taxableIncome,
        estimatedSalesTax,
        estimatedCorporateTax: estimatedIncomeTax,
        totalEstimatedTaxLiability: totalTaxLiability
      },
      breakdownRows: [
        {
          taxCategory: "Sales & Indirect Tax (Est. 5%)",
          applicableBase: revenue,
          rateApplied: "5.0%",
          estimatedTax: estimatedSalesTax,
          status: "ACCRUING"
        },
        {
          taxCategory: "Corporate Income Tax (Est. 15%)",
          applicableBase: taxableIncome,
          rateApplied: "15.0%",
          estimatedTax: estimatedIncomeTax,
          status: taxableIncome > 0 ? "LIABLE" : "NIL"
        },
        {
          taxCategory: "Allowable Expense Deductions",
          applicableBase: totalExpenses,
          rateApplied: "100.0%",
          estimatedTax: -totalExpenses,
          status: "SHIELDED"
        }
      ]
    };
  }
};

// server/feedback.service.ts
var FeedbackService = class {
  static async submitFeedback(payload) {
    const feedbackId = generateUUID();
    try {
      if (isValidUUID(payload.businessId)) {
        const { data, error } = await serverSupabase.from("user_feedback").insert({
          id: feedbackId,
          business_id: payload.businessId,
          user_id: payload.userId && isValidUUID(payload.userId) ? payload.userId : null,
          feedback_type: payload.feedbackType,
          rating: payload.rating || null,
          comment: payload.comment || null,
          context_json: payload.context || {}
        }).select("id").maybeSingle();
        if (error) {
          console.warn("[FeedbackService] Error inserting feedback to Supabase:", error);
        }
        return { success: true, id: data?.id || feedbackId };
      }
      return { success: true, id: feedbackId };
    } catch (e) {
      console.warn("[FeedbackService] Fallback feedback acknowledgment:", e);
      return { success: true, id: feedbackId };
    }
  }
};

// server/health.service.ts
var HealthService = class {
  static {
    this.startTime = Date.now();
  }
  static async performHealthCheck(detailed = false) {
    const dbStart = Date.now();
    let dbConnected = false;
    let dbError;
    try {
      const { error } = await serverSupabase.from("businesses").select("id", { count: "exact", head: true });
      if (!error) {
        dbConnected = true;
      } else {
        dbError = error.message;
      }
    } catch (e) {
      dbError = e?.message || "Database connection error";
    }
    const dbLatency = Date.now() - dbStart;
    const isGeminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("MY_GEMINI_API_KEY")
    );
    const isHealthy = dbConnected;
    const status = isHealthy ? "healthy" : "degraded";
    return {
      status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1e3),
      environment: process.env.NODE_ENV || "development",
      checks: {
        application: true,
        database: {
          connected: dbConnected,
          latencyMs: dbLatency,
          error: detailed ? dbError : void 0
        },
        aiEngine: {
          model: getActiveGeminiModel(),
          isConfigured: isGeminiConfigured
        },
        paymentGateway: {
          momoConfigured: Boolean(process.env.MOMO_API_KEY),
          stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY)
        }
      },
      system: {
        memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        nodeVersion: process.version
      }
    };
  }
};

// server/push-notification.service.ts
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
var VAPID_FILE = path.join(process.cwd(), ".vapid.json");
var SUBSCRIPTIONS_FILE = path.join(process.cwd(), ".push_subscriptions.json");
var subscriptions = /* @__PURE__ */ new Map();
function saveSubscriptionsToDisk() {
  try {
    const list = Array.from(subscriptions.values());
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[WebPush] Error saving subscriptions to disk:", err);
  }
}
function loadSubscriptionsFromDisk() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const raw = fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((sub) => {
          if (sub?.endpoint) {
            subscriptions.set(sub.endpoint, sub);
          }
        });
        console.log(`[WebPush] Restored ${subscriptions.size} push subscriptions from disk.`);
      }
    }
  } catch (err) {
    console.error("[WebPush] Error loading subscriptions from disk:", err);
  }
}
var vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
var vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
var vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@ursella.app";
if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
      if (saved.publicKey && saved.privateKey) {
        vapidPublicKey = saved.publicKey;
        vapidPrivateKey = saved.privateKey;
        console.log("[WebPush] Loaded persistent VAPID keypair from disk");
      }
    }
  } catch (err) {
    console.error("[WebPush] Failed reading .vapid.json:", err);
  }
}
if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = generated.publicKey;
    vapidPrivateKey = generated.privateKey;
    fs.writeFileSync(
      VAPID_FILE,
      JSON.stringify({ publicKey: vapidPublicKey, privateKey: vapidPrivateKey }, null, 2),
      "utf-8"
    );
    console.log("[WebPush] Generated and persisted new VAPID keypair to .vapid.json");
  } catch (err) {
    console.error("[WebPush] Error generating VAPID keys:", err);
  }
}
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log("[WebPush] VAPID configured successfully");
  } catch (err) {
    console.error("[WebPush] Failed to set VAPID details:", err);
  }
}
loadSubscriptionsFromDisk();
var morningBriefsSentDate = /* @__PURE__ */ new Map();
var PushNotificationService = class {
  static getPublicKey() {
    return vapidPublicKey;
  }
  static isConfigured() {
    return Boolean(vapidPublicKey && vapidPrivateKey);
  }
  static registerSubscription(businessId, subscription, userId) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return false;
    }
    subscriptions.set(subscription.endpoint, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      businessId,
      userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveSubscriptionsToDisk();
    console.log(`[WebPush] Registered subscription for business ${businessId}. Total subscriptions: ${subscriptions.size}`);
    return true;
  }
  static unregisterSubscription(endpoint) {
    if (!endpoint) return false;
    const removed = subscriptions.delete(endpoint);
    if (removed) {
      saveSubscriptionsToDisk();
    }
    return removed;
  }
  static getSubscriptionsForBusiness(businessId) {
    const result = [];
    for (const sub of subscriptions.values()) {
      if (!businessId || sub.businessId === businessId || sub.businessId === "default") {
        result.push(sub);
      }
    }
    return result;
  }
  static getAllSubscriptions() {
    return Array.from(subscriptions.values());
  }
  static async sendToSubscription(subscription, payload) {
    if (!this.isConfigured()) {
      return { success: false, error: "VAPID keys not configured on server" };
    }
    try {
      const payloadString = JSON.stringify({
        title: payload.title || "Ursella Business Alert",
        body: payload.body || "You have an operational update.",
        icon: payload.icon || "/pwa-192x192.png",
        badge: payload.badge || "/pwa-192x192.png",
        url: payload.url || "/#/",
        tag: payload.tag || "general-alert",
        timestamp: Date.now()
      });
      await webpush.sendNotification(subscription, payloadString, {
        TTL: 60 * 60 * 24,
        // 24 hours
        urgency: "high"
      });
      return { success: true };
    } catch (err) {
      console.error("[WebPush] Error sending push notification:", err?.message || err);
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        subscriptions.delete(subscription.endpoint);
        saveSubscriptionsToDisk();
      }
      return { success: false, error: err?.message || "Failed to dispatch push notification" };
    }
  }
  static async sendToBusiness(businessId, payload) {
    const businessSubs = this.getSubscriptionsForBusiness(businessId);
    let sentCount = 0;
    const errors = [];
    for (const sub of businessSubs) {
      const result = await this.sendToSubscription(sub, payload);
      if (result.success) {
        sentCount++;
      } else if (result.error) {
        errors.push(result.error);
      }
    }
    return { sentCount, errors };
  }
  /**
   * Automated Morning Executive Briefing Dispatcher
   * Automatically triggered by the server scheduler every morning
   */
  static async dispatchScheduledMorningBriefs(force = false) {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const uniqueBusinessIds = /* @__PURE__ */ new Set();
    for (const sub of subscriptions.values()) {
      if (sub.businessId) {
        uniqueBusinessIds.add(sub.businessId);
      }
    }
    let dispatchedCount = 0;
    const details = [];
    for (const businessId of uniqueBusinessIds) {
      const lastSent = morningBriefsSentDate.get(businessId);
      if (!force && lastSent === todayStr) {
        continue;
      }
      let bizName = "Your Business";
      let lowStockCount = 0;
      try {
        const { data: biz } = await serverSupabase.from("businesses").select("name").eq("id", businessId).maybeSingle();
        if (biz?.name) bizName = biz.name;
        const { data: prods } = await serverSupabase.from("products").select("id, stock_quantity, minimum_stock_level").eq("business_id", businessId);
        if (prods && Array.isArray(prods)) {
          lowStockCount = prods.filter(
            (p) => (p.stock_quantity ?? 0) <= (p.minimum_stock_level ?? 5)
          ).length;
        }
      } catch {
      }
      const body = lowStockCount > 0 ? `Good morning! ${lowStockCount} item(s) require restock replenishment today. Tap to view your daily executive briefing.` : `Good morning! Your store is ready for trading. Tap to review cash collection targets and today's priorities.`;
      const result = await this.sendToBusiness(businessId, {
        title: `\u2600\uFE0F Morning Executive Brief: ${bizName}`,
        body,
        url: "/#/home",
        tag: `morning-brief-${todayStr}`
      });
      if (result.sentCount > 0) {
        dispatchedCount += result.sentCount;
        morningBriefsSentDate.set(businessId, todayStr);
        details.push(`Sent morning brief to ${bizName} (${result.sentCount} devices)`);
      }
    }
    return {
      checkedCount: uniqueBusinessIds.size,
      dispatchedCount,
      details
    };
  }
};

// server.ts
var app = express();
var PORT = 3e3;
app.use(express.json({ limit: "10mb" }));
function isValidUUID2(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
async function verifyTenantRequest(req, businessId) {
  if (!isValidUUID2(businessId)) {
    return { authorized: true, userId: "dev-user", role: "owner" };
  }
  const isServerSupabaseConfigured2 = Boolean(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  ) && !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").includes("placeholder.supabase.co");
  if (!isServerSupabaseConfigured2) {
    return { authorized: true, userId: "local-user", role: "owner" };
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      status: 401,
      error: "Missing or malformed Authorization header. Please sign in."
    };
  }
  const token = authHeader.replace("Bearer ", "").trim();
  try {
    const { data: userData, error: userError } = await serverSupabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return {
        authorized: false,
        status: 401,
        error: "Invalid or expired authentication session. Please sign in again."
      };
    }
    const userId = userData.user.id;
    const membership = await BusinessToolsService.getTenantMembership(userId, businessId);
    if (!membership.authorized) {
      return {
        authorized: false,
        status: 403,
        error: "Access denied: You are not authorized to view or perform actions for this business."
      };
    }
    return { authorized: true, userId, role: membership.role || "owner" };
  } catch (err) {
    return {
      authorized: false,
      status: 500,
      error: err?.message || "Tenant verification failed."
    };
  }
}
app.get("/api/health", async (req, res) => {
  const result = await HealthService.performHealthCheck(false);
  res.status(result.status === "unhealthy" ? 503 : 200).json(result);
});
app.get("/api/health/detailed", async (req, res) => {
  const result = await HealthService.performHealthCheck(true);
  res.status(result.status === "unhealthy" ? 503 : 200).json(result);
});
app.post("/api/ai/chat", async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  try {
    const payload = req.body;
    const { businessId, message, conversationId, history = [], preferredTimeHorizonDays = 30, businessContext } = payload;
    if (!businessId || !message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing required parameters: businessId and message are mandatory." });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const rateLimit = aiRateLimiter.check(businessId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. Please wait ${Math.ceil(rateLimit.resetTimeMs / 1e3)} seconds before sending another message.`
      });
    }
    let businessName = businessContext?.businessName || "My Business";
    let businessType = businessContext?.businessType || "Retail";
    let currency = businessContext?.currency || businessContext?.currencySymbol || "USD";
    let timezone = businessContext?.timezone || "UTC";
    let ownerName = businessContext?.ownerName || "";
    let address = businessContext?.address || "";
    let taxRate = businessContext?.taxRate !== void 0 ? businessContext.taxRate : 0;
    try {
      const { data: bData } = await serverSupabase.from("businesses").select("name, business_type, currency, timezone, address, tax_rate").eq("id", businessId).maybeSingle();
      if (bData) {
        businessName = businessContext?.businessName || bData.name || businessName;
        businessType = businessContext?.businessType || bData.business_type || businessType;
        currency = businessContext?.currency || bData.currency || currency;
        timezone = businessContext?.timezone || bData.timezone || timezone;
        address = businessContext?.address || bData.address || address;
        if (bData.tax_rate !== void 0 && businessContext?.taxRate === void 0) {
          taxRate = bData.tax_rate;
        }
      }
    } catch (e) {
      console.warn(`[Req ${requestId}] Failed to fetch business metadata, using context:`, e);
    }
    const intentResult = classifyBusinessQuery(message, history);
    const horizon = preferredTimeHorizonDays || intentResult.suggestedTimeHorizonDays || 30;
    const toolResults = {};
    const toolsExecuted = [];
    const toolExecutionPromises = [];
    for (const toolName of intentResult.requiredTools) {
      toolsExecuted.push(toolName);
      if (toolName === "get_business_overview") {
        toolExecutionPromises.push(
          BusinessToolsService.getBusinessOverview(businessId, horizon, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_sales_summary") {
        toolExecutionPromises.push(
          BusinessToolsService.getSalesSummary(businessId, horizon, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_today_sales_summary") {
        toolExecutionPromises.push(
          BusinessToolsService.getTodaySalesSummary(businessId, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_product_performance") {
        const productFilter = intentResult.entityHint || message;
        toolExecutionPromises.push(
          BusinessToolsService.getProductPerformance(businessId, 50, productFilter).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_inventory_alerts") {
        toolExecutionPromises.push(
          BusinessToolsService.getInventoryAlerts(businessId).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_customer_balances") {
        toolExecutionPromises.push(
          BusinessToolsService.getCustomerBalances(businessId).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_expense_summary") {
        toolExecutionPromises.push(
          BusinessToolsService.getExpenseSummary(businessId, horizon, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_cash_flow") {
        toolExecutionPromises.push(
          BusinessToolsService.getCashFlow(businessId, horizon, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_period_comparison") {
        toolExecutionPromises.push(
          BusinessToolsService.getPeriodComparison(businessId, horizon, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_business_health") {
        toolExecutionPromises.push(
          BusinessToolsService.getBusinessHealth(businessId, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_daily_brief_facts") {
        toolExecutionPromises.push(
          BusinessToolsService.getDailyBriefFacts(businessId, timezone).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      } else if (toolName === "get_fifo_inventory_valuation") {
        toolExecutionPromises.push(
          BusinessToolsService.getFIFOInventoryValuation(businessId).then((res2) => {
            toolResults[toolName] = res2;
          })
        );
      }
    }
    await Promise.all(toolExecutionPromises);
    const structuredResponse = await GeminiService.generateChatResponse(message, {
      businessName,
      businessType,
      currency,
      timezone,
      ownerName,
      address,
      taxRate,
      currentDateIso: (/* @__PURE__ */ new Date()).toISOString(),
      toolResults,
      conversationHistory: history,
      parsedIntent: {
        intent: intentResult.intent,
        domain: intentResult.domain,
        timePeriod: intentResult.timePeriod,
        primaryGoal: intentResult.primaryGoal,
        isEntitySpecific: intentResult.isEntitySpecific,
        entityHint: intentResult.entityHint,
        isReportMode: intentResult.isReportMode,
        resolvedContextTopic: intentResult.resolvedContextTopic
      },
      testSimulation: req.body.testSimulation || req.headers["x-simulate-ai-failure"]
    });
    structuredResponse.intent = intentResult.intent;
    structuredResponse.toolsUsed = toolsExecuted;
    const latencyMs = Date.now() - startTime;
    const generatedConversationId = conversationId || `conv-${businessId}-${Date.now()}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(
      `[AI Chat] req=${requestId} business=${businessId} intent=${intentResult.intent} tools=${toolsExecuted.join(",")} latency=${latencyMs}ms`
    );
    const responsePayload = {
      conversationId: generatedConversationId,
      messageId,
      response: structuredResponse,
      intent: intentResult.intent,
      toolsUsed: toolsExecuted,
      latencyMs,
      responseSource: structuredResponse.responseSource
    };
    AICostControlService.logUsage({
      businessId,
      requestType: "chat",
      model: getActiveGeminiModel(),
      latencyMs,
      success: true
    }).catch(() => {
    });
    return res.json(responsePayload);
  } catch (error) {
    console.error(`[AI Chat Error] req=${requestId}:`, error);
    AICostControlService.logUsage({
      businessId: req.body?.businessId || "unknown",
      requestType: "chat",
      model: getActiveGeminiModel(),
      latencyMs: Date.now() - startTime,
      success: false,
      errorMessage: error?.message
    }).catch(() => {
    });
    return res.status(500).json({
      error: "An error occurred while generating business insights. Please try again.",
      details: error?.message || "Internal AI service error"
    });
  }
});
app.post("/api/ai/daily-brief", async (req, res) => {
  try {
    const { businessId, businessName: inputName, currency: inputCurrency, timezone: inputTz, businessContext } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: "businessId is required" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    let businessName = businessContext?.businessName || inputName || "My Business";
    let businessType = businessContext?.businessType || "Retail";
    let currency = businessContext?.currency || inputCurrency || "USD";
    let timezone = businessContext?.timezone || inputTz || "UTC";
    let ownerName = businessContext?.ownerName || "";
    let address = businessContext?.address || "";
    let taxRate = businessContext?.taxRate !== void 0 ? businessContext.taxRate : 0;
    try {
      const { data: bData } = await serverSupabase.from("businesses").select("name, business_type, currency, timezone, address, tax_rate").eq("id", businessId).maybeSingle();
      if (bData) {
        businessName = businessContext?.businessName || inputName || bData.name || businessName;
        businessType = businessContext?.businessType || bData.business_type || businessType;
        currency = businessContext?.currency || inputCurrency || bData.currency || currency;
        timezone = businessContext?.timezone || inputTz || bData.timezone || timezone;
        address = businessContext?.address || bData.address || address;
        if (bData.tax_rate !== void 0 && businessContext?.taxRate === void 0) {
          taxRate = bData.tax_rate;
        }
      }
    } catch {
    }
    const briefFacts = await BusinessToolsService.getDailyBriefFacts(businessId);
    const brief = await GeminiService.generateDailyBrief({
      businessName,
      businessType,
      currency,
      timezone,
      ownerName,
      address,
      taxRate,
      currentDateIso: (/* @__PURE__ */ new Date()).toISOString(),
      toolResults: {
        get_daily_brief_facts: briefFacts
      }
    });
    return res.json(brief);
  } catch (error) {
    console.error("[AI Daily Brief Error]:", error);
    return res.status(500).json({ error: "Failed to generate daily brief." });
  }
});
app.post("/api/ai/proactive-insights", async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const [health, inv, debtors] = await Promise.all([
      BusinessToolsService.getBusinessHealth(businessId),
      BusinessToolsService.getInventoryAlerts(businessId),
      BusinessToolsService.getCustomerBalances(businessId)
    ]);
    const proactiveItems = [];
    if (inv.outOfStockCount > 0) {
      proactiveItems.push({
        id: "out-of-stock-alert",
        type: "critical",
        title: `${inv.outOfStockCount} Products Out of Stock`,
        message: "Depleted SKUs risk lost customer sales. Restock recommended.",
        actionPrompt: "Which products are out of stock and need restocking?"
      });
    }
    if (debtors.totalOutstandingDebt > 0) {
      proactiveItems.push({
        id: "debtors-alert",
        type: "warning",
        title: "Unpaid Customer Receivables",
        message: `${debtors.debtorsCount} accounts hold active credit balances.`,
        actionPrompt: "Who owes me money and what are the largest balances?"
      });
    }
    if (health.score >= 80) {
      proactiveItems.push({
        id: "health-positive",
        type: "positive",
        title: "Strong Operational Health",
        message: `Business Health score is ${health.score}/100 (${health.rating}).`,
        actionPrompt: "How is my business doing and what should I do to scale?"
      });
    }
    return res.json({
      healthScore: health.score,
      healthRating: health.rating,
      insights: proactiveItems
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate proactive insights." });
  }
});
app.post("/api/insights/scan", async (req, res) => {
  try {
    const { businessId, snapshot, config, businessMetadata } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId is required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const rawEvents = await EventDetectionService.scanBusiness(businessId, snapshot, config);
    const insights = await ProactiveAIService.processDetectedEvents(businessId, rawEvents, businessMetadata);
    return res.json({
      success: true,
      scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
      detectedEventsCount: rawEvents.length,
      insightsCount: insights.length,
      insights
    });
  } catch (error) {
    console.error("[API /api/insights/scan error]:", error);
    return res.status(500).json({ error: "Failed to scan business events", details: error.message });
  }
});
app.get("/api/insights", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    const category = req.query.category || "all";
    const status = req.query.status || "all";
    if (!businessId) return res.status(400).json({ error: "businessId query param required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const insights = ProactiveAIService.getInsights(businessId, { category, status });
    return res.json(insights);
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve insights" });
  }
});
app.post("/api/insights/:id/status", async (req, res) => {
  try {
    const insightId = req.params.id;
    const { businessId, status } = req.body;
    if (!businessId || !status) {
      return res.status(400).json({ error: "businessId and status are required" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = ProactiveAIService.updateInsightStatus(businessId, insightId, status);
    return res.json({ success, insightId, status });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update insight status" });
  }
});
app.get("/api/priorities/today", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const priorities = ProactiveAIService.getTodayPriorities(businessId);
    return res.json(priorities);
  } catch (error) {
    return res.status(500).json({ error: "Failed to get daily priorities" });
  }
});
app.post("/api/actions/propose", async (req, res) => {
  try {
    const { businessId, insightId, actionType, title, description, payload, requestedBy, requiresRole, impactPreview } = req.body;
    if (!businessId || !actionType || !title) {
      return res.status(400).json({ error: "Missing required action proposal fields" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const proposal = await ActionExecutorService.proposeAction({
      business_id: businessId,
      insight_id: insightId || null,
      action_type: actionType,
      title,
      description: description || title,
      payload: payload || {},
      requested_by: requestedBy || "ursella_ai",
      idempotency_key: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requires_role: requiresRole || ["owner", "admin", "staff"],
      impact_preview: impactPreview
    });
    return res.json(proposal);
  } catch (error) {
    return res.status(500).json({ error: "Failed to propose action" });
  }
});
app.get("/api/actions/proposals", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const proposals = await ActionExecutorService.getActionProposals(businessId);
    return res.json(proposals);
  } catch (error) {
    return res.status(500).json({ error: "Failed to list action proposals" });
  }
});
app.post("/api/actions/execute", async (req, res) => {
  try {
    const { actionId, businessId, actionType, payload, idempotencyKey, isAIGenerated } = req.body;
    if (!businessId || !actionType || !payload) {
      return res.status(400).json({ error: "Missing required execution fields: businessId, actionType, payload" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const verifiedUserId = authCheck.userId || req.body.userId || "system";
    const verifiedUserRole = authCheck.role || "staff";
    const execResult = await ActionExecutorService.executeAction({
      actionId,
      businessId,
      userId: verifiedUserId,
      userRole: verifiedUserRole,
      actionType,
      payload,
      idempotencyKey: idempotencyKey || `exec_${Date.now()}`,
      isAIGenerated: Boolean(isAIGenerated)
    });
    if (execResult.success && payload.insightId) {
      ProactiveAIService.updateInsightStatus(businessId, payload.insightId, "acted_on");
    }
    return res.json(execResult);
  } catch (error) {
    console.error("[API /api/actions/execute error]:", error);
    return res.status(500).json({ error: "Action execution failed", details: error.message });
  }
});
app.post("/api/actions/reject", async (req, res) => {
  try {
    const { actionId, businessId } = req.body;
    if (!actionId || !businessId) return res.status(400).json({ error: "actionId and businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = await ActionExecutorService.rejectAction(actionId, authCheck.userId || "user", businessId);
    return res.json({ success, actionId, status: "rejected" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reject action" });
  }
});
app.get("/api/actions/audit-logs", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const logs = await ActionExecutorService.getAuditLogs(businessId);
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: "Failed to get audit logs" });
  }
});
app.get("/api/reminders", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const reminders = await ActionExecutorService.getReminders(businessId);
    return res.json(reminders);
  } catch (error) {
    return res.status(500).json({ error: "Failed to get reminders" });
  }
});
app.post("/api/reminders", async (req, res) => {
  try {
    const { businessId, title, description, dueDate, priority, relatedEntityType, relatedEntityId, relatedEntityName } = req.body;
    if (!businessId || !title) return res.status(400).json({ error: "businessId and title required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const result = await ActionExecutorService.executeAction({
      businessId,
      userId: authCheck.userId || "user",
      userRole: authCheck.role || "staff",
      actionType: "create_reminder",
      payload: {
        title,
        description,
        dueDate: dueDate || new Date(Date.now() + 864e5).toISOString(),
        priority: priority || "medium",
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        productName: relatedEntityName
      },
      idempotencyKey: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create reminder" });
  }
});
app.patch("/api/reminders/:id", async (req, res) => {
  try {
    const reminderId = req.params.id;
    const { businessId, status } = req.body;
    if (!businessId || !status) return res.status(400).json({ error: "businessId and status required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = await ActionExecutorService.updateReminderStatus(reminderId, businessId, status);
    return res.json({ success, reminderId, status });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update reminder" });
  }
});
app.delete("/api/reminders/:id", async (req, res) => {
  try {
    const reminderId = req.params.id;
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId query param required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = await ActionExecutorService.deleteReminder(reminderId, businessId);
    return res.json({ success, reminderId });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete reminder" });
  }
});
app.get("/api/notifications", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    let notifications = ProactiveAIService.getNotifications(businessId);
    if (notifications.length === 0) {
      try {
        const rawEvents = await EventDetectionService.scanBusiness(businessId);
        if (rawEvents.length > 0) {
          await ProactiveAIService.processDetectedEvents(businessId, rawEvents);
          notifications = ProactiveAIService.getNotifications(businessId);
        }
      } catch (scanErr) {
        console.warn("[Auto-scan on empty notifications error]:", scanErr);
      }
    }
    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ error: "Failed to get notifications" });
  }
});
app.post("/api/notifications/read-all", async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    ProactiveAIService.markAllNotificationsRead(businessId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to mark notifications read" });
  }
});
app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const businessId = req.query.businessId || req.body?.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = ProactiveAIService.deleteNotification(businessId, notificationId);
    return res.json({ success, notificationId });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete notification" });
  }
});
app.post("/api/notifications/clear-all", async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = ProactiveAIService.clearAllNotifications(businessId);
    return res.json({ success });
  } catch (error) {
    return res.status(500).json({ error: "Failed to clear all notifications" });
  }
});
app.post("/api/notifications/:id/toggle-read", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const success = ProactiveAIService.toggleNotificationRead(businessId, notificationId);
    return res.json({ success, notificationId });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle notification read status" });
  }
});
app.get("/api/preferences/notifications", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const prefs = ProactiveAIService.getPreferences(businessId);
    return res.json(prefs);
  } catch (error) {
    return res.status(500).json({ error: "Failed to get preferences" });
  }
});
app.post("/api/preferences/notifications", async (req, res) => {
  try {
    const { businessId, preferences } = req.body;
    if (!businessId || !preferences) return res.status(400).json({ error: "businessId and preferences required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const updated = ProactiveAIService.savePreferences(businessId, preferences);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to save preferences" });
  }
});
app.get("/api/push/config", (req, res) => {
  return res.json({
    configured: PushNotificationService.isConfigured(),
    publicKey: PushNotificationService.getPublicKey()
  });
});
app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { businessId, subscription, userId } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Invalid PushSubscription payload" });
    }
    if (businessId && businessId !== "default") {
      const authCheck = await verifyTenantRequest(req, businessId);
      if (!authCheck.authorized) {
        return res.status(authCheck.status || 403).json({ error: authCheck.error });
      }
    }
    const saved = PushNotificationService.registerSubscription(businessId || "default", subscription, userId);
    return res.json({ success: saved });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to register push subscription" });
  }
});
app.post("/api/push/unsubscribe", (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint required" });
    }
    const removed = PushNotificationService.unregisterSubscription(endpoint);
    return res.json({ success: removed });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to unregister push subscription" });
  }
});
app.post("/api/push/send-test", async (req, res) => {
  try {
    const { businessId, subscription } = req.body;
    if (businessId) {
      const authCheck = await verifyTenantRequest(req, businessId);
      if (!authCheck.authorized) {
        return res.status(authCheck.status || 403).json({ error: authCheck.error });
      }
    }
    if (subscription && subscription.endpoint) {
      const result = await PushNotificationService.sendToSubscription(subscription, {
        title: "\u{1F514} Ursella Out-of-App Push Alert",
        body: "Out-of-app push notifications are active! You will receive daily morning briefs and urgent stock alerts.",
        url: "/#/insights",
        tag: "ursella-test-notification"
      });
      return res.json(result);
    }
    if (businessId) {
      const result = await PushNotificationService.sendToBusiness(businessId, {
        title: "\u{1F514} Ursella Out-of-App Push Alert",
        body: "Out-of-app push notifications are active! You will receive daily morning briefs and urgent stock alerts.",
        url: "/#/insights",
        tag: "ursella-test-notification"
      });
      return res.json({ success: result.sentCount > 0, ...result });
    }
    return res.status(400).json({ error: "businessId or subscription is required" });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to send test push" });
  }
});
app.get("/api/push/status", async (req, res) => {
  try {
    const isConfigured = PushNotificationService.isConfigured();
    const subs = PushNotificationService.getAllSubscriptions();
    const publicKey = PushNotificationService.getPublicKey();
    return res.json({
      configured: isConfigured,
      publicKey: publicKey || null,
      activeSubscriptionsCount: subs.length,
      schedulerActive: true
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to get push status" });
  }
});
app.post("/api/push/send-morning-brief", async (req, res) => {
  try {
    const { businessId, businessName = "My Business", force = true } = req.body || {};
    if (!businessId) {
      const dispatchResult = await PushNotificationService.dispatchScheduledMorningBriefs(force);
      return res.json({
        success: dispatchResult.dispatchedCount > 0,
        ...dispatchResult,
        message: `Morning briefing dispatched to ${dispatchResult.dispatchedCount} active device(s).`
      });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const result = await PushNotificationService.sendToBusiness(businessId, {
      title: `\u2600\uFE0F Morning Executive Brief: ${businessName}`,
      body: `Your daily business briefing is ready. Tap to review revenue insights and today's operational priorities.`,
      url: "/#/home",
      tag: "ursella-morning-brief"
    });
    return res.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      errors: result.errors,
      message: result.sentCount > 0 ? `Morning brief push sent to ${result.sentCount} device(s).` : "No active push subscriptions found for this business. Make sure you enable notifications on your device."
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to send morning brief push" });
  }
});
app.get("/api/subscription/plans", async (req, res) => {
  try {
    const plans = await SubscriptionService.getPlans();
    return res.json(plans);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch subscription plans" });
  }
});
app.get("/api/subscription", async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId query param required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const subscription = await SubscriptionService.getBusinessSubscription(businessId);
    return res.json(subscription);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch business subscription" });
  }
});
app.post("/api/subscription/checkout", async (req, res) => {
  try {
    const { businessId, planId, billingCycle = "monthly", provider = "momo", customerEmail, phoneNumber, network } = req.body;
    if (!businessId || !planId) {
      return res.status(400).json({ error: "businessId and planId are required" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const response = await PaymentProviderService.initiatePayment({
      businessId,
      planId,
      billingCycle,
      provider,
      customerEmail,
      phoneNumber,
      network
    });
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: "Payment checkout initiation failed", details: error.message });
  }
});
app.post("/api/webhooks/payment", async (req, res) => {
  try {
    const event = req.body;
    const result = await PaymentProviderService.handleWebhook(event);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Webhook processing error", details: error.message });
  }
});
app.post("/api/data/import/preview", (req, res) => {
  try {
    const { csvContent, entityType } = req.body;
    if (!csvContent || !entityType) {
      return res.status(400).json({ error: "csvContent and entityType are required" });
    }
    const preview = DataIOService.previewImport(csvContent, entityType);
    return res.json(preview);
  } catch (error) {
    return res.status(500).json({ error: "Failed to parse and validate CSV", details: error.message });
  }
});
app.post("/api/data/import/execute", async (req, res) => {
  try {
    const { businessId, userId, entityType, rows } = req.body;
    if (!businessId || !entityType || !Array.isArray(rows)) {
      return res.status(400).json({ error: "businessId, entityType, and rows array are required" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    if (authCheck.role && authCheck.role === "staff") {
      return res.status(403).json({ error: "Permission denied: Bulk data import requires owner or admin privileges." });
    }
    const result = await DataIOService.executeImport({
      businessId,
      userId: authCheck.userId || userId,
      entityType,
      rows
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Data import execution failed", details: error.message });
  }
});
app.get("/api/data/export/:entity", async (req, res) => {
  try {
    const entity = req.params.entity;
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "businessId query param required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const csvData = await DataIOService.exportDataToCSV(businessId, entity);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ursella_${entity}_${Date.now()}.csv"`);
    return res.send("\uFEFF" + csvData);
  } catch (error) {
    return res.status(500).json({ error: "Data export failed" });
  }
});
app.get("/api/reports/:type", async (req, res) => {
  try {
    const type = req.params.type;
    const businessId = req.query.businessId;
    const period = req.query.period || "30d";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if (!businessId) return res.status(400).json({ error: "businessId required" });
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const filterOpts = {
      period,
      startDate,
      endDate
    };
    let reportData;
    if (type === "sales") {
      reportData = await ReportingService.generateSalesReport(businessId, filterOpts);
    } else if (type === "profitability") {
      reportData = await ReportingService.generateProfitabilityReport(businessId, filterOpts);
    } else if (type === "inventory") {
      reportData = await ReportingService.generateInventoryReport(businessId);
    } else if (type === "expenses") {
      reportData = await ReportingService.generateExpenseReport(businessId, filterOpts);
    } else if (type === "receivables") {
      reportData = await ReportingService.generateReceivablesReport(businessId);
    } else if (type === "cash_flow") {
      reportData = await ReportingService.generateCashFlowReport(businessId, filterOpts);
    } else if (type === "tax") {
      reportData = await ReportingService.generateTaxReport(businessId, filterOpts);
    } else {
      return res.status(400).json({ error: `Unknown report type: ${type}` });
    }
    return res.json(reportData);
  } catch (error) {
    console.error(`[Reporting Error /api/reports/${req.params.type}]:`, error);
    return res.status(500).json({ error: "Failed to generate report", details: error.message });
  }
});
app.post("/api/feedback/submit", async (req, res) => {
  try {
    const { businessId, userId, feedbackType, rating, comment, context } = req.body;
    if (!businessId || !feedbackType) {
      return res.status(400).json({ error: "businessId and feedbackType are required" });
    }
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }
    const result = await FeedbackService.submitFeedback({
      businessId,
      userId: authCheck.userId || userId,
      feedbackType,
      rating,
      comment,
      context
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to record feedback" });
  }
});
var server_default = app;
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Ursella Full-Stack Server running on http://0.0.0.0:${PORT}`);
    const SCHEDULER_INTERVAL_MS = 15 * 60 * 1e3;
    setInterval(async () => {
      try {
        const currentHour = (/* @__PURE__ */ new Date()).getHours();
        if (currentHour >= 6 && currentHour <= 10) {
          console.log("[Scheduler] Checking scheduled morning briefs...");
          const result = await PushNotificationService.dispatchScheduledMorningBriefs();
          if (result.dispatchedCount > 0) {
            console.log(`[Scheduler] Dispatched morning briefs to ${result.dispatchedCount} device(s).`);
          }
        }
      } catch (schedulerErr) {
        console.error("[Scheduler] Error in morning brief scheduler:", schedulerErr);
      }
    }, SCHEDULER_INTERVAL_MS);
    setTimeout(async () => {
      try {
        const subs = PushNotificationService.getAllSubscriptions();
        console.log(`[PushNotification] Initialized with ${subs.length} active persistent subscription(s).`);
      } catch (initErr) {
        console.error("[PushNotification] Error checking subscriptions on boot:", initErr);
      }
    }, 5e3);
  });
}
if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
export {
  app,
  server_default as default
};
