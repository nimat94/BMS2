'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';

export default function ProfilePage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
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

  async function changeRole(userId: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    load();
  }

  if (!me) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div className="max-w-lg">
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Личный кабинет</h2>
      <div className="card space-y-3 mb-6">
        <label className="block"><span className="text-xs text-slate-500">ФИО</span><input className="inp mt-1" value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Должность</span><input className="inp mt-1" value={position} onChange={e => setPosition(e.target.value)} placeholder="Монтажник / Инженер ПНР / Прораб" /></label>
        <label className="block"><span className="text-xs text-slate-500">Телефон</span><input className="inp mt-1" value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <div className="text-xs text-slate-500">Роль: <b>{ROLE_LABEL[me.role]}</b> {me.role !== 'admin' && '(меняет администратор)'}</div>
        <button disabled={saving} onClick={save} className="btn-primary">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
        {msg && <div className="text-xs text-emerald-600">{msg}</div>}
      </div>

      {me.role === 'admin' && (
        <>
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Пользователи (администрирование)</h2>
          <div className="space-y-2">
            {allUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{u.full_name || '(без имени)'}</div>
                  <div className="text-[11px] text-slate-500">{u.position}{u.phone ? ' · ' + u.phone : ''}</div>
                </div>
                <select className="inp w-auto text-xs" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                  <option value="installer">Монтажник</option>
                  <option value="engineer">Инженер</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Инженеры и администраторы видят кнопку ✏️ «Изменить» на кабелях и оборудовании (правка марки/длины/наименования). Монтажники — только добавляют записи о монтаже и историю.
          </p>
        </>
      )}
    </div>
  );
}
