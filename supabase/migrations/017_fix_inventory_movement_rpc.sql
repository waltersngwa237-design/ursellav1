-- =============================================================================
-- Migration 017: Fix record_inventory_movement RPC Signature & Schema Cache
-- =============================================================================
-- Resolves parameter naming discrepancies between client SDK (p_type, p_product_id)
-- and migration 016 (p_transaction_type), with complete support for decimal quantities,
-- FIFO unit_cost tracking, and typo compatibility.
-- =============================================================================

-- 1. Canonical Implementation with p_type and p_product_id
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
    p_business_id UUID,
    p_product_id UUID,
    p_type public.inventory_transaction_type,
    p_quantity NUMERIC(14,4),
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT 'manual',
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

    -- Verify Business Membership (if executed in authenticated context)
    IF v_user_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.business_members 
            WHERE business_id = p_business_id AND user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Access denied: You do not belong to this business.';
        END IF;
    END IF;

    -- Fetch product with row-level concurrency lock
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
    CASE p_type
        WHEN 'purchase', 'restock', 'return' THEN
            IF p_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity for % must be positive.', p_type;
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
            RAISE EXCEPTION 'Unsupported transaction type: %', p_type;
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
        p_type,
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

-- 2. Compatibility Overload for migration 016 naming (p_transaction_type)
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
    p_business_id UUID,
    p_product_id UUID,
    p_transaction_type public.inventory_transaction_type,
    p_quantity NUMERIC(14,4),
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT 'manual',
    p_notes TEXT DEFAULT NULL,
    p_unit_cost NUMERIC(14,2) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.record_inventory_movement(
        p_business_id => p_business_id,
        p_product_id => p_product_id,
        p_type => p_transaction_type,
        p_quantity => p_quantity,
        p_reference_id => p_reference_id,
        p_reference_type => p_reference_type,
        p_notes => p_notes,
        p_unit_cost => p_unit_cost
    );
END;
$$;

-- 3. Compatibility Overload for client typos (p_product_ia, p_reference_ia, P_notes)
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
    p_business_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_product_ia UUID DEFAULT NULL,
    p_quantity NUMERIC DEFAULT 0,
    p_reference_ia UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT 'manual',
    p_type public.inventory_transaction_type DEFAULT 'adjustment',
    p_unit_cost NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.record_inventory_movement(
        p_business_id => p_business_id,
        p_product_id => p_product_ia,
        p_type => p_type,
        p_quantity => p_quantity::NUMERIC(14,4),
        p_reference_id => p_reference_ia,
        p_reference_type => p_reference_type,
        p_notes => p_notes,
        p_unit_cost => p_unit_cost::NUMERIC(14,2)
    );
END;
$$;

-- 4. Permissions & Grants
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(
    UUID, UUID, public.inventory_transaction_type, NUMERIC(14,4), UUID, TEXT, TEXT, NUMERIC(14,2)
) TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION public.record_inventory_movement(
    UUID, UUID, public.inventory_transaction_type, NUMERIC(14,4), UUID, TEXT, TEXT, NUMERIC(14,2)
) TO authenticated, anon, service_role;

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
