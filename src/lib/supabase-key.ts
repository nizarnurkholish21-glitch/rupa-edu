// Memilih kunci Supabase dari environment variable dan MENOLAK kunci rahasia.
// Aplikasi web hanya boleh memakai kunci publik (anon / publishable): kunci rahasia (service_role / secret)
// menembus semua aturan privasi (RLS), jadi bila tertempel di Vercel, aplikasi menolak memakainya.
// Tanpa import khusus server agar bisa dipakai di middleware (edge) maupun server.

export type KeyKind = 'publik' | 'rahasia' | 'tidak_dikenal';

export function classifyKey(key: string): KeyKind {
  const k = key.trim();
  if (k.startsWith('sb_publishable_')) return 'publik';
  if (k.startsWith('sb_secret_')) return 'rahasia';
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { role?: string };
      if (payload.role === 'anon') return 'publik';
      if (payload.role === 'service_role') return 'rahasia';
    } catch { /* bukan JWT yang sah */ }
  }
  return 'tidak_dikenal';
}

export type SupabaseEnv =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; reason: 'belum_diisi' | 'kunci_rahasia' | 'kunci_tidak_dikenal' | 'url_salah' };

export function resolveSupabaseEnv(env: Record<string, string | undefined>): SupabaseEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();
  if (!url || !key) return { ok: false, reason: 'belum_diisi' };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return { ok: false, reason: 'url_salah' };
  const kind = classifyKey(key);
  if (kind === 'rahasia') return { ok: false, reason: 'kunci_rahasia' };
  if (kind === 'tidak_dikenal') return { ok: false, reason: 'kunci_tidak_dikenal' };
  return { ok: true, url, anonKey: key };
}

export const SUPABASE_ENV_MESSAGE: Record<Exclude<SupabaseEnv, { ok: true }>['reason'], string> = {
  belum_diisi: 'Belum dikonfigurasi',
  kunci_rahasia: 'Kunci RAHASIA terpasang — ganti dengan kunci publik (publishable/anon) dan hapus kunci rahasia dari Vercel',
  kunci_tidak_dikenal: 'Kunci tidak dikenali — salin ulang publishable key dari Supabase',
  url_salah: 'Alamat Supabase tidak sesuai — salin ulang Project URL (https://….supabase.co)',
};
