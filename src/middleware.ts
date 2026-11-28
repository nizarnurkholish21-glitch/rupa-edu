import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resolveSupabaseEnv } from '@/lib/supabase-key';

// Menyegarkan sesi Supabase di setiap permintaan dan melindungi /ruang.
// Bila Supabase belum dikonfigurasi, /ruang tetap terbuka tetapi hanya menampilkan status "belum dikonfigurasi".
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = resolveSupabaseEnv(process.env);
  if (!env.ok) return response;
  const { url, anonKey: key } = env;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && (request.nextUrl.pathname.startsWith('/ruang') || request.nextUrl.pathname.startsWith('/admin'))) {
    const to = request.nextUrl.clone();
    to.pathname = '/masuk';
    to.search = `?lanjut=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|fonts/|brand/|pdfjs/|favicon.ico|icon.svg).*)'],
};
