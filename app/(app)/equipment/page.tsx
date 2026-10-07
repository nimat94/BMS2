'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/fetchAll';
import type { Equipment, Readiness } from '@/lib/types';
import { SECTIONS } from '@/lib/types';
import { fmtNum, fmtDate, todayStr, parseNum } from '@/lib/utils';
import { readinessKey, isReady, missingMarkers, readyCount } from '@/lib/readiness';
import Sheet from '@/components/Sheet';

const TH = 'px-2 py-1.5 border border-slate-200 dark:border-slate-700 font-medium';
const TD = 'px-2 py-1.5 border border-slate-200 dark:border-slate-700';

export default function EquipmentPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mOpen, setMOpen] = useState<Set<string>>(new Set()); // раскрытые группы на телефоне
  const [modal, setModal] = useState<null | { kind: 'add'|'edit'|'history'|'blocked'; item: Equipment }>(null);
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({});
  const [role, setRole] = useState<string>('installer');

  async function load() {
    setLoading(true);
    const data = await fetchAll(() => supabase.from('equipment_progress').select('*').order('section').order('ord', { nullsFirst: false }).order('id'));
    const secIdx = (s: string) => { const i = SECTIONS.indexOf(s); return i < 0 ? 99 : i; };
    data.sort((a: any, b: any) => secIdx(a.section) - secIdx(b.section));
    setItems(data as Equipment[]);
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

  const grpName = (e: Equipment) => e.group_name || '(без группы)';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(e => {
      if (section !== 'all' && e.section !== section) return false;
      if (onlyTodo && (e.installed || 0) >= (e.qty || 0)) return false;
      if (!q) return true;
      return [e.pos, e.name, e.model, e.supplier, e.group_name].join(' ').toLowerCase().includes(q);
    });
  }, [items, search, section, onlyTodo]);

  const groups = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const e of filtered) {
      const key = e.section + '|' + grpName(e);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filtered]);

  function toggle(key: string) {
    const s = new Set(collapsed);
    s.has(key) ? s.delete(key) : s.add(key);
    setCollapsed(s);
  }
  const allKeys = [...groups.keys()];

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  const totalDone = filtered.filter(e => (e.installed || 0) >= (e.qty || 0) && (e.qty || 0) > 0).length;

  return (
    <div>
      <div className="hidden sm:block text-xs text-slate-500 mb-2">Конечное оборудование — датчики, приводы, устройства для монтажа на объекте (щиты приходят в сборе, см. «Щиты»)</div>
      <div className="sticky top-12 sm:static z-20 -mx-3 px-3 sm:mx-0 sm:px-0 pt-1 pb-2 sm:pb-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur sm:bg-transparent sm:backdrop-blur-none flex flex-wrap gap-2 mb-2 sm:mb-3 items-center">
        <div className="relative flex-1 basis-full sm:basis-auto min-w-[200px]">
          <input type="search" enterKeyHint="search" className="inp pr-10" placeholder="Поиск: поз., наименование, марка…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button aria-label="Очистить" onClick={() => setSearch('')} className="absolute right-0 top-0 h-full w-10 text-slate-400 text-lg">✕</button>}
        </div>
        <select className="inp w-auto flex-1 sm:flex-none" value={section} onChange={e => setSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => setOnlyTodo(v => !v)}
          className={`chip min-h-11 sm:min-h-0 ${onlyTodo ? 'bg-blue-100 text-blue-800 border-blue-300' : 'border-slate-300 text-slate-600 dark:text-slate-300'}`}>
          только не смонтированное
        </button>
        <button className="btn text-xs hidden sm:inline-flex" onClick={() => setCollapsed(new Set())}>Развернуть всё</button>
        <button className="btn text-xs hidden sm:inline-flex" onClick={() => setCollapsed(new Set(allKeys))}>Свернуть всё</button>
        <span className="text-xs text-slate-400 w-full sm:w-auto">смонтировано {totalDone} из {filtered.length}</span>
      </div>

      {/* Телефон: группы с карточками; по умолчанию свёрнуты */}
      <div className="sm:hidden">
        {[...groups.entries()].map(([key, list]) => {
          const [sec, grp] = key.split('|');
          const r = readiness[readinessKey('equipment', sec, grp)];
          const ok = isReady(r);
          const done = list.filter(e => (e.installed || 0) >= (e.qty || 0) && (e.qty || 0) > 0).length;
          const open = mOpen.has(key) || !!search || onlyTodo;
          return (
            <div key={key} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden">
              <button onClick={() => { const s = new Set(mOpen); if (s.has(key)) s.delete(key); else s.add(key); setMOpen(s); }}
                className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-3 bg-blue-50 dark:bg-blue-950/40 text-left">
                <span className={`text-blue-700 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                <span className="font-medium text-sm text-blue-900 dark:text-blue-300 flex-1">{section === 'all' && <span className="text-[11px] text-slate-500 mr-1">{sec}</span>}{grp}</span>
                <span className={`badge ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>{ok ? '✓ допуск' : `⛔ ${readyCount(r)}/6`}</span>
                <span className="basis-full pl-5 text-[11px] text-slate-500">смонтировано {done} из {list.length}</span>
              </button>
              {open && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {list.map(e => {
                    const inst = e.installed || 0;
                    const qty = e.qty || 0;
                    const full = inst >= qty && qty > 0;
                    return (
                      <div key={e.id} className={`px-3 py-3 ${full ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                        <div className="flex gap-2">
                          {e.pos && <span className="font-mono text-xs text-slate-500 shrink-0 pt-0.5">{e.pos}</span>}
                          <div className="flex-1 min-w-0">
                            <div className="text-[15px] leading-snug">{e.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{[e.model, e.supplier].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <span>
                            <b className={full ? 'text-emerald-600' : inst > 0 ? 'text-amber-600' : 'text-rose-500'}>{fmtNum(inst)}</b>
                            <span className="text-slate-500"> из {fmtNum(qty)} {e.unit}</span>
                          </span>
                          {e.last_date && <span className="text-[11px] text-slate-400">{fmtDate(e.last_date)} {e.last_user_name || ''}</span>}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {!full
                            ? <button onClick={() => setModal({ kind: ok ? 'add' : 'blocked', item: e })} className={`flex-1 ${ok ? 'btn-primary' : 'btn text-rose-600'}`}>{ok ? '+ Смонтировано' : '🔒 Нет допуска'}</button>
                            : <button onClick={() => setModal({ kind: ok ? 'add' : 'blocked', item: e })} className="btn flex-1">✓ Смонтировано · добавить</button>}
                          <button onClick={() => setModal({ kind: 'history', item: e })} className="btn w-12 shrink-0" aria-label="История">🕓</button>
                          {role !== 'installer' && <button onClick={() => setModal({ kind: 'edit', item: e })} className="btn w-12 shrink-0" aria-label="Изменить">✏️</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {groups.size === 0 && <div className="text-center text-slate-400 py-16 text-sm">Ничего не найдено</div>}
      </div>

      <div className="hidden sm:block overflow-auto max-h-[75vh] border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
              <th className={TH + ' w-12'}>Поз.</th>
              <th className={TH}>Комплект/зона</th>
              <th className={TH}>Наименование, техническая характеристика</th>
              <th className={TH}>Тип/марка</th>
              <th className={TH}>Поставщик</th>
              <th className={TH + ' w-14'}>Ед.изм.</th>
              <th className={TH + ' text-right w-20'}>Кол-во по проекту</th>
              <th className={TH + ' text-right w-24'}>Смонтировано</th>
              <th className={TH}>Ответственный</th>
              <th className={TH + ' w-16'}>Дата</th>
              <th className={TH + ' w-24'}></th>
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([key, list]) => {
              const [sec, grp] = key.split('|');
              const r = readiness[readinessKey('equipment', sec, grp)];
              const ok = isReady(r);
              const done = list.filter(e => (e.installed || 0) >= (e.qty || 0) && (e.qty || 0) > 0).length;
              const isCollapsed = collapsed.has(key) && !search;
              return [
                <tr key={key + '#h'} className="bg-blue-50 dark:bg-blue-950/40 cursor-pointer" onClick={() => toggle(key)}>
                  <td colSpan={11} className={TD + ' font-semibold text-blue-900 dark:text-blue-300'}>
                    <span className={`inline-block mr-2 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                    {section === 'all' && <span className="text-[11px] font-normal text-slate-500 mr-2">{sec}</span>}
                    {grp}
                    <span className={`badge ml-2 ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>{ok ? '✓ допуск' : `⛔ нет допуска ${readyCount(r)}/6`}</span>
                    <span className="text-[11px] font-normal text-slate-500 ml-2">смонтировано {done}/{list.length}</span>
                  </td>
                </tr>,
                ...(isCollapsed ? [] : list.map(e => {
                  const inst = e.installed || 0;
                  const full = inst >= (e.qty || 0) && (e.qty || 0) > 0;
                  return (
                    <tr key={e.id} className={`align-top ${full ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                      <td className={TD + ' font-mono'}>{e.pos}</td>
                      <td className={TD + ' text-slate-500'}>{grp}</td>
                      <td className={TD + ' min-w-[240px]'}>{e.name}</td>
                      <td className={TD + ' whitespace-nowrap'}>{e.model}</td>
                      <td className={TD}>{e.supplier}</td>
                      <td className={TD}>{e.unit}</td>
                      <td className={TD + ' text-right'}>{fmtNum(e.qty)}</td>
                      <td className={TD + ` text-right font-semibold ${full ? 'text-emerald-600' : inst > 0 ? 'text-amber-600' : 'text-rose-500'}`}>{fmtNum(inst)}</td>
                      <td className={TD}>{e.last_user_name || ''}</td>
                      <td className={TD + ' whitespace-nowrap'}>{fmtDate(e.last_date)}</td>
                      <td className={TD + ' whitespace-nowrap px-1'}>
                        <button title="Добавить монтаж" className="icon-btn" onClick={() => setModal({ kind: ok ? 'add' : 'blocked', item: e })}>{ok ? '➕' : '🔒'}</button>
                        <button title="История" className="icon-btn" onClick={() => setModal({ kind: 'history', item: e })}>🕓</button>
                        {role !== 'installer' && <button title="Изменить" className="icon-btn" onClick={() => setModal({ kind: 'edit', item: e })}>✏️</button>}
                      </td>
                    </tr>
                  );
                })),
              ];
            })}
          </tbody>
        </table>
        {groups.size === 0 && <div className="text-center text-slate-400 py-16 text-sm">Ничего не найдено</div>}
      </div>

      {modal?.kind === 'blocked' && (
        <Sheet title="⛔ Монтаж не разрешён" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <div>По комплекту <b>{modal.item.section} · {grpName(modal.item)}</b> нет допуска. Не выполнено:</div>
            <ul className="space-y-1">{missingMarkers(readiness[readinessKey('equipment', modal.item.section, grpName(modal.item))]).map(m => <li key={m} className="text-rose-600">✕ {m}</li>)}</ul>
            <Link href="/readiness" className="btn-primary block text-center">Перейти в «Допуск»</Link>
          </div>
        </Sheet>
      )}
      {modal?.kind === 'add' && <AddEquipModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.kind === 'edit' && <EditEquipModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.kind === 'history' && <HistoryEquipModal equipmentId={modal.item.id} title={modal.item.name || ''} unit={modal.item.unit || ''} onClose={() => setModal(null)} />}
    </div>
  );
}

function AddEquipModal({ item, onClose, onSaved }: { item: Equipment; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const left = Math.max(0, (item.qty || 0) - (item.installed || 0));
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    const q = parseNum(qty);
    if (!q) { setErr('Укажите, сколько смонтировали'); return; }
    setSaving(true); setErr('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('equipment_logs').insert({ equipment_id: item.id, qty: q, date, user_id: user?.id, note });
    setSaving(false);
    if (error) { setErr('Не сохранилось: ' + error.message); return; } onSaved(); onClose();
  }
  return (
    <Sheet title={`Монтаж — ${item.pos ? item.pos + ' ' : ''}${item.name || ''}`} onClose={onClose}
      footer={<>
        {err && <div className="text-xs text-rose-600 mb-2">{err}</div>}
        <button disabled={saving} onClick={save} className="btn-primary w-full text-base sm:text-sm">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </>}>
      <div className="space-y-3 text-sm">
        <div className="text-slate-500">{item.model}{item.model ? ' · ' : ''}смонтировано {fmtNum(item.installed)} из {fmtNum(item.qty)} {item.unit}</div>
        <label className="block"><span className="text-xs text-slate-500">Сколько смонтировали, {item.unit}</span>
          <div className="flex gap-2 mt-1">
            <input type="text" inputMode="decimal" enterKeyHint="done" className="inp text-lg sm:text-sm font-semibold" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" autoFocus />
            {left > 0 && <button type="button" onClick={() => setQty(String(left))} className="btn shrink-0 whitespace-nowrap">все {fmtNum(left)} {item.unit}</button>}
          </div>
        </label>
        <label className="block"><span className="text-xs text-slate-500">Дата</span><input type="date" className="inp mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Комментарий</span><input className="inp mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="необязательно" /></label>
      </div>
    </Sheet>
  );
}

function EditEquipModal({ item, onClose, onSaved }: { item: Equipment; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [name, setName] = useState(item.name || '');
  const [model, setModel] = useState(item.model || '');
  const [qty, setQty] = useState(String(item.qty || 0));
  const [unit, setUnit] = useState(item.unit || '');
  const [supplier, setSupplier] = useState(item.supplier || '');
  const [pos, setPos] = useState(item.pos || '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await supabase.from('equipment').update({ name, model, qty: parseNum(qty), unit, supplier, pos }).eq('id', item.id);
    setSaving(false); onSaved(); onClose();
  }
  return (
    <Sheet title={`Изменить — ${item.pos || item.name || ''}`} onClose={onClose}
      footer={<button disabled={saving} onClick={save} className="btn-primary w-full text-base sm:text-sm">{saving ? 'Сохраняю…' : 'Сохранить'}</button>}>
      <div className="space-y-3 text-sm">
        <label className="block"><span className="text-xs text-slate-500">Поз.</span><input className="inp mt-1" value={pos} onChange={e => setPos(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Наименование</span><input className="inp mt-1" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Тип/марка</span><input className="inp mt-1" value={model} onChange={e => setModel(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Кол-во по проекту</span><input type="text" inputMode="decimal" className="inp mt-1" value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Поставщик</span><input className="inp mt-1" value={supplier} onChange={e => setSupplier(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Ед.изм.</span><input className="inp mt-1" value={unit} onChange={e => setUnit(e.target.value)} /></label>
      </div>
    </Sheet>
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
    <Sheet title={`История — ${title}`} onClose={onClose}>
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
    </Sheet>
  );
}
