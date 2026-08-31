-- ============================================================================
-- URSELLA BUSINESS OS: Complete Consolidated Database Schema
-- Production PostgreSQL / Supabase Schema Definition
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('owner', 'admin', 'staff');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE inventory_transaction_type AS ENUM (
        'purchase', 'sale', 'adjustment', 'return', 'restock', 'damage', 'initial_stock'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sale_status_type AS ENUM ('completed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM (
        'cash', 'mobile_money', 'bank_transfer', 'card', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ai_role_type AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ai_insight_type AS ENUM (
        'sales', 'inventory', 'cash_flow', 'profit', 'customer', 'expense', 'general'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ai_insight_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ai_insight_status AS ENUM ('new', 'read', 'dismissed', 'actioned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- 2. Businesses
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    business_type TEXT,
    description TEXT,
    country TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    logo_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_businesses_updated_at
    BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Business Members
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_business_user_membership UNIQUE (business_id, user_id)
);

CREATE TRIGGER tr_business_members_updated_at
    BEFORE UPDATE ON public.business_members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Business Settings
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    business_type TEXT,
    tax_enabled BOOLEAN NOT NULL DEFAULT false,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_business_settings_business UNIQUE (business_id)
);

CREATE TRIGGER tr_business_settings_updated_at
    BEFORE UPDATE ON public.business_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Product Categories
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_business_category_name UNIQUE (business_id, name)
);

CREATE TRIGGER tr_product_categories_updated_at
    BEFORE UPDATE ON public.product_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    description TEXT,
    sku TEXT,
    selling_price NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    minimum_stock_level INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock_level >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_sku_unique 
    ON public.products (business_id, sku) 
    WHERE sku IS NOT NULL AND sku <> '';

CREATE TRIGGER tr_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. Inventory Transactions
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    transaction_type inventory_transaction_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_type TEXT,
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 9. Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    phone TEXT,
    email TEXT,
    location TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. Sales
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    amount_due NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (amount_due >= 0),
    payment_status payment_status_type NOT NULL DEFAULT 'unpaid',
    payment_method payment_method_type,
    sale_status sale_status_type NOT NULL DEFAULT 'completed',
    notes TEXT,
    sold_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sold_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_sales_updated_at
    BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    discount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 12. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method payment_method_type NOT NULL,
    reference TEXT,
    notes TEXT,
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 13. Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (char_length(trim(category)) > 0),
    description TEXT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method payment_method_type,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 14. AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    context_type TEXT NOT NULL DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER tr_ai_conversations_updated_at
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 15. AI Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    role ai_role_type NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 16. AI Insights
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    type ai_insight_type NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    summary TEXT NOT NULL,
    severity ai_insight_severity NOT NULL DEFAULT 'info',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status ai_insight_status NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- 17. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    message TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    read_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- High Performance Query & FK Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON public.businesses(created_by);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_composite ON public.business_members(business_id, user_id, role);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_business_id ON public.inventory_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_product_id ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_created_at ON public.inventory_transactions(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers(business_id);

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

CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(business_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_business ON public.ai_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_business ON public.ai_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_business ON public.ai_insights(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON public.notifications(business_id);

-- ----------------------------------------------------------------------------
-- Stored Procedures & Atomic Business Logic
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_business_with_owner(
    p_name TEXT,
    p_business_type TEXT DEFAULT 'retail',
    p_description TEXT DEFAULT NULL,
    p_country TEXT DEFAULT 'US',
    p_currency VARCHAR(10) DEFAULT 'USD',
    p_timezone TEXT DEFAULT 'UTC',
    p_logo_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_business_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a business.';
    END IF;

    IF p_name IS NULL OR char_length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Business name cannot be empty.';
    END IF;

    INSERT INTO public.businesses (
        name, business_type, description, country, currency, timezone, logo_url, created_by
    ) VALUES (
        trim(p_name), p_business_type, p_description, p_country, COALESCE(p_currency, 'USD'), COALESCE(p_timezone, 'UTC'), p_logo_url, v_user_id
    ) RETURNING id INTO v_business_id;

    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (v_business_id, v_user_id, 'owner'::member_role);

    INSERT INTO public.business_settings (
        business_id, currency, timezone, business_type, tax_enabled, tax_rate, low_stock_threshold
    ) VALUES (
        v_business_id, COALESCE(p_currency, 'USD'), COALESCE(p_timezone, 'UTC'), p_business_type, false, 0.00, 5
    );

    RETURN v_business_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_complete_sale(
    p_business_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_discount NUMERIC(14,2) DEFAULT 0.00,
    p_tax NUMERIC(14,2) DEFAULT 0.00,
    p_payment_amount NUMERIC(14,2) DEFAULT 0.00,
    p_payment_method payment_method_type DEFAULT 'cash',
    p_payment_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_member_role member_role;
    v_sale_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_calculated_subtotal NUMERIC(14,2) := 0.00;
    v_item_subtotal NUMERIC(14,2);
    v_item_total NUMERIC(14,2);
    v_calculated_total NUMERIC(14,2);
    v_amount_paid NUMERIC(14,2);
    v_amount_due NUMERIC(14,2);
    v_payment_status payment_status_type;
BEGIN
    v_user_id := auth.uid();
    
    SELECT role INTO v_member_role
    FROM public.business_members
    WHERE business_id = p_business_id AND user_id = v_user_id;

    IF v_member_role IS NULL THEN
        RAISE EXCEPTION 'Access denied. You are not an authorized member of this business.';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot complete sale: A sale must contain at least one item.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INTEGER,
        unit_price NUMERIC(14,2),
        discount NUMERIC(14,2)
    )
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Sale item quantity must be greater than zero.';
        END IF;

        IF v_item.product_id IS NOT NULL THEN
            SELECT id, name, cost_price, selling_price, stock_quantity, is_active
            INTO v_product
            FROM public.products
            WHERE id = v_item.product_id AND business_id = p_business_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product % does not exist in this business.', v_item.product_id;
            END IF;

            IF NOT v_product.is_active THEN
                RAISE EXCEPTION 'Product "%" is archived and cannot be sold.', v_product.name;
            END IF;

            IF v_product.stock_quantity < v_item.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for product "%". Requested: %, Available: %',
                    v_product.name, v_item.quantity, v_product.stock_quantity;
            END IF;
        END IF;

        v_item_subtotal := COALESCE(v_item.unit_price, 0.00) * v_item.quantity;
        v_calculated_subtotal := v_calculated_subtotal + (v_item_subtotal - COALESCE(v_item.discount, 0.00));
    END LOOP;

    v_calculated_total := v_calculated_subtotal - COALESCE(p_discount, 0.00) + COALESCE(p_tax, 0.00);
    IF v_calculated_total < 0 THEN v_calculated_total := 0.00; END IF;

    v_amount_paid := COALESCE(p_payment_amount, 0.00);
    IF v_amount_paid > v_calculated_total THEN v_amount_paid := v_calculated_total; END IF;
    v_amount_due := v_calculated_total - v_amount_paid;

    IF v_amount_paid >= v_calculated_total AND v_calculated_total > 0 THEN
        v_payment_status := 'paid'::payment_status_type;
    ELSIF v_amount_paid > 0 THEN
        v_payment_status := 'partial'::payment_status_type;
    ELSE
        v_payment_status := 'unpaid'::payment_status_type;
    END IF;

    INSERT INTO public.sales (
        business_id, customer_id, subtotal, discount, tax, total, amount_paid, amount_due, payment_status, payment_method, sale_status, notes, sold_by, sold_at
    ) VALUES (
        p_business_id, p_customer_id, v_calculated_subtotal, COALESCE(p_discount, 0.00), COALESCE(p_tax, 0.00), v_calculated_total, v_amount_paid, v_amount_due, v_payment_status,
        CASE WHEN v_amount_paid > 0 THEN p_payment_method ELSE NULL END, 'completed'::sale_status_type, p_notes, v_user_id, clock_timestamp()
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INTEGER,
        unit_price NUMERIC(14,2),
        discount NUMERIC(14,2)
    )
    LOOP
        IF v_item.product_id IS NOT NULL THEN
            SELECT id, name, cost_price, selling_price, stock_quantity
            INTO v_product
            FROM public.products
            WHERE id = v_item.product_id AND business_id = p_business_id;

            v_item_subtotal := COALESCE(v_item.unit_price, v_product.selling_price) * v_item.quantity;
            v_item_total := v_item_subtotal - COALESCE(v_item.discount, 0.00);

            INSERT INTO public.sale_items (
                sale_id, business_id, product_id, product_name_snapshot, quantity, unit_price, unit_cost, discount, subtotal, total
            ) VALUES (
                v_sale_id, p_business_id, v_item.product_id, v_product.name, v_item.quantity, COALESCE(v_item.unit_price, v_product.selling_price), v_product.cost_price, COALESCE(v_item.discount, 0.00), v_item_subtotal, v_item_total
            );

            UPDATE public.products
            SET stock_quantity = stock_quantity - v_item.quantity, updated_at = clock_timestamp()
            WHERE id = v_item.product_id AND business_id = p_business_id;

            INSERT INTO public.inventory_transactions (
                business_id, product_id, transaction_type, quantity, reference_type, reference_id, notes, created_by
            ) VALUES (
                p_business_id, v_item.product_id, 'sale'::inventory_transaction_type, v_item.quantity, 'sale', v_sale_id, format('Sale #%s items deducted', substring(v_sale_id::text from 1 for 8)), v_user_id
            );
        END IF;
    END LOOP;

    IF v_amount_paid > 0 THEN
        INSERT INTO public.payments (
            business_id, sale_id, customer_id, amount, payment_method, reference, notes, received_by, paid_at
        ) VALUES (
            p_business_id, v_sale_id, p_customer_id, v_amount_paid, p_payment_method, p_payment_reference, p_notes, v_user_id, clock_timestamp()
        );
    END IF;

    RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_movement(
    p_business_id UUID,
    p_product_id UUID,
    p_type inventory_transaction_type,
    p_quantity INTEGER,
    p_reference_type TEXT DEFAULT 'manual',
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_member_role member_role;
    v_product RECORD;
    v_new_stock INTEGER;
    v_tx_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    SELECT role INTO v_member_role
    FROM public.business_members
    WHERE business_id = p_business_id AND user_id = v_user_id;

    IF v_member_role IS NULL THEN
        RAISE EXCEPTION 'Access denied. You are not an authorized member of this business.';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Inventory movement quantity must be strictly positive.';
    END IF;

    SELECT id, name, stock_quantity INTO v_product
    FROM public.products
    WHERE id = p_product_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % does not exist in business %', p_product_id, p_business_id;
    END IF;

    IF p_type IN ('purchase', 'restock', 'return') THEN
        v_new_stock := v_product.stock_quantity + p_quantity;
    ELSIF p_type IN ('sale', 'damage') THEN
        IF v_product.stock_quantity < p_quantity THEN
            RAISE EXCEPTION 'Cannot deduct % units from product "%". Current stock is %.', p_quantity, v_product.name, v_product.stock_quantity;
        END IF;
        v_new_stock := v_product.stock_quantity - p_quantity;
    ELSIF p_type = 'adjustment' OR p_type = 'initial_stock' THEN
        v_new_stock := p_quantity;
    ELSE
        RAISE EXCEPTION 'Unknown transaction type: %', p_type;
    END IF;

    UPDATE public.products
    SET stock_quantity = v_new_stock, updated_at = clock_timestamp()
    WHERE id = p_product_id AND business_id = p_business_id;

    INSERT INTO public.inventory_transactions (
        business_id, product_id, transaction_type, quantity, reference_type, reference_id, notes, created_by
    ) VALUES (
        p_business_id, p_product_id, p_type, p_quantity, p_reference_type, p_reference_id, p_notes, v_user_id
    ) RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_dashboard_summary(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_revenue NUMERIC(14,2) := 0.00;
    v_cogs NUMERIC(14,2) := 0.00;
    v_gross_profit NUMERIC(14,2) := 0.00;
    v_total_expenses NUMERIC(14,2) := 0.00;
    v_net_profit NUMERIC(14,2) := 0.00;
    v_transaction_count INTEGER := 0;
    v_average_order_value NUMERIC(14,2) := 0.00;
    v_outstanding_receivables NUMERIC(14,2) := 0.00;
    v_total_inventory_valuation NUMERIC(14,2) := 0.00;
    v_low_stock_count INTEGER := 0;
    v_low_stock_threshold INTEGER := 5;
    v_currency VARCHAR(10) := 'USD';
BEGIN
    v_user_id := auth.uid();
    
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied. You do not belong to this business.';
    END IF;

    v_start := COALESCE(p_start_date, date_trunc('month', clock_timestamp()));
    v_end := COALESCE(p_end_date, clock_timestamp());

    SELECT COALESCE(s.low_stock_threshold, 5), COALESCE(b.currency, 'USD')
    INTO v_low_stock_threshold, v_currency
    FROM public.businesses b
    LEFT JOIN public.business_settings s ON s.business_id = b.id
    WHERE b.id = p_business_id;

    SELECT 
        COALESCE(SUM(total), 0.00),
        COUNT(id),
        COALESCE(SUM(amount_due), 0.00)
    INTO 
        v_revenue,
        v_transaction_count,
        v_outstanding_receivables
    FROM public.sales
    WHERE business_id = p_business_id 
      AND sale_status = 'completed'
      AND sold_at >= v_start 
      AND sold_at <= v_end;

    IF v_transaction_count > 0 THEN
        v_average_order_value := ROUND(v_revenue / v_transaction_count, 2);
    END IF;

    SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0.00)
    INTO v_cogs
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id 
      AND s.sale_status = 'completed'
      AND s.sold_at >= v_start 
      AND s.sold_at <= v_end;

    v_gross_profit := v_revenue - v_cogs;

    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_total_expenses
    FROM public.expenses
    WHERE business_id = p_business_id 
      AND expense_date >= v_start::DATE 
      AND expense_date <= v_end::DATE;

    v_net_profit := v_gross_profit - v_total_expenses;

    SELECT 
        COALESCE(SUM(stock_quantity * cost_price), 0.00),
        COUNT(CASE WHEN stock_quantity <= COALESCE(minimum_stock_level, v_low_stock_threshold) THEN 1 END)
    INTO 
        v_total_inventory_valuation,
        v_low_stock_count
    FROM public.products
    WHERE business_id = p_business_id AND is_active = true;

    RETURN jsonb_build_object(
        'business_id', p_business_id,
        'currency', v_currency,
        'period_start', v_start,
        'period_end', v_end,
        'revenue', v_revenue,
        'cost_of_goods_sold', v_cogs,
        'gross_profit', v_gross_profit,
        'expenses', v_total_expenses,
        'net_profit', v_net_profit,
        'transaction_count', v_transaction_count,
        'average_order_value', v_average_order_value,
        'outstanding_receivables', v_outstanding_receivables,
        'inventory_valuation', v_total_inventory_valuation,
        'low_stock_count', v_low_stock_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_business_context(
    p_business_id UUID,
    p_time_horizon_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_since TIMESTAMPTZ;
    v_business RECORD;
    v_summary JSONB;
    v_top_products JSONB;
    v_low_stock_items JSONB;
    v_recent_expenses JSONB;
    v_customer_summary JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied: You are not authorized to access business AI context.';
    END IF;

    v_since := clock_timestamp() - (COALESCE(p_time_horizon_days, 30) || ' days')::INTERVAL;

    SELECT b.name, b.business_type, b.country, b.currency, b.timezone
    INTO v_business
    FROM public.businesses b
    WHERE b.id = p_business_id;

    v_summary := public.get_business_dashboard_summary(p_business_id, v_since, clock_timestamp());

    SELECT jsonb_agg(sub) INTO v_top_products FROM (
        SELECT 
            si.product_name_snapshot AS product_name,
            SUM(si.quantity) AS total_units_sold,
            SUM(si.total) AS total_revenue,
            SUM(si.total - (si.unit_cost * si.quantity)) AS gross_profit
        FROM public.sale_items si
        INNER JOIN public.sales s ON s.id = si.sale_id
        WHERE s.business_id = p_business_id 
          AND s.sale_status = 'completed'
          AND s.sold_at >= v_since
        GROUP BY si.product_name_snapshot
        ORDER BY total_revenue DESC
        LIMIT 5
    ) sub;

    SELECT jsonb_agg(sub) INTO v_low_stock_items FROM (
        SELECT 
            p.name,
            p.sku,
            p.stock_quantity,
            p.minimum_stock_level,
            c.name AS category_name
        FROM public.products p
        LEFT JOIN public.product_categories c ON c.id = p.category_id
        WHERE p.business_id = p_business_id 
          AND p.is_active = true 
          AND p.stock_quantity <= p.minimum_stock_level
        ORDER BY p.stock_quantity ASC
        LIMIT 10
    ) sub;

    SELECT jsonb_agg(sub) INTO v_recent_expenses FROM (
        SELECT 
            category,
            COUNT(id) AS count,
            SUM(amount) AS total_amount
        FROM public.expenses
        WHERE business_id = p_business_id 
          AND expense_date >= v_since::DATE
        GROUP BY category
        ORDER BY total_amount DESC
    ) sub;

    SELECT jsonb_build_object(
        'total_registered_customers', COUNT(id),
        'active_customers', COUNT(CASE WHEN is_active THEN 1 END)
    ) INTO v_customer_summary
    FROM public.customers
    WHERE business_id = p_business_id;

    RETURN jsonb_build_object(
        'business_overview', jsonb_build_object(
            'id', p_business_id,
            'name', v_business.name,
            'business_type', v_business.business_type,
            'country', v_business.country,
            'currency', v_business.currency,
            'timezone', v_business.timezone
        ),
        'time_horizon_days', p_time_horizon_days,
        'financial_metrics', v_summary,
        'top_performing_products', COALESCE(v_top_products, '[]'::jsonb),
        'inventory_alerts', COALESCE(v_low_stock_items, '[]'::jsonb),
        'expense_breakdown', COALESCE(v_recent_expenses, '[]'::jsonb),
        'customer_insights', v_customer_summary
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Helper Functions & Policies
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_business_role(p_business_id UUID)
RETURNS member_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role member_role;
BEGIN
    SELECT role INTO v_role
    FROM public.business_members
    WHERE business_id = p_business_id AND user_id = auth.uid();
    RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_business_access(
    p_business_id UUID,
    p_allowed_roles member_role[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role member_role;
BEGIN
    IF auth.uid() IS NULL OR p_business_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT role INTO v_role
    FROM public.business_members
    WHERE business_id = p_business_id AND user_id = auth.uid();

    IF v_role IS NULL THEN
        RETURN false;
    END IF;

    IF p_allowed_roles IS NULL OR cardinality(p_allowed_roles) = 0 THEN
        RETURN true;
    END IF;

    RETURN v_role = ANY(p_allowed_roles);
END;
$$;

-- Enable RLS on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "profiles_select_own_or_colleagues" ON public.profiles FOR SELECT
    USING (id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.business_members my_bm
        INNER JOIN public.business_members other_bm ON other_bm.business_id = my_bm.business_id
        WHERE my_bm.user_id = auth.uid() AND other_bm.user_id = profiles.id
    ));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Businesses Policies
CREATE POLICY "businesses_select_member" ON public.businesses FOR SELECT USING (public.user_has_business_access(id));
CREATE POLICY "businesses_insert_authenticated" ON public.businesses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);
CREATE POLICY "businesses_update_owner_admin" ON public.businesses FOR UPDATE 
    USING (public.user_has_business_access(id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "businesses_delete_owner_only" ON public.businesses FOR DELETE USING (public.user_has_business_access(id, ARRAY['owner'::member_role]));

-- Business Members Policies
CREATE POLICY "business_members_select" ON public.business_members FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "business_members_insert" ON public.business_members FOR INSERT
    WITH CHECK (
        public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])
        OR (auth.uid() = user_id AND role = 'owner'::member_role AND NOT EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_members.business_id))
    );
CREATE POLICY "business_members_update_owner" ON public.business_members FOR UPDATE 
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role]));
CREATE POLICY "business_members_delete_owner" ON public.business_members FOR DELETE 
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role]) OR (user_id = auth.uid() AND role <> 'owner'::member_role));

-- Business Settings Policies
CREATE POLICY "business_settings_select" ON public.business_settings FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "business_settings_insert" ON public.business_settings FOR INSERT WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "business_settings_update" ON public.business_settings FOR UPDATE 
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- Product Categories Policies
CREATE POLICY "product_categories_select" ON public.product_categories FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "product_categories_insert" ON public.product_categories FOR INSERT WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));
CREATE POLICY "product_categories_update" ON public.product_categories FOR UPDATE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])) WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "product_categories_delete" ON public.product_categories FOR DELETE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- Suppliers Policies
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])) WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- Products Policies
CREATE POLICY "products_select" ON public.products FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role])) WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));
CREATE POLICY "products_delete_owner_admin" ON public.products FOR DELETE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- Inventory Transactions Policies
CREATE POLICY "inventory_tx_select" ON public.inventory_transactions FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "inventory_tx_insert" ON public.inventory_transactions FOR INSERT WITH CHECK (public.user_has_business_access(business_id));

-- Customers Policies
CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- Sales, Sale Items, Payments Policies
CREATE POLICY "sales_select" ON public.sales FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "sales_insert" ON public.sales FOR INSERT WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "sales_update_status" ON public.sales FOR UPDATE 
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

CREATE POLICY "sale_items_select" ON public.sale_items FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "sale_items_insert" ON public.sale_items FOR INSERT WITH CHECK (public.user_has_business_access(business_id));

CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (public.user_has_business_access(business_id));

-- Expenses Policies
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])) WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- AI Conversations & Messages Policies
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT 
    USING (public.user_has_business_access(business_id) AND (user_id = auth.uid() OR public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])));
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT WITH CHECK (public.user_has_business_access(business_id) AND user_id = auth.uid());
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE USING (public.user_has_business_access(business_id) AND user_id = auth.uid()) WITH CHECK (public.user_has_business_access(business_id) AND user_id = auth.uid());
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE USING (public.user_has_business_access(business_id) AND user_id = auth.uid());

CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT 
    USING (public.user_has_business_access(business_id) AND EXISTS (
        SELECT 1 FROM public.ai_conversations ac
        WHERE ac.id = ai_messages.conversation_id AND (ac.user_id = auth.uid() OR public.user_has_business_access(ai_messages.business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    ));
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT 
    WITH CHECK (public.user_has_business_access(business_id) AND EXISTS (
        SELECT 1 FROM public.ai_conversations ac WHERE ac.id = ai_messages.conversation_id AND ac.user_id = auth.uid()
    ));

-- AI Insights Policies
CREATE POLICY "ai_insights_select" ON public.ai_insights FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "ai_insights_insert" ON public.ai_insights FOR INSERT WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "ai_insights_update" ON public.ai_insights FOR UPDATE USING (public.user_has_business_access(business_id)) WITH CHECK (public.user_has_business_access(business_id));

-- Notifications Policies
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid() AND public.user_has_business_access(business_id));
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid() AND public.user_has_business_access(business_id)) WITH CHECK (user_id = auth.uid() AND public.user_has_business_access(business_id));
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (user_id = auth.uid() AND public.user_has_business_access(business_id));

-- ============================================================================
-- 18. SUBSCRIPTION PLANS & COMMERCIAL TIERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'business', 'enterprise')),
    description TEXT NOT NULL,
    monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    annual_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_members INT NOT NULL DEFAULT 1,
    ai_monthly_quota INT NOT NULL DEFAULT 100,
    max_products INT NOT NULL DEFAULT 100,
    allows_csv_import BOOLEAN NOT NULL DEFAULT true,
    allows_export BOOLEAN NOT NULL DEFAULT true,
    allows_advanced_reports BOOLEAN NOT NULL DEFAULT false,
    allows_push_notifications BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_plans_read_all" ON public.subscription_plans FOR SELECT USING (true);

-- Seed Default Plans
INSERT INTO public.subscription_plans (
    id, name, tier, description, monthly_price, annual_price, currency, features_json, max_members, ai_monthly_quota, max_products, allows_csv_import, allows_export, allows_advanced_reports, allows_push_notifications, is_active
) VALUES 
(
    'plan_free',
    'Starter Free',
    'free',
    'Essential POS, inventory and deterministic analytics for single-operator stores.',
    0,
    0,
    'USD',
    '["Core POS Sales & Digital Receipts", "Deterministic Financial Metrics", "1 Team Member / Operator", "100 AI Queries / Month", "Standard Inventory Tracking", "Basic Sales & Expense Reports"]'::jsonb,
    1,
    100,
    100,
    true,
    true,
    false,
    false,
    true
),
(
    'plan_pro',
    'Ursella Pro',
    'pro',
    'Proactive AI anomaly detection, team roles, WhatsApp reminders, and multi-device access.',
    15,
    150,
    'USD',
    '["All Starter Free Capabilities", "Continuous Proactive Anomaly Alerts", "Up to 5 Team Members with RBAC", "1,000 AI Queries / Month", "Full Financial Statement Reports & PDF", "CSV Data Import & Bulk Migration", "Customer WhatsApp Debt Reminders"]'::jsonb,
    5,
    1000,
    2500,
    true,
    true,
    true,
    true,
    true
),
(
    'plan_business',
    'Ursella Scale',
    'business',
    'High-velocity shops, wholesale distributors, and multi-branch commercial operations.',
    45,
    450,
    'USD',
    '["All Ursella Pro Capabilities", "Unlimited Team Members & Roles", "10,000 AI Queries / Month", "Automated Action Authorizations", "Priority MoMo & Card Webhooks", "Full Audit Trail & Export API", "Dedicated Account Support"]'::jsonb,
    50,
    10000,
    100000,
    true,
    true,
    true,
    true,
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    annual_price = EXCLUDED.annual_price,
    features_json = EXCLUDED.features_json,
    max_members = EXCLUDED.max_members,
    ai_monthly_quota = EXCLUDED.ai_monthly_quota,
    max_products = EXCLUDED.max_products,
    allows_advanced_reports = EXCLUDED.allows_advanced_reports,
    allows_push_notifications = EXCLUDED.allows_push_notifications;

-- 19. Business Subscriptions Table
CREATE TABLE IF NOT EXISTS public.business_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'incomplete')),
    provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('momo', 'stripe', 'flutterwave', 'paystack', 'manual')),
    provider_subscription_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + interval '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_business_subscriptions_business UNIQUE (business_id)
);

ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_subscriptions_select" ON public.business_subscriptions FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "business_subscriptions_insert" ON public.business_subscriptions FOR INSERT WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));
CREATE POLICY "business_subscriptions_update" ON public.business_subscriptions FOR UPDATE USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])) WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- 20. AI Usage Logs Table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    model TEXT NOT NULL,
    latency_ms INT NOT NULL DEFAULT 0,
    tokens_in INT NOT NULL DEFAULT 0,
    tokens_out INT NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_logs_select" ON public.ai_usage_logs FOR SELECT USING (public.user_has_business_access(business_id));
CREATE POLICY "ai_usage_logs_insert" ON public.ai_usage_logs FOR INSERT WITH CHECK (public.user_has_business_access(business_id));

-- ============================================================================
-- SCHEMA & TABLE PERMISSIONS (GRANTS)
-- Critical for Supabase: Grants Postgres access permissions to anon, authenticated,
-- and service_role so RLS policies can evaluate queries without 42501 permission errors.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON TABLE 
    public.profiles,
    public.businesses,
    public.business_members,
    public.business_settings,
    public.product_categories,
    public.suppliers,
    public.products,
    public.inventory_transactions,
    public.customers,
    public.sales,
    public.sale_items,
    public.payments,
    public.expenses,
    public.ai_conversations,
    public.ai_messages,
    public.ai_insights,
    public.notifications,
    public.subscription_plans,
    public.business_subscriptions,
    public.ai_usage_logs
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

