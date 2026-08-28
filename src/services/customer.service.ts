import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type { Customer, CustomerWithSummary, Sale, Payment, PaymentMethodType } from '../types/index.ts';

const LOCAL_CUSTOMERS_PREFIX = 'ursella_customers_';
const LOCAL_SALES_PREFIX = 'ursella_sales_';
const LOCAL_PAYMENTS_PREFIX = 'ursella_payments_';

export interface CreateCustomerInput {
  business_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface CustomerFilterOptions {
  search?: string;
  hasOutstandingDebt?: boolean;
  isActive?: boolean;
  limit?: number;
}

export interface CustomerProfileResult {
  customer: CustomerWithSummary;
  sales: Sale[];
  payments: Payment[];
}

export interface RecordCustomerDebtPaymentInput {
  business_id: string;
  customer_id: string;
  amount: number;
  payment_method?: PaymentMethodType;
  reference?: string | null;
  notes?: string | null;
}

export const CustomerService = {
  /**
   * Get list of customers with aggregated metrics (total spent, outstanding debt, order count).
   */
  async getCustomers(
    businessId: string,
    options: CustomerFilterOptions = {}
  ): Promise<CustomerWithSummary[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        let query = (supabase as any)
          .from('customers')
          .select(`
            *,
            sales (
              id,
              total,
              amount_paid,
              amount_due,
              payment_status,
              sale_status,
              sold_at
            )
          `)
          .eq('business_id', businessId)
          .order('name', { ascending: true });

        if (options.isActive !== undefined) {
          query = query.eq('is_active', options.isActive);
        }

        if (options.search && options.search.trim()) {
          const s = `%${options.search.trim()}%`;
          query = query.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s},location.ilike.${s}`);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Failed to fetch customers:', error.message);
          return [];
        }

        let customers: CustomerWithSummary[] = (data || []).map((c: any) => {
          const validSales = (c.sales || []).filter((s: any) => s.sale_status === 'completed');
          const totalSpent = validSales.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0);
          const outstanding = validSales.reduce(
            (acc: number, s: any) => acc + (Number(s.amount_due) || 0),
            0
          );
          const sortedSales = [...validSales].sort(
            (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
          );

          return {
            id: c.id,
            business_id: c.business_id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            location: c.location,
            notes: c.notes,
            is_active: c.is_active,
            created_at: c.created_at,
            updated_at: c.updated_at,
            total_spent: totalSpent,
            purchase_count: validSales.length,
            last_purchase_at: sortedSales[0]?.sold_at || null,
            outstanding_balance: Math.max(0, outstanding),
          };
        });

        if (options.hasOutstandingDebt) {
          customers = customers.filter((c) => c.outstanding_balance > 0);
        }

        return customers;
      } catch (err) {
        console.error('Error in CustomerService.getCustomers:', err);
        return [];
      }
    } else {
      // Local storage fallback
      const key = `${LOCAL_CUSTOMERS_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      let list: Customer[] = stored ? JSON.parse(stored) : [];

      const salesKey = `${LOCAL_SALES_PREFIX}${businessId}`;
      const salesStored = localStorage.getItem(salesKey);
      const salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];

      if (options.isActive !== undefined) {
        list = list.filter((c) => c.is_active === options.isActive);
      }

      if (options.search && options.search.trim()) {
        const s = options.search.trim().toLowerCase();
        list = list.filter(
          (c) =>
            c.name.toLowerCase().includes(s) ||
            (c.phone && c.phone.toLowerCase().includes(s)) ||
            (c.email && c.email.toLowerCase().includes(s)) ||
            (c.location && c.location.toLowerCase().includes(s))
        );
      }

      let results: CustomerWithSummary[] = list.map((c) => {
        const customerSales = salesList.filter(
          (s) => s.customer_id === c.id && s.sale_status === 'completed'
        );
        const totalSpent = customerSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
        const outstanding = customerSales.reduce((acc, s) => acc + Number(s.amount_due || 0), 0);
        const sortedSales = [...customerSales].sort(
          (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
        );

        return {
          ...c,
          total_spent: totalSpent,
          purchase_count: customerSales.length,
          last_purchase_at: sortedSales[0]?.sold_at || null,
          outstanding_balance: Math.max(0, outstanding),
        };
      });

      if (options.hasOutstandingDebt) {
        results = results.filter((c) => c.outstanding_balance > 0);
      }

      return results.sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  /**
   * Get single customer with full purchase history and outstanding balances.
   */
  async getCustomerProfile(
    businessId: string,
    customerId: string
  ): Promise<CustomerProfileResult | null> {
    if (!businessId || !customerId) return null;

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(customerId)) {
      try {
        const { data, error } = await (supabase as any)
          .from('customers')
          .select(`
            *,
            sales (
              id,
              total,
              amount_paid,
              amount_due,
              payment_status,
              payment_method,
              sale_status,
              sold_at,
              notes
            )
          `)
          .eq('id', customerId)
          .eq('business_id', businessId)
          .single();

        if (error || !data) return null;

        // Fetch payments
        const { data: payData } = await (supabase as any)
          .from('payments')
          .select('*')
          .eq('customer_id', customerId)
          .eq('business_id', businessId)
          .order('paid_at', { ascending: false });

        const validSales = (data.sales || []).filter((s: any) => s.sale_status === 'completed');
        const totalSpent = validSales.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0);
        const outstanding = validSales.reduce(
          (acc: number, s: any) => acc + (Number(s.amount_due) || 0),
          0
        );
        const sortedSales = [...(data.sales || [])].sort(
          (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
        );

        const customerSummary: CustomerWithSummary = {
          id: data.id,
          business_id: data.business_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          location: data.location,
          notes: data.notes,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          total_spent: totalSpent,
          purchase_count: validSales.length,
          last_purchase_at: sortedSales[0]?.sold_at || null,
          outstanding_balance: Math.max(0, outstanding),
        };

        return {
          customer: customerSummary,
          sales: sortedSales as Sale[],
          payments: (payData || []) as Payment[],
        };
      } catch (err) {
        console.error('Error fetching customer profile:', err);
        return null;
      }
    } else {
      const key = `${LOCAL_CUSTOMERS_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: Customer[] = stored ? JSON.parse(stored) : [];
      const customer = list.find((c) => c.id === customerId);
      if (!customer) return null;

      const salesKey = `${LOCAL_SALES_PREFIX}${businessId}`;
      const salesStored = localStorage.getItem(salesKey);
      const salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];
      const customerSales = salesList.filter((s) => s.customer_id === customerId);

      const validSales = customerSales.filter((s) => s.sale_status === 'completed');
      const totalSpent = validSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
      const outstanding = validSales.reduce((acc, s) => acc + Number(s.amount_due || 0), 0);
      const sortedSales = [...customerSales].sort(
        (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
      );

      const payKey = `${LOCAL_PAYMENTS_PREFIX}${businessId}`;
      const payStored = localStorage.getItem(payKey);
      const payList: Payment[] = payStored ? JSON.parse(payStored) : [];
      const customerPayments = payList.filter((p) => p.customer_id === customerId);

      return {
        customer: {
          ...customer,
          total_spent: totalSpent,
          purchase_count: validSales.length,
          last_purchase_at: sortedSales[0]?.sold_at || null,
          outstanding_balance: Math.max(0, outstanding),
        },
        sales: sortedSales,
        payments: customerPayments,
      };
    }
  },

  /**
   * Create a customer record.
   */
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    if (!input.name || !input.name.trim()) {
      throw new Error('Customer name is required.');
    }

    if (isSupabaseConfigured && isValidUUID(input.business_id)) {
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert({
          business_id: input.business_id,
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          location: input.location?.trim() || null,
          notes: input.notes?.trim() || null,
          is_active: true,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as Customer;
    } else {
      const key = `${LOCAL_CUSTOMERS_PREFIX}${input.business_id}`;
      const stored = localStorage.getItem(key);
      const list: Customer[] = stored ? JSON.parse(stored) : [];

      const now = new Date().toISOString();
      const newCustomer: Customer = {
        id: generateUUID(),
        business_id: input.business_id,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      list.push(newCustomer);
      localStorage.setItem(key, JSON.stringify(list));
      return newCustomer;
    }
  },

  /**
   * Update customer profile details.
   */
  async updateCustomer(
    businessId: string,
    customerId: string,
    input: UpdateCustomerInput
  ): Promise<Customer> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new Error('Customer name cannot be blank.');
    }

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(customerId)) {
      const { data, error } = await (supabase as any)
        .from('customers')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .eq('business_id', businessId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as Customer;
    } else {
      const key = `${LOCAL_CUSTOMERS_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: Customer[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((c) => c.id === customerId);
      if (idx === -1) throw new Error('Customer not found.');

      const updated: Customer = {
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
   * Toggle Customer Active / Archived state.
   */
  async toggleCustomerActive(
    businessId: string,
    customerId: string,
    isActive: boolean
  ): Promise<Customer> {
    return this.updateCustomer(businessId, customerId, { is_active: isActive });
  },

  /**
   * Record debt payment for a customer, applying payment across unpaid sales FIFO.
   */
  async recordDebtPayment(input: RecordCustomerDebtPaymentInput): Promise<Payment> {
    const { business_id, customer_id, amount, payment_method = 'cash', reference, notes } = input;
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (isSupabaseConfigured && isValidUUID(business_id) && isValidUUID(customer_id)) {
      // 1. Find unpaid or partial sales for customer
      const { data: sales, error: salesErr } = await (supabase as any)
        .from('sales')
        .select('*')
        .eq('business_id', business_id)
        .eq('customer_id', customer_id)
        .eq('sale_status', 'completed')
        .gt('amount_due', 0)
        .order('sold_at', { ascending: true });

      let targetSaleId = sales && sales.length > 0 && isValidUUID(sales[0].id) ? sales[0].id : null;
      let remainingPayment = amount;

      if (sales && sales.length > 0) {
        for (const s of sales) {
          if (remainingPayment <= 0) break;
          const due = Number(s.amount_due) || 0;
          const paid = Number(s.amount_paid) || 0;
          const total = Number(s.total) || 0;
          const applyAmt = Math.min(due, remainingPayment);

          const newPaid = paid + applyAmt;
          const newDue = Math.max(0, total - newPaid);
          const newStatus = newDue === 0 ? 'paid' : 'partial';

          await (supabase as any)
            .from('sales')
            .update({
              amount_paid: newPaid,
              amount_due: newDue,
              payment_status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', s.id);

          remainingPayment -= applyAmt;
        }
      }

      // 2. Insert Payment record
      const { data: payData, error: payErr } = await (supabase as any)
        .from('payments')
        .insert({
          business_id,
          customer_id,
          sale_id: targetSaleId,
          amount,
          payment_method,
          reference: reference || null,
          notes: notes || 'Customer debt payment',
          paid_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (payErr) throw new Error(payErr.message);
      return payData as Payment;
    } else {
      // Local Storage Fallback
      const salesKey = `${LOCAL_SALES_PREFIX}${business_id}`;
      const salesStored = localStorage.getItem(salesKey);
      let salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];

      const unpaidSales = salesList
        .filter((s) => s.customer_id === customer_id && s.sale_status === 'completed' && Number(s.amount_due) > 0)
        .sort((a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime());

      let remaining = amount;
      const targetSaleId = unpaidSales.length > 0 ? unpaidSales[0].id : null;

      for (const s of unpaidSales) {
        if (remaining <= 0) break;
        const due = Number(s.amount_due) || 0;
        const paid = Number(s.amount_paid) || 0;
        const total = Number(s.total) || 0;
        const applyAmt = Math.min(due, remaining);

        const newPaid = paid + applyAmt;
        const newDue = Math.max(0, total - newPaid);
        const newStatus = newDue === 0 ? 'paid' : 'partial';

        const sIdx = salesList.findIndex((item) => item.id === s.id);
        if (sIdx !== -1) {
          salesList[sIdx] = {
            ...salesList[sIdx],
            amount_paid: newPaid,
            amount_due: newDue,
            payment_status: newStatus,
            updated_at: new Date().toISOString(),
          };
        }
        remaining -= applyAmt;
      }
      localStorage.setItem(salesKey, JSON.stringify(salesList));

      // Add payment
      const payKey = `${LOCAL_PAYMENTS_PREFIX}${business_id}`;
      const payStored = localStorage.getItem(payKey);
      const payList: Payment[] = payStored ? JSON.parse(payStored) : [];

      const newPayment: Payment = {
        id: generateUUID(),
        business_id,
        sale_id: targetSaleId,
        customer_id,
        amount,
        payment_method,
        reference: reference || null,
        notes: notes || 'Customer debt payment',
        received_by: null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      payList.push(newPayment);
      localStorage.setItem(payKey, JSON.stringify(payList));
      return newPayment;
    }
  },
};
