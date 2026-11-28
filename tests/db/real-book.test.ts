// GERBANG FASE 2 (perpustakaan): satu buku nyata diproses, ditinjau, diberi akses, lalu dicari oleh siswa.
// Buku berhak cipta tidak disimpan di repositori, jadi tes ini hanya berjalan bila REAL_BOOK menunjuk ke berkasnya:
//   REAL_BOOK=/path/Dasar-Dasar-Seni-Rupa-Semester-2-BS-KLS-X.pdf.txt TEST_DATABASE_URL=... npx vitest run tests/db/real-book.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importBook } from '../../scripts/import-books';
import { as, freshDatabase } from './harness';

const REAL = process.env.REAL_BOOK;
const SISWA_A = { id: '00000000-0000-0000-0000-0000000000b1' };
const SISWA_B = { id: '00000000-0000-0000-0000-0000000000d2' };
const SCHOOL_A = '10000000-0000-0000-0000-00000000000a';

describe.skipIf(!REAL)('Buku nyata: Dasar-Dasar Seni Rupa Kelas X Semester 2', () => {
  let pool: pg.Pool;
  let bookId = '';
  beforeAll(async () => {
    pool = await freshDatabase('rupa_realbook_test');
    await pool.query(readFileSync(join(__dirname, 'fixtures.sql'), 'utf8'));
    const c = await pool.connect();
    try {
      const out = await importBook(c, REAL!, 'dasar-seni-rupa-x-sem-2');
      bookId = out.id;
      // Tinjauan manusia (disimulasikan): tandai bab ditinjau, buku siap, beri akses ke sekolah A.
      await c.query(`update public.book_chapters set reviewed = true where book_id = $1`, [bookId]);
      await c.query(`update public.books set status = 'siap', reviewed_at = now() where id = $1`, [bookId]);
      await c.query(`insert into public.book_access (book_id, school_id) values ($1, $2)`, [bookId, SCHOOL_A]);
    } finally { c.release(); }
  }, 120_000);
  afterAll(async () => { await pool?.end(); });

  it('metadata terbaca dari buku', async () => {
    const { rows } = await pool.query('select title, book_type, level, grade, semester, authors, isbn, page_count from public.books where id = $1', [bookId]);
    expect(rows[0]).toMatchObject({ book_type: 'buku_siswa', level: 'SMK/MAK', grade: 10, semester: 2, page_count: 201 });
    const pub = await pool.query('select content_public from public.books where id = $1', [bookId]);
    expect(pub.rows[0].content_public).toBe(true);
    expect(rows[0].authors).toEqual(['Giriluhita Retno Cahyaningsih', 'Haeni Purwanto']);
    expect(rows[0].isbn).toContain('978-623-194-552-5');
  });
  it('tiga bab sesuai daftar isi buku (hlm 1, 53, 109)', async () => {
    const { rows } = await pool.query(
      `select c.ordinal, p.printed_label from public.book_chapters c join public.book_pages p on p.book_id = c.book_id and p.page_index = c.start_index
       where c.book_id = $1 and c.kind <> 'bagian' order by c.ordinal`, [bookId]);
    expect(rows.map((r) => [r.ordinal, r.printed_label])).toEqual([[1, '1'], [2, '53'], [3, '109']]);
  });
  it('siswa sekolah A menemukan "jenis arsiran" di halaman 17–18 buku', async () => {
    const rows = await as(pool, SISWA_A, async (c) => (await c.query(`select printed_label from public.search_book_chunks('arsiran hatching')`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(['17', '18']).toContain(rows[0]?.printed_label);
  });
  it('siswa sekolah A menemukan proyeksi ortogonal di Bab 2 (hlm 53–108)', async () => {
    const rows = await as(pool, SISWA_A, async (c) => (await c.query(`select printed_label, chapter_title from public.search_book_chunks('proyeksi ortogonal')`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    // Halaman sisipan tanpa nomor cetak berlabel null (tidak ditebak), tetapi tetap harus masuk Bab 2.
    const known = rows.filter((r) => r.printed_label !== null).map((r) => Number(r.printed_label));
    expect(known.length).toBeGreaterThan(0);
    expect(known.every((p) => p >= 53 && p <= 108)).toBe(true);
    expect(rows.every((r) => /GAMBAR TEKNIK/i.test(r.chapter_title))).toBe(true);
  });
  it('buku Kementerian publik: pengunjung tanpa login menemukan isinya, lengkap dengan bab', async () => {
    const rows = await as(pool, null, async (c) => (await c.query(`select printed_label, chapter_title from public.search_book_chunks('arsiran hatching')`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.chapter_title).toMatch(/MENGGAMBAR BENTUK/i);
  });
  it('bila dijadikan privat, siswa sekolah B (tanpa akses) dan pengunjung tidak menemukan apa pun', async () => {
    await pool.query('update public.books set content_public = false where id = $1', [bookId]);
    try {
      const b = await as(pool, SISWA_B, async (c) => (await c.query(`select 1 from public.search_book_chunks('arsiran')`)).rows);
      const anon = await as(pool, null, async (c) => (await c.query(`select 1 from public.search_book_chunks('arsiran')`)).rows);
      expect(b).toHaveLength(0);
      expect(anon).toHaveLength(0);
    } finally {
      await pool.query('update public.books set content_public = true where id = $1', [bookId]);
    }
  });
});
