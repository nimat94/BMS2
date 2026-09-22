import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [
      !url ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !key ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
    ].filter(Boolean).join(', ');
    return new NextResponse(
      `Настройка не завершена. В Vercel не найдены переменные окружения: ${missing}.\n` +
      `Vercel → проект → Settings → Environments → Production → Environment Variables.\n` +
      `После сохранения обязательно сделайте Redeploy без кэша.`,
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

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
      'Ошибка подключения к Supabase: ' + (e?.message || String(e)) +
      '\nПроверьте, что NEXT_PUBLIC_SUPABASE_URL — это Project URL (https://xxxx.supabase.co), ' +
      'а NEXT_PUBLIC_SUPABASE_ANON_KEY — Publishable key.',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.png$).*)'],
};
