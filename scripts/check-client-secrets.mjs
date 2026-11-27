// Memastikan tidak ada kunci rahasia yang ikut terkirim ke browser.
// Jalankan setelah `npm run build`. Gagal (exit 1) jika menemukan kebocoran.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = '.next/static';
if (!existsSync(dir)) { console.error('Jalankan `npm run build` dulu.'); process.exit(1); }

const secrets = ['SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']
  .map((k) => [k, process.env[k]])
  .filter(([, v]) => v && v.length >= 16);
const forbiddenNames = ['SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'service_role'];

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(js|css|html|json)$/.test(p)) files.push(p);
  }
})(dir);

let bad = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const [name, value] of secrets) if (text.includes(value)) { console.error(`BOCOR: nilai ${name} ada di ${f}`); bad++; }
  for (const n of forbiddenNames) if (text.includes(n)) { console.error(`CURIGA: nama "${n}" ada di ${f}`); bad++; }
}
console.log(`${files.length} file klien diperiksa, ${secrets.length} nilai rahasia dibandingkan.`);
if (bad) process.exit(1);
console.log('Tidak ada rahasia di bundle klien.');
