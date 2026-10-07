-- ============================================================
-- Миграция 08: раздел «Проекты» — PDF проектной документации
-- Выполнять от supabase_admin (нужны права на схему storage):
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < migration_08_projects.sql
-- Повторный запуск безопасен.
-- ============================================================

-- кто может загружать/удалять документы: администратор или инженер
create or replace function public.is_editor()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'engineer'));
$$;
grant execute on function public.is_editor() to authenticated;

create table if not exists public.project_docs (
  id bigint generated always as identity primary key,
  section text not null default 'Общее',  -- раздел проекта (АОВ-К00, АДИС…) или «Общее»
  code text default '',                   -- шифр, например 21-Р-Э01.00-К00.С00-АК.АОВ.00
  title text not null,                    -- название документа
  note text default '',                   -- версия / изм. / комментарий
  file_path text not null unique,         -- путь в хранилище (бакет projects)
  file_name text default '',              -- исходное имя файла
  size bigint default 0,                  -- байт
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.project_docs enable row level security;
grant select, insert, update, delete on public.project_docs to authenticated;

drop policy if exists "project_docs_read" on public.project_docs;
create policy "project_docs_read" on public.project_docs for select to authenticated using (true);
drop policy if exists "project_docs_insert" on public.project_docs;
create policy "project_docs_insert" on public.project_docs for insert to authenticated with check (public.is_editor());
drop policy if exists "project_docs_update" on public.project_docs;
create policy "project_docs_update" on public.project_docs for update to authenticated using (public.is_editor());
drop policy if exists "project_docs_delete" on public.project_docs;
create policy "project_docs_delete" on public.project_docs for delete to authenticated using (public.is_editor());

-- закрытый бакет: файлы доступны только вошедшим пользователям (по временной ссылке)
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('projects', 'projects', false, array['application/pdf'])
on conflict (id) do update set public = false, allowed_mime_types = array['application/pdf'];

drop policy if exists "projects_read" on storage.objects;
create policy "projects_read" on storage.objects for select to authenticated
  using (bucket_id = 'projects');
drop policy if exists "projects_insert" on storage.objects;
create policy "projects_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'projects' and public.is_editor());
drop policy if exists "projects_delete" on storage.objects;
create policy "projects_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'projects' and public.is_editor());
