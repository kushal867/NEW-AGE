-- =============================================================================
-- NewAge I.T. Solution Center - Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Replaces the old localStorage-only "CMS" and the Google Sheets repair lookup.
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Products (public catalogue)
-- ------------------------------------------------------------------
create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text not null,
    spec text,
    mrp text,
    price text not null,
    stock text not null default 'in-stock' check (stock in ('in-stock', 'pre-order')),
    image text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Videos (TikTok reels shown on the site)
-- ------------------------------------------------------------------
create table if not exists public.videos (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    topic text,
    views text,
    url text not null,
    thumbnail text,
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Repairs (ticket tracking) - NOT publicly selectable; see track_repair() below
-- ------------------------------------------------------------------
create table if not exists public.repairs (
    ticket_id text primary key,
    customer_name text,
    phone text,
    device text,
    issue text,
    stage int not null default 1 check (stage between 1 and 8),
    date_received date,
    estimated_delivery text,
    cost text,
    technician_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Inquiries (contact form submissions)
-- ------------------------------------------------------------------
create table if not exists public.inquiries (
    id uuid primary key default gen_random_uuid(),
    ticket_id text,
    customer_name text,
    phone text,
    email text,
    service text,
    message text,
    status text not null default 'New' check (status in ('New', 'Contacted', 'In Repair', 'Closed')),
    created_at timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.products enable row level security;
alter table public.videos enable row level security;
alter table public.repairs enable row level security;
alter table public.inquiries enable row level security;

-- Products: everyone can read, only logged-in admin can write
create policy "products_public_read" on public.products for select using (true);
create policy "products_admin_write" on public.products for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Videos: same as products
create policy "videos_public_read" on public.videos for select using (true);
create policy "videos_admin_write" on public.videos for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Repairs: NO direct public read (customer PII) - only admin can read/update/
-- delete. The contact form is allowed to INSERT a new ticket (stage 1) for
-- itself, but can't read back or modify any existing ticket. Visitors look up
-- their own ticket through track_repair() below, which runs as SECURITY
-- DEFINER and returns only the one matching row.
create policy "repairs_public_insert" on public.repairs for insert with check (true);
create policy "repairs_admin_select" on public.repairs for select using (auth.role() = 'authenticated');
create policy "repairs_admin_update" on public.repairs for update
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "repairs_admin_delete" on public.repairs for delete using (auth.role() = 'authenticated');

-- Inquiries: anyone can submit one (contact form), only admin can read/manage them
create policy "inquiries_public_insert" on public.inquiries for insert with check (true);
create policy "inquiries_admin_manage" on public.inquiries for select using (auth.role() = 'authenticated');
create policy "inquiries_admin_update" on public.inquiries for update
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "inquiries_admin_delete" on public.inquiries for delete using (auth.role() = 'authenticated');

-- =============================================================================
-- Secure repair lookup (exact ticket ID or exact phone match only - no
-- substring matching, so this can't be used to enumerate/scrape the table)
-- =============================================================================
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

-- =============================================================================
-- Seed data (same demo content the site already ships with)
-- =============================================================================
insert into public.products (title, category, spec, mrp, price, stock) values
    ('NVMe M.2 1TB PCIe 4.0 SSD', 'Storage', 'Speeds up to 7,000 MB/s. Perfect for high-speed boot, gaming, and 4K editing.', 'NPR 15,500', 'NPR 13,200', 'in-stock'),
    ('16GB DDR4 / DDR5 High-Speed RAM', 'Memory', 'Heat-spreader module, low latency, tested for flawless stability and multitasking.', 'NPR 6,800', 'NPR 5,600', 'in-stock'),
    ('RGB Mechanical Gaming Keyboard', 'Peripherals', 'Blue/Red mechanical switches, tactile feedback, customizable backlit modes.', 'NPR 5,200', 'NPR 4,200', 'in-stock'),
    ('HP & Canon Laser Toner Cartridges', 'Printing', 'High-yield crisp black toner cartridges with original chip for laser printers.', 'NPR 2,800', 'NPR 2,200', 'in-stock'),
    ('Genuine Replacement Laptop Screens', 'Laptop Hardware', 'IPS FHD & 4K display panels for Dell, HP, Lenovo, Acer, and MacBook.', 'NPR 9,500', 'NPR 7,800+', 'pre-order'),
    ('650W 80+ Bronze Gaming PSU', 'Power & Cases', 'Reliable active PFC power supply with Japanese capacitors and silent cooling fan.', 'NPR 7,200', 'NPR 5,900', 'in-stock')
on conflict do nothing;

insert into public.videos (title, topic, views, url) values
    ('Laptop Water Damage? What to do immediately', 'Laptop Emergency Tip', '24.5K views', 'https://www.tiktok.com/player/v1/7595988578186824967'),
    ('Gaming Laptop Won''t Boot? Fixed at the BIOS Level', 'BIOS & Boot Repair', '12K views', 'https://www.tiktok.com/player/v1/7598566558608264466'),
    ('Induction Cooker Not Working? We Can Help', 'Appliance Repair', '21K views', 'https://www.tiktok.com/player/v1/7595196841881472274'),
    ('Power ON but No Display? Full Motherboard Service', 'Chip-Level Engineering', '15K views', 'https://www.tiktok.com/player/v1/7658712315147160853')
on conflict do nothing;

insert into public.repairs (ticket_id, customer_name, phone, device, issue, stage, date_received, estimated_delivery, cost, technician_notes) values
    ('NA-1001', 'Bikash Sharma', '9841301930', 'Dell Inspiron 15 Gaming Laptop', 'Power on failure / Motherboard short circuit', 5, '2026-09-06', '2026-09-10', 'NPR 3,500', 'Replacing power management IC and charging capacitors. Cleaned cooling fans and applied Arctic MX-4 thermal paste.'),
    ('NA-1002', 'Pooja Shrestha', '9801234567', 'Apple MacBook Air M1', 'Cracked display / Vertical colorful lines', 7, '2026-09-05', '2026-09-08', 'NPR 18,000', 'Original Retina screen assembly replaced and calibrated. 90-day NewAge warranty slip ready for collection.'),
    ('NA-1003', 'Aayush Thapa', '9812345678', 'HP LaserJet Pro MFP Printer', 'Paper jam error & faded toner printouts', 2, '2026-09-07', '2026-09-11', 'NPR 1,800', 'Inspecting pickup roller and optical laser scanner unit. Cleaning toner residue and paper sensors.'),
    ('NA-1004', 'Suman Adhikari', '9841000000', 'Sony Bravia 55" 4K Smart TV', 'Sound working but no display / black screen', 3, '2026-09-08', '2026-09-12', 'NPR 4,200', 'LED backlight strip open-circuit. Quotation sent to customer for backlight array replacement.')
on conflict (ticket_id) do nothing;
