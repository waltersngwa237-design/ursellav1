-- ============================================================================
-- Migration 010: Row Level Security (RLS) Architecture & Security Definer Helpers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Security Helper Functions
-- Uses explicitly locked search_path to prevent search_path poisoning attacks.
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

-- ----------------------------------------------------------------------------
-- 2. Enable RLS on all 16 Tables
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. Profiles Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own_or_colleagues" ON public.profiles;
CREATE POLICY "profiles_select_own_or_colleagues" ON public.profiles
    FOR SELECT
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.business_members my_bm
            INNER JOIN public.business_members other_bm ON other_bm.business_id = my_bm.business_id
            WHERE my_bm.user_id = auth.uid() AND other_bm.user_id = profiles.id
        )
    );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Businesses Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "businesses_select_member" ON public.businesses;
CREATE POLICY "businesses_select_member" ON public.businesses
    FOR SELECT
    USING (public.user_has_business_access(id));

DROP POLICY IF EXISTS "businesses_insert_authenticated" ON public.businesses;
CREATE POLICY "businesses_insert_authenticated" ON public.businesses
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "businesses_update_owner_admin" ON public.businesses;
CREATE POLICY "businesses_update_owner_admin" ON public.businesses
    FOR UPDATE
    USING (public.user_has_business_access(id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(id, ARRAY['owner'::member_role, 'admin'::member_role]));

DROP POLICY IF EXISTS "businesses_delete_owner_only" ON public.businesses;
CREATE POLICY "businesses_delete_owner_only" ON public.businesses
    FOR DELETE
    USING (public.user_has_business_access(id, ARRAY['owner'::member_role]));

-- ----------------------------------------------------------------------------
-- 5. Business Members Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "business_members_select" ON public.business_members;
CREATE POLICY "business_members_select" ON public.business_members
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "business_members_insert" ON public.business_members;
CREATE POLICY "business_members_insert" ON public.business_members
    FOR INSERT
    WITH CHECK (
        -- Owners and Admins can add members
        public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role])
        -- Or bootstrap initial owner when business has zero members
        OR (
            auth.uid() = user_id 
            AND role = 'owner'::member_role 
            AND NOT EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_members.business_id)
        )
    );

DROP POLICY IF EXISTS "business_members_update_owner" ON public.business_members;
CREATE POLICY "business_members_update_owner" ON public.business_members
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role]));

DROP POLICY IF EXISTS "business_members_delete_owner" ON public.business_members;
CREATE POLICY "business_members_delete_owner" ON public.business_members
    FOR DELETE
    USING (
        public.user_has_business_access(business_id, ARRAY['owner'::member_role])
        -- Or self-leave if not the sole owner
        OR (user_id = auth.uid() AND role <> 'owner'::member_role)
    );

-- ----------------------------------------------------------------------------
-- 6. Business Settings Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "business_settings_select" ON public.business_settings;
CREATE POLICY "business_settings_select" ON public.business_settings
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "business_settings_insert" ON public.business_settings;
CREATE POLICY "business_settings_insert" ON public.business_settings
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

DROP POLICY IF EXISTS "business_settings_update" ON public.business_settings;
CREATE POLICY "business_settings_update" ON public.business_settings
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- ----------------------------------------------------------------------------
-- 7. Product Categories Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "product_categories_select" ON public.product_categories;
CREATE POLICY "product_categories_select" ON public.product_categories
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "product_categories_insert" ON public.product_categories;
CREATE POLICY "product_categories_insert" ON public.product_categories
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));

DROP POLICY IF EXISTS "product_categories_update" ON public.product_categories;
CREATE POLICY "product_categories_update" ON public.product_categories
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

DROP POLICY IF EXISTS "product_categories_delete" ON public.product_categories;
CREATE POLICY "product_categories_delete" ON public.product_categories
    FOR DELETE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- ----------------------------------------------------------------------------
-- 8. Suppliers Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
CREATE POLICY "suppliers_insert" ON public.suppliers
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));

DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
CREATE POLICY "suppliers_update" ON public.suppliers
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;
CREATE POLICY "suppliers_delete" ON public.suppliers
    FOR DELETE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- ----------------------------------------------------------------------------
-- 9. Products Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role, 'staff'::member_role]));

DROP POLICY IF EXISTS "products_delete_owner_admin" ON public.products;
CREATE POLICY "products_delete_owner_admin" ON public.products
    FOR DELETE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- ----------------------------------------------------------------------------
-- 10. Inventory Transactions Policies (Ledger is Append-Only)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "inventory_tx_select" ON public.inventory_transactions;
CREATE POLICY "inventory_tx_select" ON public.inventory_transactions
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "inventory_tx_insert" ON public.inventory_transactions;
CREATE POLICY "inventory_tx_insert" ON public.inventory_transactions
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

-- Note: No UPDATE or DELETE policy - ledger is strictly immutable for audit integrity.

-- ----------------------------------------------------------------------------
-- 11. Customers Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers
    FOR UPDATE
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_delete" ON public.customers
    FOR DELETE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- ----------------------------------------------------------------------------
-- 12. Sales, Sale Items, and Payments Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "sales_select" ON public.sales;
CREATE POLICY "sales_select" ON public.sales
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "sales_insert" ON public.sales;
CREATE POLICY "sales_insert" ON public.sales
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "sales_update_status" ON public.sales;
CREATE POLICY "sales_update_status" ON public.sales
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- Sale items policies
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;
CREATE POLICY "sale_items_insert" ON public.sale_items
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

-- Payments policies
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

-- ----------------------------------------------------------------------------
-- 13. Expenses Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select" ON public.expenses
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update" ON public.expenses
    FOR UPDATE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete" ON public.expenses
    FOR DELETE
    USING (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

-- ----------------------------------------------------------------------------
-- 14. AI Conversations and Messages Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations
    FOR SELECT
    USING (
        public.user_has_business_access(business_id) 
        AND (user_id = auth.uid() OR public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
    );

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations
    FOR UPDATE
    USING (public.user_has_business_access(business_id) AND user_id = auth.uid())
    WITH CHECK (public.user_has_business_access(business_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations
    FOR DELETE
    USING (public.user_has_business_access(business_id) AND user_id = auth.uid());

-- AI Messages
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages
    FOR SELECT
    USING (
        public.user_has_business_access(business_id)
        AND EXISTS (
            SELECT 1 FROM public.ai_conversations ac
            WHERE ac.id = ai_messages.conversation_id 
              AND (ac.user_id = auth.uid() OR public.user_has_business_access(ai_messages.business_id, ARRAY['owner'::member_role, 'admin'::member_role]))
        )
    );

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages
    FOR INSERT
    WITH CHECK (
        public.user_has_business_access(business_id)
        AND EXISTS (
            SELECT 1 FROM public.ai_conversations ac
            WHERE ac.id = ai_messages.conversation_id AND ac.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 15. AI Insights Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_insights_select" ON public.ai_insights;
CREATE POLICY "ai_insights_select" ON public.ai_insights
    FOR SELECT
    USING (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "ai_insights_insert" ON public.ai_insights;
CREATE POLICY "ai_insights_insert" ON public.ai_insights
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id, ARRAY['owner'::member_role, 'admin'::member_role]));

DROP POLICY IF EXISTS "ai_insights_update" ON public.ai_insights;
CREATE POLICY "ai_insights_update" ON public.ai_insights
    FOR UPDATE
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- ----------------------------------------------------------------------------
-- 16. Notifications Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT
    USING (user_id = auth.uid() AND public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid() AND public.user_has_business_access(business_id))
    WITH CHECK (user_id = auth.uid() AND public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
    FOR DELETE
    USING (user_id = auth.uid() AND public.user_has_business_access(business_id));

-- ----------------------------------------------------------------------------
-- 17. Schema, Table, Sequence, and Routine Grants
-- Essential for Supabase: ensures authenticated and anon roles have PostgreSQL
-- table access so that Row Level Security (RLS) policies can govern operations
-- without triggering "42501: permission denied for table ..." errors.
-- ----------------------------------------------------------------------------

-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Table privileges across all public tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Sequence privileges (for auto-incrementing counters and serial identifiers)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Routine / Function execution privileges
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Explicit table-level grants for all core tables
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
    public.notifications
TO anon, authenticated, service_role;

-- Future objects default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
