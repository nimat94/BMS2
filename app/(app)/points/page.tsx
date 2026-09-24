'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/fetchAll';
import type { Point } from '@/lib/types';

export default function PointsPage() {
  const supabase = createClient();
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const data = await fetchAll(() => supabase.from('points').select('*').order('cabinet').order('id'));
    setPoints(data as Point[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return points;
    return points.filter(p => `${p.cabinet} ${p.num} ${p.io} ${p.signal}`.toLowerCase().includes(q));
  }, [points, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Point[]>();
    for (const p of filtered) { if (!map.has(p.cabinet)) map.set(p.cabinet, []); map.get(p.cabinet)!.push(p); }
    return map;
  }, [filtered]);

  async function toggle(p: Point) {
    const next = p.checked === 'Да' ? 'Нет' : 'Да';
    const { data: { user } } = await supabase.auth.getUser();
    setPoints(list => list.map(x => x.id === p.id ? { ...x, checked: next as any } : x));
    await supabase.from('points').update({ checked: next, resp_id: user?.id }).eq('id', p.id);
  }

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="inp flex-1" placeholder="Поиск по точкам…" value={search} onChange={e=>setSearch(e.target.value)} />
        <span className="text-xs text-slate-400 self-center whitespace-nowrap">{filtered.length} из {points.length}</span>
      </div>
      {[...groups.entries()].map(([cab, list]) => {
        const checkable = list.filter(p => p.signal);
        const done = checkable.filter(p => p.checked === 'Да').length;
        const isOpen = open.has(cab) || !!search;
        return (
          <div key={cab} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden">
            <button onClick={() => { const s=new Set(open); s.has(cab)?s.delete(cab):s.add(cab); setOpen(s); }} className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-left">
              <span className={`text-blue-700 transition-transform ${isOpen?'rotate-90':''}`}>▶</span>
              <span className="font-medium text-sm text-blue-900 dark:text-blue-300 flex-1">{cab}</span>
              <span className="text-[11px] text-slate-500">{done}/{checkable.length} проверено</span>
            </button>
            {isOpen && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm">
                    <span className="font-mono w-10">#{p.num}</span>
                    <span className="w-16 text-slate-500">{p.io}</span>
                    <span className="flex-1">{p.signal ? p.signal : <i className="text-slate-400">(резерв)</i>}</span>
                    {p.signal && (
                      <button onClick={() => toggle(p)} className={`badge ${p.checked==='Да' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
                        {p.checked==='Да' ? '✓ проверено' : 'не проверено'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
