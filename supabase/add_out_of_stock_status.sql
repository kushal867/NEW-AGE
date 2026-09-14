-- =============================================================================
-- NewAge I.T. Solution Center - allow an explicit "out-of-stock" status
-- Run this once in the Supabase SQL Editor (after schema.sql has been applied).
-- Additive only - safe to run on a live database, no data is touched. Existing
-- rows stay 'in-stock' or 'pre-order' exactly as they are; this just widens
-- the allowed values so the CMS can also save 'out-of-stock'.
-- =============================================================================

alter table public.products drop constraint if exists products_stock_check;
alter table public.products add constraint products_stock_check
    check (stock in ('in-stock', 'pre-order', 'out-of-stock'));
