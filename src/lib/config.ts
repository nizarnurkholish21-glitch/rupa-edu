// Status integrasi dibaca dari environment variable. Tidak ada integrasi yang dipalsukan:
// jika kunci belum ada, fitur terkait menampilkan "belum dikonfigurasi".
import 'server-only';

export type IntegrationStatus = 'terhubung' | 'belum_dikonfigurasi';

export interface Integration {
  key: string;
  name: string;
  purpose: string;
  status: IntegrationStatus;
  phase: string;
}

const has = (v: string | undefined) => typeof v === 'string' && v.trim().length > 0;

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!has(url) || !has(anonKey)) return null;
  return { url: url!.trim(), anonKey: anonKey!.trim() };
}

export function integrations(): Integration[] {
  return [
    {
      key: 'supabase',
      name: 'Supabase',
      purpose: 'Database, login, dan penyimpanan',
      status: supabaseConfig() ? 'terhubung' : 'belum_dikonfigurasi',
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
