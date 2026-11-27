// Harness tes database: membuat database baru, menerapkan stub Supabase + semua migration + seed,
// lalu menjalankan query "sebagai" pengguna tertentu dengan peran anon/authenticated dan klaim JWT,
// persis seperti PostgREST di Supabase. Setiap query dibungkus transaksi yang di-rollback.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = join(__dirname, '..', '..');
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? '';

export async function freshDatabase(name: string): Promise<pg.Pool> {
  if (!ADMIN_URL) throw new Error('TEST_DATABASE_URL belum diatur (lihat docs/testing.md)');
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });
  const files = [
    join(ROOT, 'tests/db/supabase-stub.sql'),
    ...readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
      .map((f) => join(ROOT, 'supabase/migrations', f)),
    join(ROOT, 'supabase/seed.sql'),
  ];
  for (const f of files) await pool.query(readFileSync(f, 'utf8'));
  return pool;
}

export type Actor = { id: string } | null; // null = pengunjung tanpa login

/** Jalankan fn dengan hak akses aktor (RLS aktif), lalu rollback. */
export async function as<T>(pool: pg.Pool, actor: Actor, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (actor) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: actor.id, role: 'authenticated' })]);
      await c.query('set local role authenticated');
    } else {
      await c.query(`select set_config('request.jwt.claims', '', true)`);
      await c.query('set local role anon');
    }
    return await fn(c);
  } finally {
    await c.query('rollback').catch(() => undefined);
    c.release();
  }
}

/** Ambil kolom id dari hasil query sebagai set, untuk perbandingan mudah. */
export const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
