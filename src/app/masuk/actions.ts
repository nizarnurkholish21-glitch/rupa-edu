'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseConfig } from '@/lib/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

export interface LoginState { error?: string }

const Schema = z.object({
  email: z.string().trim().email('Format email tidak valid').max(254),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter').max(200),
  lanjut: z.string().optional(),
});


export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!supabaseConfig()) return { error: 'Login belum tersedia: layanan akun (Supabase) belum dikonfigurasi.' };
  const parsed = Schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    lanjut: formData.get('lanjut') ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  // Pesan sengaja umum agar tidak membocorkan apakah sebuah email terdaftar.
  if (error) return { error: 'Email atau kata sandi salah, atau akun belum aktif.' };
  redirect(safeNext(parsed.data.lanjut));
}
