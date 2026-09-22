import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/client';

export async function middleware(request: NextRequest) {
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isAuthPage = path.startsWith('/login');

    if (!user && !isAuthPage) {
      const u = request.nextUrl.clone();
      u.pathname = '/login';
      return NextResponse.redirect(u);
    }
    if (user && isAuthPage) {
      const u = request.nextUrl.clone();
      u.pathname = '/';
      return NextResponse.redirect(u);
    }
  } catch (e: any) {
    return new NextResponse(
      'Ошибка подключения к Supabase: ' + (e?.message || String(e)),
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.png$).*)'],
};
