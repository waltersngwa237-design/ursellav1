-- ============================================================================
-- Migration 015: Phase 7 — Authoritative FIFO Costing, Ledger Audit & Security Hardening
-- ============================================================================

-- 1. Add unit_cost column to inventory_transactions table for FIFO cost lot tracking
ALTER TABLE public.inventory_transactions 
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,2);

COMMENT ON COLUMN public.inventory_transactions.unit_cost IS
  'Authoritative per-unit landed cost for stock-in rows (purchases, restocks, initial_stock, positive adjustments). Populated for true FIFO cost lots.';

-- 2. Optional Backfill for Existing History: Use current product cost_price as fallback baseline
UPDATE public.inventory_transactions it
SET unit_cost = p.cost_price
FROM public.products p
WHERE it.product_id = p.id
  AND it.unit_cost IS NULL
  AND it.transaction_type IN ('purchase', 'restock', 'initial_stock', 'return');

-- 3. Upgrade record_inventory_movement RPC to accept and record unit_cost
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
    p_business_id UUID,
    p_product_id UUID,
    p_type inventory_transaction_type,
    p_quantity INTEGER,
    p_reference_type TEXT DEFAULT 'manual',
    p_reference_id UUID DEFAULT NULL,
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
    v_member_role member_role;
    v_product RECORD;
    v_new_stock INTEGER;
    v_tx_id UUID;
    v_effective_unit_cost NUMERIC(14,2);
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

    -- Lock Product Row with concurrency protection
    SELECT id, name, cost_price, selling_price, stock_quantity INTO v_product
    FROM public.products
    WHERE id = p_product_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % does not exist in business %', p_product_id, p_business_id;
    END IF;

    v_effective_unit_cost := COALESCE(p_unit_cost, v_product.cost_price);

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
        v_new_stock := p_quantity; -- Set to target stock quantity
    ELSE
        RAISE EXCEPTION 'Unknown transaction type: %', p_type;
    END IF;

    -- Update Product Stock and cost_price when new purchase price is recorded
    UPDATE public.products
    SET 
        stock_quantity = v_new_stock,
        cost_price = CASE 
            WHEN p_unit_cost IS NOT NULL AND p_type IN ('purchase', 'restock', 'initial_stock') THEN p_unit_cost 
            ELSE cost_price 
        END,
        updated_at = clock_timestamp()
    WHERE id = p_product_id AND business_id = p_business_id;

    -- Insert Ledger Entry with explicit unit_cost for FIFO tracking
    INSERT INTO public.inventory_transactions (
        business_id,
        product_id,
        transaction_type,
        quantity,
        unit_cost,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        p_business_id,
        p_product_id,
        p_type,
        p_quantity,
        CASE 
            WHEN p_type IN ('purchase', 'restock', 'initial_stock', 'return') OR (p_type = 'adjustment' AND p_quantity > 0) 
            THEN v_effective_unit_cost 
            ELSE NULL 
        END,
        p_reference_type,
        p_reference_id,
        p_notes,
        v_user_id
    ) RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$;

-- 4. Index for fast FIFO queries ordered by transaction occurrence
CREATE INDEX IF NOT EXISTS idx_inventory_tx_fifo 
  ON public.inventory_transactions(business_id, product_id, created_at);

-- 5. Grant execute permissions on updated RPC
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(UUID, UUID, inventory_transaction_type, INTEGER, TEXT, UUID, TEXT, NUMERIC) TO authenticated;
