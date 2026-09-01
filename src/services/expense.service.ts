import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import { OfflineSyncService } from './offline-sync.service.ts';
import type { Expense, PaymentMethodType } from '../types/index.ts';

const LOCAL_EXPENSES_PREFIX = 'ursella_expenses_';

export interface CreateExpenseInput {
  business_id: string;
  category: string;
  description?: string | null;
  amount: number;
  payment_method: PaymentMethodType;
  expense_date: string;
  is_recurring?: boolean;
}

export interface UpdateExpenseInput {
  category?: string;
  description?: string | null;
  amount?: number;
  payment_method?: PaymentMethodType;
  expense_date?: string;
  is_recurring?: boolean;
}

export interface ExpenseFilterOptions {
  category?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export interface ExpenseSummary {
  totalExpenses: number;
  categoryBreakdown: Record<string, number>;
  count: number;
}

export const ExpenseService = {
  /**
   * Fetch list of expenses with optional category and date filtering.
   */
  async getExpenses(
    businessId: string,
    options: ExpenseFilterOptions = {}
  ): Promise<Expense[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        let query = (supabase as any)
          .from('expenses')
          .select('*')
          .eq('business_id', businessId)
          .order('expense_date', { ascending: false });

        if (options.category && options.category !== 'all') {
          query = query.eq('category', options.category);
        }

        if (options.paymentMethod && options.paymentMethod !== 'all') {
          query = query.eq('payment_method', options.paymentMethod);
        }

        if (options.startDate) {
          query = query.gte('expense_date', options.startDate);
        }

        if (options.endDate) {
          query = query.lte('expense_date', options.endDate);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Error fetching expenses from Supabase, checking local cache:', error.message);
          throw error;
        }

        let expenses: Expense[] = (data || []).map((e: any) => ({
          ...e,
          amount: Number(e.amount) || 0,
        }));

        // Cache expenses snapshot locally
        if (expenses.length > 0 && !options.category && !options.search) {
          try {
            localStorage.setItem(`${LOCAL_EXPENSES_PREFIX}${businessId}`, JSON.stringify(expenses));
          } catch {}
        }

        if (options.search && options.search.trim()) {
          const s = options.search.trim().toLowerCase();
          expenses = expenses.filter(
            (e) =>
              e.category.toLowerCase().includes(s) ||
              (e.description && e.description.toLowerCase().includes(s))
          );
        }

        return expenses;
      } catch (err) {
        console.warn('[ExpenseService] Supabase offline, using local expense cache:', err);
      }
    }

    const key = `${LOCAL_EXPENSES_PREFIX}${businessId}`;
    const stored = localStorage.getItem(key);
    let list: Expense[] = stored ? JSON.parse(stored) : [];

      if (options.category && options.category !== 'all') {
        list = list.filter((e) => e.category === options.category);
      }

      if (options.paymentMethod && options.paymentMethod !== 'all') {
        list = list.filter((e) => e.payment_method === options.paymentMethod);
      }

      if (options.startDate) {
        list = list.filter(
          (e) => new Date(e.expense_date).getTime() >= new Date(options.startDate!).getTime()
        );
      }

      if (options.endDate) {
        list = list.filter(
          (e) => new Date(e.expense_date).getTime() <= new Date(options.endDate!).getTime()
        );
      }

      if (options.search && options.search.trim()) {
        const s = options.search.trim().toLowerCase();
        list = list.filter(
          (e) =>
            e.category.toLowerCase().includes(s) ||
            (e.description && e.description.toLowerCase().includes(s))
        );
      }

      return list.sort(
        (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
      );
  },

  /**
   * Create a new expense.
   */
  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    if (!input.category || !input.category.trim()) {
      throw new Error('Expense category is required.');
    }
    if (input.amount <= 0) {
      throw new Error('Expense amount must be greater than zero.');
    }
    if (!input.expense_date) {
      throw new Error('Expense date is required.');
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isSupabaseConfigured && isValidUUID(input.business_id) && isOnline) {
      try {
        const { data, error } = await (supabase as any)
          .from('expenses')
          .insert({
            business_id: input.business_id,
            category: input.category.trim(),
            description: input.description?.trim() || null,
            amount: input.amount,
            payment_method: input.payment_method || 'cash',
            expense_date: input.expense_date,
            is_recurring: Boolean(input.is_recurring),
          })
          .select('*')
          .single();

        if (!error && data) {
          const key = `${LOCAL_EXPENSES_PREFIX}${input.business_id}`;
          const stored = localStorage.getItem(key);
          const list: Expense[] = stored ? JSON.parse(stored) : [];
          list.unshift(data as Expense);
          localStorage.setItem(key, JSON.stringify(list));
          return data as Expense;
        }
      } catch (e) {
        console.warn('[ExpenseService] Cloud expense creation failed, saving locally:', e);
      }
    }

    // Local execution + offline queue
    const key = `${LOCAL_EXPENSES_PREFIX}${input.business_id}`;
    const stored = localStorage.getItem(key);
    const list: Expense[] = stored ? JSON.parse(stored) : [];

    const now = new Date().toISOString();
    const newExp: Expense = {
      id: generateUUID(),
      business_id: input.business_id,
      category: input.category.trim(),
      description: input.description?.trim() || null,
      amount: Number(input.amount),
      payment_method: input.payment_method || 'cash',
      expense_date: input.expense_date,
      is_recurring: Boolean(input.is_recurring),
      created_by: null,
      created_at: now,
      updated_at: now,
    };

    list.unshift(newExp);
    localStorage.setItem(key, JSON.stringify(list));

    if (isSupabaseConfigured && isValidUUID(input.business_id)) {
      OfflineSyncService.enqueue('expense', input.business_id, newExp);
    }

    return newExp;
  },

  /**
   * Update an expense record.
   */
  async updateExpense(
    businessId: string,
    expenseId: string,
    input: UpdateExpenseInput
  ): Promise<Expense> {
    if (input.amount !== undefined && input.amount <= 0) {
      throw new Error('Expense amount must be greater than zero.');
    }

    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(expenseId)) {
      const { data, error } = await (supabase as any)
        .from('expenses')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .eq('business_id', businessId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as Expense;
    } else {
      const key = `${LOCAL_EXPENSES_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      const list: Expense[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((e) => e.id === expenseId);
      if (idx === -1) throw new Error('Expense record not found.');

      const updated: Expense = {
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
   * Delete an expense record.
   */
  async deleteExpense(businessId: string, expenseId: string): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(expenseId)) {
      const { error } = await (supabase as any)
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('business_id', businessId);

      if (error) throw new Error(error.message);
    } else {
      const key = `${LOCAL_EXPENSES_PREFIX}${businessId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: Expense[] = JSON.parse(stored);
        const filtered = list.filter((e) => e.id !== expenseId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  },

  /**
   * Get aggregate metrics for expenses.
   */
  async getExpenseSummary(
    businessId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ExpenseSummary> {
    const list = await this.getExpenses(businessId, { startDate, endDate });
    let total = 0;
    const breakdown: Record<string, number> = {};

    for (const exp of list) {
      total += exp.amount;
      breakdown[exp.category] = (breakdown[exp.category] || 0) + exp.amount;
    }

    return {
      totalExpenses: total,
      categoryBreakdown: breakdown,
      count: list.length,
    };
  },
};
