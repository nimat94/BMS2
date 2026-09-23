'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Cable, Profile, Readiness } from '@/lib/types';
import { SECTIONS, STOP_REASONS } from '@/lib/types';
import { fmtNum, fmtDate, todayStr, statusClass, nextStatus } from '@/lib/utils';
import { readinessKey, isReady, missingMarkers, readyCount } from '@/lib/readiness';

export default function CablesPage() {
  const supabase = createClient();
  const [cables, setCables] = useState<Cable[]>([]);
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [onlyPaused, setOnlyPaused] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<Profile | null>(null);
  const [modal, setModal] = useState<null | { kind: 'add'|'edit'|'history'|'blocked'; cable: Cable }>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('cable_progress').select('*').order('section').order('system').order('tag');
    setCables((data || []) as Cable[]);
    const { data: rd } = await supabase.from('readiness').select('*').eq('kind', 'cable');
    const m: Record<string, Readiness> = {};
    for (const r of (rd || []) as Readiness[]) m[readinessKey('cable', r.section, r.front)] = r;
    setReadiness(m);
    setLoading(false);
  }
  useEffect(() => {
    load();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setMe(data as Profile);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cables.filter(c => {
      if (section !== 'all' && c.section !== section) return false;
      if (onlyPaused && c.last_completed !== false) return false;
      if (!q) return true;
      return [c.tag, c.start_point, c.end_point, c.brand, c.system].join(' ').toLowerCase().includes(q);
    });
  }, [cables, search, section, onlyPaused]);

  const groups = useMemo(() => {
    const map = new Map<string, Cable[]>();
    for (const c of filtered) {
      const key = c.section + '|' + c.system;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filtered]);

  const pausedCount = cables.filter(c => c.last_completed === false).length;

  function toggleGroup(key: string) {
    const s = new Set(openGroups);
    s.has(key) ? s.delete(key) : s.add(key);
    setOpenGroups(s);
  }

  function readyFor(c: Cable) {
    return readiness[readinessKey('cable', c.section, c.system)];
  }

  function openAdd(c: Cable) {
    setModal({ kind: isReady(readyFor(c)) ? 'add' : 'blocked', cable: c });
  }

  async function toggleDisc(c: Cable) {
    if (!isReady(readyFor(c))) { setModal({ kind: 'blocked', cable: c }); return; }
    const next = nextStatus(c.disconnected) as Cable['disconnected'];
    setCables(cs => cs.map(x => (x.id === c.id ? { ...x, disconnected: next } : x)));
    const { error } = await supabase.from('cables').update({ disconnected: next }).eq('id', c.id);
    if (error) { alert('Не сохранилось: ' + error.message); load(); }
  }

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <input className="inp pl-3" placeholder="Поиск: обозначение, помещение, марка…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="inp w-auto" value={section} onChange={e => setSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={onlyPaused} onChange={e => setOnlyPaused(e.target.checked)} /> только остановленные ⏸ ({pausedCount})
        </label>
        <span className="text-xs text-slate-400">{filtered.length} из {cables.length}</span>
      </div>

      {[...groups.entries()].map(([key, items]) => {
        const [sec, sys] = key.split('|');
        const len = items.reduce((a, c) => a + (c.length || 0), 0);
        const laid = items.reduce((a, c) => a + Math.min(c.installed || 0, c.length || 0), 0);
        const discDone = items.filter(c => c.disconnected === 'Да').length;
        const paused = items.filter(c => c.last_completed === false).length;
        const pct = len ? laid / len : 0;
        const open = openGroups.has(key) || !!search || onlyPaused;
        const r = readiness[readinessKey('cable', sec, sys)];
        const ok = isReady(r);
        return (
          <div key={key} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden">
            <button onClick={() => toggleGroup(key)} className="w-full flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-left">
              <span className={`text-blue-700 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
              <span className="font-medium text-sm text-blue-900 dark:text-blue-300 flex-1">{section === 'all' ? <span className="text-[11px] text-slate-500 mr-1">{sec}</span> : null}{sys}</span>
              <span className={`badge ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>
                {ok ? '✓ допуск' : `⛔ нет допуска ${readyCount(r)}/6`}
              </span>
              {paused > 0 && <span className="badge bg-amber-100 text-amber-700 border-amber-300">⏸ {paused}</span>}
              <span className="text-[11px] text-slate-500 hidden sm:inline">{items.length} каб. · {fmtNum(laid)}/{fmtNum(len)} м · расключено {discDone}/{items.length}</span>
              <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden hidden sm:inline-block">
                <span className="block h-full bg-emerald-500" style={{ width: `${Math.round(pct * 100)}%` }} />
              </span>
            </button>
            {open && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 w-8">№</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Обозначение</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Откуда</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Куда</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Способ прокладки</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Труба</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Марка</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Сечение</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-right">Длина, м</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-right">Проложено, м</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-right">Остаток, м</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">Статус</th>
                      <th className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c, i) => {
                      const rem = Math.max(0, (c.length || 0) - (c.installed || 0));
                      const done = (c.installed || 0) >= (c.length || 0) && (c.length || 0) > 0;
                      return (
                        <tr key={c.id} className={`align-top ${done ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : c.last_completed === false ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-400">{i + 1}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 font-mono font-semibold whitespace-nowrap">{c.tag}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 min-w-[180px]">{c.start_point}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 min-w-[180px]">{c.end_point}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">{c.method}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 whitespace-nowrap">{c.diam}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 whitespace-nowrap">{c.brand}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 whitespace-nowrap">{c.wires}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-right">{fmtNum(c.length)}</td>
                          <td className={`px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-right font-semibold ${done ? 'text-emerald-600' : ''}`}>{fmtNum(c.installed)}</td>
                          <td className={`px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-right ${rem > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{fmtNum(rem)}</td>
                          <td className="px-2 py-1.5 border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col gap-1 items-start">
                              <button onClick={() => toggleDisc(c)} className={`badge ${statusClass(c.disconnected)}`}>
                                {c.disconnected === 'Да' ? '✓ расключен' : c.disconnected === 'Частично' ? 'частично' : 'не расключен'}
                              </button>
                              {c.last_completed === false && (
                                <span className="badge bg-amber-100 text-amber-700 border-amber-300" title="Трасса не проложена до конца">⏸ {c.last_stop_reason}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-1 py-1 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            <button title="Добавить прокладку" className="icon-btn" onClick={() => openAdd(c)}>{ok ? '➕' : '🔒'}</button>
                            <button title="История" className="icon-btn" onClick={() => setModal({ kind: 'history', cable: c })}>🕓</button>
                            {me && me.role !== 'installer' && (
                              <button title="Изменить данные" className="icon-btn" onClick={() => setModal({ kind: 'edit', cable: c })}>✏️</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {groups.size === 0 && <div className="text-center text-slate-400 py-16 text-sm">Ничего не найдено</div>}

      {modal && modal.kind === 'blocked' && (
        <BlockedModal title={`${modal.cable.section} · ${modal.cable.system}`} missing={missingMarkers(readyFor(modal.cable))} onClose={() => setModal(null)} />
      )}
      {modal && modal.kind === 'add' && (
        <AddCableModal cable={modal.cable} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal && modal.kind === 'edit' && (
        <EditCableModal cable={modal.cable} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal && modal.kind === 'history' && (
        <HistoryModal cableId={modal.cable.id} title={modal.cable.tag} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-[min(440px,92vw)] max-h-[85vh] overflow-auto shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function BlockedModal({ title, missing, onClose }: { title: string; missing: string[]; onClose: () => void }) {
  return (
    <ModalShell title="⛔ Монтаж не разрешён" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-slate-600 dark:text-slate-300">По фронту <b>{title}</b> нет допуска к монтажу. Не выполнено:</div>
        <ul className="space-y-1">
          {missing.map(m => <li key={m} className="text-rose-600">✕ {m}</li>)}
        </ul>
        <div className="text-xs text-slate-500">Маркеры отмечает инженер или администратор в разделе «Допуск».</div>
        <Link href="/readiness" className="btn-primary block text-center">Перейти в «Допуск»</Link>
      </div>
    </ModalShell>
  );
}

function AddCableModal({ cable, onClose, onSaved }: { cable: Cable; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const remaining = Math.max(0, (cable.length || 0) - (cable.installed || 0));
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // подсказка: если метраж закрывает остаток — по умолчанию «до конца»
  const q = parseFloat(qty) || 0;
  const effectiveCompleted = completed === null ? (q > 0 && q >= remaining) : completed;

  async function save() {
    if (!q) { setErr('Укажите, сколько метров проложено'); return; }
    if (!effectiveCompleted && !reason) { setErr('Укажите причину, почему трасса не проложена до конца'); return; }
    setSaving(true); setErr('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('cable_logs').insert({
      cable_id: cable.id, qty: q, date, user_id: user?.id, note,
      completed: effectiveCompleted, stop_reason: effectiveCompleted ? null : reason,
    });
    setSaving(false);
    if (error) { setErr('Не сохранилось: ' + error.message); return; }
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={`Прокладка — ${cable.tag}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-slate-500">{cable.start_point} → {cable.end_point}</div>
        <div className="text-slate-500">{cable.brand} {cable.wires} · проложено {fmtNum(cable.installed)} из {fmtNum(cable.length)} м · <b>остаток {fmtNum(remaining)} м</b></div>
        {cable.last_completed === false && <div className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 rounded-lg px-3 py-2">Прошлый раз остановились: {cable.last_stop_reason}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-slate-500">Дата</span><input type="date" className="inp mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-slate-500">Проложили сегодня, м</span><input type="number" className="inp mt-1" value={qty} onChange={e => setQty(e.target.value)} autoFocus /></label>
        </div>

        <div>
          <span className="text-xs text-slate-500">Трасса проложена до конца?</span>
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setCompleted(true)} className={`flex-1 badge py-1.5 ${effectiveCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'border-slate-300 text-slate-500'}`}>✓ Да, до конца</button>
            <button type="button" onClick={() => setCompleted(false)} className={`flex-1 badge py-1.5 ${!effectiveCompleted ? 'bg-amber-100 text-amber-700 border-amber-300' : 'border-slate-300 text-slate-500'}`}>⏸ Нет, остановились</button>
          </div>
        </div>

        {!effectiveCompleted && (
          <div>
            <span className="text-xs text-slate-500">Причина</span>
            <div className="grid gap-1 mt-1">
              {STOP_REASONS.map(r => (
                <label key={r} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer ${reason === r ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="block"><span className="text-xs text-slate-500">Комментарий</span><input className="inp mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder={effectiveCompleted ? 'необязательно' : 'например: что именно мешает'} /></label>
        {err && <div className="text-xs text-rose-600">{err}</div>}
        <button disabled={saving} onClick={save} className="btn-primary w-full">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </div>
    </ModalShell>
  );
}

function EditCableModal({ cable, onClose, onSaved }: { cable: Cable; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [brand, setBrand] = useState(cable.brand || '');
  const [wires, setWires] = useState(cable.wires || '');
  const [length, setLength] = useState(String(cable.length || 0));
  const [start, setStart] = useState(cable.start_point || '');
  const [end, setEnd] = useState(cable.end_point || '');
  const [method, setMethod] = useState(cable.method || '');
  const [diam, setDiam] = useState(cable.diam || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('cables').update({
      brand, wires, length: parseFloat(length) || 0, start_point: start, end_point: end, method, diam,
    }).eq('id', cable.id);
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={`Изменить данные — ${cable.tag}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <label className="block"><span className="text-xs text-slate-500">Марка</span><input className="inp mt-1" value={brand} onChange={e => setBrand(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Сечение</span><input className="inp mt-1" value={wires} onChange={e => setWires(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Длина по проекту, м</span><input type="number" className="inp mt-1" value={length} onChange={e => setLength(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Откуда</span><input className="inp mt-1" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Куда</span><input className="inp mt-1" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Способ прокладки</span><input className="inp mt-1" value={method} onChange={e => setMethod(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Труба</span><input className="inp mt-1" value={diam} onChange={e => setDiam(e.target.value)} /></label>
        <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">Правки видят все — используются вместо исходных проектных данных.</div>
        <button disabled={saving} onClick={save} className="btn-primary w-full">{saving ? 'Сохраняю…' : 'Сохранить'}</button>
      </div>
    </ModalShell>
  );
}

function HistoryModal({ cableId, title, onClose }: { cableId: number; title: string; onClose: () => void }) {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cable_logs')
        .select('qty,date,note,user_id,completed,stop_reason,profiles(full_name)')
        .eq('cable_id', cableId)
        .order('date', { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [cableId]);

  return (
    <ModalShell title={`История — ${title}`} onClose={onClose}>
      {loading ? <div className="text-slate-400 text-sm text-center py-6">Загрузка…</div> :
        rows.length === 0 ? <div className="text-slate-400 text-sm text-center py-6">Записей ещё нет</div> :
        <div className="space-y-1.5 max-h-[50vh] overflow-auto">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[54px_54px_1fr] gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5">
              <span>{fmtDate(r.date)}</span>
              <span className="font-medium">+{fmtNum(r.qty)}м</span>
              <span className="text-slate-500">{r.profiles?.full_name || '—'}{r.note ? ' · ' + r.note : ''}{r.completed === false ? <b className="text-amber-600"> · ⏸ {r.stop_reason}</b> : ''}</span>
            </div>
          ))}
        </div>
      }
    </ModalShell>
  );
}
