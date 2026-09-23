-- ============================================================
-- Миграция 02: допуск к монтажу, выписка материала, причины остановки
-- Выполнить ОДИН раз в Supabase → SQL Editor → New query → Run
-- (schema.sql и seed_data.sql уже должны быть выполнены ранее)
-- ============================================================

-- ---------- ДОПУСК К МОНТАЖУ (по фронту работ) ----------
-- kind: 'cable' — фронт = система кабелей; 'equipment' — фронт = комплект оборудования
create table if not exists readiness (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('cable','equipment')),
  section text not null,
  front text not null,
  stroy     text not null default 'Нет' check (stroy     in ('Да','Нет')), -- стройготовность
  smezh     text not null default 'Нет' check (smezh     in ('Да','Нет')), -- смежные разделы готовы
  materials text not null default 'Нет' check (materials in ('Да','Нет')), -- оборудование и кабель на объекте
  permit    text not null default 'Нет' check (permit    in ('Да','Нет')), -- разрешение ИТР заказчика
  docs      text not null default 'Нет' check (docs      in ('Да','Нет')), -- рабочая документация в порядке
  secured   text not null default 'Нет' check (secured   in ('Да','Нет')), -- нет риска кражи (двери, контроль доступа)
  note text default '',
  updated_by uuid references profiles(id),
  updated_at timestamptz default now(),
  unique(kind, section, front)
);

-- ---------- ВЫПИСКА МАТЕРИАЛА ----------
create table if not exists material_issues (
  id bigint generated always as identity primary key,
  section text not null,
  front text not null,           -- система / комплект
  brand text not null,           -- марка кабеля или наименование изделия
  wires text default '',         -- сечение (для кабеля)
  unit text not null default 'м',
  qty numeric not null,
  issued_to uuid references profiles(id),
  issued_by uuid references profiles(id),
  date date not null default current_date,
  note text default '',
  created_at timestamptz default now()
);

-- ---------- ПРОКЛАДКА ДО КОНЦА / ПРИЧИНА ОСТАНОВКИ ----------
alter table cable_logs add column if not exists completed boolean not null default true;
alter table cable_logs add column if not exists stop_reason text;

-- ---------- ПРЕДСТАВЛЕНИЯ (пересоздаём с новыми полями) ----------
drop view if exists cable_progress;
create view cable_progress with (security_invoker = true) as
select c.*,
  coalesce((select sum(l.qty) from cable_logs l where l.cable_id = c.id), 0)::numeric as installed,
  (select l.completed   from cable_logs l where l.cable_id = c.id order by l.date desc, l.id desc limit 1) as last_completed,
  (select l.stop_reason from cable_logs l where l.cable_id = c.id order by l.date desc, l.id desc limit 1) as last_stop_reason
from cables c;

drop view if exists equipment_progress;
create view equipment_progress with (security_invoker = true) as
select e.*, coalesce((select sum(l.qty) from equipment_logs l where l.equipment_id = e.id), 0)::numeric as installed
from equipment e;

grant select on cable_progress to authenticated;
grant select on equipment_progress to authenticated;

-- ---------- ПРАВА ----------
alter table readiness enable row level security;
alter table material_issues enable row level security;

drop policy if exists "readiness_select" on readiness;
drop policy if exists "readiness_write_itr" on readiness;
drop policy if exists "readiness_update_itr" on readiness;
create policy "readiness_select" on readiness for select to authenticated using (true);
-- менять допуск могут только инженер и администратор
create policy "readiness_write_itr" on readiness for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','engineer')));
create policy "readiness_update_itr" on readiness for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','engineer')));

drop policy if exists "material_issues_select" on material_issues;
drop policy if exists "material_issues_insert" on material_issues;
drop policy if exists "material_issues_delete" on material_issues;
create policy "material_issues_select" on material_issues for select to authenticated using (true);
create policy "material_issues_insert" on material_issues for insert to authenticated with check (auth.uid() = issued_by);
create policy "material_issues_delete" on material_issues for delete to authenticated
  using (auth.uid() = issued_by or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists idx_readiness_key on readiness(kind, section, front);
create index if not exists idx_material_issues_front on material_issues(section, front);
