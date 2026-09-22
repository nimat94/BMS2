'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Cable, Profile } from '@/lib/types';
import { SECTIONS } from '@/lib/types';
import { fmtNum, fmtDate, todayStr, statusClass, nextStatus } from '@/lib/utils';

export default function CablesPage() {
  const supabase = createClient();
  const [cables, setCables] = useState<Cable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<Profile | null>(null);
  const [modal, setModal] = useState<null | { kind: 'add'|'edit'|'history'; cable: Cable }>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('cable_progress').select('*').order('section').order('system').order('tag');
    setCables((data || []) as Cable[]);
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
      if (!q) return true;
      return [c.tag, c.start_point, c.end_point, c.brand, c.system].join(' ').toLowerCase().includes(q);
    });
  }, [cables, search, section]);

  const groups = useMemo(() => {
    const map = new Map<string, Cable[]>();
    for (const c of filtered) {
      const key = c.section + '|' + c.system;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filtered]);

  function toggleGroup(key: string) {
    const s = new Set(openGroups);
    s.has(key) ? s.delete(key) : s.add(key);
    setOpenGroups(s);
  }

  async function toggleDisc(c: Cable) {
    const next = nextStatus(c.disconnected) as Cable['disconnected'];
    setCables(cs => cs.map(x => (x.id === c.id ? { ...x, disconnected: next } : x)));
    await supabase.from('cables').update({ disconnected: next }).eq('id', c.id);
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
        <span className="text-xs text-slate-400">{filtered.length} из {cables.length}</span>
      </div>

      {[...groups.entries()].map(([key, items]) => {
        const [sec, sys] = key.split('|');
        const len = items.reduce((a, c) => a + (c.length || 0), 0);
        const laid = items.reduce((a, c) => a + Math.min(c.installed || 0, c.length || 0), 0);
        const discDone = items.filter(c => c.disconnected === 'Да').length;
        const pct = len ? laid / len : 0;
        const open = openGroups.has(key) || !!search;
        return (
          <div key={key} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden">
            <button onClick={() => toggleGroup(key)} className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-left">
              <span className={`text-blue-700 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
              <span className="font-medium text-sm text-blue-900 dark:text-blue-300 flex-1">{sys}</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">{items.length} каб. · {fmtNum(laid)}/{fmtNum(len)} м · расключено {discDone}/{items.length}</span>
              <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden hidden sm:inline-block">
                <span className="block h-full bg-emerald-500" style={{ width: `${Math.round(pct * 100)}%` }} />
              </span>
            </button>
            {open && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs sm:text-sm odd:bg-slate-50/50 dark:odd:bg-slate-800/30">
                    <span className="font-mono font-semibold min-w-[90px]">{c.tag}</span>
                    <span className="text-slate-500 flex-1 min-w-[160px] hidden md:block">
                      <b className="text-slate-700 dark:text-slate-300">{c.start_point}</b> → <b className="text-slate-700 dark:text-slate-300">{c.end_point}</b>
                    </span>
                    <span className="text-[11px] text-slate-500 hidden lg:inline min-w-[120px]">{c.brand} {c.wires}</span>
                    <span className={`font-semibold ${(c.installed||0) >= c.length ? 'text-emerald-600' : 'text-rose-500'}`}>{fmtNum(c.installed)}/{fmtNum(c.length)} м</span>
                    <button onClick={() => toggleDisc(c)} className={`badge ${statusClass(c.disconnected)}`}>
                      {c.disconnected === 'Да' ? '✓ расключен' : c.disconnected === 'Частично' ? 'частично' : 'не расключен'}
                    </button>
                    <button title="Добавить запись" className="icon-btn" onClick={() => setModal({ kind: 'add', cable: c })}>➕</button>
                    <button title="История" className="icon-btn" onClick={() => setModal({ kind: 'history', cable: c })}>🕓</button>
                    {me && me.role !== 'installer' && (
                      <button title="Изменить" className="icon-btn" onClick={() => setModal({ kind: 'edit', cable: c })}>✏️</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {groups.size === 0 && <div className="text-center text-slate-400 py-16 text-sm">Ничего не найдено</div>}

      {modal && modal.kind === 'add' && (
        <AddCableModal cable={modal.cable} me={me} onClose={() => setModal(null)} onSaved={load} />
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

function AddCableModal({ cable, me, onClose, onSaved }: { cable: Cable; me: Profile | null; onClose: () => void; onSaved: () => void }) {
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
    await supabase.from('cable_logs').insert({ cable_id: cable.id, qty: q, date, user_id: user?.id, note });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={`Добавить прокладку — ${cable.tag}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-slate-500">{cable.start_point} → {cable.end_point}</div>
        <div className="text-slate-500">Уже проложено: {fmtNum(cable.installed)} из {fmtNum(cable.length)} м</div>
        <label className="block"><span className="text-xs text-slate-500">Дата</span><input type="date" className="inp mt-1" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-slate-500">Сколько проложили, м</span><input type="number" className="inp mt-1" value={qty} onChange={e => setQty(e.target.value)} autoFocus /></label>
        <label className="block"><span className="text-xs text-slate-500">Комментарий</span><input className="inp mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="необязательно" /></label>
        <button disabled={saving} onClick={save} className="btn-primary w-full">{saving ? 'Сохраняю…' : 'Добавить'}</button>
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
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('cables').update({
      brand, wires, length: parseFloat(length) || 0, start_point: start, end_point: end,
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
        .select('qty,date,note,user_id,profiles(full_name)')
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
              <span className="text-slate-500 truncate">{r.profiles?.full_name || '—'}{r.note ? ' · ' + r.note : ''}</span>
            </div>
          ))}
        </div>
      }
    </ModalShell>
  );
}
