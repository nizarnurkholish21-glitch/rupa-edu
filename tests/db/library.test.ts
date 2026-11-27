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
const BOOK = { siap: '40000000-0000-0000-0000-00000000000a', draf: '40000000-0000-0000-0000-00000000000b', tertutup: '40000000-0000-0000-0000-00000000000c' };

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
    expect(await slugsSeen(null)).toEqual(['buku-uji-siap']);
  });
  it('melihat daftar bab buku publik, tetapi tidak bab buku tertutup', async () => {
    const rows = await as(pool, null, async (c) => (await c.query('select title from public.book_chapters')).rows);
    expect(rows.map((r) => r.title)).toEqual(['Menggambar']);
  });
  it('tidak bisa membaca isi halaman atau mencari di dalam buku', async () => {
    await expect(as(pool, null, (c) => c.query('select * from public.book_pages'))).rejects.toThrow(/permission denied/);
    await expect(as(pool, null, (c) => c.query(`select * from public.search_book_chunks('arsiran')`))).rejects.toThrow(/permission denied/);
  });
});

describe('Siswa dan guru di sekolah yang diberi akses', () => {
  it('siswa sekolah A membaca isi buku siap, tidak buku draf atau buku sekolah lain', async () => {
    expect(await pagesSeen(U.siswaA1)).toEqual(new Set([BOOK.siap]));
  });
  it('guru sekolah A membaca isi yang sama', async () => {
    expect(await pagesSeen(U.guruA1)).toEqual(new Set([BOOK.siap]));
  });
  it('pencarian dalam buku hanya memberi hasil dari buku yang boleh dibaca, lengkap dengan halaman cetak', async () => {
    const rows = await as(pool, U.siswaA1, async (c) => (await c.query(`select book_slug, printed_label, snippet from public.search_book_chunks('arsiran')`)).rows);
    expect(rows.map((r) => r.book_slug)).toEqual(['buku-uji-siap']);
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
    expect(await pagesSeen(U.guruB1)).toEqual(new Set([BOOK.tertutup]));
    expect(await slugsSeen(U.guruB1)).toEqual(['buku-uji-siap', 'buku-uji-tertutup']);
  });
  it('wali tidak membaca isi buku (hanya siswa, guru, admin sekolah)', async () => {
    expect(await pagesSeen(U.waliA1)).toEqual(new Set());
  });
  it('pengguna umum hanya melihat metadata publik', async () => {
    expect(await slugsSeen(U.umum)).toEqual(['buku-uji-siap']);
    expect(await pagesSeen(U.umum)).toEqual(new Set());
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
    expect(await slugsSeen(U.superAdmin)).toEqual(['buku-uji-draf', 'buku-uji-siap', 'buku-uji-tertutup']);
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
