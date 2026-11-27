import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseConfig } from '@/lib/config';

/** Klien Supabase untuk Server Component, Server Action, dan Route Handler. Memakai anon key + sesi pengguna,
 *  sehingga semua query tunduk pada Row-Level Security. Service role key TIDAK pernah dipakai di aplikasi web. */
export async function createServerSupabase() {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Supabase belum dikonfigurasi');
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Dipanggil dari Server Component (read-only); middleware yang menyegarkan sesi.
        }
      },
    },
  });
}
