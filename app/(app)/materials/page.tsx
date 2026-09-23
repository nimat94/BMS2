'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { SECTIONS } from '@/lib/types';
import { fmtNum, fmtDate, todayStr } from '@/lib/utils';

type Issue = {
  id: number; section: string; front: string; brand: string; wires: string; unit: string;
  qty: number; issued_to: string | null; issued_by: string | null; date: string; note: string;
};

export default function MaterialsPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [cables, setCables] = useState<any[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // form
  const [section, setSection] = useState(SECTIONS[0]);
  const [front, setFront] = useState('');
  const [brandKey, setBrandKey] = useState('');
  const [qty, setQty] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterSection, setFilterSection] = useState('all');

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setMe(data as Profile);
      if (data) setIssuedTo((data as any).id);
    }
    const { data: ps } = await supabase.from('profiles').select('*').order('full_name');
    setPeople((ps || []) as Profile[]);
    const { data: cp } = await supabase.from('cable_progress').select('section,system,brand,wires,length,installed');
    setCables(cp || []);
    const { data: is, error } = await supabase.from('material_issues').select('*').order('date', { ascending: false }).order('id', { ascending: false });
    if (error) setMsg('Ошибка загрузки: ' + error.message + ' (выполнена ли миграция migration_02_readiness.sql?)');
    setIssues((is || []) as Issue[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const fronts = useMemo(() => [...new Set(cables.filter(c => c.section === section).map(c => c.system))].sort(), [cables, section]);
  useEffect(() => { if (!fronts.includes(front)) setFront(fronts[0] || ''); }, [fronts]);

  const brands = useMemo(() => {
    const m = new Map<string, { brand: string; wires: string; need: number }>();
    for (const c of cables.filter(c => c.section === section && c.system === front)) {
      const k = `${c.brand}|${c.wires}`;
      const v = m.get(k) || { brand: c.brand, wires: c.wires, need: 0 };
      v.need += Number(c.length) || 0; m.set(k, v);
    }
    return [...m.values()];
  }, [cables, section, front]);
  useEffect(() => { const ks = brands.map(b => `${b.brand}|${b.wires}`); if (!ks.includes(brandKey)) setBrandKey(ks[0] || ''); }, [brands]);

  const nameOf = (id: string | null) => people.find(p => p.id === id)?.full_name || '—';

  async function save() {
    const q = parseFloat(qty);
    if (!q || !front || !brandKey) { setMsg('Заполните систему, марку и количество'); return; }
    setSaving(true); setMsg('');
    const [brand, wires] = brandKey.split('|');
    const { error } = await supabase.from('material_issues').insert({
      section, front, brand, wires, unit: 'м', qty: q, issued_to: issuedTo || null, issued_by: me?.id, date, note,
    });
    setSaving(false);
    if (error) { setMsg('Не сохранилось: ' + error.message); return; }
    setQty(''); setNote(''); setMsg('Выписано ✓');
    load();
  }

  async function remove(id: number) {
    if (!confirm('Удалить эту выписку?')) return;
    const { error } = await supabase.from('material_issues').delete().eq('id', id);
    if (error) setMsg('Не удалилось: ' + error.message);
    load();
  }

  // balance per front+brand: issued vs laid
  const balance = useMemo(() => {
    const m = new Map<string, { section: string; front: string; brand: string; wires: string; need: number; issued: number; laid: number }>();
    const key = (s: string, f: string, b: string, w: string) => `${s}|${f}|${b}|${w}`;
    for (const i of issues) {
      const k = key(i.section, i.front, i.brand, i.wires);
      const v = m.get(k) || { section: i.section, front: i.front, brand: i.brand, wires: i.wires, need: 0, issued: 0, laid: 0 };
      v.issued += Number(i.qty) || 0; m.set(k, v);
    }
    for (const c of cables) {
      const k = key(c.section, c.system, c.brand, c.wires);
      const v = m.get(k);
      if (v) { v.laid += Number(c.installed) || 0; v.need += Number(c.length) || 0; }
    }
    return [...m.values()]
      .filter(v => filterSection === 'all' || v.section === filterSection)
      .sort((a, b) => a.section.localeCompare(b.section) || a.front.localeCompare(b.front));
  }, [issues, cables, filterSection]);

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  const sel = brands.find(b => `${b.brand}|${b.wires}` === brandKey);

  return (
    <div>
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Выписать материал на систему</h2>
      <div className="card mb-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block"><span className="text-xs text-slate-500">Раздел</span>
          <select className="inp mt-1" value={section} onChange={e => setSection(e.target.value)}>
            {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-500">Система / фронт</span>
          <select className="inp mt-1" value={front} onChange={e => setFront(e.target.value)}>
            {fronts.map(f => <option key={f} value={f}>{f}</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-500">Марка кабеля</span>
          <select className="inp mt-1" value={brandKey} onChange={e => setBrandKey(e.target.value)}>
            {brands.map(b => <option key={`${b.brand}|${b.wires}`} value={`${b.brand}|${b.wires}`}>{b.brand} {b.wires} (по проекту {fmtNum(b.need)} м)</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-500">Количество, м</span>
          <input type="number" className="inp mt-1" value={qty} onChange={e => setQty(e.target.value)} placeholder={sel ? `до ${fmtNum(sel.need)}` : ''} /></label>
        <label className="block"><span className="text-xs text-slate-500">Кому выдано</span>
          <select className="inp mt-1" value={issuedTo} onChange={e => setIssuedTo(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.full_name || '(без имени)'}{p.position ? ' — ' + p.position : ''}</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-500">Дата</span>
          <input type="date" className="inp mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className="text-xs text-slate-500">Примечание</span>
          <input className="inp mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="бухта №…, склад…" /></label>
        <button disabled={saving} onClick={save} className="btn-primary self-end h-[38px]">{saving ? '…' : 'Выписать'}</button>
      </div>
      {msg && <div className="text-xs mb-4 text-slate-600 dark:text-slate-300">{msg}</div>}

      <div className="flex items-center justify-between mb-2 mt-5">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Баланс: выдано / проложено / на руках</h2>
        <select className="inp w-auto" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-xs sm:text-sm">
          <thead><tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
            <th className="py-1.5 pr-2">Раздел</th><th className="py-1.5 pr-2">Система</th><th className="py-1.5 pr-2">Марка</th>
            <th className="py-1.5 pr-2 text-right">Проект</th><th className="py-1.5 pr-2 text-right">Выдано</th>
            <th className="py-1.5 pr-2 text-right">Проложено</th><th className="py-1.5 text-right">На руках</th>
          </tr></thead>
          <tbody>
            {balance.map((b, i) => {
              const onHand = b.issued - b.laid;
              return (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-2">{b.section}</td><td className="py-1.5 pr-2">{b.front}</td>
                  <td className="py-1.5 pr-2">{b.brand} {b.wires}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtNum(b.need)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtNum(b.issued)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtNum(b.laid)}</td>
                  <td className={`py-1.5 text-right font-semibold ${onHand < 0 ? 'text-rose-600' : ''}`} title={onHand < 0 ? 'Проложено больше, чем выписано' : ''}>{fmtNum(onHand)}</td>
                </tr>
              );
            })}
            {balance.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-6">Выписок пока нет</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Журнал выписок</h2>
      <div className="space-y-1">
        {issues.filter(i => filterSection === 'all' || i.section === filterSection).map(i => (
          <div key={i.id} className="flex flex-wrap gap-2 items-center text-xs sm:text-sm px-3 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/30 rounded">
            <span className="w-16">{fmtDate(i.date)}</span>
            <span className="text-slate-500 w-16">{i.section}</span>
            <span className="flex-1">{i.front} · {i.brand} {i.wires}</span>
            <span className="font-semibold">{fmtNum(i.qty)} {i.unit}</span>
            <span className="text-slate-500">→ {nameOf(i.issued_to)}</span>
            {i.note && <span className="text-slate-400">· {i.note}</span>}
            {(me?.id === i.issued_by || me?.role === 'admin') && <button className="icon-btn" title="Удалить" onClick={() => remove(i.id)}>🗑</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
