'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { Equipment, Readiness } from '@/lib/types';
import { readinessKey, isReady, missingMarkers, readyCount } from '@/lib/readiness';
import { SECTIONS } from '@/lib/types';
import { fmtNum, fmtDate, todayStr } from '@/lib/utils';

export default function EquipmentPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | { kind: 'add'|'edit'|'history'|'blocked'; item: Equipment }>(null);
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({});
  const [role, setRole] = useState<string>('installer');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('equipment_progress').select('*').order('section').order('group_name').order('pos');
    setItems((data || []) as Equipment[]);
    const { data: rd } = await supabase.from('readiness').select('*').eq('kind', 'equipment');
    const m: Record<string, Readiness> = {};
    for (const r of (rd || []) as Readiness[]) m[readinessKey('equipment', r.section, r.front)] = r;
    setReadiness(m);
    setLoading(false);
  }
  useEffect(() => {
    load();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data) setRole((data as any).role);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(e => {
      if (section !== 'all' && e.section !== section) return false;
      if (!q) return true;
      return [e.pos, e.name, e.model, e.supplier, e.group_name].join(' ').toLowerCase().includes(q);
    });
  }, [items, search, section]);

  const groups = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const e of filtered) {
      const key = e.section + '|' + e.group_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filtered]);

  function toggleGroup(key: string) {
    const s = new Set(openGroups);
    s.has(key) ? s.delete(key) : s.add(key);
    setOpenGroups(s);
  }

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input className="inp flex-1 min-w-[200px]" placeholder="Поиск: позиция, наименование, марка…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="inp w-auto" value={section} onChange={e => setSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} из {items.length}</span>
      </div>

      {[...groups.entries()].map(([key, list]) => {
        const [sec, grp] = key.split('|');
        const fullyDone = list.filter(e => (e.installed || 0) >= e.qty && e.qty > 0).length;
        const total = list.reduce((a,e)=>a+(e.qty||0),0);
        const done = list.reduce((a,e)=>a+Math.min(e.installed||0,e.qty||0),0);
        const pct = total ? done/total : 0;
        const open = openGroups.has(key) || !!search;
        return (
          <div key={key} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden">
            <button onClick={() => toggleGroup(key)} className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-left">
              <span className={`text-blue-700 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
              <span className="font-medium text-sm text-blue-900 dark:text-blue-300 flex-1">{grp}</span>
              {(() => { const r = readiness[readinessKey('equipment', sec, grp)]; const ok = isReady(r); return (
                <span className={`badge ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>{ok ? '✓ допуск' : `⛔ нет допуска ${readyCount(r)}/6`}</span>
              ); })()}
              <span className="text-[11px] text-slate-500 hidden sm:inline">{fullyDone}/{list.length} смонтировано</span>
              <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden hidden sm:inline-block">
                <span className="block h-full bg-emerald-500" style={{ width: `${Math.round(pct * 100)}%` }} />
              </span>
            </button>
            {open && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map(e => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs sm:text-sm odd:bg-slate-50/50 dark:odd:bg-slate-800/30">
                    <span className="font-mono font-semibold min-w-[46px]">{e.pos}</span>
                    <span className="flex-1 min-w-[160px]">{e.name}<div className="text-[11px] text-slate-400">{e.model}{e.supplier ? ' · '+e.supplier : ''}</div></span>
                    <span className={`font-semibold ${(e.installed||0) >= e.qty ? 'text-emerald-600' : 'text-rose-500'}`}>{fmtNum(e.installed)} из {fmtNum(e.qty)} {e.unit}</span>
                    <button title="Добавить запись" className="icon-btn" onClick={() => setModal({ kind: isReady(readiness[readinessKey('equipment', e.section, e.group_name || '(без группы)')]) ? 'add' : 'blocked', item: e })}>{isReady(readiness[readinessKey('equipment', e.section, e.group_name || '(без группы)')]) ? '➕' : '🔒'}</button>
                    <button title="История" className="icon-btn" onClick={() => setModal({ kind: 'history', item: e })}>🕓</button>
                    {role !== 'installer' && (
                      <button title="Изменить" className="icon-btn" onClick={() => setModal({ kind: 'edit', item: e })}>✏️</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {groups.size === 0 && <div className="text-center text-slate-400 py-16 text-sm">Ничего не найдено</div>}

      {modal?.kind === 'blocked' && (
        <ModalShell title="⛔ Монтаж не разрешён" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <div>По комплекту <b>{modal.item.section} · {modal.item.group_name}</b> нет допуска. Не выполнено:</div>
            <ul className="space-y-1">{missingMarkers(readiness[readinessKey('equipment', modal.item.section, modal.item.group_name || '(без группы)')]).map(m => <li key={m} className="text-rose-600">✕ {m}</li>)}</ul>
            <Link href="/readiness" className="btn-primary block text-center">Перейти в «Допуск»</Link>
          </div>
        </ModalShell>
      )}
      {modal?.kind === 'add' && <AddEquipModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.kind === 'edit' && <EditEquipModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.kind === 'history' && <HistoryEquipModal equipmentId={modal.item.id} title={modal.item.name || ''} unit={modal.item.unit || ''} onClose={() => setModal(null)} />}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-[min(420px,92vw)] max-h-[85vh] overflow-auto shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function AddEquipModal({ item, onClose, onSaved }: { item: Equipment; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    const q = parseFloat(qty);
    if (!q) { onClose(); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('equipment_logs').insert({ equipment_id: item.id, qty: q, date, user_id: user?.id, note });
    setSaving(false);
    if (error) { alert('Не сохранилось: ' + error.message); return; } onSaved(); onClose();
  }
  return (
    <ModalShell title={`Добавить монтаж — ${item.name}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-slate-500">Смонтировано: {fmtNum(item.installed)} из {fmtNum(item.qty)} {item.unit}</div>
        <label className="block"><span className="text-xs text-slate-500">Дата</span><input type="date" className="inp mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Сколько смонтировали, {item.unit}</span><input type="number" className="inp mt-1" value={qty} onChange={e => setQty(e.target.value)} autoFocus /></label>
        <label className="block"><span className="text-xs text-slate-500">Комментарий</span><input className="inp mt-1" value={note} onChange={e => setNote(e.target.value)} /></label>
        <button disabled={saving} onClick={save} className="btn-primary w-full">{saving ? 'Сохраняю…' : 'Добавить'}</button>
      </div>
    </ModalShell>
  );
}

function EditEquipModal({ item, onClose, onSaved }: { item: Equipment; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [name, setName] = useState(item.name || '');
  const [model, setModel] = useState(item.model || '');
  const [qty, setQty] = useState(String(item.qty || 0));
  const [unit, setUnit] = useState(item.unit || '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await supabase.from('equipment').update({ name, model, qty: parseFloat(qty) || 0, unit }).eq('id', item.id);
    setSaving(false); onSaved(); onClose();
  }
  return (
    <ModalShell title={`Изменить — ${item.pos}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <label className="block"><span className="text-xs text-slate-500">Наименование</span><input className="inp mt-1" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Тип/марка</span><input className="inp mt-1" value={model} onChange={e => setModel(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Кол-во по проекту</span><input type="number" className="inp mt-1" value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Ед.изм.</span><input className="inp mt-1" value={unit} onChange={e => setUnit(e.target.value)} /></label>
        <button disabled={saving} onClick={save} className="btn-primary w-full">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </div>
    </ModalShell>
  );
}

function HistoryEquipModal({ equipmentId, title, unit, onClose }: { equipmentId: number; title: string; unit: string; onClose: () => void }) {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('equipment_logs').select('qty,date,note,profiles(full_name)').eq('equipment_id', equipmentId).order('date', { ascending: false });
      setRows(data || []); setLoading(false);
    })();
  }, [equipmentId]);
  return (
    <ModalShell title={`История — ${title}`} onClose={onClose}>
      {loading ? <div className="text-slate-400 text-sm text-center py-6">Загрузка…</div> :
        rows.length === 0 ? <div className="text-slate-400 text-sm text-center py-6">Записей ещё нет</div> :
        <div className="space-y-1.5 max-h-[50vh] overflow-auto">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[54px_60px_1fr] gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5">
              <span>{fmtDate(r.date)}</span>
              <span className="font-medium">+{fmtNum(r.qty)} {unit}</span>
              <span className="text-slate-500 truncate">{r.profiles?.full_name || '—'}{r.note ? ' · ' + r.note : ''}</span>
            </div>
          ))}
        </div>
      }
    </ModalShell>
  );
}
