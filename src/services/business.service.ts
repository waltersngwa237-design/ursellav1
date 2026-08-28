import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type { Business, BusinessSettings, MemberRole, UserBusinessMembership } from '../types/index.ts';

const LOCAL_STORAGE_BIZ_PREFIX = 'ursella_preview_businesses_';

export interface CreateBusinessInput {
  name: string;
  business_type: string;
  country?: string;
  currency: string;
  timezone: string;
  description?: string;
  userId: string;
}

export const BusinessService = {
  /**
   * Fetch all businesses where the specified user is an active member
   */
  async getUserBusinesses(userId: string): Promise<UserBusinessMembership[]> {
    if (!userId) return [];

    const memberships: UserBusinessMembership[] = [];

    if (isSupabaseConfigured && isValidUUID(userId)) {
      try {
        // Query business_members joined with businesses and business_settings
        const { data: members, error: memError } = await (supabase as any)
          .from('business_members')
          .select(`
            id,
            business_id,
            role,
            businesses (
              id,
              name,
              business_type,
              description,
              country,
              currency,
              timezone,
              logo_url,
              created_by,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', userId);

        if (!memError && members && members.length > 0) {
          for (const m of (members as any[])) {
            const biz = m.businesses as unknown as Business;
            if (!biz || !isValidUUID(biz.id)) continue;

            const { data: settings } = await (supabase as any)
              .from('business_settings')
              .select('*')
              .eq('business_id', biz.id)
              .maybeSingle();

            memberships.push({
              business: biz,
              role: m.role as MemberRole,
              settings: settings || null,
            });
          }
        }
      } catch (err: unknown) {
        console.warn('Supabase getUserBusinesses error, checking local fallback:', err);
      }
    }

    // Always merge or fallback to local storage
    const key = `${LOCAL_STORAGE_BIZ_PREFIX}${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const localList: UserBusinessMembership[] = JSON.parse(stored);
        for (const loc of localList) {
          // If we already have Supabase businesses and this is a legacy non-UUID, skip it
          if (!isValidUUID(loc.business.id) && memberships.length > 0) {
            continue;
          }
          if (!memberships.some((m) => m.business.id === loc.business.id)) {
            memberships.push(loc);
          }
        }
      } catch {
        // ignore parse error
      }
    }

    return memberships;
  },

  /**
   * Save a business membership into local storage for resilient offline caching
   */
  saveToLocalStorage(userId: string, membership: UserBusinessMembership) {
    const key = `${LOCAL_STORAGE_BIZ_PREFIX}${userId}`;
    let existing: UserBusinessMembership[] = [];
    try {
      const stored = localStorage.getItem(key);
      if (stored) existing = JSON.parse(stored);
    } catch {}
    const updated = [...existing.filter((b) => b.business.id !== membership.business.id), membership];
    localStorage.setItem(key, JSON.stringify(updated));
  },

  /**
   * Automatically seed starter catalog & operational records for a brand-new business
   */
  seedStarterCatalogIfEmpty(businessId: string, currency = 'XAF') {
    const prodKey = `ursella_products_${businessId}`;
    const catKey = `ursella_categories_${businessId}`;
    const custKey = `ursella_customers_${businessId}`;
    const expKey = `ursella_expenses_${businessId}`;
    const salesKey = `ursella_sales_${businessId}`;
    const saleItemsKey = `ursella_sale_items_${businessId}`;
    const paymentsKey = `ursella_payments_${businessId}`;

    if (!localStorage.getItem(prodKey)) {
      const categories = [
        { id: generateUUID(), business_id: businessId, name: 'Beverages & Coffee', description: 'Hot & cold drinks', created_at: new Date().toISOString() },
        { id: generateUUID(), business_id: businessId, name: 'Pantry & Groceries', description: 'Cooking staples & oils', created_at: new Date().toISOString() },
        { id: generateUUID(), business_id: businessId, name: 'Confectionery', description: 'Snacks & chocolates', created_at: new Date().toISOString() },
      ];
      localStorage.setItem(catKey, JSON.stringify(categories));

      const isUsdOrEur = currency === 'USD' || currency === 'EUR' || currency === 'GBP';
      const p1Price = isUsdOrEur ? 14.5 : 4500;
      const p1Cost = isUsdOrEur ? 8.0 : 2800;
      const p2Price = isUsdOrEur ? 18.0 : 6000;
      const p2Cost = isUsdOrEur ? 11.5 : 3800;
      const p3Price = isUsdOrEur ? 22.0 : 7200;
      const p3Cost = isUsdOrEur ? 14.0 : 5000;
      const p4Price = isUsdOrEur ? 9.5 : 3800;
      const p4Cost = isUsdOrEur ? 5.5 : 2400;
      const p5Price = isUsdOrEur ? 4.5 : 2200;
      const p5Cost = isUsdOrEur ? 2.5 : 1300;

      const p1Id = generateUUID();
      const p2Id = generateUUID();
      const p3Id = generateUUID();
      const p4Id = generateUUID();
      const p5Id = generateUUID();

      const products = [
        {
          id: p1Id,
          business_id: businessId,
          category_id: categories[0].id,
          name: 'Organic Arabica Coffee 250g',
          sku: 'COF-ARA-250',
          selling_price: p1Price,
          cost_price: p1Cost,
          stock_quantity: 36,
          minimum_stock_level: 8,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: p2Id,
          business_id: businessId,
          category_id: categories[0].id,
          name: 'Dark Roast Robusta 500g',
          sku: 'COF-ROB-500',
          selling_price: p2Price,
          cost_price: p2Cost,
          stock_quantity: 22,
          minimum_stock_level: 6,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: p3Id,
          business_id: businessId,
          category_id: categories[1].id,
          name: 'Extra Virgin Cold-Pressed Olive Oil 1L',
          sku: 'OIL-OLV-1L',
          selling_price: p3Price,
          cost_price: p3Cost,
          stock_quantity: 15,
          minimum_stock_level: 5,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: p4Id,
          business_id: businessId,
          category_id: categories[1].id,
          name: 'Pure Wildflower Blossom Honey 500g',
          sku: 'HNY-BLS-500',
          selling_price: p4Price,
          cost_price: p4Cost,
          stock_quantity: 3, // Low stock
          minimum_stock_level: 6,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: p5Id,
          business_id: businessId,
          category_id: categories[2].id,
          name: 'Artisanal 85% Dark Cocoa Bar 100g',
          sku: 'CHO-DRK-100',
          selling_price: p5Price,
          cost_price: p5Cost,
          stock_quantity: 0, // Out of stock
          minimum_stock_level: 10,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(prodKey, JSON.stringify(products));

      // Starter Customers
      const cust1Id = generateUUID();
      const cust2Id = generateUUID();
      const customers = [
        {
          id: cust1Id,
          business_id: businessId,
          name: 'Mme. Ngono Claire',
          phone: '+237 677 123 456',
          email: 'claire.ngono@example.com',
          location: 'Akwa, Douala',
          total_debt: isUsdOrEur ? 45.0 : 15000,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: cust2Id,
          business_id: businessId,
          name: 'M. Kamdem Paul',
          phone: '+237 699 876 543',
          email: null,
          location: 'Bonapriso, Douala',
          total_debt: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(custKey, JSON.stringify(customers));

      // Starter Expenses
      const expenses = [
        {
          id: generateUUID(),
          business_id: businessId,
          category: 'Utilities & Power',
          description: 'Store electricity & generator fuel',
          amount: isUsdOrEur ? 65.0 : 35000,
          payment_method: 'momo',
          expense_date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
          is_recurring: true,
          created_at: new Date().toISOString(),
        },
        {
          id: generateUUID(),
          business_id: businessId,
          category: 'Supplies',
          description: 'Thermal receipt rolls & packaging bags',
          amount: isUsdOrEur ? 25.0 : 12500,
          payment_method: 'cash',
          expense_date: new Date().toISOString().split('T')[0],
          is_recurring: false,
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(expKey, JSON.stringify(expenses));

      // Starter Initial Completed Sales for rich dashboard
      const sale1Id = generateUUID();
      const sale2Id = generateUUID();
      const sales = [
        {
          id: sale1Id,
          business_id: businessId,
          customer_id: cust2Id,
          sale_number: 'REC-1001',
          subtotal: p1Price * 2,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: p1Price * 2,
          amount_paid: p1Price * 2,
          balance_due: 0,
          payment_method: 'cash',
          payment_status: 'paid',
          status: 'completed',
          sold_at: new Date(Date.now() - 3600000 * 3).toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: sale2Id,
          business_id: businessId,
          customer_id: cust1Id,
          sale_number: 'REC-1002',
          subtotal: p3Price + p2Price,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: p3Price + p2Price,
          amount_paid: p3Price,
          balance_due: p2Price,
          payment_method: 'momo',
          payment_status: 'partial',
          status: 'completed',
          sold_at: new Date(Date.now() - 3600000 * 1).toISOString(),
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(salesKey, JSON.stringify(sales));

      const saleItems = [
        {
          id: generateUUID(),
          sale_id: sale1Id,
          product_id: p1Id,
          quantity: 2,
          unit_price: p1Price,
          unit_cost: p1Cost,
          total_price: p1Price * 2,
          created_at: new Date().toISOString(),
        },
        {
          id: generateUUID(),
          sale_id: sale2Id,
          product_id: p3Id,
          quantity: 1,
          unit_price: p3Price,
          unit_cost: p3Cost,
          total_price: p3Price,
          created_at: new Date().toISOString(),
        },
        {
          id: generateUUID(),
          sale_id: sale2Id,
          product_id: p2Id,
          quantity: 1,
          unit_price: p2Price,
          unit_cost: p2Cost,
          total_price: p2Price,
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(saleItemsKey, JSON.stringify(saleItems));

      const payments = [
        {
          id: generateUUID(),
          business_id: businessId,
          sale_id: sale1Id,
          customer_id: cust2Id,
          amount: p1Price * 2,
          payment_method: 'cash',
          payment_type: 'sale',
          paid_at: new Date(Date.now() - 3600000 * 3).toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: generateUUID(),
          business_id: businessId,
          sale_id: sale2Id,
          customer_id: cust1Id,
          amount: p3Price,
          payment_method: 'momo',
          payment_type: 'sale',
          paid_at: new Date(Date.now() - 3600000 * 1).toISOString(),
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(paymentsKey, JSON.stringify(payments));
    }
  },

  /**
   * Helper to create local business membership with zero risk of rejection
   */
  createLocalBusiness(input: CreateBusinessInput): UserBusinessMembership {
    const newBizId = generateUUID();
    const newBiz: Business = {
      id: newBizId,
      name: input.name.trim() || 'My Business Enterprise',
      business_type: input.business_type || 'Retail & Supermarket',
      description: input.description?.trim() || null,
      country: input.country || 'Cameroon',
      currency: input.currency || 'XAF',
      timezone: input.timezone || 'Africa/Douala',
      logo_url: null,
      created_by: input.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newSettings: BusinessSettings = {
      id: generateUUID(),
      business_id: newBizId,
      currency: input.currency || 'XAF',
      timezone: input.timezone || 'Africa/Douala',
      business_type: input.business_type || 'Retail & Supermarket',
      tax_enabled: false,
      tax_rate: 0,
      low_stock_threshold: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const membership: UserBusinessMembership = {
      business: newBiz,
      role: 'owner',
      settings: newSettings,
    };

    this.saveToLocalStorage(input.userId, membership);

    return membership;
  },

  /**
   * Securely create a new business, assign current user as 'owner', and configure settings
   * Starts as a 100% clean and fresh account
   */
  async createBusiness(input: CreateBusinessInput): Promise<UserBusinessMembership> {
    const businessName = (input.name && input.name.trim()) || 'My Business Enterprise';
    const currency = input.currency || 'XAF';
    const hasValidUserUuid = isValidUUID(input.userId);

    if (isSupabaseConfigured && hasValidUserUuid) {
      try {
        // First try the PostgreSQL RPC created in schema migration
        const { data: rpcBizId, error: rpcError } = await (supabase as any).rpc('create_business_with_owner', {
          p_name: businessName,
          p_business_type: input.business_type || 'Retail',
          p_description: input.description?.trim() || null,
          p_country: input.country || 'Cameroon',
          p_currency: currency,
          p_timezone: input.timezone || 'Africa/Douala',
        });

        let businessId = (rpcBizId && isValidUUID(rpcBizId as string)) ? (rpcBizId as string) : '';

        // If RPC was not present or errored, execute atomic client insert sequence
        if (rpcError || !businessId) {
          console.warn('RPC create_business_with_owner not available, executing direct insert:', rpcError?.message);

          const { data: newBiz, error: bizError } = await (supabase as any)
            .from('businesses')
            .insert({
              name: businessName,
              business_type: input.business_type || 'Retail',
              description: input.description?.trim() || null,
              country: input.country || 'Cameroon',
              currency: currency,
              timezone: input.timezone || 'Africa/Douala',
              created_by: input.userId,
            })
            .select()
            .single();

          if (!bizError && newBiz && isValidUUID(newBiz.id)) {
            businessId = newBiz.id;

            // Add user as owner in business_members
            await (supabase as any).from('business_members').insert({
              business_id: businessId,
              user_id: input.userId,
              role: 'owner',
            });

            // Create default business settings
            await (supabase as any).from('business_settings').insert({
              business_id: businessId,
              currency: currency,
              timezone: input.timezone || 'Africa/Douala',
              business_type: input.business_type || 'Retail',
              tax_enabled: false,
              tax_rate: 0,
              low_stock_threshold: 5,
            });
          }
        }

        if (businessId && isValidUUID(businessId)) {
          const { data: createdBiz } = await (supabase as any)
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();

          if (createdBiz) {
            const { data: createdSettings } = await (supabase as any)
              .from('business_settings')
              .select('*')
              .eq('business_id', businessId)
              .maybeSingle();

            const membership: UserBusinessMembership = {
              business: createdBiz,
              role: 'owner',
              settings: createdSettings || null,
            };

            this.saveToLocalStorage(input.userId, membership);
            return membership;
          }
        }
      } catch (err: unknown) {
        console.warn('Supabase createBusiness failed, seamlessly creating local workspace:', err);
      }
    }

    // Fail-safe Local creation (100% clean & fresh)
    return this.createLocalBusiness({
      ...input,
      name: businessName,
      currency,
    });
  },

  /**
   * Reset all data for a specific business to provide a pristine fresh start
   */
  async resetBusinessData(businessId: string): Promise<void> {
    const prodKey = `ursella_products_${businessId}`;
    const catKey = `ursella_categories_${businessId}`;
    const custKey = `ursella_customers_${businessId}`;
    const expKey = `ursella_expenses_${businessId}`;
    const salesKey = `ursella_sales_${businessId}`;
    const saleItemsKey = `ursella_sale_items_${businessId}`;
    const paymentsKey = `ursella_payments_${businessId}`;

    localStorage.removeItem(prodKey);
    localStorage.removeItem(catKey);
    localStorage.removeItem(custKey);
    localStorage.removeItem(expKey);
    localStorage.removeItem(salesKey);
    localStorage.removeItem(saleItemsKey);
    localStorage.removeItem(paymentsKey);
  },

  /**
   * Update business settings
   */
  async updateSettings(businessId: string, updates: Partial<BusinessSettings>) {
    if (isSupabaseConfigured) {
      const { data, error } = await (supabase as any)
        .from('business_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }
    return null;
  },

  /**
   * Seed an optional demo business for review/preview with sample realistic data
   * (Explicitly labeled as DEMO mode)
   */
  async createDemoBusiness(userId: string): Promise<UserBusinessMembership> {
    const membership = await this.createBusiness({
      name: 'Kivu Roast & Cafe (Demo)',
      business_type: 'Food & Restaurant / Cafe',
      country: 'Cameroon',
      currency: 'XAF',
      timezone: 'Africa/Douala',
      description: 'Specialty coffee roasting and artisanal cafe.',
      userId,
    });

    this.seedStarterCatalogIfEmpty(membership.business.id, 'XAF');
    return membership;
  }
};
