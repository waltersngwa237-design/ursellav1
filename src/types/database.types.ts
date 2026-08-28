/**
 * Ursella Business OS - Database Type Definitions
 * Auto-generated TypeScript types matching Supabase PostgreSQL schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = 'owner' | 'admin' | 'staff';

export type InventoryTransactionType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'return'
  | 'restock'
  | 'damage'
  | 'initial_stock';

export type PaymentStatusType = 'paid' | 'partial' | 'unpaid';

export type SaleStatusType = 'completed' | 'cancelled' | 'refunded';

export type PaymentMethodType =
  | 'cash'
  | 'mobile_money'
  | 'bank_transfer'
  | 'card'
  | 'other';

export type AIRoleType = 'user' | 'assistant' | 'system';

export type AIInsightType =
  | 'sales'
  | 'inventory'
  | 'cash_flow'
  | 'profit'
  | 'customer'
  | 'expense'
  | 'general';

export type AIInsightSeverity = 'info' | 'warning' | 'critical';

export type AIInsightStatus = 'new' | 'read' | 'dismissed' | 'actioned';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          business_type: string | null;
          description: string | null;
          country: string | null;
          currency: string;
          timezone: string;
          logo_url: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_type?: string | null;
          description?: string | null;
          country?: string | null;
          currency?: string;
          timezone?: string;
          logo_url?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_type?: string | null;
          description?: string | null;
          country?: string | null;
          currency?: string;
          timezone?: string;
          logo_url?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      business_settings: {
        Row: {
          id: string;
          business_id: string;
          currency: string;
          timezone: string;
          business_type: string | null;
          tax_enabled: boolean;
          tax_rate: number;
          low_stock_threshold: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          currency?: string;
          timezone?: string;
          business_type?: string | null;
          tax_enabled?: boolean;
          tax_rate?: number;
          low_stock_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          currency?: string;
          timezone?: string;
          business_type?: string | null;
          tax_enabled?: boolean;
          tax_rate?: number;
          low_stock_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_categories: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          business_id: string;
          category_id: string | null;
          supplier_id: string | null;
          name: string;
          description: string | null;
          sku: string | null;
          selling_price: number;
          cost_price: number;
          stock_quantity: number;
          minimum_stock_level: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          category_id?: string | null;
          supplier_id?: string | null;
          name: string;
          description?: string | null;
          sku?: string | null;
          selling_price?: number;
          cost_price?: number;
          stock_quantity?: number;
          minimum_stock_level?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          name?: string;
          description?: string | null;
          sku?: string | null;
          selling_price?: number;
          cost_price?: number;
          stock_quantity?: number;
          minimum_stock_level?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory_transactions: {
        Row: {
          id: string;
          business_id: string;
          product_id: string;
          transaction_type: InventoryTransactionType;
          quantity: number;
          reference_type: string | null;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          product_id: string;
          transaction_type: InventoryTransactionType;
          quantity: number;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          product_id?: string;
          transaction_type?: InventoryTransactionType;
          quantity?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          location: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          location?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          location?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          subtotal: number;
          discount: number;
          tax: number;
          total: number;
          amount_paid: number;
          amount_due: number;
          payment_status: PaymentStatusType;
          payment_method: PaymentMethodType | null;
          sale_status: SaleStatusType;
          notes: string | null;
          sold_by: string | null;
          sold_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id?: string | null;
          subtotal?: number;
          discount?: number;
          tax?: number;
          total?: number;
          amount_paid?: number;
          amount_due?: number;
          payment_status?: PaymentStatusType;
          payment_method?: PaymentMethodType | null;
          sale_status?: SaleStatusType;
          notes?: string | null;
          sold_by?: string | null;
          sold_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string | null;
          subtotal?: number;
          discount?: number;
          tax?: number;
          total?: number;
          amount_paid?: number;
          amount_due?: number;
          payment_status?: PaymentStatusType;
          payment_method?: PaymentMethodType | null;
          sale_status?: SaleStatusType;
          notes?: string | null;
          sold_by?: string | null;
          sold_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          business_id: string;
          product_id: string | null;
          product_name_snapshot: string;
          quantity: number;
          unit_price: number;
          unit_cost: number;
          discount: number;
          subtotal: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          business_id: string;
          product_id?: string | null;
          product_name_snapshot: string;
          quantity: number;
          unit_price: number;
          unit_cost?: number;
          discount?: number;
          subtotal: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          business_id?: string;
          product_id?: string | null;
          product_name_snapshot?: string;
          quantity?: number;
          unit_price?: number;
          unit_cost?: number;
          discount?: number;
          subtotal?: number;
          total?: number;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          sale_id: string | null;
          customer_id: string | null;
          amount: number;
          payment_method: PaymentMethodType;
          reference: string | null;
          notes: string | null;
          received_by: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          sale_id?: string | null;
          customer_id?: string | null;
          amount: number;
          payment_method: PaymentMethodType;
          reference?: string | null;
          notes?: string | null;
          received_by?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          sale_id?: string | null;
          customer_id?: string | null;
          amount?: number;
          payment_method?: PaymentMethodType;
          reference?: string | null;
          notes?: string | null;
          received_by?: string | null;
          paid_at?: string;
          created_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          business_id: string;
          category: string;
          description: string | null;
          amount: number;
          payment_method: PaymentMethodType | null;
          expense_date: string;
          is_recurring: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          category: string;
          description?: string | null;
          amount: number;
          payment_method?: PaymentMethodType | null;
          expense_date?: string;
          is_recurring?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          category?: string;
          description?: string | null;
          amount?: number;
          payment_method?: PaymentMethodType | null;
          expense_date?: string;
          is_recurring?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          title: string;
          context_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          title: string;
          context_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          title?: string;
          context_type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          business_id: string;
          role: AIRoleType;
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          business_id: string;
          role: AIRoleType;
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          business_id?: string;
          role?: AIRoleType;
          content?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
      ai_insights: {
        Row: {
          id: string;
          business_id: string;
          type: AIInsightType;
          title: string;
          summary: string;
          severity: AIInsightSeverity;
          data: Json;
          status: AIInsightStatus;
          created_at: string;
          expires_at: string | null;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          type: AIInsightType;
          title: string;
          summary: string;
          severity?: AIInsightSeverity;
          data?: Json;
          status?: AIInsightStatus;
          created_at?: string;
          expires_at?: string | null;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          type?: AIInsightType;
          title?: string;
          summary?: string;
          severity?: AIInsightSeverity;
          data?: Json;
          status?: AIInsightStatus;
          created_at?: string;
          expires_at?: string | null;
          read_at?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: Json;
          is_read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: Json;
          is_read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          data?: Json;
          is_read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_business_with_owner: {
        Args: {
          p_name: string;
          p_business_type?: string;
          p_description?: string | null;
          p_country?: string;
          p_currency?: string;
          p_timezone?: string;
          p_logo_url?: string | null;
        };
        Returns: string;
      };
      process_complete_sale: {
        Args: {
          p_business_id: string;
          p_customer_id?: string | null;
          p_items?: Json;
          p_discount?: number;
          p_tax?: number;
          p_payment_amount?: number;
          p_payment_method?: PaymentMethodType;
          p_payment_reference?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      record_inventory_movement: {
        Args: {
          p_business_id: string;
          p_product_id: string;
          p_type: InventoryTransactionType;
          p_quantity: number;
          p_reference_type?: string;
          p_reference_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      get_business_dashboard_summary: {
        Args: {
          p_business_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: Json;
      };
      get_ai_business_context: {
        Args: {
          p_business_id: string;
          p_time_horizon_days?: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      member_role: MemberRole;
      inventory_transaction_type: InventoryTransactionType;
      payment_status_type: PaymentStatusType;
      sale_status_type: SaleStatusType;
      payment_method_type: PaymentMethodType;
      ai_role_type: AIRoleType;
      ai_insight_type: AIInsightType;
      ai_insight_severity: AIInsightSeverity;
      ai_insight_status: AIInsightStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

