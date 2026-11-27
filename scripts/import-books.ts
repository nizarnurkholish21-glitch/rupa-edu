// Mengimpor buku ke database lewat koneksi PostgreSQL langsung (mis. "Connection string" Supabase).
// Pakai: DATABASE_URL=postgresql://... npx tsx scripts/import-books.ts <berkas.pdf|.txt> [...]
// Buku masuk berstatus "perlu_tinjauan": belum terlihat siswa sampai staf meninjau bab dan metadata di /admin/buku.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import pg from 'pg';
import { ingestText } from '../src/lib/library/ingest';
import { bookRow, chapterRows, chunkRows, pageRows } from '../src/lib/library/rows';

export async function importBook(client: pg.PoolClient | pg.Client, path: string, slug?: string) {
  const bytes = readFileSync(path);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const text = /\.pdf$/i.test(path) ? execFileSync('pdftotext', ['-layout', path, '-'], { maxBuffer: 64 << 20 }).toString('utf8') : bytes.toString('utf8');
  const r = ingestText(text);
  const fileName = basename(path).replace(/^[0-9a-f]{8}-/, '');
  const b = bookRow(r, { slug, fileName, sha256: sha });
  await client.query('begin');
  try {
    const exists = await client.query('select id from public.books where source_sha256 = $1', [sha]);
    if (exists.rowCount) { await client.query('rollback'); return { id: exists.rows[0].id as string, skipped: true, result: r }; }
    const { rows } = await client.query(
      `insert into public.books (slug, title, book_type, level, grade, semester, subject, edition, year, authors, publisher, isbn,
        copyright_holder, license_kind, license_note, page_count, label_coverage, metadata_public, allow_ai_processing, status,
        source_file_name, source_sha256, warnings)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) returning id`,
      [b.slug, b.title, b.book_type, b.level, b.grade, b.semester, b.subject, b.edition, b.year, b.authors, b.publisher, b.isbn,
        b.copyright_holder, b.license_kind, b.license_note, b.page_count, b.label_coverage, b.metadata_public, b.allow_ai_processing,
        b.status, b.source_file_name, b.source_sha256, b.warnings]);
    const id = rows[0].id as string;
    const pages = pageRows(r);
    for (let i = 0; i < pages.length; i += 100) {
      const part = pages.slice(i, i + 100);
      await client.query(
        `insert into public.book_pages (book_id, page_index, printed_label, label_confidence, content)
         select $1, x.page_index, x.printed_label, x.label_confidence::public.label_confidence, x.content
         from jsonb_to_recordset($2::jsonb) as x(page_index int, printed_label text, label_confidence text, content text)`,
        [id, JSON.stringify(part)]);
    }
    await client.query(
      `insert into public.book_chapters (book_id, ordinal, kind, title, start_index, end_index, source, auto_verified, reviewed)
       select $1, x.ordinal, x.kind::public.chapter_kind, x.title, x.start_index, x.end_index, x.source::public.chapter_source, x.auto_verified, false
       from jsonb_to_recordset($2::jsonb) as x(ordinal int, kind text, title text, start_index int, end_index int, source text, auto_verified boolean)`,
      [id, JSON.stringify(chapterRows(r))]);
    const chunks = chunkRows(r);
    for (let i = 0; i < chunks.length; i += 200) {
      await client.query(
        `insert into public.book_chunks (book_id, page_index, ord, content)
         select $1, x.page_index, x.ord, x.content from jsonb_to_recordset($2::jsonb) as x(page_index int, ord int, content text)`,
        [id, JSON.stringify(chunks.slice(i, i + 200))]);
    }
    await client.query('commit');
    return { id, skipped: false, result: r };
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (!process.env.DATABASE_URL || files.length === 0) {
    console.error('Pakai: DATABASE_URL=postgresql://... npx tsx scripts/import-books.ts <berkas> [...]');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const f of files) {
    const out = await importBook(client, f);
    console.log(`${out.skipped ? 'LEWATI (sudah ada)' : 'OK'}  ${basename(f)} → ${out.result.metadata.title} · ${out.result.pageCount} hlm · ${out.result.chapters.length} bab`);
  }
  await client.end();
}

if (process.argv[1]?.endsWith('import-books.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
