-- =============================================================================
-- NewAge I.T. Solution Center - rate limiting
-- Run this in the Supabase SQL Editor AFTER schema.sql has already been applied.
-- Adds a per-IP rate limit to the contact form, repair-ticket submission, and
-- the public repair-tracking lookup, so a script can't flood the tables or
-- brute-force ticket IDs/phone numbers.
-- =============================================================================

-- ------------------------------------------------------------------
-- Counter table. Locked down with RLS + no policies, so anon/authenticated
-- can never read or write it directly - only the SECURITY DEFINER functions
-- below (owned by the table owner, which bypasses RLS) can touch it.
-- ------------------------------------------------------------------
create table if not exists public.rate_limits (
    key text primary key,
    count int not null default 1,
    window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- ------------------------------------------------------------------
-- Best-effort client identifier. Supabase's gateway (Kong) sets
-- X-Forwarded-For before requests reach PostgREST, which exposes it to
-- Postgres as the `request.headers` GUC. Falls back to a single shared
-- bucket if the header is ever missing (e.g. requests from the SQL editor).
-- ------------------------------------------------------------------
create or replace function public.client_ip()
returns text
language sql
stable
as $$
    select coalesce(
        split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
        'unknown'
    );
$$;

-- ------------------------------------------------------------------
-- Fixed-window rate limiter. Returns true if the call is allowed, false if
-- the key has already hit p_max within the last p_window_seconds.
-- ------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    insert into public.rate_limits (key, count, window_start)
    values (p_key, 1, now())
    on conflict (key) do update
        set count = case
                when public.rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
                    then 1
                else public.rate_limits.count + 1
            end,
            window_start = case
                when public.rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
                    then now()
                else public.rate_limits.window_start
            end
    returning count into v_count;

    return v_count <= p_max;
end;
$$;

-- ------------------------------------------------------------------
-- Lock down direct inserts and route them through rate-limited RPCs instead.
-- Raw table INSERT policies for anon are removed so the only way in is
-- submit_inquiry()/submit_repair() below.
-- ------------------------------------------------------------------
drop policy if exists "inquiries_public_insert" on public.inquiries;
drop policy if exists "repairs_public_insert" on public.repairs;

create or replace function public.submit_inquiry(
    p_ticket_id text,
    p_customer_name text,
    p_phone text,
    p_email text,
    p_service text,
    p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.check_rate_limit('inquiry:' || public.client_ip(), 5, 3600) then
        raise exception 'Too many submissions. Please try again in a while.';
    end if;

    insert into public.inquiries (ticket_id, customer_name, phone, email, service, message)
    values (p_ticket_id, p_customer_name, p_phone, p_email, p_service, p_message);
end;
$$;

grant execute on function public.submit_inquiry(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.submit_repair(
    p_ticket_id text,
    p_customer_name text,
    p_phone text,
    p_device text,
    p_issue text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.check_rate_limit('repair:' || public.client_ip(), 5, 3600) then
        raise exception 'Too many submissions. Please try again in a while.';
    end if;

    insert into public.repairs (ticket_id, customer_name, phone, device, issue, stage, date_received)
    values (p_ticket_id, p_customer_name, p_phone, p_device, p_issue, 1, current_date);
end;
$$;

grant execute on function public.submit_repair(text, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------------
-- Rate-limit the public repair lookup too (20 lookups/hour/IP), so it can't
-- be used to brute-force ticket IDs or phone numbers.
-- ------------------------------------------------------------------
create or replace function public.track_repair(p_query text)
returns table (
    ticket_id text,
    customer_name text,
    phone text,
    device text,
    issue text,
    stage int,
    date_received text,
    estimated_delivery text,
    cost text,
    technician_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    clean_ticket text := upper(trim(p_query));
    clean_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
    if not public.check_rate_limit('track:' || public.client_ip(), 20, 3600) then
        raise exception 'Too many lookup attempts. Please try again in a while.';
    end if;

    return query
    select r.ticket_id, r.customer_name, r.phone, r.device, r.issue, r.stage,
           to_char(r.date_received, 'YYYY-MM-DD'), r.estimated_delivery, r.cost, r.technician_notes
    from public.repairs r
    where upper(r.ticket_id) = clean_ticket
       or (length(clean_digits) >= 7 and regexp_replace(r.phone, '\D', '', 'g') = clean_digits)
    limit 1;
end;
$$;

grant execute on function public.track_repair(text) to anon, authenticated;
