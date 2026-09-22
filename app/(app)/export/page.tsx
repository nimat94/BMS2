'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SECTIONS } from '@/lib/types';
import { todayStr } from '@/lib/utils';

export default function ExportPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function doExport() {
    setBusy(true);
    setStatus('Собираю данные…');
    try {
      const XLSX = await import('xlsx');
      const from = month + '-01';
      const to = month + '-31';

      let cq = supabase.from('cable_logs').select('qty,date,note,cable_id,user_id,cables(section,system,tag,start_point,end_point),profiles(full_name)').gte('date', from).lte('date', to);
      let eq = supabase.from('equipment_logs').select('qty,date,note,equipment_id,user_id,equipment(section,group_name,name,unit),profiles(full_name)').gte('date', from).lte('date', to);
      const { data: cableLogs } = await cq;
      const { data: equipLogs } = await eq;

      let cl = (cableLogs || []).filter((r: any) => section === 'all' || r.cables?.section === section);
      let el = (equipLogs || []).filter((r: any) => section === 'all' || r.equipment?.section === section);

      if (cl.length === 0 && el.length === 0) {
        setStatus('За этот месяц записей не найдено — нечего выгружать.');
        setBusy(false);
        return;
      }

      setStatus('Формирую таблицы…');

      const cableSummary: Record<string, number> = {};
      for (const r of cl as any[]) {
        const key = `${r.cables?.section}|${r.cables?.system}`;
        cableSummary[key] = (cableSummary[key] || 0) + Number(r.qty);
      }
      const cableSummaryRows = Object.entries(cableSummary).map(([k, v]) => {
        const [sec, sys] = k.split('|');
        return { 'Раздел': sec, 'Система': sys, 'Проложено за месяц, м': Math.round(v * 10) / 10 };
      });

      const equipSummary: Record<string, number> = {};
      for (const r of el as any[]) {
        const key = `${r.equipment?.section}|${r.equipment?.group_name}`;
        equipSummary[key] = (equipSummary[key] || 0) + Number(r.qty);
      }
      const equipSummaryRows = Object.entries(equipSummary).map(([k, v]) => {
        const [sec, grp] = k.split('|');
        return { 'Раздел': sec, 'Комплект/зона': grp, 'Смонтировано за месяц': Math.round(v * 10) / 10 };
      });

      const cableDetailRows = (cl as any[]).map(r => ({
        'Дата': r.date, 'Раздел': r.cables?.section, 'Система': r.cables?.system,
        'Обозначение': r.cables?.tag, 'Откуда': r.cables?.start_point, 'Куда': r.cables?.end_point,
        'Кол-во, м': r.qty, 'Кто': r.profiles?.full_name || '', 'Комментарий': r.note || '',
      })).sort((a, b) => a['Дата'].localeCompare(b['Дата']));

      const equipDetailRows = (el as any[]).map(r => ({
        'Дата': r.date, 'Раздел': r.equipment?.section, 'Комплект/зона': r.equipment?.group_name,
        'Наименование': r.equipment?.name, 'Кол-во': r.qty, 'Ед.изм.': r.equipment?.unit,
        'Кто': r.profiles?.full_name || '', 'Комментарий': r.note || '',
      })).sort((a, b) => a['Дата'].localeCompare(b['Дата']));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cableSummaryRows.length ? cableSummaryRows : [{ 'Нет данных': '' }]), 'Свод — кабели');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipSummaryRows.length ? equipSummaryRows : [{ 'Нет данных': '' }]), 'Свод — оборудование');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cableDetailRows.length ? cableDetailRows : [{ 'Нет данных': '' }]), 'Журнал — кабели');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipDetailRows.length ? equipDetailRows : [{ 'Нет данных': '' }]), 'Журнал — оборудование');

      setStatus('Скачиваю файл…');
      const filename = `Отчёт_монтаж_${month}${section !== 'all' ? '_' + section : ''}.xlsx`;
      XLSX.writeFile(wb, filename);
      setStatus('Готово ✓');
    } catch (e: any) {
      setStatus('Ошибка: ' + (e?.message || 'не получилось сформировать файл'));
    } finally {
      setBusy(false);
    }
  }

  async function doAttendanceExport() {
    setBusy(true);
    setStatus('Собираю данные по посещаемости…');
    try {
      const XLSX = await import('xlsx');
      const from = month + '-01';
      const to = month + '-31';
      const { data } = await supabase.from('attendance').select('date,section,hours,note,profiles(full_name,position)').gte('date', from).lte('date', to).order('date');
      const rows = (data || []).map((r: any) => ({
        'Дата': r.date, 'ФИО': r.profiles?.full_name, 'Должность': r.profiles?.position,
        'Раздел/участок': r.section, 'Часов': r.hours, 'Примечание': r.note,
      }));
      if (rows.length === 0) { setStatus('За этот месяц отметок посещаемости нет.'); setBusy(false); return; }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Посещаемость');
      XLSX.writeFile(wb, `Посещаемость_${month}.xlsx`);
      setStatus('Готово ✓');
    } catch (e: any) {
      setStatus('Ошибка: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Выгрузка отчёта за месяц</h2>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Файл Excel: сводка проложенных кабелей и смонтированного оборудования по каждой системе,
        плюс детальный журнал — кто, что и когда монтировал.
      </p>
      <label className="block mb-3"><span className="text-xs text-slate-500">Месяц</span><input type="month" className="inp mt-1" value={month} onChange={e => setMonth(e.target.value)} /></label>
      <label className="block mb-4"><span className="text-xs text-slate-500">Раздел</span>
        <select className="inp mt-1" value={section} onChange={e => setSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button disabled={busy} onClick={doExport} className="btn-primary w-full mb-2">Скачать отчёт по монтажу (.xlsx)</button>
      <button disabled={busy} onClick={doAttendanceExport} className="btn w-full">Скачать отчёт по посещаемости (.xlsx)</button>
      {status && <div className="mt-3 text-xs text-slate-500">{status}</div>}
    </div>
  );
}
