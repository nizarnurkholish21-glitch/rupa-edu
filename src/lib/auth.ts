import 'server-only';
import { cache } from 'react';
import { supabaseConfig } from '@/lib/config';
import { createServerSupabase } from '@/lib/supabase/server';

export type AppRole = 'student' | 'teacher' | 'guardian' | 'school_admin' | 'moderator' | 'super_admin';

export const ROLE_LABEL: Record<AppRole, string> = {
  student: 'Siswa',
  teacher: 'Guru',
  guardian: 'Orang tua/wali',
  school_admin: 'Admin sekolah',
  moderator: 'Moderator',
  super_admin: 'Super admin',
};

export interface Membership { role: AppRole; school_id: string | null; school_name: string | null }
export interface CurrentUser { id: string; email: string | null; displayName: string; memberships: Membership[] }

/** Pengguna yang sedang login, beserta perannya. null bila belum login atau Supabase belum terhubung.
 *  Peran dibaca lewat RLS: pengguna hanya bisa membaca keanggotaannya sendiri. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!supabaseConfig()) return null;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase.from('memberships').select('role, school_id, schools(name)').eq('user_id', user.id),
  ]);
  const memberships: Membership[] = (rows ?? []).map((r) => {
    const school = (r as { schools?: { name: string } | { name: string }[] | null }).schools;
    const name = Array.isArray(school) ? school[0]?.name ?? null : school?.name ?? null;
    return { role: r.role as AppRole, school_id: r.school_id as string | null, school_name: name };
  });
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: (profile?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Pengguna',
    memberships,
  };
});

/** Urutan prioritas peran untuk memilih beranda awal. */
const PRIORITY: AppRole[] = ['super_admin', 'school_admin', 'moderator', 'teacher', 'guardian', 'student'];
export function primaryRole(user: CurrentUser): AppRole | null {
  for (const r of PRIORITY) if (user.memberships.some((m) => m.role === r)) return r;
  return null;
}
