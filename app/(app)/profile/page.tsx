'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { formatPhone } from '@/lib/phone';
import Sheet from '@/components/Sheet';

export default function ProfilePage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [loginPhone, setLoginPhone] = useState('');
  const [pwUser, setPwUser] = useState<Profile | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoginPhone(user.phone ? formatPhone('+' + user.phone) : '');
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const p = data as Profile;
    setMe(p);
    setFullName(p?.full_name || '');
    setPosition(p?.position || '');
    setPhone(p?.phone || '');
    if (p?.role === 'admin') {
      const { data: all } = await supabase.from('profiles').select('*').order('full_name');
      setAllUsers((all || []) as Profile[]);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!me) return;
    setSaving(true); setMsg('');
    const { error } = await supabase.from('profiles').update({ full_name: fullName, position, phone }).eq('id', me.id);
    setSaving(false);
    setMsg(error ? 'Ошибка: ' + error.message : 'Сохранено ✓');
  }

  const [roleMsg, setRoleMsg] = useState('');
  async function changeRole(userId: string, role: string) {
    setRoleMsg('');
    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select('id');
    if (error) setRoleMsg('Не сохранилось: ' + error.message);
    else if (!data || data.length === 0) setRoleMsg('Не сохранилось: нет прав. Выполните в Supabase миграцию migration_03_roles.sql.');
    else setRoleMsg('Роль изменена ✓');
    load();
  }

  if (!me) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div className="max-w-lg">
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Личный кабинет</h2>
      <div className="card space-y-3 mb-6">
        <label className="block"><span className="text-xs text-slate-500">ФИО</span><input className="inp mt-1" value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Должность</span><input className="inp mt-1" value={position} onChange={e => setPosition(e.target.value)} placeholder="Монтажник / Инженер ПНР / Прораб" /></label>
        <label className="block"><span className="text-xs text-slate-500">Телефон для связи</span><input className="inp mt-1" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <div className="text-xs text-slate-500">Роль: <b>{ROLE_LABEL[me.role]}</b> {me.role !== 'admin' && '(меняет администратор)'}</div>
        {loginPhone && <div className="text-xs text-slate-500">Вход по номеру: <b>{loginPhone}</b></div>}
        {me.email && <div className="text-xs text-slate-500">Email: {me.email}</div>}
        <button disabled={saving} onClick={save} className="btn-primary w-full sm:w-auto">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
        {msg && <div className="text-xs text-emerald-600">{msg}</div>}
      </div>

      {me.role === 'admin' && (
        <>
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Пользователи (администрирование)</h2>
          <div className="space-y-2">
            {allUsers.map(u => (
              <div key={u.id} className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium">{u.full_name || '(без имени)'}</div>
                  <div className="text-[11px] text-slate-500">{[u.email, u.position, u.phone].filter(Boolean).join(' · ')}</div>
                </div>
                <select className="inp w-auto text-xs" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                  <option value="installer">Монтажник</option>
                  <option value="engineer">Инженер</option>
                  <option value="admin">Администратор</option>
                </select>
                <button className="btn shrink-0" title="Задать новый пароль" onClick={() => setPwUser(u)}>🔑 Пароль</button>
              </div>
            ))}
          </div>
          {roleMsg && <div className="text-xs mt-2 text-slate-600 dark:text-slate-300">{roleMsg}</div>}
          <p className="text-[11px] text-slate-400 mt-3">
            Инженеры и администраторы видят кнопку ✏️ «Изменить» на кабелях и оборудовании (правка марки/длины/наименования). Монтажники — только добавляют записи о монтаже и историю.
            Если монтажник забыл пароль — нажмите «🔑 Пароль», задайте новый и сообщите ему.
          </p>
          {pwUser && <PasswordSheet user={pwUser} onClose={() => setPwUser(null)} />}
        </>
      )}
    </div>
  );
}

function PasswordSheet({ user, onClose }: { user: Profile; onClose: () => void }) {
  const supabase = createClient();
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  async function save() {
    if (pw.length < 6) { setMsg('Минимум 6 символов'); return; }
    setSaving(true); setMsg('');
    const { error } = await supabase.rpc('admin_set_password', { target: user.id, new_password: pw });
    setSaving(false);
    if (error) { setMsg('Не получилось: ' + error.message + (error.message.includes('function') ? ' (выполнена ли миграция migration_09?)' : '')); return; }
    setDone(true);
  }
  return (
    <Sheet title={`Новый пароль — ${user.full_name || 'пользователь'}`} onClose={onClose}
      footer={done
        ? <button onClick={onClose} className="btn w-full">Готово</button>
        : <>{msg && <div className="text-xs text-rose-600 mb-2">{msg}</div>}<button disabled={saving} onClick={save} className="btn-primary w-full text-base sm:text-sm">{saving ? 'Сохраняю…' : 'Задать пароль'}</button></>}>
      {done
        ? <div className="text-sm space-y-2"><div className="text-emerald-600 font-medium">✓ Пароль изменён</div><div>Сообщите его пользователю: <b className="font-mono text-base">{pw}</b></div><div className="text-xs text-slate-500">Вход: {user.phone || user.email}</div></div>
        : <label className="block text-sm"><span className="text-xs text-slate-500">Новый пароль (минимум 6 символов)</span>
            <input className="inp mt-1 font-mono" type="text" autoComplete="off" value={pw} onChange={e => setPw(e.target.value)} autoFocus /></label>}
    </Sheet>
  );
}
