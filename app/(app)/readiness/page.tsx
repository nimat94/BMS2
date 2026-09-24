'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/fetchAll';
import type { Readiness, Profile } from '@/lib/types';
import { SECTIONS, READINESS_MARKERS } from '@/lib/types';
import { readinessKey, emptyReadiness, isReady, readyCount } from '@/lib/readiness';
import { fmtDate } from '@/lib/utils';

type Front = { kind: 'cable' | 'equipment'; section: string; front: string; count: number };

export default function ReadinessPage() {
  const supabase = createClient();
  const [fronts, setFronts] = useState<Front[]>([]);
  const [map, setMap] = useState<Record<string, Readiness>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('all');
  const [kind, setKind] = useState<'cable' | 'equipment'>('cable');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setMe(data as Profile);
    }
    const cab = await fetchAll(() => supabase.from('cables').select('section,system,ord').order('section').order('ord').order('id'));
    const eq = await fetchAll(() => supabase.from('equipment').select('section,group_name,ord').order('section').order('ord').order('id'));
    const fm = new Map<string, Front>();
    for (const c of (cab || []) as any[]) {
      const k = readinessKey('cable', c.section, c.system);
      const f = fm.get(k) || { kind: 'cable', section: c.section, front: c.system, count: 0 };
      f.count++; fm.set(k, f);
    }
    for (const e of (eq || []) as any[]) {
      const g = e.group_name || '(без группы)';
      const k = readinessKey('equipment', e.section, g);
      const f = fm.get(k) || { kind: 'equipment', section: e.section, front: g, count: 0 };
      f.count++; fm.set(k, f);
    }
    setFronts([...fm.values()]);
    const { data: rd } = await supabase.from('readiness').select('*');
    const m: Record<string, Readiness> = {};
    for (const r of (rd || []) as Readiness[]) m[readinessKey(r.kind, r.section, r.front)] = r;
    setMap(m);
    const ids = [...new Set((rd || []).map((r: any) => r.updated_by).filter(Boolean))];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id,full_name').in('id', ids);
      const n: Record<string, string> = {};
      (ps || []).forEach((p: any) => (n[p.id] = p.full_name));
      setNames(n);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const canEdit = me && me.role !== 'installer';

  async function toggle(f: Front, key: keyof Readiness) {
    if (!canEdit) return;
    setErr('');
    const k = readinessKey(f.kind, f.section, f.front);
    const cur = map[k] || emptyReadiness(f.kind, f.section, f.front);
    const next = { ...cur, [key]: cur[key] === 'Да' ? 'Нет' : 'Да', updated_by: me!.id, updated_at: new Date().toISOString() } as Readiness;
    setMap(m => ({ ...m, [k]: next }));
    const { id, ...row } = next as any;
    const { error } = await supabase.from('readiness').upsert(row, { onConflict: 'kind,section,front' });
    if (error) { setErr('Не сохранилось: ' + error.message); load(); }
  }

  async function setAll(f: Front, value: 'Да' | 'Нет') {
    if (!canEdit) return;
    const k = readinessKey(f.kind, f.section, f.front);
    const cur = map[k] || emptyReadiness(f.kind, f.section, f.front);
    const next: any = { ...cur, updated_by: me!.id, updated_at: new Date().toISOString() };
    READINESS_MARKERS.forEach(mk => (next[mk.key] = value));
    setMap(m => ({ ...m, [k]: next }));
    const { id, ...row } = next;
    const { error } = await supabase.from('readiness').upsert(row, { onConflict: 'kind,section,front' });
    if (error) { setErr('Не сохранилось: ' + error.message); load(); }
  }

  const list = useMemo(() => fronts
    .filter(f => f.kind === kind)
    .filter(f => section === 'all' || f.section === section)
    .filter(f => !onlyBlocked || !isReady(map[readinessKey(f.kind, f.section, f.front)]))
    .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.front.localeCompare(b.front)),
  [fronts, kind, section, onlyBlocked, map]);

  const readyN = fronts.filter(f => f.kind === kind && isReady(map[readinessKey(f.kind, f.section, f.front)])).length;
  const totalN = fronts.filter(f => f.kind === kind).length;

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Допуск к монтажу</h2>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
        Монтаж по фронту работ разрешён, только когда все 6 маркеров = «Да». Пока допуска нет — добавить запись о монтаже нельзя.
        {!canEdit && ' Менять маркеры может инженер или администратор.'}
      </p>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-sm">
          <button onClick={() => setKind('cable')} className={`px-3 py-1.5 ${kind === 'cable' ? 'bg-blue-800 text-white' : ''}`}>Кабельные системы</button>
          <button onClick={() => setKind('equipment')} className={`px-3 py-1.5 ${kind === 'equipment' ? 'bg-blue-800 text-white' : ''}`}>Оборудование</button>
        </div>
        <select className="inp w-auto" value={section} onChange={e => setSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={onlyBlocked} onChange={e => setOnlyBlocked(e.target.checked)} /> только без допуска</label>
        <span className="text-xs text-slate-500 ml-auto">С допуском: <b>{readyN}</b> из {totalN}</span>
      </div>
      {err && <div className="text-xs text-rose-600 mb-2">{err}</div>}

      <div className="space-y-2">
        {list.map(f => {
          const k = readinessKey(f.kind, f.section, f.front);
          const r = map[k];
          const ok = isReady(r);
          return (
            <div key={k} className={`rounded-lg border px-3 py-2 ${ok ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[11px] text-slate-500 w-16">{f.section}</span>
                <span className="font-medium text-sm flex-1">{f.front} <span className="text-[11px] text-slate-400 font-normal">· {f.count} {f.kind === 'cable' ? 'каб.' : 'поз.'}</span></span>
                <span className={`badge ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>
                  {ok ? '✓ Допуск есть' : `Нет допуска (${readyCount(r)}/6)`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {READINESS_MARKERS.map(mk => {
                  const v = r ? (r as any)[mk.key] : 'Нет';
                  return (
                    <button key={mk.key} title={mk.label} disabled={!canEdit} onClick={() => toggle(f, mk.key)}
                      className={`badge ${v === 'Да' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-600 border-rose-200'} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                      {v === 'Да' ? '✓' : '✕'} {mk.short}
                    </button>
                  );
                })}
                {canEdit && (
                  <>
                    <button className="badge border-slate-300 text-slate-500" onClick={() => setAll(f, 'Да')}>всё Да</button>
                    <button className="badge border-slate-300 text-slate-500" onClick={() => setAll(f, 'Нет')}>сбросить</button>
                  </>
                )}
                {r?.updated_by && <span className="text-[10px] text-slate-400 self-center ml-1">{fmtDate(r.updated_at?.slice(0, 10))} {names[r.updated_by] || (r.updated_by === me?.id ? me?.full_name : '')}</span>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">Нет фронтов по фильтру</div>}
      </div>
    </div>
  );
}
