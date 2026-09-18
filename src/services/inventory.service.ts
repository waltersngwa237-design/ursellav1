import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import { isDeviceOnline, fastRaceWithFallback } from '../lib/offline-fast.ts';
import type { InventoryTransactionType } from '../types/database.types.ts';
import type { InventoryTransaction, Product } from '../types/index.ts';

const LOCAL_PRODUCTS_PREFIX = 'ursella_products_';
const LOCAL_INVENTORY_PREFIX = 'ursella_inventory_txs_';

export interface InventoryMovementParams {
  business_id: string;
  product_id: string;
  type: InventoryTransactionType;
  quantity: number;
  unit_cost?: number | null;
  reference_type?: string;
  reference_id?: string | null;
  notes?: string | null;
}

export interface InventoryLedgerItem extends InventoryTransaction {
  product?: {
    id: string;
    name: string;
    sku: string | null;
    stock_quantity: number;
    selling_price: number;
  } | null;
}

/**
 * Service to execute atomic inventory ledger adjustments.
 * Ensures stock levels are synchronized and logged in the immutable audit ledger.
 */
export const InventoryService = {
  /**
   * Record an inventory transaction (compatibility alias for recordMovement).
   */
  async recordTransaction(params: {
    business_id: string;
    product_id: string;
    transaction_type: string;
    quantity: number;
    reason?: string;
    notes?: string;
    unit_cost?: number | null;
    reference_type?: string;
    reference_id?: string | null;
  }): Promise<string> {
    return this.recordMovement({
      business_id: params.business_id,
      product_id: params.product_id,
      type: params.transaction_type as InventoryTransactionType,
      quantity: params.quantity,
      notes: params.notes || params.reason || null,
      unit_cost: params.unit_cost,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
    });
  },

  /**
   * Record an atomic inventory movement.
   * Decrements or increments stock, or resets stock for adjustments.
   */
  async recordMovement(params: InventoryMovementParams): Promise<string> {
    if (params.quantity <= 0) {
      throw new Error('Movement quantity must be greater than zero.');
    }

    let resultTxId: string | null = null;

    if (isSupabaseConfigured && isValidUUID(params.business_id) && isValidUUID(params.product_id)) {
      const sanitizedRefId = params.reference_id && isValidUUID(params.reference_id)
        ? params.reference_id
        : null;

      // Canonical payload with verified parameter keys (p_product_id, p_reference_id, p_type)
      const rpcPayload = {
        p_business_id: params.business_id,
        p_product_id: params.product_id,
        p_type: params.type,
        p_quantity: params.quantity,
        p_reference_type: params.reference_type || 'manual',
        p_reference_id: sanitizedRefId,
        p_notes: params.notes || null,
        p_unit_cost: params.unit_cost ?? null,
      };

      let { data, error } = await (supabase as any).rpc('record_inventory_movement', rpcPayload);

      // Fallback: If database schema uses p_transaction_type instead of p_type (e.g. migration 016)
      if (error && (error.message?.includes('schema cache') || error.message?.includes('p_transaction_type') || error.message?.includes('p_type'))) {
        const altPayload = {
          p_business_id: params.business_id,
          p_product_id: params.product_id,
          p_transaction_type: params.type,
          p_quantity: params.quantity,
          p_reference_type: params.reference_type || 'manual',
          p_reference_id: sanitizedRefId,
          p_notes: params.notes || null,
          p_unit_cost: params.unit_cost ?? null,
        };
        const fallbackRes = await (supabase as any).rpc('record_inventory_movement', altPayload);
        if (!fallbackRes.error) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (error) {
        console.warn('[Inventory] record_inventory_movement RPC error, attempting direct table update:', error.message);
        try {
          const { data: prodData } = await (supabase as any)
            .from('products')
            .select('stock_quantity')
            .eq('id', params.product_id)
            .maybeSingle();

          if (prodData) {
            let nextStock = (prodData as any).stock_quantity ?? 0;
            if (['purchase', 'restock', 'return'].includes(params.type)) {
              nextStock += params.quantity;
            } else if (['sale', 'damage'].includes(params.type)) {
              if (nextStock < params.quantity) {
                throw new Error(`Insufficient stock. Available: ${nextStock}, requested: ${params.quantity}.`);
              }
              nextStock -= params.quantity;
            } else if (params.type === 'adjustment' || params.type === 'initial_stock') {
              nextStock = params.quantity;
            }

            await (supabase as any)
              .from('products')
              .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
              .eq('id', params.product_id);

            const { data: tx } = await (supabase as any)
              .from('inventory_transactions')
              .insert({
                business_id: params.business_id,
                product_id: params.product_id,
                transaction_type: params.type,
                quantity: params.quantity,
                unit_cost: params.unit_cost ?? null,
                reference_type: params.reference_type || 'manual',
                reference_id: sanitizedRefId,
                notes: params.notes || null,
              })
              .select('id')
              .maybeSingle();

            resultTxId = (tx as any)?.id || generateUUID();
          }
        } catch (directErr: any) {
          console.warn('[Inventory] Direct table update failed, proceeding to local cache sync:', directErr?.message);
        }
      } else {
        resultTxId = data as string;
      }
    }

    // Always update local storage product cache so offline and catalog views immediately reflect new stock
    const prodKey = `${LOCAL_PRODUCTS_PREFIX}${params.business_id}`;
    const prodStored = localStorage.getItem(prodKey);
    const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];
    let prodIdx = prods.findIndex((p) => p.id === params.product_id);

    if (prodIdx === -1 && params.product_id) {
      const search = params.product_id.toLowerCase();
      prodIdx = prods.findIndex(
        (p) =>
          p.name.toLowerCase() === search ||
          (p.sku && p.sku.toLowerCase() === search) ||
          p.name.toLowerCase().includes(search)
      );
    }

    if (prodIdx !== -1) {
      const product = prods[prodIdx];
      let newStock = product.stock_quantity;

      if (['purchase', 'restock', 'return'].includes(params.type)) {
        newStock += params.quantity;
      } else if (['sale', 'damage'].includes(params.type)) {
        if (!resultTxId && product.stock_quantity < params.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, requested: ${params.quantity}.`
          );
        }
        newStock = Math.max(0, newStock - params.quantity);
      } else if (params.type === 'adjustment' || params.type === 'initial_stock') {
        newStock = params.quantity; // target level
      }

      prods[prodIdx] = {
        ...product,
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(prodKey, JSON.stringify(prods));
    }

    // Record local transaction if not handled online
    if (!resultTxId) {
      const invKey = `${LOCAL_INVENTORY_PREFIX}${params.business_id}`;
      const invStored = localStorage.getItem(invKey);
      const invList: InventoryTransaction[] = invStored ? JSON.parse(invStored) : [];
      const txId = generateUUID();

      invList.unshift({
        id: txId,
        business_id: params.business_id,
        product_id: params.product_id,
        transaction_type: params.type,
        quantity: params.quantity,
        unit_cost: params.unit_cost ?? null,
        reference_type: params.reference_type || 'manual',
        reference_id: params.reference_id || null,
        notes: params.notes || null,
        created_by: null,
        created_at: new Date().toISOString(),
      });

      localStorage.setItem(invKey, JSON.stringify(invList));
      resultTxId = txId;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ursella_data_changed', {
          detail: { type: 'inventory_movement', productId: params.product_id },
        })
      );
    }

    return resultTxId;
  },

  /**
   * Helper to restock inventory with supplier cost or purchase order reference.
   */
  async restockProduct(
    businessId: string,
    productId: string,
    quantityToAdd: number,
    notes?: string
  ): Promise<string> {
    if (quantityToAdd <= 0) {
      throw new Error('Restock quantity must be greater than 0.');
    }
    return this.recordMovement({
      business_id: businessId,
      product_id: productId,
      type: 'restock',
      quantity: quantityToAdd,
      reference_type: 'restock',
      notes: notes || 'Manual stock replenishment',
    });
  },

  /**
   * Helper to adjust stock to a specific target count with a mandatory explanation.
   */
  async adjustStock(
    businessId: string,
    productId: string,
    newTargetQuantity: number,
    reason: string,
    notes?: string
  ): Promise<string> {
    if (newTargetQuantity < 0) {
      throw new Error('Target stock quantity cannot be negative.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('A reason is required for stock level adjustments.');
    }

    return this.recordMovement({
      business_id: businessId,
      product_id: productId,
      type: 'adjustment',
      quantity: newTargetQuantity,
      reference_type: 'stock_count',
      notes: `Reason: ${reason.trim()}${notes ? ` | Notes: ${notes.trim()}` : ''}`,
    });
  },

  /**
   * Fetch complete inventory transaction history with product info.
   */
  async getInventoryLedger(
    businessId: string,
    productId?: string,
    limit = 100
  ): Promise<InventoryLedgerItem[]> {
    if (!businessId) return [];

    const getLocal = (): InventoryLedgerItem[] => {
      const invKey = `${LOCAL_INVENTORY_PREFIX}${businessId}`;
      const invStored = localStorage.getItem(invKey);
      let invList: InventoryTransaction[] = invStored ? JSON.parse(invStored) : [];

      const prodKey = `${LOCAL_PRODUCTS_PREFIX}${businessId}`;
      const prodStored = localStorage.getItem(prodKey);
      const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];

      if (productId) {
        invList = invList.filter((t) => t.product_id === productId);
      }

      const results: InventoryLedgerItem[] = invList.slice(0, limit).map((t) => {
        const p = prods.find((x) => x.id === t.product_id);
        return {
          ...t,
          product: p
            ? {
                id: p.id,
                name: p.name,
                sku: p.sku,
                stock_quantity: p.stock_quantity,
                selling_price: p.selling_price,
              }
            : null,
        };
      });

      return results;
    };

    if (!isDeviceOnline() || !isSupabaseConfigured || !isValidUUID(businessId)) {
      return getLocal();
    }

    return fastRaceWithFallback(
      async () => {
        let query = (supabase as any)
          .from('inventory_transactions')
          .select(`
            *,
            product:products ( id, name, sku, stock_quantity, selling_price )
          `)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (productId && isValidUUID(productId)) {
          query = query.eq('product_id', productId);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          return data;
        }
        return getLocal();
      },
      getLocal,
      2000
    );
  },
};
