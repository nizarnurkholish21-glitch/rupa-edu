import { describe, expect, it } from 'vitest';
import { classifyKey, resolveSupabaseEnv } from '../../src/lib/supabase-key';

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: 'supabase', role })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;
const URL_OK = 'https://abcdefgh.supabase.co';

describe('kunci Supabase', () => {
  it('mengenali kunci publik dan rahasia (format baru dan JWT lama)', () => {
    expect(classifyKey('sb_publishable_abc123')).toBe('publik');
    expect(classifyKey('sb_secret_abc123')).toBe('rahasia');
    expect(classifyKey(jwt('anon'))).toBe('publik');
    expect(classifyKey(jwt('service_role'))).toBe('rahasia');
    expect(classifyKey('asal-asalan')).toBe('tidak_dikenal');
  });
  it('menolak kunci rahasia walau tertempel di variabel publik', () => {
    expect(resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') })).toEqual({ ok: false, reason: 'kunci_rahasia' });
    expect(resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_x' })).toEqual({ ok: false, reason: 'kunci_rahasia' });
  });
  it('menerima publishable key lewat salah satu nama variabel; merapikan garis miring di akhir URL', () => {
    expect(resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK + '/', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_x ' }))
      .toEqual({ ok: true, url: URL_OK, anonKey: 'sb_publishable_x' });
  });
  it('melaporkan yang belum diisi dan URL yang keliru', () => {
    expect(resolveSupabaseEnv({})).toEqual({ ok: false, reason: 'belum_diisi' });
    expect(resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.com/dashboard/project/abc', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x' })).toEqual({ ok: false, reason: 'url_salah' });
  });
});
