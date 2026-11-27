// GERBANG TAHAP 1: isolasi peran dan sekolah ditegakkan oleh database (Row-Level Security).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, freshDatabase, ids } from './harness';

const U = {
  adminA: { id: '00000000-0000-0000-0000-0000000000a0' },
  guruA1: { id: '00000000-0000-0000-0000-0000000000a1' },
  guruA2: { id: '00000000-0000-0000-0000-0000000000a2' },
  siswaA1: { id: '00000000-0000-0000-0000-0000000000b1' },
  siswaA2: { id: '00000000-0000-0000-0000-0000000000b2' },
  siswaA3: { id: '00000000-0000-0000-0000-0000000000b3' },
  waliA1: { id: '00000000-0000-0000-0000-0000000000c1' },
  guruB1: { id: '00000000-0000-0000-0000-0000000000d1' },
  siswaB1: { id: '00000000-0000-0000-0000-0000000000d2' },
  superAdmin: { id: '00000000-0000-0000-0000-0000000000e1' },
  umum: { id: '00000000-0000-0000-0000-0000000000f1' },
};
const SCHOOL_A = '10000000-0000-0000-0000-00000000000a';
const SCHOOL_B = '10000000-0000-0000-0000-00000000000b';
const YEAR_B = '20000000-0000-0000-0000-00000000000b';
const YEAR_A = '20000000-0000-0000-0000-00000000000a';
const KELAS = { A1: '30000000-0000-0000-0000-0000000000a1', A2: '30000000-0000-0000-0000-0000000000a2', B1: '30000000-0000-0000-0000-0000000000b1' };

let pool: pg.Pool;
beforeAll(async () => {
  pool = await freshDatabase('rupa_rls_test');
  await pool.query(readFileSync(join(__dirname, 'fixtures.sql'), 'utf8'));
}, 60_000);
afterAll(async () => { await pool?.end(); });

const profilesSeenBy = (actor: { id: string }) =>
  as(pool, actor, async (c) => ids((await c.query('select id from public.profiles')).rows));
const classesSeenBy = (actor: { id: string }) =>
  as(pool, actor, async (c) => ids((await c.query('select id from public.classes')).rows));

describe('Pengunjung tanpa login (anon)', () => {
  it('bisa membaca konten publik yang sudah terbit', async () => {
    const rows = await as(pool, null, async (c) => (await c.query('select slug from public.public_items')).rows);
    expect(rows.length).toBe(12);
    expect(rows.map((r) => r.slug)).not.toContain('draf-belum-terbit');
  });
  it('bisa mencari, termasuk dengan salah ketik', async () => {
    const rows = await as(pool, null, async (c) => (await c.query(`select slug from public.search_public_items('komplementr')`)).rows);
    expect(rows.map((r) => r.slug)).toContain('warna-komplementer');
  });
  it('pencarian tidak pernah mengembalikan item yang belum terbit', async () => {
    const rows = await as(pool, null, async (c) => (await c.query(`select slug from public.search_public_items('draf rahasia')`)).rows);
    expect(rows).toHaveLength(0);
  });
  for (const table of ['schools', 'profiles', 'memberships', 'classes', 'enrollments', 'audit_logs', 'consent_records']) {
    it(`ditolak membaca tabel ${table}`, async () => {
      await expect(as(pool, null, (c) => c.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    });
  }
});

describe('Siswa', () => {
  it('melihat profilnya sendiri dan guru kelasnya, bukan teman sekelas atau sekolah lain', async () => {
    const seen = await profilesSeenBy(U.siswaA1);
    expect(seen).toEqual(new Set([U.siswaA1.id, U.guruA1.id]));
  });
  it('hanya melihat kelas yang ia ikuti', async () => {
    expect(await classesSeenBy(U.siswaA1)).toEqual(new Set([KELAS.A1]));
  });
  it('hanya melihat baris pendaftarannya sendiri (tidak bisa mendaftar teman sekelas)', async () => {
    const rows = await as(pool, U.siswaA1, async (c) => (await c.query('select student_id from public.enrollments')).rows);
    expect(rows.map((r) => r.student_id)).toEqual([U.siswaA1.id]);
  });
  it('hanya melihat sekolahnya sendiri dan keanggotaannya sendiri', async () => {
    const schools = await as(pool, U.siswaA1, async (c) => ids((await c.query('select id from public.schools')).rows));
    expect(schools).toEqual(new Set([SCHOOL_A]));
    const mem = await as(pool, U.siswaA1, async (c) => (await c.query('select user_id from public.memberships')).rows);
    expect(new Set(mem.map((r) => r.user_id))).toEqual(new Set([U.siswaA1.id]));
  });
  it('tidak bisa membuat kelas', async () => {
    await expect(as(pool, U.siswaA1, (c) => c.query(
      `insert into public.classes (school_id, academic_year_id, name, grade, subject) values ($1, $2, 'X', 7, 'Seni Rupa')`, [SCHOOL_A, YEAR_A],
    ))).rejects.toThrow(/row-level security/);
  });
  it('bisa mengubah nama tampilannya sendiri, tetapi tidak profil orang lain', async () => {
    const own = await as(pool, U.siswaA1, async (c) => (await c.query(`update public.profiles set display_name = 'Nama Baru' where id = $1`, [U.siswaA1.id])).rowCount);
    expect(own).toBe(1);
    const other = await as(pool, U.siswaA1, async (c) => (await c.query(`update public.profiles set display_name = 'Diretas' where id = $1`, [U.siswaA2.id])).rowCount);
    expect(other).toBe(0);
  });
  it('tidak bisa mengubah kolom selain nama tampilan', async () => {
    await expect(as(pool, U.siswaA1, (c) => c.query(`update public.profiles set is_demo = false where id = $1`, [U.siswaA1.id])))
      .rejects.toThrow(/permission denied/);
  });
  it('tidak bisa membaca jejak audit', async () => {
    const rows = await as(pool, U.siswaA1, async (c) => (await c.query('select id from public.audit_logs')).rows);
    expect(rows).toHaveLength(0);
  });
});

describe('Guru', () => {
  it('hanya melihat kelas yang ia ampu', async () => {
    expect(await classesSeenBy(U.guruA1)).toEqual(new Set([KELAS.A1]));
  });
  it('melihat siswa di kelasnya saja, bukan siswa kelas lain di sekolah yang sama', async () => {
    expect(await profilesSeenBy(U.guruA1)).toEqual(new Set([U.guruA1.id, U.siswaA1.id, U.siswaA2.id]));
  });
  it('tidak bisa membuat kelas (hanya admin sekolah)', async () => {
    await expect(as(pool, U.guruA1, (c) => c.query(
      `insert into public.classes (school_id, academic_year_id, name, grade, subject) values ($1, $2, 'X', 7, 'Seni Rupa')`, [SCHOOL_A, YEAR_A],
    ))).rejects.toThrow(/row-level security/);
  });
  it('guru sekolah B tidak melihat apa pun dari sekolah A', async () => {
    expect(await classesSeenBy(U.guruB1)).toEqual(new Set([KELAS.B1]));
    expect(await profilesSeenBy(U.guruB1)).toEqual(new Set([U.guruB1.id, U.siswaB1.id]));
  });
});

describe('Orang tua / wali', () => {
  it('melihat profil anaknya saja', async () => {
    expect(await profilesSeenBy(U.waliA1)).toEqual(new Set([U.waliA1.id, U.siswaA1.id]));
  });
  it('melihat kelas dan pendaftaran anaknya saja', async () => {
    expect(await classesSeenBy(U.waliA1)).toEqual(new Set([KELAS.A1]));
    const rows = await as(pool, U.waliA1, async (c) => (await c.query('select student_id from public.enrollments')).rows);
    expect(rows.map((r) => r.student_id)).toEqual([U.siswaA1.id]);
  });
  it('bisa mencatat persetujuan untuk anaknya yang terverifikasi, tidak untuk anak lain', async () => {
    const ok = await as(pool, U.waliA1, async (c) => (await c.query(
      `insert into public.consent_records (subject_user_id, granted_by, school_id, purpose, granted) values ($1, $2, $3, 'publikasi_karya', true)`,
      [U.siswaA1.id, U.waliA1.id, SCHOOL_A])).rowCount);
    expect(ok).toBe(1);
    await expect(as(pool, U.waliA1, (c) => c.query(
      `insert into public.consent_records (subject_user_id, granted_by, school_id, purpose, granted) values ($1, $2, $3, 'publikasi_karya', true)`,
      [U.siswaA2.id, U.waliA1.id, SCHOOL_A]))).rejects.toThrow(/row-level security/);
  });
  it('tidak bisa memalsukan persetujuan atas nama orang lain', async () => {
    await expect(as(pool, U.waliA1, (c) => c.query(
      `insert into public.consent_records (subject_user_id, granted_by, purpose, granted) values ($1, $2, 'pemrosesan_ai', true)`,
      [U.siswaA1.id, U.guruA1.id]))).rejects.toThrow(/row-level security/);
  });
});

describe('Admin sekolah', () => {
  it('melihat semua kelas sekolahnya, bukan sekolah lain', async () => {
    expect(await classesSeenBy(U.adminA)).toEqual(new Set([KELAS.A1, KELAS.A2]));
  });
  it('bisa membuat kelas di sekolahnya, tetapi tidak di sekolah lain', async () => {
    const ok = await as(pool, U.adminA, async (c) => (await c.query(
      `insert into public.classes (school_id, academic_year_id, name, grade, subject) values ($1, $2, '9A', 9, 'Seni Rupa')`, [SCHOOL_A, YEAR_A])).rowCount);
    expect(ok).toBe(1);
    await expect(as(pool, U.adminA, (c) => c.query(
      `insert into public.classes (school_id, academic_year_id, name, grade, subject) values ($1, $2, 'Y', 7, 'Seni Rupa')`, [SCHOOL_B, YEAR_B],
    ))).rejects.toThrow(/row-level security/);
  });
  it('membaca jejak audit sekolahnya saja', async () => {
    const rows = await as(pool, U.adminA, async (c) => (await c.query('select school_id from public.audit_logs')).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.school_id))).toEqual(new Set([SCHOOL_A]));
  });
});

describe('Jejak audit', () => {
  it('tidak bisa ditulis langsung oleh klien', async () => {
    await expect(as(pool, U.adminA, (c) => c.query(
      `insert into public.audit_logs (actor_id, school_id, action) values ($1, $2, 'palsu.entry')`, [U.adminA.id, SCHOOL_A],
    ))).rejects.toThrow(/permission denied/);
  });
  it('bisa ditambah lewat log_event() oleh anggota sekolah, dengan aktor dari sesi (bukan dari klien)', async () => {
    const actor = await as(pool, U.guruA1, async (c) => {
      await c.query(`select public.log_event('grade.update', $1, 'grades', 'x1', '{}'::jsonb)`, [SCHOOL_A]);
      await c.query('reset role');
      return (await c.query(`select actor_id from public.audit_logs where action = 'grade.update'`)).rows[0]?.actor_id;
    });
    expect(actor).toBe(U.guruA1.id);
  });
  it('menolak log_event() untuk sekolah lain', async () => {
    await expect(as(pool, U.guruA1, (c) => c.query(`select public.log_event('grade.update', $1, null, null, '{}'::jsonb)`, [SCHOOL_B])))
      .rejects.toThrow(/bukan anggota sekolah/);
  });
  it('tidak bisa diubah atau dihapus', async () => {
    await expect(as(pool, U.adminA, (c) => c.query(`delete from public.audit_logs`))).rejects.toThrow(/permission denied/);
  });
});

describe('Pengguna umum dan super admin', () => {
  it('pengguna umum tanpa sekolah hanya melihat profilnya sendiri dan tidak ada kelas', async () => {
    expect(await profilesSeenBy(U.umum)).toEqual(new Set([U.umum.id]));
    expect(await classesSeenBy(U.umum)).toEqual(new Set());
  });
  it('super admin melihat semua sekolah', async () => {
    const schools = await as(pool, U.superAdmin, async (c) => ids((await c.query('select id from public.schools')).rows));
    expect(schools).toEqual(new Set([SCHOOL_A, SCHOOL_B]));
  });
  it('pengguna umum tidak bisa menerbitkan konten publik', async () => {
    await expect(as(pool, U.umum, (c) => c.query(
      `insert into public.public_items (slug, title, summary, kind, source_name, license, published) values ('spam', 'Spam', 'Konten tidak sah untuk diuji.', 'konsep', 'x', 'x', true)`,
    ))).rejects.toThrow(/row-level security/);
  });
});

describe('Staf konten', () => {
  it('super admin bisa menambah konten publik', async () => {
    const n = await as(pool, U.superAdmin, async (c) => (await c.query(
      `insert into public.public_items (slug, title, summary, kind, source_name, license, published) values ('uji-staf', 'Uji staf', 'Konten uji yang ditulis staf platform.', 'konsep', 'x', 'x', false)`,
    )).rowCount);
    expect(n).toBe(1);
  });
});

describe('Profil otomatis', () => {
  it('akun baru otomatis mendapat profil dengan nama tampilan', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000099', 'baru@demo.test', '{"display_name":"Baru"}')`);
      const r = await c.query(`select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000099'`);
      expect(r.rows[0]?.display_name).toBe('Baru');
    } finally {
      await c.query('rollback');
      c.release();
    }
  });
});
