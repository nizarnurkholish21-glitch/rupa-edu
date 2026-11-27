import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from '@/lib/config';
import { createServerSupabase } from '@/lib/supabase/server';

// Keluar hanya lewat POST (formulir), agar tautan pihak lain tidak bisa mengeluarkan pengguna.
export async function POST(request: NextRequest) {
  if (supabaseConfig()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
