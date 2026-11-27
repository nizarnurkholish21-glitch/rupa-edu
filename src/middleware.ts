import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Menyegarkan sesi Supabase di setiap permintaan dan melindungi /ruang.
// Bila Supabase belum dikonfigurasi, /ruang tetap terbuka tetapi hanya menampilkan status "belum dikonfigurasi".
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

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
