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
  { href: '/export', label: 'Экспорт' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h1 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-300">
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

        <nav className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap text-xs sm:text-sm px-3 py-1.5 rounded-t-lg border border-b-0 ${
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

        <main className="bg-white dark:bg-slate-900 rounded-b-xl rounded-tr-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-5 min-h-[60vh]">
          {children}
        </main>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Личный кабинет: {profile ? `${profile.full_name} (${ROLE_LABEL[profile.role]})` : '…'}
        </p>
      </div>
    </div>
  );
}
