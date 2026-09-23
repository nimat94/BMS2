'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtNum } from '@/lib/utils';
import { SECTIONS, READINESS_MARKERS } from '@/lib/types';
import { readinessKey, isReady } from '@/lib/readiness';
import Link from 'next/link';

type SectionAgg = { section: string; len: number; laid: number };

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [totalLen, setTotalLen] = useState(0);
  const [laidLen, setLaidLen] = useState(0);
  const [bySection, setBySection] = useState<SectionAgg[]>([]);
  const [equipDone, setEquipDone] = useState(0);
  const [equipTotal, setEquipTotal] = useState(0);
  const [shieldsAvg, setShieldsAvg] = useState(0);
  const [shieldsCount, setShieldsCount] = useState(0);
  const [pointsChecked, setPointsChecked] = useState(0);
  const [pointsTotal, setPointsTotal] = useState(0);
  const [blockers, setBlockers] = useState<{ fronts: number; ready: number; byMarker: Record<string, number>; paused: Record<string, number>; pausedTotal: number }>({ fronts: 0, ready: 0, byMarker: {}, paused: {}, pausedTotal: 0 });
  const [worst, setWorst] = useState<{section:string;system:string;remaining:number;pct:number}[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cables } = await supabase.from('cable_progress').select('section,system,length,installed,last_completed,last_stop_reason');
      const { data: rd } = await supabase.from('readiness').select('*').eq('kind', 'cable');
      {
        const rmap: Record<string, any> = {};
        for (const r of (rd || []) as any[]) rmap[readinessKey('cable', r.section, r.front)] = r;
        const fronts = new Map<string, { section: string; system: string }>();
        for (const c of (cables || []) as any[]) fronts.set(c.section + '|' + c.system, { section: c.section, system: c.system });
        const byMarker: Record<string, number> = {};
        let ready = 0;
        for (const f of fronts.values()) {
          const r = rmap[readinessKey('cable', f.section, f.system)];
          if (isReady(r)) { ready++; continue; }
          for (const mk of READINESS_MARKERS) if (!r || r[mk.key] !== 'Да') byMarker[mk.label] = (byMarker[mk.label] || 0) + 1;
        }
        const paused: Record<string, number> = {};
        let pausedTotal = 0;
        for (const c of (cables || []) as any[]) if (c.last_completed === false) {
          pausedTotal++; const k = c.last_stop_reason || 'не указана'; paused[k] = (paused[k] || 0) + 1;
        }
        setBlockers({ fronts: fronts.size, ready, byMarker, paused, pausedTotal });
      }
      const { data: equip } = await supabase.from('equipment_progress').select('qty,installed');
      const { data: shields } = await supabase.from('shields').select('postavlen,ustanovlen,k_prol,k_raskl,pnr');
      const { data: points } = await supabase.from('points').select('signal,checked');

      if (cables) {
        let tl = 0, ll = 0;
        const secMap: Record<string, SectionAgg> = {};
        const sysMap: Record<string, {section:string;system:string;len:number;laid:number}> = {};
        for (const c of cables as any[]) {
          const len = Number(c.length) || 0;
          const laid = Math.min(Number(c.installed) || 0, len);
          tl += len; ll += laid;
          const s = secMap[c.section] || { section: c.section, len: 0, laid: 0 };
          s.len += len; s.laid += laid; secMap[c.section] = s;
          const key = c.section + '|' + c.system;
          const sy = sysMap[key] || { section: c.section, system: c.system, len: 0, laid: 0 };
          sy.len += len; sy.laid += laid; sysMap[key] = sy;
        }
        setTotalLen(tl); setLaidLen(ll);
        setBySection(SECTIONS.map(s => secMap[s] || { section: s, len: 0, laid: 0 }));
        const w = Object.values(sysMap)
          .map(v => ({ section: v.section, system: v.system, remaining: v.len - v.laid, pct: v.len ? v.laid / v.len : 0 }))
          .filter(v => v.remaining > 0)
          .sort((a, b) => b.remaining - a.remaining)
          .slice(0, 8);
        setWorst(w);
      }
      if (equip) {
        let done = 0;
        for (const e of equip as any[]) {
          if ((Number(e.installed) || 0) >= (Number(e.qty) || 0) && (Number(e.qty) || 0) > 0) done++;
        }
        setEquipDone(done); setEquipTotal(equip.length);
      }
      if (shields) {
        const v = (x: string) => (x === 'Да' ? 1 : x === 'Частично' ? 0.5 : 0);
        let sum = 0;
        for (const s of shields as any[]) sum += (v(s.postavlen) + v(s.ustanovlen) + v(s.k_prol) + v(s.k_raskl) + v(s.pnr)) / 5;
        setShieldsAvg(shields.length ? sum / shields.length : 0);
        setShieldsCount(shields.length);
      }
      if (points) {
        const checkable = (points as any[]).filter(p => p.signal);
        setPointsTotal(checkable.length);
        setPointsChecked(checkable.filter(p => p.checked === 'Да').length);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  const overallPct = totalLen ? laidLen / totalLen : 0;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat num={fmtNum(totalLen)} label="Всего кабеля, м" />
        <Stat num={fmtNum(laidLen)} label="Проложено, м" />
        <Stat num={fmtNum(totalLen - laidLen)} label="Остаток, м" />
        <Stat num={Math.round(overallPct * 100) + '%'} label="Готовность по кабелям" />
        <Stat num={`${equipDone}/${equipTotal}`} label="Оборудование смонтировано" />
        <Stat num={Math.round(shieldsAvg * 100) + '%'} label={`Готовность по щитам (${shieldsCount})`} />
      </div>

      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Блокеры монтажа</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <Link href="/readiness" className="block rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <div className="text-xs text-slate-500 mb-1">Допуск к монтажу (кабельные системы)</div>
          <div className="text-lg font-bold mb-2"><span className="text-emerald-600">{blockers.ready}</span> <span className="text-slate-400 text-sm font-normal">из {blockers.fronts} фронтов с допуском</span></div>
          {Object.entries(blockers.byMarker).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-rose-600">✕ {k}</span><b>{v}</b></div>
          ))}
        </Link>
        <Link href="/cables" className="block rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <div className="text-xs text-slate-500 mb-1">Трассы остановлены, не проложены до конца</div>
          <div className="text-lg font-bold mb-2 text-amber-600">⏸ {blockers.pausedTotal}</div>
          {Object.entries(blockers.paused).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs py-0.5"><span>{k}</span><b>{v}</b></div>
          ))}
          {blockers.pausedTotal === 0 && <div className="text-xs text-slate-400">Остановленных трасс нет</div>}
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Готовность по разделам</h2>
      <div className="space-y-2 mb-6">
        {bySection.map(s => {
          const pct = s.len ? s.laid / s.len : 0;
          return (
            <Link key={s.section} href="/cables" className="flex items-center gap-3 text-xs sm:text-sm hover:opacity-80">
              <span className="w-20 sm:w-24 font-medium shrink-0">{s.section}</span>
              <span className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden border border-slate-200 dark:border-slate-700">
                <span className="block h-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${Math.round(pct * 100)}%` }} />
              </span>
              <span className="w-10 text-right text-slate-500 shrink-0">{Math.round(pct * 100)}%</span>
            </Link>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Больше всего осталось (по системам)</h2>
      <div className="space-y-1.5 mb-6">
        {worst.length === 0 && <div className="text-slate-400 text-sm text-center py-6">Все кабели проложены 🎉</div>}
        {worst.map((w, i) => (
          <div key={i} className="flex justify-between text-xs sm:text-sm bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
            <span>{w.section} — {w.system}</span>
            <span><b>{fmtNum(w.remaining)} м</b> осталось ({Math.round(w.pct * 100)}%)</span>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Контрольные точки АДИС</h2>
      <Stat num={`${pointsChecked}/${pointsTotal}`} label="Точек проверено (ПНР)" />
    </div>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl px-3 py-2.5">
      <div className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-300">{num}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
