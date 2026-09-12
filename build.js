// Runs on every Vercel deploy (see vercel.json "buildCommand"). Substitutes
// real Supabase credentials from environment variables into config.js, which
// the static pages load before script.js/admin.js. Keeps the actual anon key
// out of the committed source while still working with zero bundler/framework.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

if (!url || !anonKey) {
    console.warn('WARNING: SUPABASE_URL and/or SUPABASE_ANON_KEY are not set. ' +
        'Set them in Vercel Project Settings -> Environment Variables (or in a ' +
        'local .env you load yourself before running this script). Writing an ' +
        'empty config.js so the build still completes.');
}

const template = fs.readFileSync(path.join(__dirname, 'config.template.js'), 'utf8');
const output = template
    .replace('__SUPABASE_URL__', url)
    .replace('__SUPABASE_ANON_KEY__', anonKey);

fs.writeFileSync(path.join(__dirname, 'config.js'), output);
console.log('Generated config.js' + (url && anonKey ? '' : ' (with empty values - see warning above)'));
