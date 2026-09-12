-- =============================================================================
-- Migration 019: Payments Compatibility, Inventory Integrity & Service Analytics
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Payments Table Compatibility Columns & Bidirectional Synchronization
-- -----------------------------------------------------------------------------
-- Ensures seamless interoperability across both historical and updated schemas:
-- (reference <-> reference_number, paid_at <-> payment_date, received_by <-> created_by)

ALTER TABLE public.payments 
    ADD COLUMN IF NOT EXISTS reference_number TEXT,
    ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill compatibility columns
UPDATE public.payments 
SET 
    reference_number = COALESCE(reference_number, reference),
    reference = COALESCE(reference, reference_number),
    payment_date = COALESCE(payment_date, paid_at, clock_timestamp()),
    paid_at = COALESCE(paid_at, payment_date, clock_timestamp()),
    created_by = COALESCE(created_by, received_by),
    received_by = COALESCE(received_by, created_by);

-- Trigger function for continuous bidirectional synchronization
CREATE OR REPLACE FUNCTION public.sync_payments_compat_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.reference := COALESCE(NEW.reference, NEW.reference_number);
    NEW.reference_number := COALESCE(NEW.reference_number, NEW.reference);
    
    NEW.paid_at := COALESCE(NEW.paid_at, NEW.payment_date, clock_timestamp());
    NEW.payment_date := COALESCE(NEW.payment_date, NEW.paid_at, clock_timestamp());

    NEW.received_by := COALESCE(NEW.received_by, NEW.created_by);
    NEW.created_by := COALESCE(NEW.created_by, NEW.received_by);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_payments_sync_compat ON public.payments;
CREATE TRIGGER tr_payments_sync_compat
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_payments_compat_columns();

-- -----------------------------------------------------------------------------
-- 2. Update get_business_dashboard_summary to properly isolate physical products
-- -----------------------------------------------------------------------------
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
    
    -- Check Membership
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied. You do not belong to this business.';
    END IF;

    -- Defaults: current month or supplied window
    v_start := COALESCE(p_start_date, date_trunc('month', clock_timestamp()));
    v_end := COALESCE(p_end_date, clock_timestamp());

    -- Fetch Business Settings for threshold & currency
    SELECT COALESCE(s.low_stock_threshold, 5), COALESCE(b.currency, 'USD')
    INTO v_low_stock_threshold, v_currency
    FROM public.businesses b
    LEFT JOIN public.business_settings s ON s.business_id = b.id
    WHERE b.id = p_business_id;

    -- 1. Sales & Revenue in Date Window
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

    -- 2. Cost of Goods Sold (using historical snapshot unit_cost)
    SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0.00)
    INTO v_cogs
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id 
      AND s.sale_status = 'completed'
      AND s.sold_at >= v_start 
      AND s.sold_at <= v_end;

    v_gross_profit := v_revenue - v_cogs;

    -- 3. Expenses in Date Window
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_total_expenses
    FROM public.expenses
    WHERE business_id = p_business_id 
      AND expense_date >= v_start::DATE 
      AND expense_date <= v_end::DATE;

    v_net_profit := v_gross_profit - v_total_expenses;

    -- 4. Current Inventory Valuation & Low Stock Count (Physical products only)
    SELECT 
        COALESCE(SUM(CASE WHEN product_type = 'physical' THEN stock_quantity * cost_price ELSE 0 END), 0.00),
        COUNT(CASE WHEN product_type = 'physical' AND stock_quantity <= COALESCE(minimum_stock_level, v_low_stock_threshold) THEN 1 END)
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

-- -----------------------------------------------------------------------------
-- 3. Update get_ai_business_context to filter services from low-stock alerts
-- -----------------------------------------------------------------------------
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
    
    -- Verify Business Membership
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied: You are not authorized to access business AI context.';
    END IF;

    v_since := clock_timestamp() - (COALESCE(p_time_horizon_days, 30) || ' days')::INTERVAL;

    -- Business Profile
    SELECT b.name, b.business_type, b.country, b.currency, b.timezone
    INTO v_business
    FROM public.businesses b
    WHERE b.id = p_business_id;

    -- Financial summary in horizon
    v_summary := public.get_business_dashboard_summary(p_business_id, v_since, clock_timestamp());

    -- Top 5 performing products by revenue
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

    -- Low stock items requiring restock attention (Physical products only)
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
          AND p.product_type = 'physical'
          AND p.stock_quantity <= p.minimum_stock_level
        ORDER BY p.stock_quantity ASC
        LIMIT 10
    ) sub;

    -- Expense breakdown by category
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
        LIMIT 10
    ) sub;

    -- Customer metrics
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

-- -----------------------------------------------------------------------------
-- 4. Update get_business_analytics to properly handle service products
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_business_analytics(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_revenue NUMERIC(14,2) := 0.00;
    v_cogs NUMERIC(14,2) := 0.00;
    v_gross_profit NUMERIC(14,2) := 0.00;
    v_gross_margin NUMERIC(7,2) := 0.00;
    v_expenses NUMERIC(14,2) := 0.00;
    v_net_profit NUMERIC(14,2) := 0.00;
    v_net_margin NUMERIC(7,2) := 0.00;
    v_transaction_count INTEGER := 0;
    v_units_sold NUMERIC(14,4) := 0;
    v_aov NUMERIC(14,2) := 0.00;
    v_amount_collected NUMERIC(14,2) := 0.00;
    v_outstanding_receivables NUMERIC(14,2) := 0.00;
    v_inventory_valuation NUMERIC(14,2) := 0.00;
    v_low_stock_count INTEGER := 0;
    v_out_of_stock_count INTEGER := 0;
    v_low_stock_threshold INTEGER := 5;
    v_currency VARCHAR(10) := 'USD';
    v_timezone TEXT := 'UTC';
BEGIN
    v_user_id := auth.uid();
    
    -- Verify Business Membership
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied. You do not belong to this business.';
    END IF;

    -- Fetch Business Settings
    SELECT 
        COALESCE(s.low_stock_threshold, 5), 
        COALESCE(b.currency, 'USD'),
        COALESCE(b.timezone, 'UTC')
    INTO 
        v_low_stock_threshold, 
        v_currency,
        v_timezone
    FROM public.businesses b
    LEFT JOIN public.business_settings s ON s.business_id = b.id
    WHERE b.id = p_business_id;

    -- 1. Sales, Units Sold & Revenue (Completed sales only)
    SELECT 
        COALESCE(SUM(total), 0.00),
        COUNT(id)
    INTO 
        v_revenue,
        v_transaction_count
    FROM public.sales
    WHERE business_id = p_business_id 
      AND sale_status = 'completed'
      AND sold_at >= p_start_date 
      AND sold_at <= p_end_date;

    SELECT COALESCE(SUM(si.quantity), 0)
    INTO v_units_sold
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id 
      AND s.sale_status = 'completed'
      AND s.sold_at >= p_start_date 
      AND s.sold_at <= p_end_date;

    IF v_transaction_count > 0 THEN
        v_aov := ROUND(v_revenue / v_transaction_count, 2);
    END IF;

    -- 2. Cost of Goods Sold (using historical snapshot unit_cost)
    SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0.00)
    INTO v_cogs
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id 
      AND s.sale_status = 'completed'
      AND s.sold_at >= p_start_date 
      AND s.sold_at <= p_end_date;

    v_gross_profit := v_revenue - v_cogs;

    IF v_revenue > 0 THEN
        v_gross_margin := ROUND((v_gross_profit / v_revenue) * 100.0, 2);
    END IF;

    -- 3. Operating Expenses
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_expenses
    FROM public.expenses
    WHERE business_id = p_business_id 
      AND expense_date >= (p_start_date AT TIME ZONE v_timezone)::DATE
      AND expense_date <= (p_end_date AT TIME ZONE v_timezone)::DATE;

    v_net_profit := v_gross_profit - v_expenses;

    IF v_revenue > 0 THEN
        v_net_margin := ROUND((v_net_profit / v_revenue) * 100.0, 2);
    END IF;

    -- 4. Actual Cash/Payments Collected in Window
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_amount_collected
    FROM public.payments
    WHERE business_id = p_business_id 
      AND (paid_at >= p_start_date OR payment_date >= p_start_date)
      AND (paid_at <= p_end_date OR payment_date <= p_end_date);

    -- 5. Outstanding Receivables
    SELECT COALESCE(SUM(amount_due), 0.00)
    INTO v_outstanding_receivables
    FROM public.sales
    WHERE business_id = p_business_id
      AND sale_status = 'completed'
      AND amount_due > 0;

    -- 6. Current Inventory Valuation & Low Stock (Physical products only)
    SELECT 
        COALESCE(SUM(CASE WHEN product_type = 'physical' THEN stock_quantity * cost_price ELSE 0 END), 0.00),
        COUNT(CASE WHEN product_type = 'physical' AND stock_quantity > 0 AND stock_quantity <= COALESCE(minimum_stock_level, v_low_stock_threshold) THEN 1 END),
        COUNT(CASE WHEN product_type = 'physical' AND stock_quantity = 0 THEN 1 END)
    INTO 
        v_inventory_valuation,
        v_low_stock_count,
        v_out_of_stock_count
    FROM public.products
    WHERE business_id = p_business_id AND is_active = true;

    RETURN jsonb_build_object(
        'business_id', p_business_id,
        'currency', v_currency,
        'timezone', v_timezone,
        'period_start', p_start_date,
        'period_end', p_end_date,
        'revenue', v_revenue,
        'cost_of_goods_sold', v_cogs,
        'gross_profit', v_gross_profit,
        'gross_margin', v_gross_margin,
        'operating_expenses', v_expenses,
        'estimated_net_profit', v_net_profit,
        'net_margin', v_net_margin,
        'transaction_count', v_transaction_count,
        'units_sold', v_units_sold,
        'average_order_value', v_aov,
        'amount_collected', v_amount_collected,
        'outstanding_receivables', v_outstanding_receivables,
        'inventory_valuation', v_inventory_valuation,
        'low_stock_count', v_low_stock_count,
        'out_of_stock_count', v_out_of_stock_count
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Update get_product_performance to handle service stock statuses
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_performance(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_days_count NUMERIC(10,2);
    v_threshold INTEGER := 5;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    SELECT COALESCE(low_stock_threshold, 5) INTO v_threshold
    FROM public.business_settings WHERE business_id = p_business_id;

    v_days_count := GREATEST(1.0, EXTRACT(EPOCH FROM (p_end_date - p_start_date)) / 86400.0);

    WITH product_sales AS (
        SELECT 
            si.product_id,
            SUM(si.quantity) as units_sold,
            SUM(si.total) as revenue,
            SUM(si.unit_cost * si.quantity) as cogs,
            SUM(si.total - (si.unit_cost * si.quantity)) as gross_profit,
            COUNT(DISTINCT s.id) as tx_count,
            MAX(s.sold_at) as last_sale_at
        FROM public.sale_items si
        INNER JOIN public.sales s ON s.id = si.sale_id
        WHERE s.business_id = p_business_id 
          AND s.sale_status = 'completed'
          AND s.sold_at >= p_start_date 
          AND s.sold_at <= p_end_date
        GROUP BY si.product_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'sku', p.sku,
            'category_name', c.name,
            'product_type', p.product_type,
            'unit_of_measure', p.unit_of_measure,
            'current_stock', p.stock_quantity,
            'cost_price', p.cost_price,
            'selling_price', p.selling_price,
            'minimum_stock_level', p.minimum_stock_level,
            'units_sold', COALESCE(ps.units_sold, 0),
            'revenue', COALESCE(ps.revenue, 0.00),
            'cogs', COALESCE(ps.cogs, 0.00),
            'gross_profit', COALESCE(ps.gross_profit, 0.00),
            'gross_margin', CASE 
                WHEN COALESCE(ps.revenue, 0.00) > 0 THEN ROUND((COALESCE(ps.gross_profit, 0.00) / ps.revenue) * 100.0, 2)
                ELSE 0.00 
            END,
            'transaction_count', COALESCE(ps.tx_count, 0),
            'last_sale_at', ps.last_sale_at,
            'observed_velocity_units_per_day', ROUND(COALESCE(ps.units_sold, 0) / v_days_count, 2),
            'stock_status', CASE
                WHEN p.product_type = 'service' THEN 'service'
                WHEN p.stock_quantity = 0 THEN 'out_of_stock'
                WHEN p.stock_quantity <= COALESCE(p.minimum_stock_level, v_threshold) THEN 'low_stock'
                WHEN COALESCE(ps.units_sold, 0) = 0 AND p.created_at < (clock_timestamp() - INTERVAL '14 days') THEN 'slow_moving'
                ELSE 'healthy'
            END,
            'days_of_inventory_remaining', CASE
                WHEN p.product_type = 'service' THEN NULL
                WHEN (COALESCE(ps.units_sold, 0) / v_days_count) > 0 
                THEN ROUND(p.stock_quantity / (ps.units_sold / v_days_count), 1)
                ELSE NULL
            END
        ) ORDER BY COALESCE(ps.revenue, 0.00) DESC
    ) INTO v_result
    FROM public.products p
    LEFT JOIN public.product_categories c ON c.id = p.category_id
    LEFT JOIN product_sales ps ON ps.product_id = p.id
    WHERE p.business_id = p_business_id AND p.is_active = true
    LIMIT p_limit;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Permissions & Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_business_dashboard_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_business_context(UUID, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_business_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- 7. Notify PostgREST to reload schema
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
