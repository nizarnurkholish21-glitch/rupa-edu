// Menggabungkan semua migration + data demo menjadi satu berkas, agar pemilik cukup sekali salin-tempel
// di Supabase SQL Editor. Jalankan ulang setiap kali ada migration baru: `npm run setup:sql`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parts = [
  '-- RUPA EDU — penyiapan database lengkap (dibuat otomatis oleh scripts/build-setup-sql.mjs; jangan diedit langsung).',
  '-- Jalankan SEKALI di proyek Supabase yang masih kosong: SQL Editor → New query → tempel semua isi berkas ini → Run.',
  `-- Isi: ${files.join(', ')}, seed.sql`,
  '',
];
for (const f of files) parts.push(`-- ===== ${f} =====`, readFileSync(join(dir, f), 'utf8').trim(), '');
parts.push('-- ===== seed.sql (12 artikel demo) =====', readFileSync('supabase/seed.sql', 'utf8').trim(), '');
writeFileSync('supabase/setup-lengkap.sql', parts.join('\n'));
console.log(`supabase/setup-lengkap.sql: ${files.length} migration + seed`);
