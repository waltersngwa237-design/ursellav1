import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import { OfflineSyncService } from './offline-sync.service.ts';
import { InventoryService } from './inventory.service.ts';
import type {
  PaymentMethodType,
  PaymentStatusType,
  SaleStatusType,
} from '../types/database.types.ts';
import type {
  Sale,
  SaleItem,
  SaleWithDetails,
  Payment,
  Product,
  InventoryTransaction,
} from '../types/index.ts';

const LOCAL_SALES_PREFIX = 'ursella_sales_';
const LOCAL_SALE_ITEMS_PREFIX = 'ursella_sale_items_';
const LOCAL_PAYMENTS_PREFIX = 'ursella_payments_';
const LOCAL_PRODUCTS_PREFIX = 'ursella_products_';
const LOCAL_INVENTORY_PREFIX = 'ursella_inventory_txs_';

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface CompleteSaleParams {
  business_id: string;
  customer_id?: string | null;
  items: SaleItemInput[];
  discount?: number;
  tax?: number;
  payment_amount?: number;
  payment_method?: PaymentMethodType;
  payment_reference?: string | null;
  notes?: string | null;
}

export interface SalesFilterOptions {
  search?: string;
  customerId?: string;
  paymentStatus?: PaymentStatusType | 'all';
  saleStatus?: SaleStatusType | 'all';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Service to execute atomic sale transactions and manage sales records.
 */
export const SalesService = {
  /**
   * Process a complete sale atomically.
   */
  async processSale(
    params: CompleteSaleParams
  ): Promise<{ sale_id: string | null; error: Error | null }> {
    try {
      if (!params.items || params.items.length === 0) {
        throw new Error('A sale must include at least one item.');
      }

      for (const item of params.items) {
        if (!item.quantity || item.quantity <= 0) {
          throw new Error('All sale items must have a quantity greater than zero.');
        }
        if (item.unit_price < 0) {
          throw new Error('Unit price cannot be negative.');
        }
      }

      const sanitizedCustomerId = params.customer_id && isValidUUID(params.customer_id)
        ? params.customer_id
        : null;

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (isSupabaseConfigured && isValidUUID(params.business_id) && isOnline) {
        try {
          const { data, error } = await (supabase as any).rpc('process_complete_sale', {
            p_business_id: params.business_id,
            p_customer_id: sanitizedCustomerId,
            p_items: params.items,
            p_discount: params.discount ?? 0.0,
            p_tax: params.tax ?? 0.0,
            p_payment_amount: params.payment_amount ?? 0.0,
            p_payment_method: params.payment_method ?? 'cash',
            p_payment_reference: params.payment_reference || null,
            p_notes: params.notes || null,
          });

          if (error) {
            // If it's a domain validation error (e.g. insufficient stock in DB), return the error
            if (error.message && (error.message.includes('Insufficient stock') || error.message.includes('archived'))) {
              return { sale_id: null, error: new Error(error.message) };
            }
            console.warn('[SalesService] Supabase RPC failed, executing offline and queueing sync:', error.message);
          } else {
            const saleId = typeof data === 'string' ? data : (data?.sale_id || data?.id || (data ? String(data) : null));
            return { sale_id: saleId, error: null };
          }
        } catch (rpcErr) {
          console.warn('[SalesService] Network error during sale RPC, executing offline:', rpcErr);
        }
      }

      // Fallback local transactional execution with strict stock deduction & snapshot preservation
      const prodKey = `${LOCAL_PRODUCTS_PREFIX}${params.business_id}`;
        const prodStored = localStorage.getItem(prodKey);
        const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];

        // 1. Stock Validation Check
        for (const item of params.items) {
          const p = prods.find((x) => x.id === item.product_id);
          if (!p) {
            throw new Error(`Product not found in catalog.`);
          }
          if (!p.is_active) {
            throw new Error(`Product "${p.name}" is archived and cannot be sold.`);
          }
          if (p.product_type !== 'service' && p.stock_quantity < item.quantity) {
            throw new Error(
              `Insufficient stock for "${p.name}". Requested: ${item.quantity}, Available: ${p.stock_quantity}.`
            );
          }
        }

        // 2. Calculations
        let subtotal = 0;
        const now = new Date().toISOString();
        const saleId = generateUUID();
        const saleItemsToInsert: SaleItem[] = [];

        for (const item of params.items) {
          const p = prods.find((x) => x.id === item.product_id)!;
          const itemSubtotal = item.unit_price * item.quantity;
          const itemDiscount = item.discount || 0;
          const itemTotal = Math.max(0, itemSubtotal - itemDiscount);
          subtotal += itemTotal;

          saleItemsToInsert.push({
            id: generateUUID(),
            sale_id: saleId,
            business_id: params.business_id,
            product_id: p.id,
            product_name_snapshot: p.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            unit_cost: p.cost_price,
            discount: itemDiscount,
            subtotal: itemSubtotal,
            total: itemTotal,
            unit_of_measure: p.unit_of_measure || 'piece',
            created_at: now,
          });

          // Decrement stock in catalog if not a service
          if (p.product_type !== 'service') {
            p.stock_quantity -= item.quantity;
            p.updated_at = now;
          }
        }

        const discount = params.discount || 0;
        const tax = params.tax || 0;
        const calculatedTotal = Math.max(0, subtotal - discount + tax);
        const amountPaid = Math.min(calculatedTotal, Math.max(0, params.payment_amount || 0));
        const amountDue = Math.max(0, calculatedTotal - amountPaid);

        let paymentStatus: PaymentStatusType = 'unpaid';
        if (amountPaid >= calculatedTotal && calculatedTotal > 0) {
          paymentStatus = 'paid';
        } else if (amountPaid > 0) {
          paymentStatus = 'partial';
        }

        const newSale: Sale = {
          id: saleId,
          business_id: params.business_id,
          customer_id: sanitizedCustomerId,
          subtotal: subtotal,
          discount: discount,
          tax: tax,
          total: calculatedTotal,
          amount_paid: amountPaid,
          amount_due: amountDue,
          payment_status: paymentStatus,
          payment_method: amountPaid > 0 ? params.payment_method || 'cash' : null,
          sale_status: 'completed',
          notes: params.notes || null,
          sold_by: null,
          sold_at: now,
          created_at: now,
          updated_at: now,
        };

        // Save updated products
        localStorage.setItem(prodKey, JSON.stringify(prods));

        // Save sale
        const salesKey = `${LOCAL_SALES_PREFIX}${params.business_id}`;
        const salesStored = localStorage.getItem(salesKey);
        const salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];
        salesList.unshift(newSale);
        localStorage.setItem(salesKey, JSON.stringify(salesList));

        // Save sale items
        const itemsKey = `${LOCAL_SALE_ITEMS_PREFIX}${params.business_id}`;
        const itemsStored = localStorage.getItem(itemsKey);
        const itemsList: SaleItem[] = itemsStored ? JSON.parse(itemsStored) : [];
        itemsList.push(...saleItemsToInsert);
        localStorage.setItem(itemsKey, JSON.stringify(itemsList));

        // Record inventory ledger
        const invKey = `${LOCAL_INVENTORY_PREFIX}${params.business_id}`;
        const invStored = localStorage.getItem(invKey);
        const invList: InventoryTransaction[] = invStored ? JSON.parse(invStored) : [];

        for (const item of saleItemsToInsert) {
          const prod = prods.find((x) => x.id === item.product_id);
          if (prod?.product_type === 'service') {
            continue; // Skip services from inventory movements
          }
          invList.unshift({
            id: generateUUID(),
            business_id: params.business_id,
            product_id: item.product_id,
            transaction_type: 'sale',
            quantity: item.quantity,
            unit_cost: item.unit_cost ?? null,
            reference_type: 'sale',
            reference_id: saleId,
            notes: `Sale #${saleId.substring(0, 8)} deduction`,
            created_by: null,
            created_at: now,
          });
        }
        localStorage.setItem(invKey, JSON.stringify(invList));

        // Record payment if made
        if (amountPaid > 0) {
          const payKey = `${LOCAL_PAYMENTS_PREFIX}${params.business_id}`;
          const payStored = localStorage.getItem(payKey);
          const payList: Payment[] = payStored ? JSON.parse(payStored) : [];
          payList.unshift({
            id: generateUUID(),
            business_id: params.business_id,
            sale_id: saleId,
            customer_id: sanitizedCustomerId,
            amount: amountPaid,
            payment_method: params.payment_method || 'cash',
            reference: params.payment_reference || null,
            notes: params.notes || 'Point of Sale Initial Payment',
            received_by: null,
            paid_at: now,
            created_at: now,
          });
          localStorage.setItem(payKey, JSON.stringify(payList));
        }

        // If Supabase is configured for this business, enqueue for automatic background sync
        if (isSupabaseConfigured && isValidUUID(params.business_id)) {
          try {
            OfflineSyncService.enqueue('sale', params.business_id, params);
          } catch (e) {
            console.warn('[SalesService] Failed to enqueue offline sync:', e);
          }
        }

        return { sale_id: saleId, error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to process sale.');
      return { sale_id: null, error };
    }
  },

  /**
   * Fetch list of sales with item previews and customer info.
   */
  async getSales(businessId: string, options: SalesFilterOptions = {}): Promise<SaleWithDetails[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        let query = (supabase as any)
          .from('sales')
          .select(`
            *,
            customers ( id, name, phone, email ),
            sale_items (
              *,
              products ( id, name, sku )
            ),
            payments ( * )
          `)
          .eq('business_id', businessId)
          .order('sold_at', { ascending: false });

        if (options.customerId && isValidUUID(options.customerId)) {
          query = query.eq('customer_id', options.customerId);
        }

        if (options.paymentStatus && options.paymentStatus !== 'all') {
          query = query.eq('payment_status', options.paymentStatus);
        }

        if (options.saleStatus && options.saleStatus !== 'all') {
          query = query.eq('sale_status', options.saleStatus);
        }

        if (options.startDate) {
          query = query.gte('sold_at', options.startDate);
        }

        if (options.endDate) {
          query = query.lte('sold_at', options.endDate);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Error fetching sales from Supabase, checking local cache:', error.message);
          throw error;
        }

        let sales: SaleWithDetails[] = (data || []).map((s: any) => ({
          ...s,
          subtotal: Number(s.subtotal) || 0,
          discount: Number(s.discount) || 0,
          tax: Number(s.tax) || 0,
          total: Number(s.total) || 0,
          amount_paid: Number(s.amount_paid) || 0,
          amount_due: Number(s.amount_due) || 0,
          sale_items: (s.sale_items || []).map((si: any) => ({
            ...si,
            quantity: Number(si.quantity) || 0,
            unit_price: Number(si.unit_price) || 0,
            unit_cost: Number(si.unit_cost) || 0,
            discount: Number(si.discount) || 0,
            subtotal: Number(si.subtotal) || 0,
            total: Number(si.total) || 0,
          })),
        }));

        // Cache sales snapshot for offline access if this is a general query
        if (sales.length > 0 && !options.customerId && !options.search) {
          try {
            const rawSales = sales.map(({ customers, sale_items, payments, ...rest }) => rest);
            localStorage.setItem(`${LOCAL_SALES_PREFIX}${businessId}`, JSON.stringify(rawSales));
          } catch {}
        }

        if (options.search && options.search.trim()) {
          const q = options.search.trim().toLowerCase();
          sales = sales.filter(
            (s) =>
              s.id.toLowerCase().includes(q) ||
              (s.customers && s.customers.name.toLowerCase().includes(q)) ||
              (s.notes && s.notes.toLowerCase().includes(q)) ||
              s.sale_items.some((i) => i.product_name_snapshot.toLowerCase().includes(q))
          );
        }

        if (sales.length > 0) {
          return sales;
        }
        const localSales = localStorage.getItem(`${LOCAL_SALES_PREFIX}${businessId}`);
        if (!localSales) {
          return sales;
        }
      } catch (err) {
        console.warn('[SalesService] Supabase getSales offline, falling back to local storage:', err);
      }
    }

    const salesKey = `${LOCAL_SALES_PREFIX}${businessId}`;
      const salesStored = localStorage.getItem(salesKey);
      let salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];

      const itemsKey = `${LOCAL_SALE_ITEMS_PREFIX}${businessId}`;
      const itemsStored = localStorage.getItem(itemsKey);
      const itemsList: SaleItem[] = itemsStored ? JSON.parse(itemsStored) : [];

      const custKey = `ursella_customers_${businessId}`;
      const custStored = localStorage.getItem(custKey);
      const custList: any[] = custStored ? JSON.parse(custStored) : [];

      const payKey = `${LOCAL_PAYMENTS_PREFIX}${businessId}`;
      const payStored = localStorage.getItem(payKey);
      const payList: Payment[] = payStored ? JSON.parse(payStored) : [];

      if (options.customerId) {
        salesList = salesList.filter((s) => s.customer_id === options.customerId);
      }
      if (options.paymentStatus && options.paymentStatus !== 'all') {
        salesList = salesList.filter((s) => s.payment_status === options.paymentStatus);
      }
      if (options.saleStatus && options.saleStatus !== 'all') {
        salesList = salesList.filter((s) => s.sale_status === options.saleStatus);
      }
      if (options.startDate) {
        salesList = salesList.filter(
          (s) => new Date(s.sold_at).getTime() >= new Date(options.startDate!).getTime()
        );
      }
      if (options.endDate) {
        salesList = salesList.filter(
          (s) => new Date(s.sold_at).getTime() <= new Date(options.endDate!).getTime()
        );
      }

      let results: SaleWithDetails[] = salesList.map((s) => {
        const customer = custList.find((c) => c.id === s.customer_id) || null;
        const saleItems = itemsList.filter((i) => i.sale_id === s.id);
        const payments = payList.filter((p) => p.sale_id === s.id);

        return {
          ...s,
          customers: customer
            ? {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
              }
            : null,
          sale_items: saleItems,
          payments: payments,
        };
      });

      if (options.search && options.search.trim()) {
        const q = options.search.trim().toLowerCase();
        results = results.filter(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            (s.customers && s.customers.name.toLowerCase().includes(q)) ||
            (s.notes && s.notes.toLowerCase().includes(q)) ||
            s.sale_items.some((i) => i.product_name_snapshot.toLowerCase().includes(q))
        );
      }

      return results.slice(0, options.limit || 100);
  },

  /**
   * Fetch single sale with all relational metadata and payment receipts.
   */
  async getSaleDetail(businessId: string, saleId: string): Promise<SaleWithDetails | null> {
    if (!businessId || !saleId) return null;

    const list = await this.getSales(businessId, { limit: 1000 });
    return list.find((s) => s.id === saleId) || null;
  },

  /**
   * Cancel / Refund a completed sale safely.
   * Restores inventory quantities, logs a return inventory ledger transaction,
   * updates sale status to 'cancelled', and preserves complete audit trail.
   */
  async cancelSale(businessId: string, saleId: string, reason?: string): Promise<void> {
    if (!businessId || !saleId) {
      throw new Error('Business and Sale ID are required for cancellation.');
    }

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(saleId)) {
      // 1. Fetch sale with items
      const { data: saleData, error: saleErr } = await (supabase as any)
        .from('sales')
        .select(`*, sale_items(*)`)
        .eq('id', saleId)
        .eq('business_id', businessId)
        .single();

      if (saleErr || !saleData) throw new Error('Sale not found.');
      if (saleData.sale_status === 'cancelled') {
        throw new Error('This sale has already been cancelled.');
      }

      // 2. Mark sale as cancelled
      const { error: updErr } = await (supabase as any)
        .from('sales')
        .update({
          sale_status: 'cancelled',
          amount_due: 0.0,
          notes: `${saleData.notes || ''} [CANCELLED: ${reason || 'Customer request'}]`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', saleId);

      if (updErr) throw new Error(updErr.message);

      // 3. Reverse inventory for all sale items
      for (const item of saleData.sale_items || []) {
        if (item.product_id && isValidUUID(item.product_id)) {
          try {
            await InventoryService.recordMovement({
              business_id: businessId,
              product_id: item.product_id,
              type: 'return',
              quantity: item.quantity,
              reference_type: 'sale_cancellation',
              reference_id: saleId,
              notes: `Stock returned due to cancellation of Sale #${saleId.substring(0, 8)}`,
            });
          } catch (err) {
            console.error('Inventory return reversal warning:', err);
          }
        }
      }
    } else {
      const salesKey = `${LOCAL_SALES_PREFIX}${businessId}`;
      const salesStored = localStorage.getItem(salesKey);
      const salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];
      const sIdx = salesList.findIndex((s) => s.id === saleId);
      if (sIdx === -1) throw new Error('Sale not found.');

      if (salesList[sIdx].sale_status === 'cancelled') {
        throw new Error('This sale has already been cancelled.');
      }

      const sale = salesList[sIdx];
      salesList[sIdx] = {
        ...sale,
        sale_status: 'cancelled',
        amount_due: 0.0,
        notes: `${sale.notes || ''} [CANCELLED: ${reason || 'Customer request'}]`.trim(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(salesKey, JSON.stringify(salesList));

      // Re-add stock
      const itemsKey = `${LOCAL_SALE_ITEMS_PREFIX}${businessId}`;
      const itemsStored = localStorage.getItem(itemsKey);
      const itemsList: SaleItem[] = itemsStored ? JSON.parse(itemsStored) : [];
      const thisSaleItems = itemsList.filter((i) => i.sale_id === saleId);

      const prodKey = `${LOCAL_PRODUCTS_PREFIX}${businessId}`;
      const prodStored = localStorage.getItem(prodKey);
      const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];

      const invKey = `${LOCAL_INVENTORY_PREFIX}${businessId}`;
      const invStored = localStorage.getItem(invKey);
      const invList: InventoryTransaction[] = invStored ? JSON.parse(invStored) : [];

      const now = new Date().toISOString();

      for (const item of thisSaleItems) {
        const pIdx = prods.findIndex((p) => p.id === item.product_id);
        if (pIdx !== -1) {
          prods[pIdx].stock_quantity += item.quantity;
          prods[pIdx].updated_at = now;
        }

        invList.unshift({
          id: generateUUID(),
          business_id: businessId,
          product_id: item.product_id,
          transaction_type: 'return',
          quantity: item.quantity,
          unit_cost: item.unit_cost ?? null,
          reference_type: 'sale_cancellation',
          reference_id: saleId,
          notes: `Stock returned due to cancellation of Sale #${saleId.substring(0, 8)}`,
          created_by: null,
          created_at: now,
        });
      }

      localStorage.setItem(prodKey, JSON.stringify(prods));
      localStorage.setItem(invKey, JSON.stringify(invList));
    }
  },
};
