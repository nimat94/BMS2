'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';

const NAV = [
  { href: '/', label: 'Дашборд' },
  { href: '/readiness', label: 'Допуск' },
  { href: '/materials', label: 'Материалы' },
  { href: '/cables', label: 'Кабели' },
  { href: '/equipment', label: 'Оборудование' },
  { href: '/shields', label: 'Щиты' },
  { href: '/points', label: 'Точки АДИС' },
  { href: '/attendance', label: 'Посещаемость' },
  { href: '/projects', label: 'Проекты' },
  { href: '/export', label: 'Экспорт' },
];

// Нижнее меню на телефоне: самое частое — под большим пальцем, остальное в «Ещё»
const TABS = [
  { href: '/', label: 'Главная', icon: 'home' },
  { href: '/cables', label: 'Кабели', icon: 'cable' },
  { href: '/equipment', label: 'Оборуд.', icon: 'box' },
  { href: '/attendance', label: 'Отметка', icon: 'check' },
] as const;
const MORE = [
  { href: '/projects', label: 'Проекты (PDF)', icon: '📐' },
  { href: '/readiness', label: 'Допуск к монтажу', icon: '🚦' },
  { href: '/materials', label: 'Материалы', icon: '📦' },
  { href: '/shields', label: 'Щиты', icon: '🗄' },
  { href: '/points', label: 'Точки АДИС', icon: '🔘' },
  { href: '/export', label: 'Экспорт в Excel', icon: '📊' },
  { href: '/profile', label: 'Личный кабинет', icon: '👤' },
];

function Icon({ name, active }: { name: string; active: boolean }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: active ? 2.2 : 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
      {name === 'home' && <><path {...p} d="M3 11 12 4l9 7" /><path {...p} d="M5 10v10h14V10" /><path {...p} d="M10 20v-6h4v6" /></>}
      {name === 'cable' && <><path {...p} d="M4 18c4 0 4-12 8-12s4 12 8 12" /><circle {...p} cx="4" cy="18" r="1.6" /><circle {...p} cx="20" cy="18" r="1.6" /></>}
      {name === 'box' && <><path {...p} d="M4 8 12 4l8 4v8l-8 4-8-4z" /><path {...p} d="M4 8l8 4 8-4M12 12v8" /></>}
      {name === 'check' && <><rect {...p} x="4" y="4" width="16" height="16" rx="3" /><path {...p} d="m8.5 12 2.5 2.5 4.5-5" /></>}
      {name === 'more' && <><circle cx="5.5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="18.5" cy="12" r="1.7" fill="currentColor" /></>}
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data as Profile);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const current = [...NAV, ...MORE].find(n => n.href === pathname)?.label;
  const moreActive = MORE.some(m => m.href === pathname);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Шапка на телефоне: название текущего раздела + кабинет */}
      <header className="sm:hidden sticky top-0 z-30 bg-blue-900 text-white">
        <div className="flex items-center gap-2 px-3 h-12">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] leading-none text-blue-200">МФК Фрунзенская наб.</div>
            <div className="font-semibold text-base leading-tight truncate">{current || 'Контроль монтажа'}</div>
          </div>
          <Link href="/profile" aria-label="Личный кабинет" className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center text-sm font-semibold">
            {(profile?.full_name || '?').trim().charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      <div className="w-full max-w-[1920px] mx-auto sm:px-4 sm:py-3">
        {/* Шапка и вкладки на компьютере — как было */}
        <div className="hidden sm:flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h1 className="text-lg font-semibold text-blue-900 dark:text-blue-300">
            Контроль монтажа — МФК Фрунзенская наб.
          </h1>
          <div className="flex items-center gap-2">
            {profile && (
              <Link href="/profile" className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 hover:bg-blue-100">
                👤 {profile.full_name || 'без имени'}{profile.position ? ' · ' + profile.position : ''}
              </Link>
            )}
            <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
              Выйти
            </button>
          </div>
        </div>

        <nav className="hidden sm:flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-t-lg border border-b-0 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 font-medium border-slate-200 dark:border-slate-800'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="bg-white dark:bg-slate-900 sm:rounded-b-xl sm:rounded-tr-xl sm:border border-slate-200 dark:border-slate-800 px-3 pt-3 pb-24 sm:p-5 min-h-[60vh]">
          {children}
        </main>

        <p className="hidden sm:block text-center text-[11px] text-slate-400 mt-4">
          Личный кабинет: {profile ? `${profile.full_name} (${ROLE_LABEL[profile.role]})` : '…'}
        </p>
      </div>

      {/* Нижнее меню на телефоне */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="grid grid-cols-5">
          {TABS.map(t => {
            const active = pathname === t.href;
            return (
              <Link key={t.href} href={t.href}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] ${active ? 'text-blue-800 dark:text-blue-300 font-semibold' : 'text-slate-500'}`}>
                <Icon name={t.icon} active={active} />
                {t.label}
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] ${moreActive ? 'text-blue-800 dark:text-blue-300 font-semibold' : 'text-slate-500'}`}>
            <Icon name="more" active={moreActive} />
            Ещё
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/45 anim-fade" onClick={() => setMoreOpen(false)} />
          <div className="anim-sheet relative w-full bg-white dark:bg-slate-900 rounded-t-2xl pb-safe">
            <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            {profile && (
              <div className="px-4 py-2 text-xs text-slate-500">
                {profile.full_name || 'без имени'} · {ROLE_LABEL[profile.role]}
              </div>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {MORE.map(m => (
                <Link key={m.href} href={m.href} onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 h-14 text-base ${pathname === m.href ? 'text-blue-800 dark:text-blue-300 font-semibold' : ''}`}>
                  <span className="w-7 text-xl text-center">{m.icon}</span>{m.label}
                </Link>
              ))}
              <button onClick={signOut} className="w-full flex items-center gap-3 px-4 h-14 text-base text-rose-600">
                <span className="w-7 text-xl text-center">⎋</span>Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
