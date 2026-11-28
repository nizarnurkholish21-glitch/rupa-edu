// Status integrasi dibaca dari environment variable. Tidak ada integrasi yang dipalsukan:
// jika kunci belum ada, fitur terkait menampilkan "belum dikonfigurasi".
import 'server-only';

import { resolveSupabaseEnv, SUPABASE_ENV_MESSAGE } from './supabase-key';

export type IntegrationStatus = 'terhubung' | 'belum_dikonfigurasi' | 'salah_konfigurasi';

export interface Integration {
  key: string;
  name: string;
  purpose: string;
  status: IntegrationStatus;
  /** Pesan untuk pemilik bila konfigurasi salah (tanpa menampilkan isi kunci). */
  note?: string;
  phase: string;
}

const has = (v: string | undefined) => typeof v === 'string' && v.trim().length > 0;

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const r = resolveSupabaseEnv(process.env);
  return r.ok ? { url: r.url, anonKey: r.anonKey } : null;
}

export function integrations(): Integration[] {
  return [
    {
      key: 'supabase',
      name: 'Supabase',
      purpose: 'Database, login, dan penyimpanan',
      ...(() => {
        const r = resolveSupabaseEnv(process.env);
        if (r.ok) return { status: 'terhubung' as const };
        if (r.reason === 'belum_diisi') return { status: 'belum_dikonfigurasi' as const };
        return { status: 'salah_konfigurasi' as const, note: SUPABASE_ENV_MESSAGE[r.reason] };
      })(),
      phase: 'Fase 1',
    },
    {
      key: 'anthropic',
      name: 'Claude API',
      purpose: 'Tutor AI, jawaban bersitasi, generator materi',
      status: has(process.env.ANTHROPIC_API_KEY) ? 'terhubung' : 'belum_dikonfigurasi',
      phase: 'Fase 3',
    },
  ];
}
