-- ============================================================================
-- Migration 008: High Performance Query and Foreign Key Indexes
-- ============================================================================

-- Businesses & Memberships
CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON public.businesses(created_by);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_composite ON public.business_members(business_id, user_id, role);

-- Products & Inventory
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_business_id ON public.inventory_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_product_id ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_created_at ON public.inventory_transactions(business_id, created_at DESC);

-- Customers & Suppliers
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers(business_id);

-- Sales, Items & Payments
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON public.sales(business_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(business_id, sale_status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_business_id ON public.sale_items(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_id ON public.payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(business_id, paid_at DESC);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(business_id, expense_date DESC);

-- AI & Notifications
CREATE INDEX IF NOT EXISTS idx_ai_conversations_business ON public.ai_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_business ON public.ai_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_business ON public.ai_insights(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON public.notifications(business_id);
