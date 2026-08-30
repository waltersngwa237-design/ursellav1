import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type {
  Product,
  ProductCategory,
  Supplier,
  ProductWithCategory,
  InventoryTransaction,
  SaleItem,
} from '../types/index.ts';

const LOCAL_PRODUCTS_PREFIX = 'ursella_products_';
const LOCAL_CATEGORIES_PREFIX = 'ursella_categories_';
const LOCAL_SUPPLIERS_PREFIX = 'ursella_suppliers_';
const LOCAL_INVENTORY_PREFIX = 'ursella_inventory_txs_';

export interface CreateProductInput {
  business_id: string;
  category_id?: string | null;
  supplier_id?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  minimum_stock_level: number;
  image_url?: string | null;
  is_active?: boolean;
}

export interface UpdateProductInput {
  category_id?: string | null;
  supplier_id?: string | null;
  name?: string;
  description?: string | null;
  sku?: string | null;
  selling_price?: number;
  cost_price?: number;
  minimum_stock_level?: number;
  image_url?: string | null;
  is_active?: boolean;
}

export interface ProductFilterOptions {
  search?: string;
  categoryId?: string;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProductDetailResult {
  product: ProductWithCategory;
  inventoryHistory: InventoryTransaction[];
  salesHistory: Array<
    SaleItem & {
      sold_at: string;
      customer_name?: string;
    }
  >;
}

export const ProductService = {
  /**
   * Fetch catalog products with filters, search, and category joining.
   */
  async getProducts(
    businessId: string,
    options: ProductFilterOptions = {}
  ): Promise<ProductWithCategory[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        let query = (supabase as any)
          .from('products')
          .select(`
            *,
            category:product_categories ( id, name, description ),
            supplier:suppliers ( id, name, phone, email )
          `)
          .eq('business_id', businessId)
          .order('name', { ascending: true });

        if (options.isActive !== undefined) {
          query = query.eq('is_active', options.isActive);
        }

        if (options.categoryId && isValidUUID(options.categoryId)) {
          query = query.eq('category_id', options.categoryId);
        }

        if (options.search && options.search.trim()) {
          const s = `%${options.search.trim()}%`;
          query = query.or(`name.ilike.${s},sku.ilike.${s},description.ilike.${s}`);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Error fetching products from Supabase:', error.message);
          return [];
        }

        let results: ProductWithCategory[] = (data || []).map((p: any) => ({
          ...p,
          selling_price: Number(p.selling_price) || 0,
          cost_price: Number(p.cost_price) || 0,
          stock_quantity: Number(p.stock_quantity) || 0,
          minimum_stock_level: Number(p.minimum_stock_level) || 0,
        }));

        // Apply client-side stock status filter if requested
        if (options.stockStatus && options.stockStatus !== 'all') {
          results = results.filter((p) => {
            if (options.stockStatus === 'out_of_stock') {
              return p.stock_quantity <= 0;
            }
            if (options.stockStatus === 'low_stock') {
              return p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level;
            }
            if (options.stockStatus === 'in_stock') {
              return p.stock_quantity > p.minimum_stock_level;
            }
            return true;
          });
        }

        return results;
      } catch (err) {
        console.error('Failed to get products:', err);
        return [];
      }
    } else {
      // Local fallback
      const stored = localStorage.getItem(`${LOCAL_PRODUCTS_PREFIX}${businessId}`);
      let list: Product[] = stored ? JSON.parse(stored) : [];
      const catStored = localStorage.getItem(`${LOCAL_CATEGORIES_PREFIX}${businessId}`);
      const categories: ProductCategory[] = catStored ? JSON.parse(catStored) : [];
      const supStored = localStorage.getItem(`${LOCAL_SUPPLIERS_PREFIX}${businessId}`);
      const suppliers: Supplier[] = supStored ? JSON.parse(supStored) : [];

      if (options.isActive !== undefined) {
        list = list.filter((p) => p.is_active === options.isActive);
      }
      if (options.categoryId) {
        list = list.filter((p) => p.category_id === options.categoryId);
      }
      if (options.search && options.search.trim()) {
        const s = options.search.trim().toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(s) ||
            (p.sku && p.sku.toLowerCase().includes(s)) ||
            (p.description && p.description.toLowerCase().includes(s))
        );
      }

      let enriched: ProductWithCategory[] = list.map((p) => ({
        ...p,
        category: categories.find((c) => c.id === p.category_id) || null,
        supplier: suppliers.find((s) => s.id === p.supplier_id) || null,
      }));

      if (options.stockStatus && options.stockStatus !== 'all') {
        enriched = enriched.filter((p) => {
          if (options.stockStatus === 'out_of_stock') {
            return p.stock_quantity <= 0;
          }
          if (options.stockStatus === 'low_stock') {
            return p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level;
          }
          if (options.stockStatus === 'in_stock') {
            return p.stock_quantity > p.minimum_stock_level;
          }
          return true;
        });
      }

      return enriched.sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  /**
   * Fetch single product detail along with its historical inventory movements and sales.
   */
  async getProductDetail(
    businessId: string,
    productId: string
  ): Promise<ProductDetailResult | null> {
    if (!businessId || !productId) return null;

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(productId)) {
      try {
        const { data: prodData, error: prodErr } = await (supabase as any)
          .from('products')
          .select(`
            *,
            category:product_categories ( id, name, description ),
            supplier:suppliers ( id, name, phone, email )
          `)
          .eq('id', productId)
          .eq('business_id', businessId)
          .single();

        if (prodErr || !prodData) {
          return null;
        }

        // Fetch inventory history
        const { data: invData } = await (supabase as any)
          .from('inventory_transactions')
          .select('*')
          .eq('product_id', productId)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(30);

        // Fetch sales history
        const { data: salesItemsData } = await (supabase as any)
          .from('sale_items')
          .select(`
            *,
            sales!inner (
              sold_at,
              customers ( name )
            )
          `)
          .eq('product_id', productId)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(30);

        const formattedSales = (salesItemsData || []).map((si: any) => ({
          ...si,
          sold_at: si.sales?.sold_at || si.created_at,
          customer_name: si.sales?.customers?.name || 'Walk-in Customer',
        }));

        return {
          product: {
            ...prodData,
            selling_price: Number(prodData.selling_price) || 0,
            cost_price: Number(prodData.cost_price) || 0,
            stock_quantity: Number(prodData.stock_quantity) || 0,
            minimum_stock_level: Number(prodData.minimum_stock_level) || 0,
          },
          inventoryHistory: invData || [],
          salesHistory: formattedSales,
        };
      } catch (err) {
        console.error('Error fetching product detail:', err);
        return null;
      }
    } else {
      const stored = localStorage.getItem(`${LOCAL_PRODUCTS_PREFIX}${businessId}`);
      const list: Product[] = stored ? JSON.parse(stored) : [];
      const prod = list.find((p) => p.id === productId);
      if (!prod) return null;

      const catStored = localStorage.getItem(`${LOCAL_CATEGORIES_PREFIX}${businessId}`);
      const categories: ProductCategory[] = catStored ? JSON.parse(catStored) : [];
      const supStored = localStorage.getItem(`${LOCAL_SUPPLIERS_PREFIX}${businessId}`);
      const suppliers: Supplier[] = supStored ? JSON.parse(supStored) : [];

      const invStored = localStorage.getItem(`${LOCAL_INVENTORY_PREFIX}${businessId}`);
      const invList: InventoryTransaction[] = invStored ? JSON.parse(invStored) : [];
      const prodInv = invList
        .filter((t) => t.product_id === productId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        product: {
          ...prod,
          category: categories.find((c) => c.id === prod.category_id) || null,
          supplier: suppliers.find((s) => s.id === prod.supplier_id) || null,
        },
        inventoryHistory: prodInv,
        salesHistory: [],
      };
    }
  },

  /**
   * Create a new product and initialize stock movement transaction.
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Product name is required.');
    }
    if (input.selling_price < 0) {
      throw new Error('Selling price must be greater than or equal to 0.');
    }
    if (input.cost_price < 0) {
      throw new Error('Cost price must be greater than or equal to 0.');
    }
    if (input.stock_quantity < 0) {
      throw new Error('Stock quantity cannot be negative.');
    }
    if (input.minimum_stock_level < 0) {
      throw new Error('Minimum stock level cannot be negative.');
    }

    const sanitizedCategoryId = input.category_id && isValidUUID(input.category_id) ? input.category_id : null;
    const sanitizedSupplierId = input.supplier_id && isValidUUID(input.supplier_id) ? input.supplier_id : null;

    if (isSupabaseConfigured && isValidUUID(input.business_id)) {
      const { data, error } = await (supabase as any)
        .from('products')
        .insert({
          business_id: input.business_id,
          category_id: sanitizedCategoryId,
          supplier_id: sanitizedSupplierId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          sku: input.sku?.trim() || null,
          selling_price: input.selling_price,
          cost_price: input.cost_price,
          stock_quantity: input.stock_quantity,
          minimum_stock_level: input.minimum_stock_level ?? 5,
          image_url: input.image_url || null,
          is_active: input.is_active !== undefined ? input.is_active : true,
        })
        .select('*')
        .single();

      if (error) {
        if (error.message.includes('unique') || error.message.includes('sku')) {
          throw new Error('A product with this SKU already exists in this business.');
        }
        throw new Error(error.message);
      }

      // Record initial stock transaction if quantity > 0
      if (input.stock_quantity > 0 && data?.id) {
        try {
          await (supabase as any).from('inventory_transactions').insert({
            business_id: input.business_id,
            product_id: data.id,
            transaction_type: 'initial_stock',
            quantity: input.stock_quantity,
            reference_type: 'initialization',
            notes: 'Initial inventory quantity logged at product creation',
          });
        } catch (txErr) {
          console.warn('Initial stock log failed (non-critical):', txErr);
        }
      }

      return data as Product;
    } else {
      const key = `${LOCAL_PRODUCTS_PREFIX}${input.business_id}`;
      const stored = localStorage.getItem(key);
      const list: Product[] = stored ? JSON.parse(stored) : [];

      // Check duplicate SKU
      if (input.sku && list.some((p) => p.sku && p.sku.toLowerCase() === input.sku?.toLowerCase())) {
        throw new Error('A product with this SKU already exists.');
      }

      const now = new Date().toISOString();
      const newProd: Product = {
        id: generateUUID(),
        business_id: input.business_id,
        category_id: input.category_id || null,
        supplier_id: input.supplier_id || null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        sku: input.sku?.trim() || null,
        selling_price: Number(input.selling_price),
        cost_price: Number(input.cost_price),
        stock_quantity: Number(input.stock_quantity),
        minimum_stock_level: Number(input.minimum_stock_level ?? 5),
        image_url: input.image_url || null,
        is_active: input.is_active !== undefined ? input.is_active : true,
        created_at: now,
        updated_at: now,
      };

      list.push(newProd);
      localStorage.setItem(key, JSON.stringify(list));

      if (input.stock_quantity > 0) {
        const invKey = `${LOCAL_INVENTORY_PREFIX}${input.business_id}`;
        const invStored = localStorage.getItem(invKey);
        const invList: InventoryTransaction[] = invStored ? JSON.parse(invStored) : [];
        invList.push({
          id: generateUUID(),
          business_id: input.business_id,
          product_id: newProd.id,
          transaction_type: 'initial_stock',
          quantity: input.stock_quantity,
          unit_cost: Number(input.cost_price || 0),
          reference_type: 'initialization',
          reference_id: null,
          notes: 'Initial inventory quantity logged at product creation',
          created_by: null,
          created_at: now,
        });
        localStorage.setItem(invKey, JSON.stringify(invList));
      }

      return newProd;
    }
  },

  /**
   * Update existing product details.
   */
  async updateProduct(
    businessId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    if (input.selling_price !== undefined && input.selling_price < 0) {
      throw new Error('Selling price must be greater than or equal to 0.');
    }
    if (input.cost_price !== undefined && input.cost_price < 0) {
      throw new Error('Cost price must be greater than or equal to 0.');
    }
    if (input.minimum_stock_level !== undefined && input.minimum_stock_level < 0) {
      throw new Error('Minimum stock level cannot be negative.');
    }

    const sanitizedCategory = input.category_id !== undefined
      ? (input.category_id && isValidUUID(input.category_id) ? input.category_id : null)
      : undefined;
    const sanitizedSupplier = input.supplier_id !== undefined
      ? (input.supplier_id && isValidUUID(input.supplier_id) ? input.supplier_id : null)
      : undefined;

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(productId)) {
      const updatePayload: any = {
        ...input,
        updated_at: new Date().toISOString(),
      };
      if (sanitizedCategory !== undefined) updatePayload.category_id = sanitizedCategory;
      if (sanitizedSupplier !== undefined) updatePayload.supplier_id = sanitizedSupplier;

      const { data, error } = await (supabase as any)
        .from('products')
        .update(updatePayload)
        .eq('id', productId)
        .eq('business_id', businessId)
        .select('*')
        .single();

      if (error) {
        if (error.message.includes('unique') || error.message.includes('sku')) {
          throw new Error('A product with this SKU already exists in this business.');
        }
        throw new Error(error.message);
      }

      return data as Product;
    } else {
      const key = `${LOCAL_PRODUCTS_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: Product[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((p) => p.id === productId);
      if (idx === -1) throw new Error('Product not found.');

      if (
        input.sku &&
        list.some(
          (p) => p.id !== productId && p.sku && p.sku.toLowerCase() === input.sku?.toLowerCase()
        )
      ) {
        throw new Error('A product with this SKU already exists.');
      }

      const updated: Product = {
        ...list[idx],
        ...input,
        updated_at: new Date().toISOString(),
      };

      list[idx] = updated;
      localStorage.setItem(key, JSON.stringify(list));
      return updated;
    }
  },

  /**
   * Archive / Toggle active status of a product.
   */
  async toggleProductActive(
    businessId: string,
    productId: string,
    isActive: boolean
  ): Promise<Product> {
    return this.updateProduct(businessId, productId, { is_active: isActive });
  },

  // ===========================================================================
  // PRODUCT CATEGORIES
  // ===========================================================================

  async getCategories(businessId: string): Promise<ProductCategory[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      const { data, error } = await (supabase as any)
        .from('product_categories')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });

      if (error) {
        console.warn('Failed to fetch categories:', error.message);
        return [];
      }
      return data || [];
    } else {
      const key = `${LOCAL_CATEGORIES_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    }
  },

  async createCategory(
    businessId: string,
    name: string,
    description?: string
  ): Promise<ProductCategory> {
    if (!name || !name.trim()) {
      throw new Error('Category name cannot be empty.');
    }

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      const { data, error } = await (supabase as any)
        .from('product_categories')
        .insert({
          business_id: businessId,
          name: name.trim(),
          description: description?.trim() || null,
        })
        .select('*')
        .single();

      if (error) {
        if (error.message.includes('unique')) {
          throw new Error('A category with this name already exists.');
        }
        throw new Error(error.message);
      }
      return data as ProductCategory;
    } else {
      const key = `${LOCAL_CATEGORIES_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: ProductCategory[] = stored ? JSON.parse(stored) : [];

      if (list.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
        throw new Error('A category with this name already exists.');
      }

      const now = new Date().toISOString();
      const newCat: ProductCategory = {
        id: generateUUID(),
        business_id: businessId,
        name: name.trim(),
        description: description?.trim() || null,
        created_at: now,
        updated_at: now,
      };

      list.push(newCat);
      localStorage.setItem(key, JSON.stringify(list));
      return newCat;
    }
  },

  async updateCategory(
    businessId: string,
    categoryId: string,
    name: string,
    description?: string
  ): Promise<ProductCategory> {
    if (!name || !name.trim()) {
      throw new Error('Category name cannot be empty.');
    }

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(categoryId)) {
      const { data, error } = await (supabase as any)
        .from('product_categories')
        .update({
          name: name.trim(),
          description: description?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryId)
        .eq('business_id', businessId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as ProductCategory;
    } else {
      const key = `${LOCAL_CATEGORIES_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: ProductCategory[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((c) => c.id === categoryId);
      if (idx === -1) throw new Error('Category not found.');

      list[idx] = {
        ...list[idx],
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      localStorage.setItem(key, JSON.stringify(list));
      return list[idx];
    }
  },

  async deleteOrArchiveCategory(businessId: string, categoryId: string): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(categoryId)) {
      // First disassociate products
      await (supabase as any)
        .from('products')
        .update({ category_id: null })
        .eq('category_id', categoryId)
        .eq('business_id', businessId);

      const { error } = await (supabase as any)
        .from('product_categories')
        .delete()
        .eq('id', categoryId)
        .eq('business_id', businessId);

      if (error) throw new Error(error.message);
    } else {
      const prodKey = `${LOCAL_PRODUCTS_PREFIX}${businessId}`;
      const prodStored = localStorage.getItem(prodKey);
      if (prodStored) {
        const prods: Product[] = JSON.parse(prodStored);
        prods.forEach((p) => {
          if (p.category_id === categoryId) p.category_id = null;
        });
        localStorage.setItem(prodKey, JSON.stringify(prods));
      }

      const key = `${LOCAL_CATEGORIES_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: ProductCategory[] = JSON.parse(stored);
        const filtered = list.filter((c) => c.id !== categoryId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  },

  // ===========================================================================
  // SUPPLIERS
  // ===========================================================================

  async getSuppliers(businessId: string): Promise<Supplier[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      const { data } = await (supabase as any)
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });
      return data || [];
    } else {
      const key = `${LOCAL_SUPPLIERS_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    }
  },

  async createSupplier(
    businessId: string,
    data: { name: string; phone?: string; email?: string; address?: string; notes?: string }
  ): Promise<Supplier> {
    if (!data.name || !data.name.trim()) throw new Error('Supplier name is required.');

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      const { data: res, error } = await (supabase as any)
        .from('suppliers')
        .insert({
          business_id: businessId,
          name: data.name.trim(),
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          address: data.address?.trim() || null,
          notes: data.notes?.trim() || null,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return res as Supplier;
    } else {
      const key = `${LOCAL_SUPPLIERS_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: Supplier[] = stored ? JSON.parse(stored) : [];
      const now = new Date().toISOString();
      const newSup: Supplier = {
        id: generateUUID(),
        business_id: businessId,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
        created_at: now,
        updated_at: now,
      };
      list.push(newSup);
      localStorage.setItem(key, JSON.stringify(list));
      return newSup;
    }
  },
};
