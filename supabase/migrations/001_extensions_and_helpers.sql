-- ============================================================================
-- Migration 001: Extensions, Enums, and Utility Functions
-- ============================================================================

-- Ensure required PostgreSQL extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum: Member roles within a business
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('owner', 'admin', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: Inventory movement transaction types
DO $$ BEGIN
    CREATE TYPE inventory_transaction_type AS ENUM (
        'purchase',
        'sale',
        'adjustment',
        'return',
        'restock',
        'damage',
        'initial_stock'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: Payment statuses for sales
DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: Status of sales
DO $$ BEGIN
    CREATE TYPE sale_status_type AS ENUM ('completed', 'cancelled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: Payment methods
DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM (
        'cash',
        'mobile_money',
        'bank_transfer',
        'card',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: AI Message roles
DO $$ BEGIN
    CREATE TYPE ai_role_type AS ENUM ('user', 'assistant', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: AI Insight types
DO $$ BEGIN
    CREATE TYPE ai_insight_type AS ENUM (
        'sales',
        'inventory',
        'cash_flow',
        'profit',
        'customer',
        'expense',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: AI Insight severity levels
DO $$ BEGIN
    CREATE TYPE ai_insight_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum: AI Insight lifecycle statuses
DO $$ BEGIN
    CREATE TYPE ai_insight_status AS ENUM ('new', 'read', 'dismissed', 'actioned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Generic updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;
