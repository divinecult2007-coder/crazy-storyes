-- ============================================================
-- CRAZY STORYES — MEMBERSHIP PLANS DISCOUNT COLUMNS MIGRATION
-- Safe to run on existing Supabase databases (preserves all rows)
-- Run in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================

ALTER TABLE IF EXISTS public.membership_plans
  ADD COLUMN IF NOT EXISTS original_price NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill original_price for existing plans where it is NULL
UPDATE public.membership_plans
SET original_price = price
WHERE original_price IS NULL;
