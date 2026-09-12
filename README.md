# NewAge I.T. Solution Center

Production website and admin console for NewAge I.T. Solution Center, an IT/electronics
repair and parts shop in Tinthana, Chandragiri-15, Kathmandu.

Live: https://newage-gold.vercel.app

## Stack

Plain HTML/CSS/JS, no framework or bundler for the site itself. [Supabase](https://supabase.com)
(Postgres + Auth + Storage) is the backend, loaded client-side via the Supabase JS SDK. A tiny
Node build step ([build.js](build.js)) injects the Supabase URL/anon key into `config.js` from
environment variables at deploy time — there is nothing else to compile.

- [index.html](index.html) / [style.css](style.css) / [script.js](script.js) — the public site
  (hero, services, live product catalogue, repair-status tracker, contact form, video wall).
- [admin.html](admin.html) / [admin.css](admin.css) / [admin.js](admin.js) — the staff-only admin
  console (login via Supabase Auth) for managing products, videos, repair tickets, and inquiries.
- [supabase/schema.sql](supabase/schema.sql) — full database schema, RLS policies, seed data, and
  the `track_repair()` lookup function. Run once against a new Supabase project.
- [supabase/rate_limiting.sql](supabase/rate_limiting.sql) — adds per-IP rate limiting to the
  contact form, repair-ticket submission, and the repair lookup. Run after `schema.sql`.
- [supabase/storage_policies.sql](supabase/storage_policies.sql) — RLS policies for the `media`
  storage bucket used by the admin image-upload feature.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm start                    # builds config.js, then serves the site on a local port
```

Never commit `.env`, `.env.local`, or `config.js` — they're gitignored. Production values are
set as Vercel environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) and injected at
deploy time by the Vercel build (`npm run build`, configured in [vercel.json](vercel.json)).

## Deployment

Deploys automatically on push to `main` via Vercel's GitHub integration. No custom domain is
configured; the `newage.vercel.app` URL is the production address.

## Database setup (new environment only)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Run `supabase/rate_limiting.sql`.
4. Run `supabase/storage_policies.sql`, and create a public storage bucket named `media`.
5. Create the admin user via Supabase Auth (Dashboard → Authentication → Users).
6. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel project settings.
