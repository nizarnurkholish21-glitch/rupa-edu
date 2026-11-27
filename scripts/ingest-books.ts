// Memproses berkas buku (.pdf atau .txt hasil ekspor PDF) menjadi JSON siap impor + laporan mutu.
// Pakai: npx tsx scripts/ingest-books.ts <folder-masukan> <folder-keluaran>
// PDF diubah ke teks dengan `pdftotext` (poppler) bila tersedia. Keluaran berisi teks buku berhak cipta:
// JANGAN di-commit ke repositori.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ingestText } from '../src/lib/library/ingest';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) { console.error('Pakai: npx tsx scripts/ingest-books.ts <masukan> <keluaran>'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const files = readdirSync(inDir).filter((f) => /\.(pdf|txt)$/i.test(f)).sort();
const report: string[] = ['| Berkas | Judul terdeteksi | Jenjang | Hlm | Label hlm | Bab | Potongan | Peringatan |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const f of files) {
  const path = join(inDir, f);
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const text = /\.pdf$/i.test(f) ? execFileSync('pdftotext', ['-layout', path, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8') : bytes.toString('utf8');
  const r = ingestText(text);
  const slug = basename(f).replace(/^[0-9a-f]{8}-/, '').replace(/\.pdf(\.txt)?$|\.txt$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  writeFileSync(join(outDir, `${slug}.json`), JSON.stringify({ slug, sourceFile: f, sha256, ...r }, null, 0));
  const m = r.metadata;
  report.push(`| ${f.slice(0, 40)} | ${m.title ?? '—'} | ${m.level ?? '—'} ${m.grade ?? ''} | ${r.pageCount} | ${Math.round(r.labelCoverage * 100)}% | ${r.chapters.map((c) => `${c.ordinal}@${r.labels[c.startIndex]?.label ?? c.startIndex + 1}`).join(' ')} | ${r.chunks.length} | ${r.warnings.length} |`);
  console.log(`\n# ${f}\n  judul: ${m.title}\n  penulis: ${m.authors.join(', ')}\n  ISBN: ${m.isbn.join(', ')}  tahun: ${m.year}  hak cipta: ${m.copyrightHolder}`);
  for (const c of r.chapters) console.log(`  ${c.kind} ${c.ordinal} (${c.source}) hlm ${r.labels[c.startIndex]?.label ?? '?'}–${r.labels[c.endIndex]?.label ?? '?'}: ${c.title}`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
}
writeFileSync(join(outDir, 'LAPORAN.md'), report.join('\n') + '\n');
console.log('\n' + report.join('\n'));
