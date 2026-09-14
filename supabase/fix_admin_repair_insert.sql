-- =============================================================================
-- NewAge I.T. Solution Center - fix "New Repair Job" failing in the admin panel
-- Run this once in the Supabase SQL Editor.
--
-- Root cause: rate_limiting.sql replaced the public repairs-insert policy
-- with the rate-limited submit_repair() RPC, but never added a policy
-- letting a logged-in admin insert a ticket directly (for walk-in
-- customers who didn't submit through the website). Every other table
-- (products, videos, chatbot_services) already has a "for all" policy
-- covering authenticated inserts - repairs only had select/update/delete.
-- =============================================================================

create policy "repairs_admin_insert" on public.repairs for insert
    with check (auth.role() = 'authenticated');
