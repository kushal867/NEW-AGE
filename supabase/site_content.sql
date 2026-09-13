-- =============================================================================
-- NewAge I.T. Solution Center - editable site text
-- Run this once in the Supabase SQL Editor (after schema.sql has been applied).
-- Public (anon) can read - the public site fetches these on every page load
-- to override its hardcoded defaults. Only an authenticated admin can write.
-- No seed rows: an empty table means the site just shows its normal
-- hardcoded text everywhere, until an admin actually saves something.
-- =============================================================================

create table if not exists public.site_content (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

create policy "site_content_public_read" on public.site_content for select using (true);
create policy "site_content_admin_write" on public.site_content for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
