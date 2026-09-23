-- ============================================================
-- Миграция 03: управление ролями + email в профиле
-- Выполнить ОДИН раз: Supabase → SQL Editor → New query → Run
-- ============================================================

-- функция "текущий пользователь — администратор?"
-- (security definer — чтобы правило на таблице profiles не ссылалось само на себя)
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- администратор может менять любой профиль (в т.ч. роли)
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update to authenticated using (public.is_admin());

-- защита: менять роль может только администратор
-- (запросы из SQL Editor разрешены — там auth.uid() пустой)
create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Менять роль может только администратор';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_role on profiles;
create trigger trg_protect_role before update on profiles
  for each row execute function public.protect_role();

-- email в профиле (чтобы в списке пользователей было видно, кто есть кто)
alter table profiles add column if not exists email text default '';
update profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- НАЗНАЧИТЬ СЕБЯ АДМИНИСТРАТОРОМ:
-- раскомментируйте строку ниже (уберите два минуса в начале),
-- впишите свой email, с которым регистрировались, и нажмите Run
-- ============================================================
-- update profiles set role = 'admin' where email = 'ваш@email.ru';
