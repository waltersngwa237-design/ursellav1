-- ============================================================================
-- URSELLA PHASE 6: PRODUCTION HARDENING, COMMERCIALIZATION & LAUNCH READINESS
-- Subscriptions, Payment Events, AI Cost Tracking, User Feedback, Data Imports & Audit
-- ============================================================================

-- 1. SUBSCRIPTION PLANS & ENTITLEMENTS
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'business', 'enterprise')),
  description TEXT,
  monthly_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  annual_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_members INT NOT NULL DEFAULT 1,
  ai_monthly_quota INT NOT NULL DEFAULT 100,
  max_products INT NOT NULL DEFAULT 100,
  allows_csv_import BOOLEAN NOT NULL DEFAULT true,
  allows_export BOOLEAN NOT NULL DEFAULT true,
  allows_advanced_reports BOOLEAN NOT NULL DEFAULT true,
  allows_push_notifications BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Subscription Plans
INSERT INTO public.subscription_plans (
  id, name, tier, description, monthly_price, annual_price, currency, features_json, max_members, ai_monthly_quota, max_products, allows_csv_import, allows_export, allows_advanced_reports, allows_push_notifications
) VALUES
  ('plan_free', 'Starter Free', 'free', 'Ideal for solo micro-merchants just getting started', 0.00, 0.00, 'USD', '["Deterministic Analytics", "Core POS Sales & Receipts", "Single User", "100 AI Queries / month", "Basic Reports"]'::jsonb, 1, 100, 100, true, true, false, false),
  ('plan_pro', 'Ursella Pro', 'pro', 'Growing retail & services needing proactive AI & multi-user', 15.00, 150.00, 'USD', '["All Free Features", "Unlimited Proactive Intelligence", "Up to 5 Team Members", "1,000 AI Queries / month", "Full Financial Reporting & PDF", "CSV Data Import/Export", "WhatsApp Payment Reminders"]'::jsonb, 5, 1000, 2500, true, true, true, true),
  ('plan_business', 'Ursella Business Scale', 'business', 'For multi-location shops, wholesalers and high-volume commerce', 45.00, 450.00, 'USD', '["All Pro Features", "Unlimited Team Members & Roles", "10,000 AI Queries / month", "Automated Action Authorizations", "Priority Mobile Money & Stripe Integrations", "Advanced Audit Logs & Export API"]'::jsonb, 50, 10000, 100000, true, true, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  features_json = EXCLUDED.features_json,
  ai_monthly_quota = EXCLUDED.ai_monthly_quota;

-- 2. BUSINESS ACTIVE SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'incomplete')),
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('momo', 'stripe', 'flutterwave', 'paystack', 'manual')),
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_subscription UNIQUE (business_id)
);

-- 3. PAYMENT TRANSACTIONS & WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  provider TEXT NOT NULL DEFAULT 'momo',
  provider_tx_id TEXT,
  customer_email TEXT,
  payment_method TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AI USAGE & TOKEN BUDGET LOGS
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  latency_ms INT NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. USER FEEDBACK & QUALITY TRACKING
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('ai_rating', 'bug', 'feature_request', 'general')),
  rating TEXT CHECK (rating IN ('helpful', 'unhelpful')),
  comment TEXT,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. DATA IMPORT BATCHES
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('products', 'customers', 'expenses', 'sales', 'inventory')),
  filename TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  successful_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('previewing', 'completed', 'failed', 'rolled_back')),
  errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PHASE 6 PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_business_id ON public.business_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_business_id ON public.payment_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_business_created ON public.ai_usage_logs(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_business_id ON public.user_feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_business_id ON public.import_batches(business_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR PHASE 6 TABLES
-- ============================================================================
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Plans are publicly readable by authenticated users
CREATE POLICY "Public plans read" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);

-- Business subscriptions: members of business can read; owners/admins can update
CREATE POLICY "Business subscriptions select" ON public.business_subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = business_subscriptions.business_id
      AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Business subscriptions modify" ON public.business_subscriptions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = business_subscriptions.business_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
  ));

-- Payment transactions: scoped to business members
CREATE POLICY "Payment transactions select" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = payment_transactions.business_id
      AND bm.user_id = auth.uid()
  ));

-- AI usage logs: scoped to business members
CREATE POLICY "AI usage select" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = ai_usage_logs.business_id
      AND bm.user_id = auth.uid()
  ));

CREATE POLICY "AI usage insert" ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = ai_usage_logs.business_id
      AND bm.user_id = auth.uid()
  ));

-- User Feedback: insertable by members, readable by business members
CREATE POLICY "Feedback insert" ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = user_feedback.business_id
      AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Feedback select" ON public.user_feedback
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = user_feedback.business_id
      AND bm.user_id = auth.uid()
  ));

-- Import batches: scoped to business members
CREATE POLICY "Import batches select" ON public.import_batches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = import_batches.business_id
      AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Import batches insert" ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = import_batches.business_id
      AND bm.user_id = auth.uid()
  ));
