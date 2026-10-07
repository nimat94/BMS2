-- ============================================================
-- Миграция 09: вход по телефону + сброс пароля администратором
-- Выполнять от supabase_admin:
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < migration_09_phone_login.sql
-- Повторный запуск безопасен.
-- Регистрация по телефону без SMS включается в .env сервера:
--   ENABLE_PHONE_SIGNUP=true, ENABLE_PHONE_AUTOCONFIRM=true
-- ============================================================

-- новый пользователь → профиль; теперь сохраняем и телефон (у монтажников нет email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    case when coalesce(new.phone, '') = '' then '' else '+' || new.phone end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- телефон из учётной записи в профиль, где он не заполнен
update public.profiles p set phone = '+' || u.phone
from auth.users u
where u.id = p.id and coalesce(u.phone, '') <> '' and coalesce(p.phone, '') = '';

-- Администратор задаёт пользователю новый пароль (почты нет — восстановить сам он не может)
create or replace function public.admin_set_password(target uuid, new_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Менять пароли может только администратор';
  end if;
  if length(coalesce(new_password, '')) < 6 then
    raise exception 'Пароль — минимум 6 символов';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = target;
  if not found then
    raise exception 'Пользователь не найден';
  end if;
end;
$$;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
