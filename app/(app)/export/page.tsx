'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SECTIONS } from '@/lib/types';
import { todayStr, monthRange } from '@/lib/utils';

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
      const { from, to } = monthRange(month);

      const { data: cableLogs, error: e1 } = await supabase
        .from('cable_logs')
        .select('qty,date,note,cable_id,user_id,completed,stop_reason,cables(section,system,tag,start_point,end_point),profiles(full_name)')
        .gte('date', from).lt('date', to);
      if (e1) throw new Error('кабели: ' + e1.message);

      const { data: equipLogs, error: e2 } = await supabase
        .from('equipment_logs')
        .select('qty,date,note,equipment_id,user_id,equipment(section,group_name,name,unit),profiles(full_name)')
        .gte('date', from).lt('date', to);
      if (e2) throw new Error('оборудование: ' + e2.message);

      const cl = (cableLogs || []).filter((r: any) => section === 'all' || r.cables?.section === section);
      const el = (equipLogs || []).filter((r: any) => section === 'all' || r.equipment?.section === section);

      if (cl.length === 0 && el.length === 0) {
        setStatus('За этот месяц записей о монтаже нет. Записи добавляются кнопкой ➕ на вкладках «Кабели» и «Оборудование».');
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
        'Кол-во, м': Number(r.qty), 'До конца': r.completed === false ? 'Нет' : 'Да',
        'Причина остановки': r.completed === false ? (r.stop_reason || '') : '',
        'Кто': r.profiles?.full_name || '', 'Комментарий': r.note || '',
      })).sort((a, b) => String(a['Дата']).localeCompare(String(b['Дата'])));

      const equipDetailRows = (el as any[]).map(r => ({
        'Дата': r.date, 'Раздел': r.equipment?.section, 'Комплект/зона': r.equipment?.group_name,
        'Наименование': r.equipment?.name, 'Кол-во': Number(r.qty), 'Ед.изм.': r.equipment?.unit,
        'Кто': r.profiles?.full_name || '', 'Комментарий': r.note || '',
      })).sort((a, b) => String(a['Дата']).localeCompare(String(b['Дата'])));

      const wb = XLSX.utils.book_new();
      const add = (rows: any[], name: string) =>
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Нет данных': '' }]), name);
      add(cableSummaryRows, 'Свод — кабели');
      add(equipSummaryRows, 'Свод — оборудование');
      const stops: Record<string, number> = {};
      for (const r of cl as any[]) if (r.completed === false) stops[r.stop_reason || 'не указана'] = (stops[r.stop_reason || 'не указана'] || 0) + 1;
      add(Object.entries(stops).map(([k, v]) => ({ 'Причина остановки': k, 'Случаев за месяц': v })), 'Причины остановок');
      add(cableDetailRows, 'Журнал — кабели');
      add(equipDetailRows, 'Журнал — оборудование');

      const filename = `Отчёт_монтаж_${month}${section !== 'all' ? '_' + section : ''}.xlsx`;
      XLSX.writeFile(wb, filename);
      setStatus(`Готово ✓ Кабелей: ${cl.length} записей, оборудования: ${el.length} записей.`);
    } catch (e: any) {
      setStatus('Ошибка: ' + (e?.message || 'не получилось сформировать файл'));
    } finally {
      setBusy(false);
    }
  }

  async function doJournalExport() {
    setBusy(true);
    setStatus('Собираю кабельный журнал…');
    try {
      const XLSX = await import('xlsx');
      let q = supabase.from('cable_progress').select('*').order('section').order('system').order('tag');
      if (section !== 'all') q = q.eq('section', section);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data || []).map((c: any, i: number) => {
        const len = Number(c.length) || 0, inst = Number(c.installed) || 0;
        return {
          '№': i + 1, 'Раздел': c.section, 'Система/щит': c.system, 'Обозначение': c.tag,
          'Откуда': c.start_point, 'Куда': c.end_point, 'Способ прокладки': c.method, 'Труба': c.diam,
          'Марка': c.brand, 'Сечение': c.wires, 'Длина по проекту, м': len,
          'Проложено, м': inst, 'Остаток, м': Math.max(0, len - inst),
          'Расключен': c.disconnected,
          'Остановлено': c.last_completed === false ? 'Да' : '', 'Причина остановки': c.last_completed === false ? (c.last_stop_reason || '') : '',
        };
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [5, 9, 16, 14, 34, 34, 22, 14, 18, 10, 10, 10, 10, 10, 10, 26].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Кабельный журнал');
      XLSX.writeFile(wb, `Кабельный_журнал${section !== 'all' ? '_' + section : ''}_${todayStr()}.xlsx`);
      setStatus(`Готово ✓ ${rows.length} кабелей.`);
    } catch (e: any) {
      setStatus('Ошибка: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  }

  async function doAttendanceExport() {
    setBusy(true);
    setStatus('Собираю данные по посещаемости…');
    try {
      const XLSX = await import('xlsx');
      const { from, to } = monthRange(month);
      const { data, error } = await supabase
        .from('attendance')
        .select('date,section,hours,note,profiles(full_name,position)')
        .gte('date', from).lt('date', to).order('date');
      if (error) throw new Error(error.message);
      const rows = (data || []).map((r: any) => ({
        'Дата': r.date, 'ФИО': r.profiles?.full_name, 'Должность': r.profiles?.position,
        'Раздел/участок': r.section, 'Часов': r.hours, 'Примечание': r.note,
      }));
      if (rows.length === 0) { setStatus('За этот месяц отметок посещаемости нет.'); setBusy(false); return; }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Посещаемость');
      XLSX.writeFile(wb, `Посещаемость_${month}.xlsx`);
      setStatus(`Готово ✓ ${rows.length} отметок.`);
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
      <button disabled={busy} onClick={doJournalExport} className="btn w-full mb-2">Скачать кабельный журнал целиком с прогрессом (.xlsx)</button>
      <button disabled={busy} onClick={doAttendanceExport} className="btn w-full">Скачать отчёт по посещаемости (.xlsx)</button>
      {status && <div className="mt-3 text-xs text-slate-500">{status}</div>}
    </div>
  );
}
