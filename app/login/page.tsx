'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizePhone, formatPhone, looksLikeEmail } from '@/lib/phone';

// Понятные сообщения вместо английских ошибок сервера
function ruError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверный телефон (email) или пароль';
  if (m.includes('already registered') || m.includes('already exists')) return 'Этот номер уже зарегистрирован — войдите с паролем';
  if (m.includes('phone signups are disabled') || m.includes('unsupported phone provider')) return 'Регистрация по телефону выключена на сервере — сообщите администратору';
  if (m.includes('password should be at least')) return 'Пароль — минимум 6 символов';
  if (m.includes('rate limit')) return 'Слишком много попыток, подождите минуту';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Нет связи с сервером, проверьте интернет';
  if (!msg.trim() || msg.trim() === '{}') return 'Не удалось войти — попробуйте ещё раз';
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [login, setLogin] = useState(''); // телефон или email
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const value = login.trim();
    const isEmail = looksLikeEmail(value);
    const phone = isEmail ? null : normalizePhone(value);
    if (!isEmail && !phone) { setError('Введите номер телефона, например 8 916 123-45-67'); return; }
    if (mode === 'signup' && !fullName.trim()) { setError('Укажите ФИО'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = isEmail
          ? await supabase.auth.signInWithPassword({ email: value, password })
          : await supabase.auth.signInWithPassword({ phone: phone!, password });
        if (error) throw error;
      } else {
        const opts = { data: { full_name: fullName.trim() } };
        const { data, error } = isEmail
          ? await supabase.auth.signUp({ email: value, password, options: opts })
          : await supabase.auth.signUp({ phone: phone!, password, options: opts });
        if (error) throw error;
        if (!data.session) {
          setError('Аккаунт создан, но вход не выполнен: на сервере включено подтверждение. Сообщите администратору.');
          return;
        }
        if (data.user) {
          await supabase.from('profiles').update({
            full_name: fullName.trim(), position, ...(phone ? { phone: formatPhone(phone) } : {}),
          }).eq('id', data.user.id);
        }
      }
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(ruError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h1 className="text-xl font-semibold text-blue-900 dark:text-blue-300 mb-1">Контроль монтажа</h1>
        <p className="text-sm text-slate-500 mb-5">МФК Фрунзенская наб. — {mode === 'login' ? 'вход' : 'регистрация'}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <Field label="ФИО *"><input className="inp" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" autoComplete="name" required /></Field>
              <Field label="Должность"><input className="inp" value={position} onChange={e => setPosition(e.target.value)} placeholder="Монтажник / Инженер ПНР / Прораб" /></Field>
            </>
          )}
          <Field label={mode === 'login' ? 'Телефон' : 'Телефон *'}>
            <input className="inp" type="text" inputMode={looksLikeEmail(login) ? 'email' : 'tel'} autoComplete="username"
              value={login} onChange={e => setLogin(e.target.value)} placeholder="8 916 123-45-67" required />
          </Field>
          <Field label="Пароль">
            <div className="relative">
              <input className="inp pr-12" type={showPass ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder={mode === 'signup' ? 'минимум 6 символов' : ''} />
              <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-0 top-0 h-full w-12 text-slate-400 text-lg">{showPass ? '🙈' : '👁'}</button>
            </div>
          </Field>

          {error && <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950 rounded-lg px-3 py-2">{error}</div>}

          <button disabled={loading} className="btn-primary w-full text-base py-2.5">
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="mt-3 text-xs text-slate-400 text-center">Забыли пароль — попросите администратора сбросить его.<br />Можно войти и по email, если регистрировались с ним.</p>
        )}

        <button
          className="mt-4 min-h-11 text-sm text-blue-700 dark:text-blue-400 hover:underline w-full text-center"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
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
