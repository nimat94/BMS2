'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/client';
import type { Profile, ProjectDoc } from '@/lib/types';
import { SECTIONS } from '@/lib/types';
import { fmtDate } from '@/lib/utils';
import Sheet from '@/components/Sheet';

const BUCKET = 'projects';
const GENERAL = 'Общее';
const GROUPS = [GENERAL, ...SECTIONS];

function fmtSize(b: number | null | undefined) {
  const n = b || 0;
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' МБ';
  return Math.max(1, Math.round(n / 1024)) + ' КБ';
}

export default function ProjectsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);

  async function load() {
    setErr('');
    const { data, error } = await supabase
      .from('project_docs')
      .select('*, profiles(full_name)')
      .order('section')
      .order('code')
      .order('title');
    if (error) setErr('Ошибка загрузки: ' + error.message + ' (выполнена ли миграция migration_08_projects.sql?)');
    setDocs((data || []) as ProjectDoc[]);
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

  const canEdit = !!me && me.role !== 'installer';

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? docs.filter(d => [d.title, d.code, d.note, d.section, d.file_name].join(' ').toLowerCase().includes(q)) : docs;
    const map = new Map<string, ProjectDoc[]>();
    for (const g of GROUPS) map.set(g, []);
    for (const d of list) {
      if (!map.has(d.section)) map.set(d.section, []);
      map.get(d.section)!.push(d);
    }
    return [...map.entries()].filter(([, l]) => l.length > 0);
  }, [docs, search]);

  // Открываем PDF по временной ссылке (действует 1 час). Окно открываем сразу по нажатию,
  // иначе iPhone посчитает его всплывающим и заблокирует.
  async function open(d: ProjectDoc) {
    const w = window.open('', '_blank');
    setOpening(d.id);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.file_path, 3600);
    setOpening(null);
    if (error || !data) {
      w?.close();
      setErr('Не удалось открыть: ' + (error?.message || 'нет ссылки'));
      return;
    }
    if (w) w.location.replace(data.signedUrl);
    else window.location.assign(data.signedUrl);
  }

  async function remove(d: ProjectDoc) {
    if (!confirm(`Удалить «${d.title}»? Файл удалится для всех.`)) return;
    const { error: e1 } = await supabase.storage.from(BUCKET).remove([d.file_path]);
    if (e1) { setErr('Не удалось удалить файл: ' + e1.message); return; }
    const { error: e2 } = await supabase.from('project_docs').delete().eq('id', d.id);
    if (e2) setErr('Файл удалён, но запись осталась: ' + e2.message);
    load();
  }

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Загрузка…</div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="relative flex-1 basis-full sm:basis-auto min-w-[200px]">
          <input type="search" enterKeyHint="search" className="inp pr-10" placeholder="Поиск: название, шифр, раздел…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button aria-label="Очистить" onClick={() => setSearch('')} className="absolute right-0 top-0 h-full w-10 text-slate-400 text-lg">✕</button>}
        </div>
        {canEdit && <button className="btn-primary flex-1 sm:flex-none" onClick={() => setUploadOpen(true)}>+ Загрузить PDF</button>}
        <span className="text-xs text-slate-400 w-full sm:w-auto">{docs.length} {docs.length === 1 ? 'документ' : 'документов'}</span>
      </div>
      {err && <div className="text-xs text-rose-600 mb-3">{err}</div>}

      {docs.length === 0 && !err && (
        <div className="text-center text-slate-400 py-16 text-sm">
          Проектов пока нет.{canEdit ? ' Нажмите «+ Загрузить PDF».' : ' Их загружает инженер или администратор.'}
        </div>
      )}

      {groups.map(([sec, list]) => (
        <div key={sec} className="border border-slate-200 dark:border-slate-800 rounded-lg mb-3 overflow-hidden">
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 font-medium text-sm text-blue-900 dark:text-blue-300">
            {sec} <span className="text-[11px] font-normal text-slate-500">· {list.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-3">
                <button onClick={() => open(d)} className="flex items-center gap-3 flex-1 min-w-0 text-left group">
                  <span className="shrink-0 w-10 h-12 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-[10px] font-bold text-rose-600">PDF</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] sm:text-sm font-medium leading-snug group-hover:underline">{d.title}</span>
                    {d.code && <span className="block font-mono text-[11px] text-slate-500 break-all">{d.code}</span>}
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      {fmtSize(d.size)} · {fmtDate(d.created_at?.slice(0, 10))}{d.profiles?.full_name ? ' · ' + d.profiles.full_name : ''}{d.note ? ' · ' + d.note : ''}
                    </span>
                  </span>
                  <span className="sm:hidden shrink-0 text-2xl text-slate-300">{opening === d.id ? '…' : '›'}</span>
                </button>
                <button onClick={() => open(d)} disabled={opening === d.id} className="btn shrink-0 hidden sm:inline-flex">{opening === d.id ? '…' : 'Открыть'}</button>
                {canEdit && <button onClick={() => remove(d)} className="icon-btn shrink-0" aria-label="Удалить" title="Удалить">🗑</button>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {uploadOpen && <UploadSheet onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); load(); }} />}
    </div>
  );
}

function UploadSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [section, setSection] = useState(GENERAL);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState('');

  function pick(f: File | null) {
    setErr('');
    if (!f) return;
    if (f.type && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setErr('Нужен файл PDF'); return; }
    setFile(f);
    const base = f.name.replace(/\.pdf$/i, '');
    if (!title) setTitle(base);
    // шифр из имени файла, если он там есть (21-Р-Э01.00-…)
    const m = base.match(/\d{2}-[А-ЯA-Z]-[^\s_]+/);
    if (m && !code) setCode(m[0]);
    const s = SECTIONS.find(s => base.toUpperCase().includes(s.replace('-', '').toUpperCase()) || base.toUpperCase().includes(s.toUpperCase()));
    if (s && section === GENERAL) setSection(s);
  }

  // Загрузка напрямую в хранилище с полосой прогресса (supabase-js прогресс не показывает)
  async function upload() {
    if (!file) { setErr('Выберите PDF'); return; }
    if (!title.trim()) { setErr('Укажите название'); return; }
    setErr(''); setProgress(0);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr('Сессия истекла — войдите заново'); setProgress(null); return; }
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;

    const ok = await new Promise<boolean>(resolve => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('apikey', SUPABASE_KEY);
      xhr.setRequestHeader('Content-Type', 'application/pdf');
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve(true);
        let msg = xhr.responseText;
        try { msg = JSON.parse(xhr.responseText).message || msg; } catch { /* текст как есть */ }
        if (xhr.status === 413 || /size/i.test(msg)) msg = 'файл слишком большой для сервера';
        setErr(`Не загрузилось (${xhr.status}): ${msg}`);
        resolve(false);
      };
      xhr.onerror = () => { setErr('Обрыв связи при загрузке — попробуйте ещё раз'); resolve(false); };
      xhr.onabort = () => resolve(false);
      xhr.send(file);
    });
    xhrRef.current = null;
    if (!ok) { setProgress(null); return; }

    const { error } = await supabase.from('project_docs').insert({
      section, code: code.trim(), title: title.trim(), note: note.trim(),
      file_path: path, file_name: file.name, size: file.size,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      setErr('Не сохранилось: ' + error.message);
      setProgress(null);
      return;
    }
    onDone();
  }

  function close() {
    xhrRef.current?.abort();
    onClose();
  }

  const busy = progress !== null;

  return (
    <Sheet title="Загрузить проект (PDF)" onClose={close}
      footer={<>
        {err && <div className="text-xs text-rose-600 mb-2">{err}</div>}
        {busy && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Загрузка… не закрывайте окно</span><span>{Math.round((progress || 0) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.round((progress || 0) * 100)}%` }} />
            </div>
          </div>
        )}
        <button disabled={busy} onClick={upload} className="btn-primary w-full text-base sm:text-sm">{busy ? 'Загружаю…' : 'Загрузить'}</button>
      </>}>
      <div className="space-y-3 text-sm">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => pick(e.target.files?.[0] || null)} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-4 py-5 text-center hover:bg-slate-50 dark:hover:bg-slate-800">
          {file
            ? <><div className="font-medium break-all">📄 {file.name}</div><div className="text-xs text-slate-500 mt-1">{fmtSize(file.size)} · нажмите, чтобы выбрать другой</div></>
            : <><div className="font-medium">Выбрать PDF</div><div className="text-xs text-slate-500 mt-1">до 500 МБ</div></>}
        </button>
        <label className="block"><span className="text-xs text-slate-500">Название</span>
          <input className="inp mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="Автоматизация ОВиК, подземная часть" /></label>
        <label className="block"><span className="text-xs text-slate-500">Раздел</span>
          <select className="inp mt-1" value={section} onChange={e => setSection(e.target.value)}>
            {GROUPS.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-500">Шифр</span>
          <input className="inp mt-1 font-mono" value={code} onChange={e => setCode(e.target.value)} placeholder="21-Р-Э01.00-К00.С00-АК.АОВ.00" /></label>
        <label className="block"><span className="text-xs text-slate-500">Примечание</span>
          <input className="inp mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="изм. 2, стадия Р…" /></label>
      </div>
    </Sheet>
  );
}
