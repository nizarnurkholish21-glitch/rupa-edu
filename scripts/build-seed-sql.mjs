// Membuat supabase/seed.sql dari src/content/demo-items.json.
// Semua baris ditandai is_demo = true agar tidak pernah tertukar dengan data nyata.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const items = JSON.parse(readFileSync(join(root, 'src/content/demo-items.json'), 'utf8'));
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(', ')}]::text[]`;

const rows = items.map((i) =>
  `  (${q(i.slug)}, ${q(i.title)}, ${q(i.summary)}, ${q(i.body)}, ${q(i.kind)}::public.content_kind, ${arr(i.topics)}, ${i.min_grade ?? 'null'}, ` +
  `'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true)`
);

const sql = `-- DIBUAT OTOMATIS oleh scripts/build-seed-sql.mjs dari src/content/demo-items.json. Jangan diedit manual.
-- Konten DEMO: ditulis tim RUPA EDU sebagai contoh, belum ditinjau guru/ahli. is_demo = true.
insert into public.public_items (slug, title, summary, body, kind, topics, min_grade, source_name, source_url, license, is_demo, published)
values
${rows.join(',\n')}
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, body = excluded.body, kind = excluded.kind,
  topics = excluded.topics, min_grade = excluded.min_grade, is_demo = true, published = true;
`;
writeFileSync(join(root, 'supabase/seed.sql'), sql);
console.log(`seed.sql: ${items.length} item demo`);
