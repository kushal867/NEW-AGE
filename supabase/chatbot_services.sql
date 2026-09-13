-- =============================================================================
-- NewAge I.T. Solution Center - admin-managed Price Assistant catalogue
-- Run this once in the Supabase SQL Editor (after schema.sql has been applied).
-- Public (anon) can read - the Price Assistant chatbot fetches this table on
-- page load. Only an authenticated admin can add/edit/delete entries.
-- Seeded with the same 62 services from the official printed price chart, so
-- the chatbot keeps working exactly as before - the admin can then add,
-- edit, or remove entries from the new "Price Assistant" tab.
-- =============================================================================

create table if not exists public.chatbot_services (
    id uuid primary key default gen_random_uuid(),
    category text not null,
    item text not null,
    price numeric not null check (price >= 0),
    price_from boolean not null default false,
    keywords text not null default '',
    created_at timestamptz not null default now(),
    unique (category, item)
);

alter table public.chatbot_services enable row level security;

create policy "chatbot_services_public_read" on public.chatbot_services for select using (true);
create policy "chatbot_services_admin_write" on public.chatbot_services for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into public.chatbot_services (category, item, price, price_from, keywords) values
    ('Installation & Upgrades', 'OS Installation (Only)', 500, false, 'windows format install os reinstall'),
    ('Installation & Upgrades', 'OS Tune Up, Startup Repair, Restore', 500, false, 'slow hang freeze startup boot tune up restore'),
    ('Installation & Upgrades', 'OS Installation - With All Programs', 1000, false, 'windows format install os reinstall with software'),
    ('Installation & Upgrades', 'Software Installation and Upgrade', 500, false, 'app program install update'),
    ('Installation & Upgrades', 'All Drivers Setup', 300, true, 'driver graphics audio setup'),
    ('Installation & Upgrades', 'Antivirus Setup (1 Year)', 850, false, 'antivirus protection security'),
    ('Installation & Upgrades', 'Virus Scanning, Healing & Updates', 800, false, 'virus malware scan clean'),
    ('Installation & Upgrades', 'Complete Setup Servicing', 1000, false, 'desktop pc full service'),
    ('Installation & Upgrades', 'Complete Laptop Servicing', 1000, true, 'laptop full service cleaning'),
    ('Installation & Upgrades', 'Laptop''s Keyboard Change', 2000, true, 'laptop keyboard replace change key'),
    ('Installation & Upgrades', 'Laptop Battery Change (Internal)', 3000, true, 'laptop battery replace change not charging'),
    ('Installation & Upgrades', 'Laptop Cooling Fan Change, Charging Port Repair', 2000, true, 'laptop fan noise heating charging port repair'),
    ('Installation & Upgrades', 'Laptop''s HDD Change', 4500, true, 'laptop hard disk hdd ssd change replace'),
    ('Installation & Upgrades', 'Laptop''s Screen Change', 5500, true, 'laptop screen display change broken cracked replace'),
    ('Installation & Upgrades', 'Laptop''s Speaker Change', 2000, true, 'laptop speaker sound change no audio'),
    ('Installation & Upgrades', 'Desktop RAM Upgrade', 1500, true, 'desktop ram memory upgrade'),
    ('Installation & Upgrades', 'Laptop/Desktop Faults Finding Diagnose Only', 300, true, 'diagnose diagnosis check up fault finding not turning on no power dead wont start'),
    ('Installation & Upgrades', 'Monitor/Printer/UPS/Projector Faults Finding', 500, true, 'monitor printer ups projector diagnose check'),
    ('Installation & Upgrades', 'Desktop''s HDD Change', 4500, true, 'desktop hard disk hdd ssd change replace'),
    ('Password Decrypt', 'BIOS Password Remove (Laptop)', 1500, true, 'bios password remove laptop locked'),
    ('Password Decrypt', 'BIOS Password Remove (Desktop)', 500, true, 'bios password remove desktop locked'),
    ('Password Decrypt', 'OS Password Remove', 500, false, 'windows login password remove forgot locked'),
    ('Device Setup', 'Router Setup', 100, false, 'router wifi internet setup'),
    ('Device Setup', 'Thin Client Setup (Per Client)', 1500, false, 'thin client setup office'),
    ('Data Backup & Recovery', 'Data Copy/Backup', 800, false, 'data copy backup transfer'),
    ('Data Backup & Recovery', 'Data Recovery (Per GB)', 800, false, 'data recovery lost deleted recover files'),
    ('Data Backup & Recovery', 'Desktop''s HDD Repair (Physical)', 600, true, 'desktop hard disk hdd physical repair bad sector'),
    ('Data Backup & Recovery', 'Laptop''s HDD Repair (Physical)', 800, true, 'laptop hard disk hdd physical repair bad sector'),
    ('Mobile & Smartphone Repair', 'Tempered Glass', 100, true, 'mobile phone tempered glass screen guard'),
    ('Mobile & Smartphone Repair', 'Normal Repair', 500, true, 'mobile phone general repair'),
    ('Mobile & Smartphone Repair', 'Charging Port Repair', 200, true, 'mobile phone charging port not charging'),
    ('Mobile & Smartphone Repair', 'Display Change', 2000, true, 'mobile phone screen display change broken cracked'),
    ('Printer & Photocopy', 'Printer Driver Setup', 500, false, 'printer driver setup install'),
    ('Printer & Photocopy', 'Printer Servicing (Laser)', 1500, false, 'laser printer service'),
    ('Printer & Photocopy', 'Inkjet Servicing', 2000, false, 'inkjet printer service'),
    ('Printer & Photocopy', 'Printer Heavy Servicing', 2500, false, 'printer heavy service repair'),
    ('Printer & Photocopy', 'Photocopy Heavy Servicing', 3000, false, 'photocopy copier heavy service repair'),
    ('Printer & Photocopy', 'Cartridge Refilling', 500, false, 'toner cartridge refill ink'),
    ('Power System', 'Desktop SMPS Repair', 500, true, 'desktop smps power supply repair not turning on no power dead'),
    ('Power System', 'Laptop Adaptor Repair', 500, true, 'laptop adapter charger repair'),
    ('Power System', 'Laptop''s Power D/C Cord Change', 500, true, 'laptop dc jack power cord change'),
    ('Power System', 'UPS Repair', 600, true, 'ups repair not working'),
    ('Power System', 'UPS Battery Change', 2000, true, 'ups battery replace change'),
    ('Power System', 'BIOS Battery Change', 100, false, 'bios battery cmos change'),
    ('Power System', 'Inverter Repairing Charge', 1500, true, 'inverter repair'),
    ('Online/Offline Support', 'Home Service (Per Visit)', 600, true, 'home visit service call'),
    ('Online/Offline Support', 'Office Service (Per Visit)', 1000, true, 'office visit service call'),
    ('Online/Offline Support', 'Any Device Repair Minimum Charge', 300, true, 'minimum charge repair'),
    ('Online/Offline Support', 'Distance Support (TeamViewer, AnyDesk, etc.)', 600, false, 'remote support teamviewer anydesk online'),
    ('Chip Level Repair', 'Laptop''s Motherboard Power Problem', 2000, true, 'laptop motherboard mb power not turning on no power dead'),
    ('Chip Level Repair', 'ENE Chip, Power IC, LAN, Sound & Other IC', 2500, true, 'chip ic repair lan sound power'),
    ('Chip Level Repair', 'South/North Bridge Heating', 1500, true, 'motherboard bridge heating overheat'),
    ('Chip Level Repair', 'Green Chip Old Reballing', 3500, true, 'gpu chip reballing old'),
    ('Chip Level Repair', 'Green Chip New Installation & Reballing', 5000, true, 'gpu chip reballing new installation'),
    ('Chip Level Repair', 'Laptop''s Motherboard Minimum Repair', 1500, false, 'laptop motherboard mb minimum repair'),
    ('Chip Level Repair', 'Desktop''s Motherboard Repair', 1000, false, 'desktop motherboard mb repair'),
    ('Chip Level Repair', 'Laptop''s BIOS Copy', 2000, false, 'laptop bios chip copy'),
    ('Chip Level Repair', 'Desktop''s Motherboard BIOS Copy', 1000, false, 'desktop motherboard mb bios chip copy'),
    ('TV Repair', 'TV Board Problem', 3000, true, 'tv board repair not turning on'),
    ('TV Repair', 'TV Backlight Problem', 4500, true, 'tv backlight dark screen no display'),
    ('TV Repair', 'TV Panel Repair', 7000, true, 'tv panel repair screen'),
    ('TV Repair', 'TV Panel Change', 10000, true, 'tv panel change screen replace')
on conflict (category, item) do nothing;
