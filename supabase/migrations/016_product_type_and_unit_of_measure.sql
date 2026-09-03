-- =============================================================================
-- Migration 016: Product Type (Physical vs Service), Unit of Measure, & Decimal Quantities
-- =============================================================================

-- 1. Add product_type and unit_of_measure to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS unit_of_measure TEXT NOT NULL DEFAULT 'piece';

-- Add check constraint for product_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_product_type_check'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_product_type_check 
        CHECK (product_type IN ('physical', 'service'));
    END IF;
END $$;

-- 2. Add unit_of_measure snapshot to sale_items table
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;

-- 3. Upgrade quantities from INTEGER to NUMERIC(14,4) to support fractional amounts (e.g. 1.5 kg, 0.75 litres)
-- Drop old integer check constraints if they exist
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_quantity_check;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_minimum_stock_level_check;
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_quantity_check;

-- Alter column types
ALTER TABLE public.products 
ALTER COLUMN stock_quantity TYPE NUMERIC(14,4) USING stock_quantity::NUMERIC(14,4),
ALTER COLUMN minimum_stock_level TYPE NUMERIC(14,4) USING minimum_stock_level::NUMERIC(14,4);

ALTER TABLE public.products 
ADD CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0),
ADD CONSTRAINT products_minimum_stock_level_check CHECK (minimum_stock_level >= 0);

ALTER TABLE public.inventory_transactions 
ALTER COLUMN quantity TYPE NUMERIC(14,4) USING quantity::NUMERIC(14,4);

ALTER TABLE public.sale_items 
ALTER COLUMN quantity TYPE NUMERIC(14,4) USING quantity::NUMERIC(14,4);

ALTER TABLE public.sale_items 
ADD CONSTRAINT sale_items_quantity_check CHECK (quantity > 0);

-- Set default values for services: stock_quantity = 0, minimum_stock_level = 0
UPDATE public.products 
SET stock_quantity = 0, minimum_stock_level = 0 
WHERE product_type = 'service';

-- 4. Update process_complete_sale to handle services and fractional quantities
CREATE OR REPLACE FUNCTION public.process_complete_sale(
    p_business_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_payment_method public.payment_method_type DEFAULT 'cash',
    p_amount_paid NUMERIC(14,2) DEFAULT 0.00,
    p_discount_amount NUMERIC(14,2) DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_product_name TEXT;
    v_product_type TEXT;
    v_unit_measure TEXT;
    v_selling_price NUMERIC(14,2);
    v_cost_price NUMERIC(14,2);
    v_item_qty NUMERIC(14,4);
    v_item_price NUMERIC(14,2);
    v_item_discount NUMERIC(14,2);
    v_item_subtotal NUMERIC(14,2);
    v_item_total NUMERIC(14,2);
    v_calc_subtotal NUMERIC(14,2) := 0.00;
    v_calc_total NUMERIC(14,2) := 0.00;
    v_calc_amount_due NUMERIC(14,2) := 0.00;
    v_payment_status public.payment_status_type;
    v_current_stock NUMERIC(14,4);
    v_new_stock NUMERIC(14,4);
    v_is_active BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Verify Business Membership
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied. You do not belong to this business.';
    END IF;

    -- Validate items array
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A sale must contain at least one line item.';
    END IF;

    -- Pre-calculate financial totals & validate item parameters
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_qty := (v_item->>'quantity')::NUMERIC(14,4);
        v_item_price := (v_item->>'unit_price')::NUMERIC(14,2);
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC(14,2), 0.00);

        IF v_item_qty <= 0 THEN
            RAISE EXCEPTION 'Invalid line item quantity: %. Must be greater than zero.', v_item_qty;
        END IF;

        IF v_item_price < 0 THEN
            RAISE EXCEPTION 'Invalid line item price: %. Cannot be negative.', v_item_price;
        END IF;

        v_item_subtotal := ROUND((v_item_qty * v_item_price)::NUMERIC, 2);
        v_item_total := GREATEST(0.00, v_item_subtotal - v_item_discount);

        v_calc_subtotal := v_calc_subtotal + v_item_subtotal;
        v_calc_total := v_calc_total + v_item_total;
    END LOOP;

    -- Apply overall transaction discount if any
    v_calc_total := GREATEST(0.00, v_calc_total - COALESCE(p_discount_amount, 0.00));

    -- Determine initial payment status
    IF p_amount_paid >= v_calc_total THEN
        v_payment_status := 'paid';
        v_calc_amount_due := 0.00;
    ELSIF p_amount_paid > 0.00 THEN
        v_payment_status := 'partial';
        v_calc_amount_due := v_calc_total - p_amount_paid;
    ELSE
        v_payment_status := 'unpaid';
        v_calc_amount_due := v_calc_total;
    END IF;

    -- 1. Insert master sales record
    INSERT INTO public.sales (
        business_id,
        customer_id,
        created_by,
        sale_status,
        payment_status,
        payment_method,
        subtotal,
        discount,
        total,
        amount_paid,
        amount_due,
        notes,
        sold_at
    ) VALUES (
        p_business_id,
        p_customer_id,
        v_user_id,
        'completed',
        v_payment_status,
        p_payment_method,
        v_calc_subtotal,
        COALESCE(p_discount_amount, 0.00),
        v_calc_total,
        COALESCE(p_amount_paid, 0.00),
        v_calc_amount_due,
        p_notes,
        clock_timestamp()
    )
    RETURNING id INTO v_sale_id;

    -- 2. Process line items, perform inventory deductions for physical products
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_item_qty := (v_item->>'quantity')::NUMERIC(14,4);
        v_item_price := (v_item->>'unit_price')::NUMERIC(14,2);
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC(14,2), 0.00);
        v_item_subtotal := ROUND((v_item_qty * v_item_price)::NUMERIC, 2);
        v_item_total := GREATEST(0.00, v_item_subtotal - v_item_discount);

        -- Row Lock product to prevent race condition over-selling
        SELECT name, cost_price, stock_quantity, is_active, product_type, unit_of_measure
        INTO v_product_name, v_cost_price, v_current_stock, v_is_active, v_product_type, v_unit_measure
        FROM public.products
        WHERE id = v_product_id AND business_id = p_business_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % does not exist in this business.', v_product_id;
        END IF;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'Product "%" is archived and cannot be sold.', v_product_name;
        END IF;

        -- For physical products, check and deduct inventory
        IF v_product_type = 'physical' THEN
            IF v_current_stock < v_item_qty THEN
                RAISE EXCEPTION 'Insufficient stock for product "%". Requested: %, Available: %', 
                    v_product_name, v_item_qty, v_current_stock;
            END IF;

            v_new_stock := v_current_stock - v_item_qty;

            -- Deduct stock from products table
            UPDATE public.products
            SET stock_quantity = v_new_stock,
                updated_at = clock_timestamp()
            WHERE id = v_product_id;

            -- Write audit trail to inventory ledger
            INSERT INTO public.inventory_transactions (
                business_id,
                product_id,
                transaction_type,
                quantity,
                reference_id,
                reference_type,
                notes,
                created_by
            ) VALUES (
                p_business_id,
                v_product_id,
                'sale',
                -v_item_qty,
                v_sale_id,
                'sale',
                'POS Checkout sale #' || LEFT(v_sale_id::text, 8),
                v_user_id
            );
        END IF;

        -- Insert line item with unit_of_measure snapshot
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
            total,
            unit_of_measure
        ) VALUES (
            v_sale_id,
            p_business_id,
            v_product_id,
            v_product_name,
            v_item_qty,
            v_item_price,
            COALESCE(v_cost_price, 0.00),
            v_item_discount,
            v_item_subtotal,
            v_item_total,
            v_unit_measure
        );
    END LOOP;

    -- 3. If customer paid anything up front, record transaction payment record
    IF p_amount_paid > 0.00 THEN
        INSERT INTO public.payments (
            business_id,
            sale_id,
            customer_id,
            amount,
            payment_method,
            payment_date,
            reference_number,
            notes,
            created_by
        ) VALUES (
            p_business_id,
            v_sale_id,
            p_customer_id,
            p_amount_paid,
            p_payment_method,
            clock_timestamp(),
            p_reference_number,
            'Initial payment at checkout',
            v_user_id
        );
    END IF;

    -- Return the newly created sale summary
    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'total', v_calc_total,
        'amount_paid', p_amount_paid,
        'amount_due', v_calc_amount_due,
        'payment_status', v_payment_status
    );
END;
$$;

-- 5. Update record_inventory_movement to handle NUMERIC quantities and reject services
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
    p_business_id UUID,
    p_product_id UUID,
    p_transaction_type public.inventory_transaction_type,
    p_quantity NUMERIC(14,4),
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_unit_cost NUMERIC(14,2) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_current_stock NUMERIC(14,4);
    v_new_stock NUMERIC(14,4);
    v_delta NUMERIC(14,4);
    v_product_cost NUMERIC(14,2);
    v_product_type TEXT;
    v_tx_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Verify Business Membership
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members 
        WHERE business_id = p_business_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied: You do not belong to this business.';
    END IF;

    -- Fetch product with row-level lock
    SELECT stock_quantity, cost_price, product_type
    INTO v_current_stock, v_product_cost, v_product_type
    FROM public.products
    WHERE id = p_product_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found in this business.', p_product_id;
    END IF;

    IF v_product_type = 'service' THEN
        RAISE EXCEPTION 'Cannot record inventory movements for services. Services do not track physical stock.';
    END IF;

    -- Compute delta and new stock according to movement type
    CASE p_transaction_type
        WHEN 'purchase', 'restock', 'return' THEN
            IF p_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity for % must be positive.', p_transaction_type;
            END IF;
            v_delta := p_quantity;
            v_new_stock := v_current_stock + v_delta;

        WHEN 'damage' THEN
            IF p_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity for damage must be positive.';
            END IF;
            IF v_current_stock < p_quantity THEN
                RAISE EXCEPTION 'Cannot record damage of % units; only % currently in stock.', p_quantity, v_current_stock;
            END IF;
            v_delta := -p_quantity;
            v_new_stock := v_current_stock - p_quantity;

        WHEN 'adjustment' THEN
            IF p_quantity < 0 THEN
                RAISE EXCEPTION 'Target stock count cannot be negative.';
            END IF;
            v_delta := p_quantity - v_current_stock;
            v_new_stock := p_quantity;

        WHEN 'sale' THEN
            IF p_quantity <= 0 THEN
                RAISE EXCEPTION 'Sale quantity must be positive.';
            END IF;
            IF v_current_stock < p_quantity THEN
                RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %', p_quantity, v_current_stock;
            END IF;
            v_delta := -p_quantity;
            v_new_stock := v_current_stock - p_quantity;

        WHEN 'initial_stock' THEN
            IF p_quantity < 0 THEN
                RAISE EXCEPTION 'Initial stock cannot be negative.';
            END IF;
            v_delta := p_quantity;
            v_new_stock := p_quantity;

        ELSE
            RAISE EXCEPTION 'Unsupported transaction type: %', p_transaction_type;
    END CASE;

    -- Update products stock
    UPDATE public.products
    SET stock_quantity = v_new_stock,
        updated_at = clock_timestamp()
    WHERE id = p_product_id;

    -- Insert ledger record
    INSERT INTO public.inventory_transactions (
        business_id,
        product_id,
        transaction_type,
        quantity,
        reference_id,
        reference_type,
        notes,
        created_by,
        unit_cost
    ) VALUES (
        p_business_id,
        p_product_id,
        p_transaction_type,
        v_delta,
        p_reference_id,
        p_reference_type,
        p_notes,
        v_user_id,
        COALESCE(p_unit_cost, v_product_cost)
    )
    RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

-- 6. Update get_business_dashboard_summary to exclude services from low stock alerts & inventory valuation
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
    v_low_stock_threshold NUMERIC(14,4) := 5;
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
      AND sold_at >= v_start 
      AND sold_at <= v_end;

    v_gross_profit := v_revenue - v_cogs;

    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_total_expenses
    FROM public.expenses
    WHERE business_id = p_business_id 
      AND expense_date >= v_start::DATE 
      AND expense_date <= v_end::DATE;

    v_net_profit := v_gross_profit - v_total_expenses;

    -- Physical inventory calculation only: exclude services
    SELECT 
        COALESCE(SUM(stock_quantity * cost_price), 0.00),
        COUNT(CASE WHEN stock_quantity <= COALESCE(minimum_stock_level, v_low_stock_threshold) THEN 1 END)
    INTO 
        v_total_inventory_valuation,
        v_low_stock_count
    FROM public.products
    WHERE business_id = p_business_id 
      AND is_active = true
      AND product_type != 'service';

    RETURN jsonb_build_object(
        'currency', v_currency,
        'revenue', v_revenue,
        'cogs', v_cogs,
        'gross_profit', v_gross_profit,
        'total_expenses', v_total_expenses,
        'net_profit', v_net_profit,
        'transaction_count', v_transaction_count,
        'average_order_value', v_average_order_value,
        'outstanding_receivables', v_outstanding_receivables,
        'total_inventory_valuation', v_total_inventory_valuation,
        'low_stock_count', v_low_stock_count,
        'period_start', v_start,
        'period_end', v_end
    );
END;
$$;

-- 7. Update get_ai_business_context to exclude services from low stock items and include unit_of_measure
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

    -- Top selling items
    SELECT jsonb_agg(sub) INTO v_top_products FROM (
        SELECT 
            si.product_name_snapshot AS product_name,
            COALESCE(si.unit_of_measure, 'unit') AS unit_of_measure,
            SUM(si.quantity) AS total_units_sold,
            SUM(si.total) AS total_revenue,
            SUM(si.total - (si.unit_cost * si.quantity)) AS gross_profit
        FROM public.sale_items si
        INNER JOIN public.sales s ON s.id = si.sale_id
        WHERE s.business_id = p_business_id 
          AND s.sale_status = 'completed'
          AND s.sold_at >= v_since
        GROUP BY si.product_name_snapshot, si.unit_of_measure
        ORDER BY total_revenue DESC
        LIMIT 5
    ) sub;

    -- Low stock items requiring restock attention (physical products only)
    SELECT jsonb_agg(sub) INTO v_low_stock_items FROM (
        SELECT 
            p.name,
            p.sku,
            p.product_type,
            p.unit_of_measure,
            p.stock_quantity,
            p.minimum_stock_level,
            c.name AS category_name
        FROM public.products p
        LEFT JOIN public.product_categories c ON c.id = p.category_id
        WHERE p.business_id = p_business_id 
          AND p.is_active = true 
          AND p.product_type != 'service'
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
        LIMIT 5
    ) sub;

    -- Customer metrics
    SELECT jsonb_build_object(
        'total_registered_customers', COUNT(id),
        'active_customers', COUNT(CASE WHEN is_active THEN 1 END)
    ) INTO v_customer_summary
    FROM public.customers
    WHERE business_id = p_business_id;

    RETURN jsonb_build_object(
        'business', jsonb_build_object(
            'id', p_business_id,
            'name', v_business.name,
            'business_type', v_business.business_type,
            'country', v_business.country,
            'currency', v_business.currency,
            'timezone', v_business.timezone
        ),
        'financial_summary', v_summary,
        'top_performing_products', COALESCE(v_top_products, '[]'::jsonb),
        'low_stock_alerts', COALESCE(v_low_stock_items, '[]'::jsonb),
        'recent_expenses', COALESCE(v_recent_expenses, '[]'::jsonb),
        'customer_metrics', v_customer_summary,
        'context_generated_at', clock_timestamp()
    );
END;
$$;
