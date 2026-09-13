-- =============================================================================
-- NewAge I.T. Solution Center - add numeric stock quantity to products
-- Run this once in the Supabase SQL Editor (after schema.sql has been applied).
-- Additive only - safe to run on a live database, no data is touched.
-- =============================================================================

alter table public.products add column if not exists stock_qty integer not null default 0;
