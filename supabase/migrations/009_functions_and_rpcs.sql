-- ============================================================================
-- Migration 009: Production Stored Procedures, Atomic Transactions & Analytics RPCs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Atomic Business Initialization with Owner and Default Settings
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

    -- Create Business record
    INSERT INTO public.businesses (
        name,
        business_type,
        description,
        country,
        currency,
        timezone,
        logo_url,
        created_by
    ) VALUES (
        trim(p_name),
        p_business_type,
        p_description,
        p_country,
        COALESCE(p_currency, 'USD'),
        COALESCE(p_timezone, 'UTC'),
        p_logo_url,
        v_user_id
    ) RETURNING id INTO v_business_id;

    -- Add Creator as Owner in business_members
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role
    ) VALUES (
        v_business_id,
        v_user_id,
        'owner'::member_role
    );

    -- Initialize Business Settings
    INSERT INTO public.business_settings (
        business_id,
        currency,
        timezone,
        business_type,
        tax_enabled,
        tax_rate,
        low_stock_threshold
    ) VALUES (
        v_business_id,
        COALESCE(p_currency, 'USD'),
        COALESCE(p_timezone, 'UTC'),
        p_business_type,
        false,
        0.00,
        5
    );

    RETURN v_business_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Atomic Complete Sale Processing
-- Locks inventory rows, validates stock, writes sale, sale items snapshots,
-- decrements stock, records inventory ledger transactions, and optional payments.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_complete_sale(
    p_business_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb, -- Array of objects: [{product_id, quantity, unit_price, discount}]
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
    v_item_count INTEGER := 0;
BEGIN
    v_user_id := auth.uid();
    
    -- Verify Business Membership
    SELECT role INTO v_member_role
    FROM public.business_members
    WHERE business_id = p_business_id AND user_id = v_user_id;

    IF v_member_role IS NULL THEN
        RAISE EXCEPTION 'Access denied. You are not an authorized member of this business.';
    END IF;

    -- Validate Items array
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot complete sale: A sale must contain at least one item.';
    END IF;

    -- Compute Subtotal and validate each product with strict row locking (FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INTEGER,
        unit_price NUMERIC(14,2),
        discount NUMERIC(14,2)
    )
    LOOP
        v_item_count := v_item_count + 1;
        
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Sale item quantity must be greater than zero.';
        END IF;

        IF v_item.product_id IS NOT NULL THEN
            -- Lock Product Row to guarantee concurrency protection against overselling
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

    -- Calculate Totals
    v_calculated_total := v_calculated_subtotal - COALESCE(p_discount, 0.00) + COALESCE(p_tax, 0.00);
    IF v_calculated_total < 0 THEN
        v_calculated_total := 0.00;
    END IF;

    v_amount_paid := COALESCE(p_payment_amount, 0.00);
    IF v_amount_paid > v_calculated_total THEN
        v_amount_paid := v_calculated_total;
    END IF;
    v_amount_due := v_calculated_total - v_amount_paid;

    IF v_amount_paid >= v_calculated_total AND v_calculated_total > 0 THEN
        v_payment_status := 'paid'::payment_status_type;
    ELSIF v_amount_paid > 0 THEN
        v_payment_status := 'partial'::payment_status_type;
    ELSE
        v_payment_status := 'unpaid'::payment_status_type;
    END IF;

    -- 1. Insert Master Sale Record
    INSERT INTO public.sales (
        business_id,
        customer_id,
        subtotal,
        discount,
        tax,
        total,
        amount_paid,
        amount_due,
        payment_status,
        payment_method,
        sale_status,
        notes,
        sold_by,
        sold_at
    ) VALUES (
        p_business_id,
        p_customer_id,
        v_calculated_subtotal,
        COALESCE(p_discount, 0.00),
        COALESCE(p_tax, 0.00),
        v_calculated_total,
        v_amount_paid,
        v_amount_due,
        v_payment_status,
        CASE WHEN v_amount_paid > 0 THEN p_payment_method ELSE NULL END,
        'completed'::sale_status_type,
        p_notes,
        v_user_id,
        clock_timestamp()
    ) RETURNING id INTO v_sale_id;

    -- 2. Process Sale Items, Deduct Stock, and Record Inventory Ledger
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

            -- Insert Sale Item with immutable snapshot of name, cost, and price
            INSERT INTO public.sale_items (
                sale_id,
                business_id,
                product_id,
                product_name_snapshot,
                quantity,
                unit_price,
                unit_cost,
                discount,
                subtotal,
                total
            ) VALUES (
                v_sale_id,
                p_business_id,
                v_item.product_id,
                v_product.name,
                v_item.quantity,
                COALESCE(v_item.unit_price, v_product.selling_price),
                v_product.cost_price,
                COALESCE(v_item.discount, 0.00),
                v_item_subtotal,
                v_item_total
            );

            -- Decrement stock quantity atomically
            UPDATE public.products
            SET 
                stock_quantity = stock_quantity - v_item.quantity,
                updated_at = clock_timestamp()
            WHERE id = v_item.product_id AND business_id = p_business_id;

            -- Record authoritative inventory transaction
            INSERT INTO public.inventory_transactions (
                business_id,
                product_id,
                transaction_type,
                quantity,
                reference_type,
                reference_id,
                notes,
                created_by
            ) VALUES (
                p_business_id,
                v_item.product_id,
                'sale'::inventory_transaction_type,
                v_item.quantity,
                'sale',
                v_sale_id,
                format('Sale #%s items deducted', substring(v_sale_id::text from 1 for 8)),
                v_user_id
            );
        END IF;
    END LOOP;

    -- 3. Record Initial Payment if made
    IF v_amount_paid > 0 THEN
        INSERT INTO public.payments (
            business_id,
            sale_id,
            customer_id,
            amount,
            payment_method,
            reference,
            notes,
            received_by,
            paid_at
        ) VALUES (
            p_business_id,
            v_sale_id,
            p_customer_id,
            v_amount_paid,
            p_payment_method,
            p_payment_reference,
            p_notes,
            v_user_id,
            clock_timestamp()
        );
    END IF;

    RETURN v_sale_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Atomic Inventory Movement Ledger and Stock Synchronization
-- ----------------------------------------------------------------------------
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

    -- Lock Product Row
    SELECT id, name, stock_quantity INTO v_product
    FROM public.products
    WHERE id = p_product_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % does not exist in business %', p_product_id, p_business_id;
    END IF;

    -- Calculate New Stock based on movement type
    IF p_type IN ('purchase', 'restock', 'return') THEN
        v_new_stock := v_product.stock_quantity + p_quantity;
    ELSIF p_type IN ('sale', 'damage') THEN
        IF v_product.stock_quantity < p_quantity THEN
            RAISE EXCEPTION 'Cannot deduct % units from product "%". Current stock is %.',
                p_quantity, v_product.name, v_product.stock_quantity;
        END IF;
        v_new_stock := v_product.stock_quantity - p_quantity;
    ELSIF p_type = 'adjustment' OR p_type = 'initial_stock' THEN
        v_new_stock := p_quantity; -- Set to absolute target quantity
    ELSE
        RAISE EXCEPTION 'Unknown transaction type: %', p_type;
    END IF;

    -- Update Product Stock
    UPDATE public.products
    SET 
        stock_quantity = v_new_stock,
        updated_at = clock_timestamp()
    WHERE id = p_product_id AND business_id = p_business_id;

    -- Insert Ledger Entry
    INSERT INTO public.inventory_transactions (
        business_id,
        product_id,
        transaction_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        p_business_id,
        p_product_id,
        p_type,
        p_quantity,
        p_reference_type,
        p_reference_id,
        p_notes,
        v_user_id
    ) RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Fast Single-Call Business Dashboard Summary RPC
-- Computes real financial and operational metrics from authoritative records.
-- ----------------------------------------------------------------------------
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

    -- 4. Current Inventory Valuation & Low Stock Count
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

-- ----------------------------------------------------------------------------
-- 5. Structured Business Context RPC for Server-Side AI (Google Gemini)
-- Aggregates facts, summaries, top sellers, and cash flow without raw record dumps.
-- ----------------------------------------------------------------------------
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

    -- Low stock items requiring restock attention
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
