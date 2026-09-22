'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Shield } from '@/lib/types';
import { statusClass, nextStatus, fmtDate } from '@/lib/utils';

const STAGES: { key: keyof Shield; label: string }[] = [
  { key: 'postavlen', label: 'Поставлен' },
  { key: 'ustanovlen', label: 'Установлен' },
  { key: 'k_prol', label: 'Кабели проложены' },
  { key: 'k_raskl', label: 'Кабели расключены' },
  { key: 'pnr', label: 'ПНР' },
];

export default function ShieldsPage() {
  const supabase = createClient();
  const [shields, setShields] = useState<Shield[]>([]);
  const [names, setNames] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('shields').select('*').order('section').order('tag');
    setShields((data || []) as Shield[]);
    const ids = [...new Set((data||[]).map((s:any)=>s.resp_id).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', ids);
      const m: Record<string,string> = {};
      (profs||[]).forEach((p:any)=>m[p.id]=p.full_name);
      setNames(m);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shields;
    return shields.filter(s => [s.tag, s.type, s.purpose, s.place, s.model].join(' ').toLowerCase().includes(q));
  }, [shields, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Shield[]>();
    for (const s of filtered) { if (!map.has(s.section)) map.set(s.section, []); map.get(s.section)!.push(s); }
    return map;
  }, [filtered]);

  async function toggleStage(s: Shield, key: keyof Shield) {
    const next = nextStatus(s[key] as string);
    const { data: { user } } = await supabase.auth.getUser();
    setShields(list => list.map(x => x.id === s.id ? { ...x, [key]: next, resp_id: user?.id || null, resp_date: new Date().toISOString().slice(0,10) } : x));
    await supabase.from('shields').update({ [key]: next, resp_id: user?.id, resp_date: new Date().toISOString().slice(0,10) }).eq('id', s.id);
    load();
  }

  function pct(s: Shield) {
    const v = (x:string) => x==='Да'?1:(x==='Частично'?0.5:0);
    return (v(s.postavlen)+v(s.ustanovlen)+v(s.k_prol)+v(s.k_raskl)+v(s.pnr))/5;
  }

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="inp flex-1" placeholder="Поиск по щитам…" value={search} onChange={e=>setSearch(e.target.value)} />
        <span className="text-xs text-slate-400 self-center whitespace-nowrap">{filtered.length} из {shields.length}</span>
      </div>
      {[...groups.entries()].map(([sec, list]) => (
        <div key={sec} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden">
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 font-medium text-sm text-blue-900 dark:text-blue-300">{sec} <span className="text-[11px] font-normal text-slate-500">({list.length} щит.)</span></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map(s => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-xs sm:text-sm">
                <div className="min-w-[140px]">
                  <div className="font-mono font-bold">{s.tag}</div>
                  <div className="text-[11px] text-slate-500">{s.purpose}{s.qty>1?` · ${s.qty} шт`:''}</div>
                </div>
                <div className="flex flex-wrap gap-1 flex-1">
                  {STAGES.map(st => (
                    <button key={st.key} onClick={() => toggleStage(s, st.key)} className={`badge ${statusClass(s[st.key] as string)}`}>{st.label}</button>
                  ))}
                </div>
                <span className="font-bold w-10 text-right">{Math.round(pct(s)*100)}%</span>
                {s.resp_id && <span className="text-[10px] text-slate-400 w-24">{fmtDate(s.resp_date)} {names[s.resp_id]||''}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
