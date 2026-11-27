// Perpustakaan: buku privat secara bawaan, isi hanya untuk sekolah yang diberi akses.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, freshDatabase } from './harness';

const U = {
  adminA: { id: '00000000-0000-0000-0000-0000000000a0' },
  guruA1: { id: '00000000-0000-0000-0000-0000000000a1' },
  siswaA1: { id: '00000000-0000-0000-0000-0000000000b1' },
  waliA1: { id: '00000000-0000-0000-0000-0000000000c1' },
  guruB1: { id: '00000000-0000-0000-0000-0000000000d1' },
  superAdmin: { id: '00000000-0000-0000-0000-0000000000e1' },
  umum: { id: '00000000-0000-0000-0000-0000000000f1' },
};
const SCHOOL_A = '10000000-0000-0000-0000-00000000000a';
const SCHOOL_B = '10000000-0000-0000-0000-00000000000b';
const BOOK = { siap: '40000000-0000-0000-0000-00000000000a', draf: '40000000-0000-0000-0000-00000000000b', tertutup: '40000000-0000-0000-0000-00000000000c', publik: '40000000-0000-0000-0000-00000000000d' };

let pool: pg.Pool;
beforeAll(async () => {
  pool = await freshDatabase('rupa_library_test');
  await pool.query(readFileSync(join(__dirname, 'fixtures.sql'), 'utf8'));
  await pool.query(readFileSync(join(__dirname, 'fixtures-library.sql'), 'utf8'));
}, 60_000);
afterAll(async () => { await pool?.end(); });

const slugsSeen = (actor: { id: string } | null) => as(pool, actor, async (c) => (await c.query('select slug from public.books order by slug')).rows.map((r) => r.slug));
const pagesSeen = (actor: { id: string }) => as(pool, actor, async (c) => new Set((await c.query('select book_id from public.book_pages')).rows.map((r) => r.book_id)));

describe('Pengunjung tanpa login', () => {
  it('melihat metadata buku yang siap dan publik saja', async () => {
    expect(await slugsSeen(null)).toEqual(['buku-uji-publik', 'buku-uji-siap']);
  });
  it('melihat daftar bab buku dengan metadata publik, tidak bab buku tertutup atau draf', async () => {
    const rows = await as(pool, null, async (c) => (await c.query('select title from public.book_chapters order by title')).rows);
    expect(rows.map((r) => r.title)).toEqual(['Mengeksplorasi Simpul dan Berkarya Makrame', 'Menggambar']);
  });
  it('membaca isi buku publik saja; buku sekolah dan draf bertanda publik tetap tertutup', async () => {
    const seen = await as(pool, null, async (c) => new Set((await c.query('select book_id from public.book_pages')).rows.map((r) => r.book_id)));
    expect(seen).toEqual(new Set([BOOK.publik]));
  });
  it('mencari isi buku publik, lengkap dengan bab dan halaman', async () => {
    const rows = await as(pool, null, async (c) => (await c.query(`select book_slug, chapter_title, chapter_ordinal, printed_label from public.search_book_chunks('arsiran')`)).rows);
    expect(rows).toEqual([{ book_slug: 'buku-uji-publik', chapter_title: 'Mengeksplorasi Simpul dan Berkarya Makrame', chapter_ordinal: 4, printed_label: '2' }]);
  });
  it('judul bab ikut dicari, termasuk bab buku yang metadatanya publik', async () => {
    const rows = await as(pool, null, async (c) => (await c.query(`select book_slug, chapter_title from public.search_chapters('makrame')`)).rows);
    expect(rows).toEqual([{ book_slug: 'buku-uji-publik', chapter_title: 'Mengeksplorasi Simpul dan Berkarya Makrame' }]);
    const gambar = await as(pool, null, async (c) => (await c.query(`select book_slug from public.search_chapters('menggambar')`)).rows);
    expect(gambar.map((r) => r.book_slug)).toEqual(['buku-uji-siap']);
  });
  it('tidak bisa menulis apa pun', async () => {
    await expect(as(pool, null, (c) => c.query(`insert into public.book_pages (book_id, page_index, content) values ($1, 9, 'x')`, [BOOK.publik])))
      .rejects.toThrow(/permission denied/);
  });
});

describe('Siswa dan guru di sekolah yang diberi akses', () => {
  it('siswa sekolah A membaca buku sekolahnya dan buku publik, tidak buku draf atau buku sekolah lain', async () => {
    expect(await pagesSeen(U.siswaA1)).toEqual(new Set([BOOK.siap, BOOK.publik]));
  });
  it('guru sekolah A membaca isi yang sama', async () => {
    expect(await pagesSeen(U.guruA1)).toEqual(new Set([BOOK.siap, BOOK.publik]));
  });
  it('pencarian dalam buku hanya memberi hasil dari buku yang boleh dibaca, lengkap dengan halaman cetak dan bab', async () => {
    const rows = await as(pool, U.siswaA1, async (c) => (await c.query(`select book_slug, printed_label, snippet, chapter_title from public.search_book_chunks('arsiran', $1)`, [BOOK.siap])).rows);
    expect(rows.map((r) => r.book_slug)).toEqual(['buku-uji-siap']);
    expect(rows[0]?.chapter_title).toBe('Menggambar');
    expect(rows[0]?.printed_label).toBe('1');
    expect(rows[0]?.snippet).toMatch(/«/);
  });
  it('pencarian memahami imbuhan Bahasa Indonesia', async () => {
    const rows = await as(pool, U.siswaA1, async (c) => (await c.query(`select page_index from public.search_book_chunks('menggambar bangunan')`)).rows);
    expect(rows.map((r) => r.page_index)).toContain(2);
  });
  it('siswa tidak bisa mengubah isi buku', async () => {
    await expect(as(pool, U.siswaA1, (c) => c.query(`update public.book_pages set content = 'x' where book_id = $1`, [BOOK.siap])))
      .resolves.toMatchObject({ rowCount: 0 });
    await expect(as(pool, U.siswaA1, (c) => c.query(`insert into public.book_pages (book_id, page_index, content) values ($1, 99, 'x')`, [BOOK.siap])))
      .rejects.toThrow(/row-level security/);
  });
});

describe('Sekolah lain, wali, dan pengguna umum', () => {
  it('guru sekolah B membaca buku tertutupnya sendiri, bukan isi buku sekolah A', async () => {
    expect(await pagesSeen(U.guruB1)).toEqual(new Set([BOOK.tertutup, BOOK.publik]));
    expect(await slugsSeen(U.guruB1)).toEqual(['buku-uji-publik', 'buku-uji-siap', 'buku-uji-tertutup']);
  });
  it('wali tidak membaca isi buku sekolah (hanya siswa, guru, admin sekolah), tetapi membaca buku publik', async () => {
    expect(await pagesSeen(U.waliA1)).toEqual(new Set([BOOK.publik]));
  });
  it('pengguna umum melihat metadata publik dan isi buku publik saja', async () => {
    expect(await slugsSeen(U.umum)).toEqual(['buku-uji-publik', 'buku-uji-siap']);
    expect(await pagesSeen(U.umum)).toEqual(new Set([BOOK.publik]));
  });
});

describe('Pemberian akses', () => {
  it('admin sekolah tidak bisa memberi akses ke sekolah lain', async () => {
    await expect(as(pool, U.adminA, (c) => c.query(`insert into public.book_access (book_id, school_id) values ($1, $2)`, [BOOK.siap, SCHOOL_B])))
      .rejects.toThrow(/row-level security/);
  });
  it('admin sekolah bisa mencabut lalu memberi akses buku siap untuk sekolahnya', async () => {
    const n = await as(pool, U.adminA, async (c) => {
      await c.query(`delete from public.book_access where book_id = $1 and school_id = $2`, [BOOK.siap, SCHOOL_A]);
      return (await c.query(`insert into public.book_access (book_id, school_id) values ($1, $2)`, [BOOK.siap, SCHOOL_A])).rowCount;
    });
    expect(n).toBe(1);
  });
  it('admin sekolah tidak bisa memberi akses ke buku yang belum ditinjau', async () => {
    await expect(as(pool, U.adminA, async (c) => {
      await c.query(`delete from public.book_access where book_id = $1 and school_id = $2`, [BOOK.draf, SCHOOL_A]);
      await c.query(`insert into public.book_access (book_id, school_id) values ($1, $2)`, [BOOK.draf, SCHOOL_A]);
    })).rejects.toThrow(/row-level security/);
  });
});

describe('Staf dan aturan status', () => {
  it('staf melihat semua buku termasuk draf', async () => {
    expect(await slugsSeen(U.superAdmin)).toEqual(['buku-uji-draf', 'buku-uji-publik', 'buku-uji-siap', 'buku-uji-tertutup']);
  });
  it('buku tidak bisa berstatus siap tanpa tinjauan manusia', async () => {
    await expect(as(pool, U.superAdmin, (c) => c.query(`update public.books set status = 'siap' where id = $1`, [BOOK.draf])))
      .rejects.toThrow(/ready_requires_review/);
  });
  it('setelah ditinjau, buku boleh berstatus siap', async () => {
    const n = await as(pool, U.superAdmin, async (c) => (await c.query(`update public.books set status = 'siap', reviewed_at = now(), reviewed_by = $2 where id = $1`, [BOOK.draf, U.superAdmin.id])).rowCount);
    expect(n).toBe(1);
  });
});
