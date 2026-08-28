-- ============================================================================
-- Migration 014: Fix Permissions, Roles & Table Grants for Supabase
-- Run this in your Supabase SQL Editor if you see: "42501: permission denied for table ..."
-- ============================================================================

-- 1. Ensure Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant Table-Level Privileges
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant Sequence Privileges
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Grant Function & Procedure Privileges
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Explicit Grants on Core App Tables (Ensures complete coverage)
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

-- 6. Future Objects Default Privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 7. Verify helper functions are accessible and executable
GRANT EXECUTE ON FUNCTION public.user_has_business_access(UUID, member_role[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_business_role(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_business_with_owner(TEXT, TEXT, TEXT, TEXT, VARCHAR, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_complete_sale(UUID, UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, payment_method_type, TEXT, TEXT) TO anon, authenticated, service_role;
