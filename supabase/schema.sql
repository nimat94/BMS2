-- ============================================================
-- Схема БД для "Контроль монтажа — МФК Фрунзенская наб."
-- Выполнить целиком в Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- ПРОФИЛИ (личный кабинет: ФИО, должность, роль) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  position text default '',       -- должность: монтажник, инженер ПНР, прораб...
  phone text default '',
  role text not null default 'installer' check (role in ('admin','engineer','installer')),
  created_at timestamptz default now()
);

-- автосоздание профиля при регистрации пользователя
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- МАСТЕР-ДАННЫЕ ПРОЕКТА ----------
create table if not exists cables (
  id bigint generated always as identity primary key,
  section text not null,
  system text not null,
  tag text not null,
  start_point text,
  end_point text,
  brand text,
  wires text,
  length numeric default 0,
  method text,
  diam text,
  disconnected text not null default 'Нет' check (disconnected in ('Да','Нет','Частично')),
  updated_at timestamptz default now(),
  unique(section, tag)
);

create table if not exists equipment (
  id bigint generated always as identity primary key,
  section text not null,
  group_name text,
  pos text,
  name text,
  model text,
  supplier text,
  unit text,
  qty numeric default 0,
  updated_at timestamptz default now()
);

create table if not exists shields (
  id bigint generated always as identity primary key,
  section text not null,
  type text,
  tag text not null,
  purpose text,
  place text,
  model text,
  qty numeric default 1,
  postavlen text not null default 'Нет' check (postavlen in ('Да','Нет','Частично')),
  ustanovlen text not null default 'Нет' check (ustanovlen in ('Да','Нет','Частично')),
  k_prol text not null default 'Нет' check (k_prol in ('Да','Нет','Частично')),
  k_raskl text not null default 'Нет' check (k_raskl in ('Да','Нет','Частично')),
  pnr text not null default 'Нет' check (pnr in ('Да','Нет','Частично')),
  resp_id uuid references profiles(id),
  resp_date date,
  unique(section, tag)
);

create table if not exists points (
  id bigint generated always as identity primary key,
  cabinet text not null,
  num text,
  io text,
  signal text,
  checked text not null default 'Нет' check (checked in ('Да','Нет','Частично')),
  resp_id uuid references profiles(id)
);

-- ---------- ЖУРНАЛЫ (история монтажа — по датам, без ограничений на объём) ----------
create table if not exists cable_logs (
  id bigint generated always as identity primary key,
  cable_id bigint not null references cables(id) on delete cascade,
  qty numeric not null,
  date date not null default current_date,
  user_id uuid references profiles(id),
  note text default '',
  created_at timestamptz default now()
);

create table if not exists equipment_logs (
  id bigint generated always as identity primary key,
  equipment_id bigint not null references equipment(id) on delete cascade,
  qty numeric not null,
  date date not null default current_date,
  user_id uuid references profiles(id),
  note text default '',
  created_at timestamptz default now()
);

-- ---------- ПОСЕЩАЕМОСТЬ ОБЪЕКТА ----------
create table if not exists attendance (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id),
  date date not null default current_date,
  section text,
  hours numeric,             -- часов на объекте (необязательно)
  note text default '',
  created_at timestamptz default now(),
  unique(user_id, date, section)
);

-- ---------- ПРЕДСТАВЛЕНИЯ: текущий прогресс (сумма по журналам) ----------
create or replace view cable_progress as
select c.*, coalesce(sum(l.qty),0)::numeric as installed
from cables c
left join cable_logs l on l.cable_id = c.id
group by c.id;

create or replace view equipment_progress as
select e.*, coalesce(sum(l.qty),0)::numeric as installed
from equipment e
left join equipment_logs l on l.equipment_id = e.id
group by e.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table cables enable row level security;
alter table equipment enable row level security;
alter table shields enable row level security;
alter table points enable row level security;
alter table cable_logs enable row level security;
alter table equipment_logs enable row level security;
alter table attendance enable row level security;

-- profiles: все авторизованные читают все профили (чтобы видеть имена),
-- каждый правит только свой; роль/should себе никто не повышает через приложение
-- (менять роль — только вручную в Supabase Table Editor администратором БД)
create policy "profiles_select_all" on profiles for select to authenticated using (true);
create policy "profiles_update_own" on profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert to authenticated with check (auth.uid() = id);

-- мастер-данные: читают все авторизованные; редактируют (UPDATE) все —
-- разграничение "кто может менять марку/длину" сделано на уровне интерфейса
-- (кнопка редактирования видна только role IN ('admin','engineer')).
-- При необходимости ужесточить на уровне БД — см. README, раздел "Усиление прав".
create policy "cables_select" on cables for select to authenticated using (true);
create policy "cables_update" on cables for update to authenticated using (true);
create policy "equipment_select" on equipment for select to authenticated using (true);
create policy "equipment_update" on equipment for update to authenticated using (true);
create policy "shields_select" on shields for select to authenticated using (true);
create policy "shields_update" on shields for update to authenticated using (true);
create policy "points_select" on points for select to authenticated using (true);
create policy "points_update" on points for update to authenticated using (true);

-- журналы: читают все, добавляет каждый только от своего имени
create policy "cable_logs_select" on cable_logs for select to authenticated using (true);
create policy "cable_logs_insert" on cable_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "equipment_logs_select" on equipment_logs for select to authenticated using (true);
create policy "equipment_logs_insert" on equipment_logs for insert to authenticated with check (auth.uid() = user_id);

-- посещаемость: свою запись создаёт/правит любой, читают все (для отчётов и прораба)
create policy "attendance_select" on attendance for select to authenticated using (true);
create policy "attendance_insert_own" on attendance for insert to authenticated with check (auth.uid() = user_id);
create policy "attendance_update_own" on attendance for update to authenticated using (auth.uid() = user_id);
create policy "attendance_delete_own" on attendance for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
-- Индексы для скорости на больших журналах
-- ============================================================
create index if not exists idx_cable_logs_cable on cable_logs(cable_id);
create index if not exists idx_cable_logs_date on cable_logs(date);
create index if not exists idx_equipment_logs_equipment on equipment_logs(equipment_id);
create index if not exists idx_equipment_logs_date on equipment_logs(date);
create index if not exists idx_attendance_date on attendance(date);
create index if not exists idx_cables_section on cables(section);
create index if not exists idx_equipment_section on equipment(section);
