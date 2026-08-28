# Ursella Business OS — PostgreSQL Database Architecture & RLS Security

This document details the production-ready PostgreSQL and Supabase database architecture for **Ursella**, an AI-powered operating system for small businesses.

---

## 1. Architectural Highlights

- **Database Engine**: PostgreSQL 15+ / Supabase
- **Multi-Tenancy**: Organization / Business-level tenant isolation with strict Row Level Security (RLS) policies on all tables.
- **Identity & Auth**: Integration with `auth.users`, synchronized profiles, and role-based access control (`owner`, `admin`, `staff`).
- **Financial Precision**: All monetary calculations use `NUMERIC(14,2)` — zero floating-point inaccuracies.
- **Snapshot Immutability**: Historical sales store immutable item snapshots (`product_name_snapshot`, `unit_cost`, `unit_price`) so future price edits never corrupt past financial reports.
- **Inventory Ledger**: Double-entry style append-only audit trail (`inventory_transactions`) with optimistic/pessimistic row locking (`SELECT ... FOR UPDATE`) during atomic checkout.
- **Serverless AI Integration**: Structured, token-efficient pre-aggregation RPC (`get_ai_business_context`) for Google Gemini without raw data dumps or cross-tenant leaks.

---

## 2. Entity Model & Schema Breakdown

The schema comprises **16 normalized tables**:

| Table | Purpose | Security & Constraints |
|---|---|---|
| `profiles` | User accounts linked to `auth.users` | Trigger-based auto-creation on signup |
| `businesses` | Tenant entities | Multi-tenant root, currency, and timezone |
| `business_members` | Role-based tenant memberships | `owner`, `admin`, `staff` with unique `(business_id, user_id)` |
| `business_settings` | Per-tenant operational configurations | Tax rules, low stock thresholds |
| `product_categories`| Hierarchical or grouped product taxonomy | Unique per business name |
| `suppliers` | Vendor and procurement directory | Contact and payment reference |
| `products` | Inventory catalog and current stock levels | SKU uniqueness per business, non-negative stock constraint |
| `inventory_transactions` | Immutable inventory movement audit log | Tracks sales, restocks, damage, audit adjustments |
| `customers` | Client directory and ledger | Contact information, active status |
| `sales` | Sale headers and payment state | Atomic status (`completed`, `cancelled`, `refunded`), monetary balances |
| `sale_items` | Line items with historical cost snapshots | Stores historical `unit_cost` for exact Gross Margin reporting |
| `payments` | Cash and mobile money payment logs | Tracks amount, method (`cash`, `mobile_money`, `card`, etc.), collector |
| `expenses` | Operating and capital expenditures | Categorized, recurring flags |
| `ai_conversations` | Tenant-isolated AI chat threads | Context-scoped AI interaction history |
| `ai_messages` | Contextual LLM message history | Role-based messages (`user`, `assistant`, `system`) |
| `ai_insights` | Proactive business recommendations | Type, severity (`info`, `warning`, `critical`), lifecycle status |
| `notifications` | In-app alerts and system messages | Unread tracking, user target |

---

## 3. Security & Row Level Security (RLS) Matrix

RLS is enabled on **every single public table**. Multi-tenant validation is centralized through the security definer function:

```sql
CREATE OR REPLACE FUNCTION public.user_has_business_access(
    p_business_id UUID,
    p_required_roles member_role[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.business_members 
        WHERE business_id = p_business_id 
          AND user_id = auth.uid()
          AND (p_required_roles IS NULL OR role = ANY(p_required_roles))
    );
$$;
```

### Access Control Policy Summary:
1. **Catalog, Sales, Customers, Payments, Expenses, Notifications**:
   - **SELECT**: Accessible by all active business members (`owner`, `admin`, `staff`).
   - **INSERT**: Accessible by all active business members.
   - **UPDATE / DELETE**: Restricted to `owner` and `admin` roles (preventing unauthorized alterations by operational staff).
2. **Business Settings & Members**:
   - Only `owner` and `admin` can invite members or alter business parameters.
   - Only `owner` can change business ownership or delete a business entity.
3. **Inventory Transactions & Sale Items**:
   - Immutable audit logs; updates and deletions are restricted or prevented to preserve financial auditability.

---

## 4. Atomic PostgreSQL Stored Procedures (RPCs)

### A. `create_business_with_owner`
Atomically creates a new business entity, inserts the calling user as `owner` into `business_members`, and initializes default `business_settings` in a single ACID transaction.

### B. `process_complete_sale`
Performs complete point-of-sale checkout:
1. Locks all involved product rows using `SELECT ... FOR UPDATE`.
2. Validates that available stock is sufficient for each item.
3. Calculates line item totals, discounts, taxes, and subtotal.
4. Decrements `products.stock_quantity`.
5. Records immutable `sale_items` snapshotting current unit cost and product name.
6. Writes audit logs into `inventory_transactions`.
7. Records any upfront payment into `payments` and sets `sales.payment_status` (`paid`, `partial`, `unpaid`).

### C. `record_inventory_movement`
Atomically applies inventory adjustments (`restock`, `damage`, `return`, `audit`) with pessimistic row locking and logs the movement in `inventory_transactions`.

### D. `get_business_dashboard_summary`
Calculates real-time financial and operational metrics:
- Revenue, Cost of Goods Sold (COGS) based on historical snapshots, Gross Profit, Expenses, Net Profit, Average Order Value, Accounts Receivable, Inventory Valuation, and Low Stock Alerts.

### E. `get_ai_business_context`
Aggregates key metrics, top selling products, low stock warnings, and recent financial trends into a structured JSON payload for Google Gemini reasoning.

---

## 5. Automated Verification Test Suite

A comprehensive SQL test script is provided in `/supabase/tests/database_test.sql`. It verifies:
- Multi-tenant tenant creation and isolation
- Stock deduction integrity and concurrency locking
- Gross profit preservation against post-sale price modifications
- Cross-tenant data leakage prevention

---

## 6. Migration Structure

- `001_extensions_and_helpers.sql` — UUID, pgcrypto, enum types, helper functions.
- `002_profiles_and_businesses.sql` — User profiles and tenant entities.
- `003_memberships_and_settings.sql` — Role assignments and configurations.
- `004_products_and_inventory.sql` — Categories, suppliers, products, and inventory ledger.
- `005_customers_sales_and_payments.sql` — Customer CRM, sales headers, line items, and payment logs.
- `006_expenses.sql` — Business expense tracking.
- `007_ai_and_notifications.sql` — AI conversations, insights, and notification feeds.
- `008_indexes.sql` — High-performance foreign key, composite, and search indexes.
- `009_functions_and_rpcs.sql` — Atomic business logic and aggregation functions.
- `010_rls_security.sql` — Row Level Security policies across all tables.
- `011_seed_data.sql` — Reference demo tenant ("Kivu Roast & Cafe") with sample catalog and sales.
- `schema.sql` — Consolidated single-file schema for Supabase SQL Editor.
