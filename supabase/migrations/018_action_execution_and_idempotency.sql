-- =============================================================================
-- Migration 018: Action Execution Persistence, Idempotency & Sale RPC Hardening
-- =============================================================================

-- 1. Create Action Proposals Table (Persistent Human-in-the-Loop AI Actions)
CREATE TABLE IF NOT EXISTS public.action_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    insight_id UUID REFERENCES public.ai_insights(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'executed', 'failed', 'cancelled')),
    requested_by TEXT NOT NULL DEFAULT 'ursella_ai',
    requires_role TEXT[] NOT NULL DEFAULT ARRAY['owner', 'admin'],
    impact_preview JSONB DEFAULT NULL,
    result JSONB DEFAULT NULL,
    error TEXT DEFAULT NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NULL,
    executed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_action_proposals_biz_status 
    ON public.action_proposals(business_id, status, created_at DESC);

-- 2. Create Action Audit Logs Table (Immutable Execution History)
CREATE TABLE IF NOT EXISTS public.action_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    action_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    is_ai_proposed BOOLEAN NOT NULL DEFAULT false,
    target_entity_type TEXT DEFAULT NULL,
    target_entity_id TEXT DEFAULT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'rejected')),
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_action_audit_logs_biz 
    ON public.action_audit_logs(business_id, created_at DESC);

-- 3. Create Business Reminders & Tasks Table
CREATE TABLE IF NOT EXISTS public.business_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    related_entity_type TEXT DEFAULT NULL,
    related_entity_id TEXT DEFAULT NULL,
    related_entity_name TEXT DEFAULT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_business_reminders_biz_status 
    ON public.business_reminders(business_id, status, due_date ASC);

-- 4. Create Idempotency Keys Table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    response JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '24 hours'),
    CONSTRAINT uq_idempotency_biz_key UNIQUE (business_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires 
    ON public.idempotency_keys(expires_at);

-- 5. Enable Row-Level Security on New Tables
ALTER TABLE public.action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Tenant Isolation Enforced via business_members)
DROP POLICY IF EXISTS "action_proposals_tenant_isolation" ON public.action_proposals;
CREATE POLICY "action_proposals_tenant_isolation" ON public.action_proposals
    FOR ALL
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "action_audit_logs_tenant_isolation" ON public.action_audit_logs;
CREATE POLICY "action_audit_logs_tenant_isolation" ON public.action_audit_logs
    FOR ALL
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "business_reminders_tenant_isolation" ON public.business_reminders;
CREATE POLICY "business_reminders_tenant_isolation" ON public.business_reminders
    FOR ALL
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_tenant_isolation" ON public.idempotency_keys
    FOR ALL
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Triggers for updated_at
CREATE TRIGGER tr_action_proposals_updated_at
    BEFORE UPDATE ON public.action_proposals
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_business_reminders_updated_at
    BEFORE UPDATE ON public.business_reminders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 7. Authoritative, Concurrency-Safe & Idempotent process_complete_sale
-- =============================================================================
-- Supports both parameter naming sets (p_discount vs p_discount_amount, p_payment_amount vs p_amount_paid),
-- sorts rows before locking to prevent deadlocks, supports fractional units & services,
-- and guarantees financial ledger integrity.

CREATE OR REPLACE FUNCTION public.process_complete_sale(
    p_business_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_discount NUMERIC(14,2) DEFAULT 0.00,
    p_tax NUMERIC(14,2) DEFAULT 0.00,
    p_payment_amount NUMERIC(14,2) DEFAULT 0.00,
    p_payment_method public.payment_method_type DEFAULT 'cash',
    p_payment_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_sale_id UUID;
    v_existing_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_product_name TEXT;
    v_product_type TEXT;
    v_unit_measure TEXT;
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
    v_distinct_product_ids UUID[];
    v_pid UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Verify Business Membership if in authenticated context
    IF v_user_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.business_members 
            WHERE business_id = p_business_id AND user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Access denied. You do not belong to this business.';
        END IF;
    END IF;

    -- 1. Idempotency check: If a payment reference was provided and already exists for this business, return existing sale
    IF p_payment_reference IS NOT NULL AND trim(p_payment_reference) <> '' THEN
        SELECT s.id, s.total, s.amount_paid, s.amount_due, s.payment_status
        INTO v_existing_sale_id, v_calc_total, p_payment_amount, v_calc_amount_due, v_payment_status
        FROM public.payments p
        JOIN public.sales s ON s.id = p.sale_id
        WHERE p.business_id = p_business_id 
          AND (COALESCE(p.reference, '') = trim(p_payment_reference) OR COALESCE(p.reference_number, '') = trim(p_payment_reference))
        LIMIT 1;

        IF v_existing_sale_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'sale_id', v_existing_sale_id,
                'id', v_existing_sale_id,
                'total', v_calc_total,
                'amount_paid', p_payment_amount,
                'amount_due', v_calc_amount_due,
                'payment_status', v_payment_status,
                'is_idempotent_duplicate', true
            );
        END IF;
    END IF;

    -- Validate items array
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A sale must contain at least one line item.';
    END IF;

    -- Extract and sort distinct product IDs to prevent deadlocks when locking rows concurrently
    SELECT array_agg(DISTINCT (item->>'product_id')::UUID ORDER BY (item->>'product_id')::UUID ASC)
    INTO v_distinct_product_ids
    FROM jsonb_array_elements(p_items) AS item
    WHERE item->>'product_id' IS NOT NULL;

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

    -- Apply overall transaction discount and add tax
    v_calc_total := GREATEST(0.00, v_calc_total - COALESCE(p_discount, 0.00)) + COALESCE(p_tax, 0.00);

    -- Determine initial payment status
    IF p_payment_amount >= v_calc_total THEN
        v_payment_status := 'paid';
        v_calc_amount_due := 0.00;
    ELSIF p_payment_amount > 0.00 THEN
        v_payment_status := 'partial';
        v_calc_amount_due := v_calc_total - p_payment_amount;
    ELSE
        v_payment_status := 'unpaid';
        v_calc_amount_due := v_calc_total;
    END IF;

    -- 2. Concurrency Lock: Lock products in deterministic ascending order
    FOREACH v_pid IN ARRAY v_distinct_product_ids
    LOOP
        PERFORM 1 FROM public.products
        WHERE id = v_pid AND business_id = p_business_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % does not exist in this business.', v_pid;
        END IF;
    END LOOP;

    -- 3. Insert master sales record
    INSERT INTO public.sales (
        business_id,
        customer_id,
        created_by,
        sale_status,
        payment_status,
        payment_method,
        subtotal,
        discount,
        tax,
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
        COALESCE(p_discount, 0.00),
        COALESCE(p_tax, 0.00),
        v_calc_total,
        COALESCE(p_payment_amount, 0.00),
        v_calc_amount_due,
        p_notes,
        clock_timestamp()
    )
    RETURNING id INTO v_sale_id;

    -- 4. Process line items, perform inventory deductions for physical products
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_item_qty := (v_item->>'quantity')::NUMERIC(14,4);
        v_item_price := (v_item->>'unit_price')::NUMERIC(14,2);
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC(14,2), 0.00);
        v_item_subtotal := ROUND((v_item_qty * v_item_price)::NUMERIC, 2);
        v_item_total := GREATEST(0.00, v_item_subtotal - v_item_discount);

        SELECT name, cost_price, stock_quantity, is_active, product_type, unit_of_measure
        INTO v_product_name, v_cost_price, v_current_stock, v_is_active, v_product_type, v_unit_measure
        FROM public.products
        WHERE id = v_product_id AND business_id = p_business_id;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'Product "%" is archived and cannot be sold.', v_product_name;
        END IF;

        -- For physical products, verify stock and deduct
        IF v_product_type = 'physical' THEN
            IF v_current_stock < v_item_qty THEN
                RAISE EXCEPTION 'Insufficient stock for product "%". Requested: %, Available: %', 
                    v_product_name, v_item_qty, v_current_stock;
            END IF;

            v_new_stock := v_current_stock - v_item_qty;

            UPDATE public.products
            SET stock_quantity = v_new_stock,
                updated_at = clock_timestamp()
            WHERE id = v_product_id;

            -- Write immutable audit ledger transaction
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
                v_product_id,
                'sale',
                -v_item_qty,
                v_sale_id,
                'sale',
                'POS Checkout sale #' || LEFT(v_sale_id::text, 8),
                v_user_id,
                COALESCE(v_cost_price, 0.00)
            );
        END IF;

        -- Insert line item with unit of measure and cost snapshot
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
            COALESCE(v_unit_measure, 'unit')
        );
    END LOOP;

    -- 5. Record payment record if initial amount paid > 0
    IF p_payment_amount > 0.00 THEN
        INSERT INTO public.payments (
            business_id,
            sale_id,
            customer_id,
            amount,
            payment_method,
            reference,
            reference_number,
            paid_at,
            payment_date,
            notes,
            received_by,
            created_by
        ) VALUES (
            p_business_id,
            v_sale_id,
            p_customer_id,
            p_payment_amount,
            p_payment_method,
            p_payment_reference,
            p_payment_reference,
            clock_timestamp(),
            clock_timestamp(),
            'Initial payment at checkout',
            v_user_id,
            v_user_id
        );
    END IF;

    -- Return JSON result with both sale_id and id for seamless client consumption
    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'id', v_sale_id,
        'total', v_calc_total,
        'amount_paid', p_payment_amount,
        'amount_due', v_calc_amount_due,
        'payment_status', v_payment_status,
        'is_idempotent_duplicate', false
    );
END;
$$;

-- Compatibility Overload supporting (p_amount_paid, p_discount_amount, p_reference_number)
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
BEGIN
    RETURN public.process_complete_sale(
        p_business_id := p_business_id,
        p_customer_id := p_customer_id,
        p_items := p_items,
        p_discount := p_discount_amount,
        p_tax := 0.00,
        p_payment_amount := p_amount_paid,
        p_payment_method := p_payment_method,
        p_payment_reference := p_reference_number,
        p_notes := p_notes
    );
END;
$$;
