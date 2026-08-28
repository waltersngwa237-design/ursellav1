-- ============================================================================
-- Development Seed Data (Optional - For local / staging environments)
-- ============================================================================
-- NOTE: Do NOT run in production. Run only for testing/demonstrating Ursella OS.

DO $$
DECLARE
    v_user1_id UUID := '11111111-1111-4111-a111-111111111111';
    v_user2_id UUID := '22222222-2222-4222-a222-222222222222';
    v_user3_id UUID := '33333333-3333-4333-a333-333333333333';
    
    v_biz1_id UUID;
    v_biz2_id UUID;
    
    v_cat1_id UUID;
    v_cat2_id UUID;
    v_cat3_id UUID;
    
    v_sup1_id UUID;
    v_sup2_id UUID;
    
    v_prod1_id UUID;
    v_prod2_id UUID;
    v_prod3_id UUID;
    
    v_cust1_id UUID;
    v_cust2_id UUID;
    
    v_sale1_id UUID;
    v_conv1_id UUID;
BEGIN
    -- 1. Create Mock Profiles (Simulating auth.users records)
    INSERT INTO public.profiles (id, full_name, phone, avatar_url)
    VALUES 
        (v_user1_id, 'Alice Mengue', '+237 670 11 22 33', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'),
        (v_user2_id, 'Bob Ndongo', '+237 690 44 55 66', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'),
        (v_user3_id, 'Charlie Sterling', '+1 415 555 0199', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- 2. Create Business 1 (Kivu Specialty Roast & Cafe - XAF Currency)
    INSERT INTO public.businesses (
        name, business_type, description, country, currency, timezone, created_by
    ) VALUES (
        'Kivu Roast & Cafe', 'Coffee Roastery & Bakery', 'Specialty single-origin coffee and artisan baked goods.', 'Cameroon', 'XAF', 'Africa/Douala', v_user1_id
    ) RETURNING id INTO v_biz1_id;

    -- Memberships for Business 1
    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES 
        (v_biz1_id, v_user1_id, 'owner'::member_role),
        (v_biz1_id, v_user2_id, 'staff'::member_role)
    ON CONFLICT DO NOTHING;

    -- Settings for Business 1
    INSERT INTO public.business_settings (business_id, currency, timezone, business_type, tax_enabled, tax_rate, low_stock_threshold)
    VALUES (v_biz1_id, 'XAF', 'Africa/Douala', 'Cafe/Bakery', true, 19.25, 10)
    ON CONFLICT DO NOTHING;

    -- 3. Create Business 2 (Savanna Tech Gear - USD Currency, Multi-tenant Isolation Target)
    INSERT INTO public.businesses (
        name, business_type, description, country, currency, timezone, created_by
    ) VALUES (
        'Savanna Tech Gear', 'Electronics Retailer', 'Smart accessories and productivity hardware.', 'Kenya', 'USD', 'Africa/Nairobi', v_user3_id
    ) RETURNING id INTO v_biz2_id;

    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (v_biz2_id, v_user3_id, 'owner'::member_role)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.business_settings (business_id, currency, timezone, business_type, tax_enabled, tax_rate, low_stock_threshold)
    VALUES (v_biz2_id, 'USD', 'Africa/Nairobi', 'Electronics', false, 0.00, 5)
    ON CONFLICT DO NOTHING;

    -- 4. Categories for Business 1
    INSERT INTO public.product_categories (business_id, name, description)
    VALUES 
        (v_biz1_id, 'Whole Bean Coffee', 'Freshly roasted whole bean arabica and robusta bags.'),
        (v_biz1_id, 'Pastries & Bakery', 'Fresh daily croissants, bagels, and artisan cakes.')
    RETURNING id INTO v_cat1_id;

    SELECT id INTO v_cat2_id FROM public.product_categories WHERE business_id = v_biz1_id AND name = 'Pastries & Bakery';

    -- Supplier for Business 1
    INSERT INTO public.suppliers (business_id, name, phone, email, address, notes)
    VALUES (v_biz1_id, 'Highland Arabica Cooperative', '+237 671 22 33 44', 'sales@highlandcoffee.cm', 'Foumban Highlands', 'Primary green coffee beans supplier')
    RETURNING id INTO v_sup1_id;

    -- 5. Products for Business 1
    INSERT INTO public.products (
        business_id, category_id, supplier_id, name, sku, selling_price, cost_price, stock_quantity, minimum_stock_level
    ) VALUES 
        (v_biz1_id, v_cat1_id, v_sup1_id, 'Kivu Dark Roast 500g', 'COF-DRK-500', 4500.00, 2200.00, 45, 10),
        (v_biz1_id, v_cat1_id, v_sup1_id, 'Oku White Honey Process 250g', 'COF-WHT-250', 3800.00, 1800.00, 8, 12), -- Low stock alert trigger
        (v_biz1_id, v_cat2_id, NULL, 'Almond Butter Croissant', 'BAK-ALM-CRS', 1200.00, 450.00, 30, 5)
    RETURNING id INTO v_prod1_id;

    SELECT id INTO v_prod2_id FROM public.products WHERE business_id = v_biz1_id AND sku = 'COF-WHT-250';
    SELECT id INTO v_prod3_id FROM public.products WHERE business_id = v_biz1_id AND sku = 'BAK-ALM-CRS';

    -- Initial Stock Ledger Entries for Business 1
    INSERT INTO public.inventory_transactions (business_id, product_id, transaction_type, quantity, reference_type, notes, created_by)
    VALUES 
        (v_biz1_id, v_prod1_id, 'initial_stock', 45, 'seed', 'Initial inventory batch', v_user1_id),
        (v_biz1_id, v_prod2_id, 'initial_stock', 8, 'seed', 'Initial inventory batch', v_user1_id),
        (v_biz1_id, v_prod3_id, 'initial_stock', 30, 'seed', 'Morning fresh bake batch', v_user1_id);

    -- 6. Customers for Business 1
    INSERT INTO public.customers (business_id, name, phone, email, location, notes)
    VALUES 
        (v_biz1_id, 'Dr. Samuel Eto', '+237 677 88 99 00', 'samuel.eto@hospital.cm', 'Bonanjo, Douala', 'VIP customer, prefers dark roast weekly'),
        (v_biz1_id, 'Marie Claire Mbida', '+237 699 11 22 33', 'marie.mbida@lawfirm.cm', 'Akwa, Douala', 'Corporate catering account')
    RETURNING id INTO v_cust1_id;

    SELECT id INTO v_cust2_id FROM public.customers WHERE business_id = v_biz1_id AND name = 'Marie Claire Mbida';

    -- 7. Completed Sale with Historical Snapshot, Payment, and Stock Audit
    INSERT INTO public.sales (
        business_id, customer_id, subtotal, discount, tax, total, amount_paid, amount_due, payment_status, payment_method, sale_status, notes, sold_by, sold_at
    ) VALUES (
        v_biz1_id, v_cust1_id, 10200.00, 200.00, 0.00, 10000.00, 10000.00, 0.00, 'paid'::payment_status_type, 'mobile_money'::payment_method_type, 'completed'::sale_status_type, 'Weekly coffee order', v_user2_id, clock_timestamp() - interval '2 days'
    ) RETURNING id INTO v_sale1_id;

    -- Sale items snapshots
    INSERT INTO public.sale_items (sale_id, business_id, product_id, product_name_snapshot, quantity, unit_price, unit_cost, discount, subtotal, total)
    VALUES 
        (v_sale1_id, v_biz1_id, v_prod1_id, 'Kivu Dark Roast 500g', 2, 4500.00, 2200.00, 0.00, 9000.00, 9000.00),
        (v_sale1_id, v_biz1_id, v_prod3_id, 'Almond Butter Croissant', 1, 1200.00, 450.00, 200.00, 1200.00, 1000.00);

    -- Payment record
    INSERT INTO public.payments (business_id, sale_id, customer_id, amount, payment_method, reference, notes, received_by)
    VALUES (v_biz1_id, v_sale1_id, v_cust1_id, 10000.00, 'mobile_money'::payment_method_type, 'MOMO-TXN-884920', 'MTN Mobile Money verified', v_user2_id);

    -- 8. Business Expenses
    INSERT INTO public.expenses (business_id, category, description, amount, payment_method, expense_date, is_recurring, created_by)
    VALUES 
        (v_biz1_id, 'Utilities', 'Electricity generator fuel and servicing', 35000.00, 'cash'::payment_method_type, CURRENT_DATE - 5, false, v_user1_id),
        (v_biz1_id, 'Packaging', 'Biodegradable coffee pouches and takeaway cups', 24000.00, 'bank_transfer'::payment_method_type, CURRENT_DATE - 1, false, v_user1_id);

    -- 9. AI Conversation & Intelligence Insights
    INSERT INTO public.ai_conversations (business_id, user_id, title, context_type)
    VALUES (v_biz1_id, v_user1_id, 'Weekly Margin and Restock Analysis', 'inventory')
    RETURNING id INTO v_conv1_id;

    INSERT INTO public.ai_messages (conversation_id, business_id, role, content, metadata)
    VALUES 
        (v_conv1_id, v_biz1_id, 'user'::ai_role_type, 'How is our coffee margin performing this week and which items need reordering?', '{"source": "mobile_app"}'::jsonb),
        (v_conv1_id, v_biz1_id, 'assistant'::ai_role_type, 'Your gross margin on coffee beans is healthy at 51.1%. However, "Oku White Honey Process 250g" has only 8 bags remaining against a minimum safety threshold of 12. I recommend placing a purchase order with Highland Arabica Cooperative today.', '{"model": "gemini-2.5-flash", "tokens": 142}'::jsonb);

    INSERT INTO public.ai_insights (business_id, type, title, summary, severity, data, status)
    VALUES 
        (v_biz1_id, 'inventory'::ai_insight_type, 'Low Stock Alert: Oku White Honey Process', 'Current stock (8 units) is below minimum safety threshold (12 units). Reorder lead time is estimated at 3 days.', 'warning'::ai_insight_severity, '{"product_id": "COF-WHT-250", "current_stock": 8, "threshold": 12}'::jsonb, 'new'::ai_insight_status),
        (v_biz1_id, 'profit'::ai_insight_type, 'High Margin Trend: Whole Bean Roast', 'Whole bean sales contributed 85% of gross profit over the last 7 days.', 'info'::ai_insight_severity, '{"margin_pct": 51.1}'::jsonb, 'read'::ai_insight_status);

    -- 10. User Notification
    INSERT INTO public.notifications (business_id, user_id, type, title, message, data, is_read)
    VALUES (v_biz1_id, v_user1_id, 'inventory_alert', 'Reorder Required', 'Oku White Honey Process 250g is down to 8 units.', '{"sku": "COF-WHT-250"}'::jsonb, false);

END $$;
