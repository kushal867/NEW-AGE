// This is a TEMPLATE, not the real config. `npm run build` (run by Vercel on
// every deploy) reads SUPABASE_URL / SUPABASE_ANON_KEY from environment
// variables and writes the real values into config.js, which is what
// index.html and admin.html actually load. config.js is gitignored - it
// never contains committed secrets.
window.SUPABASE_CONFIG = {
    url: '__SUPABASE_URL__',
    anonKey: '__SUPABASE_ANON_KEY__'
};
