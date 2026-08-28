-- ============================================================================
-- Migration 012: Phase 3 Authoritative Analytics & Business Intelligence Engine
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Function: get_business_analytics
-- Returns authoritative financial overview metrics for a given date window.
-- ----------------------------------------------------------------------------
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
    v_units_sold INTEGER := 0;
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
        COALESCE(SUM(s.total), 0.00),
        COUNT(s.id),
        COALESCE(SUM(si.quantity), 0)
    INTO 
        v_revenue,
        v_transaction_count,
        v_units_sold
    FROM public.sales s
    LEFT JOIN public.sale_items si ON si.sale_id = s.id
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

    -- 3. Operating Expenses in Date Window
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

    -- 4. Amount Collected (Cash inflows from payment receipts)
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_amount_collected
    FROM public.payments
    WHERE business_id = p_business_id
      AND paid_at >= p_start_date
      AND paid_at <= p_end_date;

    -- 5. Outstanding Receivables (Total unpaid balance across all completed sales)
    SELECT COALESCE(SUM(amount_due), 0.00)
    INTO v_outstanding_receivables
    FROM public.sales
    WHERE business_id = p_business_id
      AND sale_status = 'completed'
      AND amount_due > 0;

    -- 6. Current Inventory Valuation & Low Stock
    SELECT 
        COALESCE(SUM(stock_quantity * cost_price), 0.00),
        COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity <= COALESCE(minimum_stock_level, v_low_stock_threshold) THEN 1 END),
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END)
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

-- ----------------------------------------------------------------------------
-- 2. Function: get_sales_timeseries
-- Produces grouped time-series data for trends and charts.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_timeseries(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_interval TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_result JSONB;
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

    SELECT COALESCE(timezone, 'UTC') INTO v_timezone
    FROM public.businesses WHERE id = p_business_id;

    WITH series AS (
        SELECT generate_series(
            date_trunc(p_interval, p_start_date AT TIME ZONE v_timezone),
            date_trunc(p_interval, p_end_date AT TIME ZONE v_timezone),
            ('1 ' || p_interval)::INTERVAL
        ) AS bucket_time
    ),
    sales_agg AS (
        SELECT 
            date_trunc(p_interval, s.sold_at AT TIME ZONE v_timezone) AS bucket_time,
            COALESCE(SUM(s.total), 0.00) AS revenue,
            COALESCE(SUM(si.unit_cost * si.quantity), 0.00) AS cogs,
            COUNT(DISTINCT s.id) AS tx_count,
            COALESCE(SUM(si.quantity), 0) AS units_sold
        FROM public.sales s
        LEFT JOIN public.sale_items si ON si.sale_id = s.id
        WHERE s.business_id = p_business_id
          AND s.sale_status = 'completed'
          AND s.sold_at >= p_start_date
          AND s.sold_at <= p_end_date
        GROUP BY 1
    ),
    expenses_agg AS (
        SELECT 
            date_trunc(p_interval, e.expense_date::TIMESTAMPTZ) AS bucket_time,
            COALESCE(SUM(e.amount), 0.00) AS expenses
        FROM public.expenses e
        WHERE e.business_id = p_business_id
          AND e.expense_date >= (p_start_date AT TIME ZONE v_timezone)::DATE
          AND e.expense_date <= (p_end_date AT TIME ZONE v_timezone)::DATE
        GROUP BY 1
    ),
    payments_agg AS (
        SELECT 
            date_trunc(p_interval, p.paid_at AT TIME ZONE v_timezone) AS bucket_time,
            COALESCE(SUM(p.amount), 0.00) AS cash_collected
        FROM public.payments p
        WHERE p.business_id = p_business_id
          AND p.paid_at >= p_start_date
          AND p.paid_at <= p_end_date
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', to_char(s.bucket_time, 'YYYY-MM-DD'),
            'timestamp', s.bucket_time,
            'revenue', COALESCE(sa.revenue, 0.00),
            'cost_of_goods_sold', COALESCE(sa.cogs, 0.00),
            'gross_profit', COALESCE(sa.revenue, 0.00) - COALESCE(sa.cogs, 0.00),
            'expenses', COALESCE(ea.expenses, 0.00),
            'estimated_net_profit', (COALESCE(sa.revenue, 0.00) - COALESCE(sa.cogs, 0.00)) - COALESCE(ea.expenses, 0.00),
            'cash_collected', COALESCE(pa.cash_collected, 0.00),
            'transaction_count', COALESCE(sa.tx_count, 0),
            'units_sold', COALESCE(sa.units_sold, 0)
        ) ORDER BY s.bucket_time ASC
    ) INTO v_result
    FROM series s
    LEFT JOIN sales_agg sa ON sa.bucket_time = s.bucket_time
    LEFT JOIN expenses_agg ea ON ea.bucket_time = s.bucket_time
    LEFT JOIN payments_agg pa ON pa.bucket_time = s.bucket_time;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Function: get_product_analytics
-- Ranks products by revenue, units, gross profit, margin, and identifies velocity.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_analytics(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_result JSONB;
    v_days_count NUMERIC := 1.0;
    v_threshold INTEGER := 5;
BEGIN
    v_user_id := auth.uid();
    
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    SELECT COALESCE(s.low_stock_threshold, 5) INTO v_threshold
    FROM public.businesses b
    LEFT JOIN public.business_settings s ON s.business_id = b.id
    WHERE b.id = p_business_id;

    v_days_count := GREATEST(1.0, EXTRACT(EPOCH FROM (p_end_date - p_start_date)) / 86400.0);

    WITH product_sales AS (
        SELECT 
            si.product_id,
            COALESCE(SUM(si.quantity), 0) AS units_sold,
            COALESCE(SUM(si.total), 0.00) AS revenue,
            COALESCE(SUM(si.unit_cost * si.quantity), 0.00) AS cogs,
            COALESCE(SUM(si.total - (si.unit_cost * si.quantity)), 0.00) AS gross_profit,
            COUNT(DISTINCT s.id) AS tx_count,
            MAX(s.sold_at) AS last_sale_at
        FROM public.sale_items si
        INNER JOIN public.sales s ON s.id = si.sale_id
        WHERE s.business_id = p_business_id
          AND s.sale_status = 'completed'
          AND s.sold_at >= p_start_date
          AND s.sold_at <= p_end_date
          AND si.product_id IS NOT NULL
        GROUP BY si.product_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'sku', p.sku,
            'category_name', c.name,
            'current_stock', p.stock_quantity,
            'cost_price', p.cost_price,
            'selling_price', p.selling_price,
            'minimum_stock_level', COALESCE(p.minimum_stock_level, v_threshold),
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
                WHEN p.stock_quantity = 0 THEN 'out_of_stock'
                WHEN p.stock_quantity <= COALESCE(p.minimum_stock_level, v_threshold) THEN 'low_stock'
                WHEN COALESCE(ps.units_sold, 0) = 0 AND p.created_at < (clock_timestamp() - INTERVAL '14 days') THEN 'slow_moving'
                ELSE 'healthy'
            END,
            'days_of_inventory_remaining', CASE
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

-- ----------------------------------------------------------------------------
-- 4. Function: get_customer_analytics
-- Segment customers: New, Repeat, High-Value, Inactive, Debtors.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_analytics(
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
    v_total_customers INTEGER := 0;
    v_active_in_period INTEGER := 0;
    v_new_in_period INTEGER := 0;
    v_repeat_customers INTEGER := 0;
    v_high_value_count INTEGER := 0;
    v_inactive_customers INTEGER := 0;
    v_debtor_count INTEGER := 0;
    v_total_debt NUMERIC(14,2) := 0.00;
    v_top_customers JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    -- Total registered
    SELECT COUNT(id) INTO v_total_customers
    FROM public.customers WHERE business_id = p_business_id AND is_active = true;

    -- New registered in period
    SELECT COUNT(id) INTO v_new_in_period
    FROM public.customers 
    WHERE business_id = p_business_id 
      AND created_at >= p_start_date 
      AND created_at <= p_end_date;

    -- Active buyers in period
    SELECT COUNT(DISTINCT customer_id) INTO v_active_in_period
    FROM public.sales 
    WHERE business_id = p_business_id 
      AND customer_id IS NOT NULL
      AND sale_status = 'completed'
      AND sold_at >= p_start_date 
      AND sold_at <= p_end_date;

    -- Repeat customers (lifetime completed purchases > 1)
    SELECT COUNT(sub.customer_id) INTO v_repeat_customers FROM (
        SELECT customer_id, COUNT(id) as total_sales
        FROM public.sales
        WHERE business_id = p_business_id 
          AND customer_id IS NOT NULL 
          AND sale_status = 'completed'
        GROUP BY customer_id
        HAVING COUNT(id) > 1
    ) sub;

    -- Debtors count and total receivables
    SELECT 
        COUNT(DISTINCT s.customer_id),
        COALESCE(SUM(s.amount_due), 0.00)
    INTO 
        v_debtor_count,
        v_total_debt
    FROM public.sales s
    WHERE s.business_id = p_business_id 
      AND s.customer_id IS NOT NULL 
      AND s.sale_status = 'completed' 
      AND s.amount_due > 0;

    -- Inactive customers (no purchase in last 30 days)
    SELECT COUNT(c.id) INTO v_inactive_customers
    FROM public.customers c
    WHERE c.business_id = p_business_id 
      AND c.is_active = true
      AND NOT EXISTS (
          SELECT 1 FROM public.sales s
          WHERE s.customer_id = c.id
            AND s.sale_status = 'completed'
            AND s.sold_at >= (clock_timestamp() - INTERVAL '30 days')
      );

    -- Top 10 customers in selected period
    WITH cust_period_sales AS (
        SELECT 
            s.customer_id,
            COALESCE(SUM(s.total), 0.00) AS period_revenue,
            COUNT(s.id) AS period_orders,
            MAX(s.sold_at) AS last_purchase_at
        FROM public.sales s
        WHERE s.business_id = p_business_id
          AND s.customer_id IS NOT NULL
          AND s.sale_status = 'completed'
          AND s.sold_at >= p_start_date
          AND s.sold_at <= p_end_date
        GROUP BY s.customer_id
    ),
    cust_lifetime AS (
        SELECT 
            s.customer_id,
            COALESCE(SUM(s.total), 0.00) AS lifetime_spent,
            COALESCE(SUM(s.amount_due), 0.00) AS outstanding_balance
        FROM public.sales s
        WHERE s.business_id = p_business_id
          AND s.customer_id IS NOT NULL
          AND s.sale_status = 'completed'
        GROUP BY s.customer_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'phone', c.phone,
            'revenue_in_period', COALESCE(cps.period_revenue, 0.00),
            'completed_orders_in_period', COALESCE(cps.period_orders, 0),
            'lifetime_spent', COALESCE(cl.lifetime_spent, 0.00),
            'outstanding_balance', COALESCE(cl.outstanding_balance, 0.00),
            'last_purchase_at', cps.last_purchase_at
        ) ORDER BY COALESCE(cps.period_revenue, 0.00) DESC
    ) INTO v_top_customers
    FROM public.customers c
    INNER JOIN cust_period_sales cps ON cps.customer_id = c.id
    LEFT JOIN cust_lifetime cl ON cl.customer_id = c.id
    LIMIT 10;

    RETURN jsonb_build_object(
        'total_customers', v_total_customers,
        'active_in_period', v_active_in_period,
        'new_customers_in_period', v_new_in_period,
        'repeat_customers', v_repeat_customers,
        'high_value_customers', GREATEST(0, ROUND(v_total_customers * 0.10)::INT),
        'inactive_customers', v_inactive_customers,
        'debtor_customers', v_debtor_count,
        'total_outstanding_debt', v_total_debt,
        'top_customers_by_revenue', COALESCE(v_top_customers, '[]'::jsonb)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Function: get_expense_analytics
-- Category distribution, ratio of revenue, recent large expenses.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_expense_analytics(
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
    v_total_expenses NUMERIC(14,2) := 0.00;
    v_revenue NUMERIC(14,2) := 0.00;
    v_ratio NUMERIC(7,2) := 0.00;
    v_categories JSONB;
    v_recent JSONB;
    v_timezone TEXT := 'UTC';
BEGIN
    v_user_id := auth.uid();
    
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    SELECT COALESCE(timezone, 'UTC') INTO v_timezone
    FROM public.businesses WHERE id = p_business_id;

    -- Total expenses
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_expenses
    FROM public.expenses
    WHERE business_id = p_business_id
      AND expense_date >= (p_start_date AT TIME ZONE v_timezone)::DATE
      AND expense_date <= (p_end_date AT TIME ZONE v_timezone)::DATE;

    -- Total revenue
    SELECT COALESCE(SUM(total), 0.00) INTO v_revenue
    FROM public.sales
    WHERE business_id = p_business_id 
      AND sale_status = 'completed'
      AND sold_at >= p_start_date 
      AND sold_at <= p_end_date;

    IF v_revenue > 0 THEN
        v_ratio := ROUND((v_total_expenses / v_revenue) * 100.0, 2);
    END IF;

    -- Categories breakdown
    SELECT jsonb_agg(
        jsonb_build_object(
            'category', category,
            'amount', COALESCE(SUM(amount), 0.00),
            'count', COUNT(id),
            'percentage_of_total_expenses', CASE 
                WHEN v_total_expenses > 0 THEN ROUND((SUM(amount) / v_total_expenses) * 100.0, 2)
                ELSE 0.00 
            END,
            'percentage_of_revenue', CASE 
                WHEN v_revenue > 0 THEN ROUND((SUM(amount) / v_revenue) * 100.0, 2)
                ELSE 0.00 
            END
        ) ORDER BY SUM(amount) DESC
    ) INTO v_categories
    FROM public.expenses
    WHERE business_id = p_business_id
      AND expense_date >= (p_start_date AT TIME ZONE v_timezone)::DATE
      AND expense_date <= (p_end_date AT TIME ZONE v_timezone)::DATE
    GROUP BY category;

    -- Recent 5 expenses
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'title', title,
            'category', category,
            'amount', amount,
            'expense_date', expense_date,
            'payment_method', payment_method
        ) ORDER BY expense_date DESC, created_at DESC
    ) INTO v_recent
    FROM (
        SELECT id, title, category, amount, expense_date, payment_method, created_at
        FROM public.expenses
        WHERE business_id = p_business_id
          AND expense_date >= (p_start_date AT TIME ZONE v_timezone)::DATE
          AND expense_date <= (p_end_date AT TIME ZONE v_timezone)::DATE
        ORDER BY expense_date DESC, created_at DESC
        LIMIT 5
    ) sub;

    RETURN jsonb_build_object(
        'total_expenses', v_total_expenses,
        'expense_to_revenue_ratio', v_ratio,
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'recent_expenses', COALESCE(v_recent, '[]'::jsonb)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Function: get_period_comparison
-- Authoritative calculation of absolute change and percentage change between periods.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_period_comparison(
    p_business_id UUID,
    p_current_start TIMESTAMPTZ,
    p_current_end TIMESTAMPTZ,
    p_prior_start TIMESTAMPTZ,
    p_prior_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_curr JSONB;
    v_prior JSONB;
    v_rev_curr NUMERIC(14,2);
    v_rev_prior NUMERIC(14,2);
    v_gp_curr NUMERIC(14,2);
    v_gp_prior NUMERIC(14,2);
    v_exp_curr NUMERIC(14,2);
    v_exp_prior NUMERIC(14,2);
    v_net_curr NUMERIC(14,2);
    v_net_prior NUMERIC(14,2);
    v_tx_curr INTEGER;
    v_tx_prior INTEGER;
    v_aov_curr NUMERIC(14,2);
    v_aov_prior NUMERIC(14,2);
    v_coll_curr NUMERIC(14,2);
    v_coll_prior NUMERIC(14,2);
BEGIN
    v_curr := public.get_business_analytics(p_business_id, p_current_start, p_current_end);
    v_prior := public.get_business_analytics(p_business_id, p_prior_start, p_prior_end);

    v_rev_curr := (v_curr->>'revenue')::NUMERIC;
    v_rev_prior := (v_prior->>'revenue')::NUMERIC;
    v_gp_curr := (v_curr->>'gross_profit')::NUMERIC;
    v_gp_prior := (v_prior->>'gross_profit')::NUMERIC;
    v_exp_curr := (v_curr->>'operating_expenses')::NUMERIC;
    v_exp_prior := (v_prior->>'operating_expenses')::NUMERIC;
    v_net_curr := (v_curr->>'estimated_net_profit')::NUMERIC;
    v_net_prior := (v_prior->>'estimated_net_profit')::NUMERIC;
    v_tx_curr := (v_curr->>'transaction_count')::INTEGER;
    v_tx_prior := (v_prior->>'transaction_count')::INTEGER;
    v_aov_curr := (v_curr->>'average_order_value')::NUMERIC;
    v_aov_prior := (v_prior->>'average_order_value')::NUMERIC;
    v_coll_curr := (v_curr->>'amount_collected')::NUMERIC;
    v_coll_prior := (v_prior->>'amount_collected')::NUMERIC;

    RETURN jsonb_build_object(
        'revenue', jsonb_build_object(
            'current', v_rev_curr,
            'prior', v_rev_prior,
            'absolute_change', v_rev_curr - v_rev_prior,
            'percentage_change', CASE 
                WHEN v_rev_prior > 0 THEN ROUND(((v_rev_curr - v_rev_prior) / v_rev_prior) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_rev_curr > v_rev_prior THEN 'positive'
                WHEN v_rev_curr < v_rev_prior THEN 'negative'
                ELSE 'neutral'
            END
        ),
        'gross_profit', jsonb_build_object(
            'current', v_gp_curr,
            'prior', v_gp_prior,
            'absolute_change', v_gp_curr - v_gp_prior,
            'percentage_change', CASE 
                WHEN v_gp_prior > 0 THEN ROUND(((v_gp_curr - v_gp_prior) / v_gp_prior) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_gp_curr > v_gp_prior THEN 'positive'
                WHEN v_gp_curr < v_gp_prior THEN 'negative'
                ELSE 'neutral'
            END
        ),
        'operating_expenses', jsonb_build_object(
            'current', v_exp_curr,
            'prior', v_exp_prior,
            'absolute_change', v_exp_curr - v_exp_prior,
            'percentage_change', CASE 
                WHEN v_exp_prior > 0 THEN ROUND(((v_exp_curr - v_exp_prior) / v_exp_prior) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_exp_curr < v_exp_prior THEN 'positive'
                WHEN v_exp_curr > v_exp_prior THEN 'negative'
                ELSE 'neutral'
            END
        ),
        'estimated_net_profit', jsonb_build_object(
            'current', v_net_curr,
            'prior', v_net_prior,
            'absolute_change', v_net_curr - v_net_prior,
            'percentage_change', CASE 
                WHEN v_net_prior != 0 THEN ROUND(((v_net_curr - v_net_prior) / ABS(v_net_prior)) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_net_curr > v_net_prior THEN 'positive'
                WHEN v_net_curr < v_net_prior THEN 'negative'
                ELSE 'neutral'
            END
        ),
        'transaction_count', jsonb_build_object(
            'current', v_tx_curr,
            'prior', v_tx_prior,
            'absolute_change', v_tx_curr - v_tx_prior,
            'percentage_change', CASE 
                WHEN v_tx_prior > 0 THEN ROUND(((v_tx_curr::NUMERIC - v_tx_prior::NUMERIC) / v_tx_prior::NUMERIC) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_tx_curr > v_tx_prior THEN 'positive'
                WHEN v_tx_curr < v_tx_prior THEN 'negative'
                ELSE 'neutral'
            END
        ),
        'average_order_value', jsonb_build_object(
            'current', v_aov_curr,
            'prior', v_aov_prior,
            'absolute_change', v_aov_curr - v_aov_prior,
            'percentage_change', CASE 
                WHEN v_aov_prior > 0 THEN ROUND(((v_aov_curr - v_aov_prior) / v_aov_prior) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_aov_curr > v_aov_prior THEN 'positive'
                WHEN v_aov_curr < v_aov_prior THEN 'negative'
                ELSE 'neutral'
            END
        ),
        'amount_collected', jsonb_build_object(
            'current', v_coll_curr,
            'prior', v_coll_prior,
            'absolute_change', v_coll_curr - v_coll_prior,
            'percentage_change', CASE 
                WHEN v_coll_prior > 0 THEN ROUND(((v_coll_curr - v_coll_prior) / v_coll_prior) * 100.0, 2)
                ELSE NULL 
            END,
            'trend', CASE
                WHEN v_coll_curr > v_coll_prior THEN 'positive'
                WHEN v_coll_curr < v_coll_prior THEN 'negative'
                ELSE 'neutral'
            END
        )
    );
END;
$$;
