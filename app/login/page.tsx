'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        if (!fullName.trim()) { setError('Укажите ФИО'); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        // fill in position/phone once the profile row exists
        if (data.user) {
          await supabase.from('profiles').update({ position, phone, full_name: fullName }).eq('id', data.user.id);
        }
        if (data.session) {
          router.push('/');
          router.refresh();
        } else {
          setInfo('Проверьте почту — нужно подтвердить регистрацию по ссылке в письме, потом войдите.');
          setMode('login');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h1 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-1">Контроль монтажа</h1>
        <p className="text-xs text-slate-500 mb-5">МФК Фрунзенская наб. — {mode === 'login' ? 'вход' : 'регистрация'}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <Field label="ФИО *"><input className="inp" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Иванов Иван Иванович" required /></Field>
              <Field label="Должность"><input className="inp" value={position} onChange={e=>setPosition(e.target.value)} placeholder="Монтажник / Инженер ПНР / Прораб" /></Field>
              <Field label="Телефон"><input className="inp" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7..." /></Field>
            </>
          )}
          <Field label="Email"><input className="inp" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></Field>
          <Field label="Пароль"><input className="inp" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} /></Field>

          {error && <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950 rounded-lg px-3 py-2">{error}</div>}
          {info && <div className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950 rounded-lg px-3 py-2">{info}</div>}

          <button disabled={loading} className="w-full bg-blue-800 hover:bg-blue-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <button
          className="mt-4 text-xs text-blue-700 dark:text-blue-400 hover:underline w-full text-center"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
        >
          {mode === 'login' ? 'Впервые здесь? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
