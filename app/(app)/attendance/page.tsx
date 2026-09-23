'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Attendance, Profile } from '@/lib/types';
import { SECTIONS, ROLE_LABEL } from '@/lib/types';
import { fmtDate, todayStr, monthRange } from '@/lib/utils';

export default function AttendancePage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [rows, setRows] = useState<(Attendance & { profiles: { full_name: string; position: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(todayStr().slice(0, 7));

  // form state for "я на объекте сегодня"
  const [date, setDate] = useState(todayStr());
  const [section, setSection] = useState(SECTIONS[0]);
  const [hours, setHours] = useState('8');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setMe(p as Profile);
    }
    const { from, to } = monthRange(month);
    const { data, error } = await supabase
      .from('attendance')
      .select('*, profiles(full_name, position)')
      .gte('date', from)
      .lt('date', to)
      .order('date', { ascending: false });
    if (error) setMsg('Ошибка загрузки: ' + error.message);
    setRows((data || []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, [month]);

  async function markToday() {
    setSaving(true); setMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('attendance').upsert({
      user_id: user.id, date, section, hours: parseFloat(hours) || null, note,
    }, { onConflict: 'user_id,date,section' });
    setSaving(false);
    if (error) { setMsg('Ошибка: ' + error.message); return; }
    setMsg('Отмечено ✓');
    load();
  }

  // summary per person for the selected month
  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; position: string; days: Set<string>; hours: number }>();
    for (const r of rows) {
      const key = r.user_id;
      if (!map.has(key)) map.set(key, { name: r.profiles?.full_name || '—', position: r.profiles?.position || '', days: new Set(), hours: 0 });
      const v = map.get(key)!;
      v.days.add(r.date);
      v.hours += Number(r.hours) || 0;
    }
    return [...map.values()].sort((a, b) => b.days.size - a.days.size);
  }, [rows]);

  if (loading && !me) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Отметиться на объекте</h2>
      <div className="card mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <label className="block"><span className="text-xs text-slate-500">Дата</span><input type="date" className="inp mt-1" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Раздел/участок</span>
          <select className="inp mt-1" value={section} onChange={e=>setSection(e.target.value)}>
            {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block"><span className="text-xs text-slate-500">Часов</span><input type="number" className="inp mt-1" value={hours} onChange={e=>setHours(e.target.value)} /></label>
        <label className="block sm:col-span-1"><span className="text-xs text-slate-500">Примечание</span><input className="inp mt-1" value={note} onChange={e=>setNote(e.target.value)} placeholder="необязательно" /></label>
        <button disabled={saving} onClick={markToday} className="btn-primary h-[38px]">{saving ? '…' : 'Отметиться'}</button>
      </div>
      {msg && <div className="text-xs text-emerald-600 mb-4">{msg}</div>}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Сводка за месяц</h2>
        <input type="month" className="inp w-auto" value={month} onChange={e=>setMonth(e.target.value)} />
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <th className="py-1.5 pr-2">ФИО</th><th className="py-1.5 pr-2">Должность</th>
              <th className="py-1.5 pr-2 text-right">Дней на объекте</th><th className="py-1.5 text-right">Часов</th>
            </tr>
          </thead>
          <tbody>
            {byPerson.map((p, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2 font-medium">{p.name}</td>
                <td className="py-1.5 pr-2 text-slate-500">{p.position}</td>
                <td className="py-1.5 pr-2 text-right">{p.days.size}</td>
                <td className="py-1.5 text-right">{p.hours || '—'}</td>
              </tr>
            ))}
            {byPerson.length === 0 && <tr><td colSpan={4} className="text-center text-slate-400 py-6">Отметок за этот месяц ещё нет</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Журнал отметок</h2>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.id} className="flex flex-wrap gap-2 text-xs sm:text-sm px-3 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/30 rounded">
            <span className="w-16 font-medium">{fmtDate(r.date)}</span>
            <span className="flex-1">{r.profiles?.full_name}</span>
            <span className="text-slate-500">{r.section}</span>
            {r.hours && <span className="text-slate-500">{r.hours} ч</span>}
            {r.note && <span className="text-slate-400">· {r.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
