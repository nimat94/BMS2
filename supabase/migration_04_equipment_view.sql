-- ============================================================
-- Миграция 04: «Ответственный» и «Дата» последней записи в оборудовании
-- Выполнить ОДИН раз: Supabase → SQL Editor → New query → Run
-- ============================================================

drop view if exists equipment_progress;
create view equipment_progress with (security_invoker = true) as
select e.*,
  coalesce((select sum(l.qty) from equipment_logs l where l.equipment_id = e.id), 0)::numeric as installed,
  (select l.date from equipment_logs l where l.equipment_id = e.id order by l.date desc, l.id desc limit 1) as last_date,
  (select p.full_name from equipment_logs l join profiles p on p.id = l.user_id
     where l.equipment_id = e.id order by l.date desc, l.id desc limit 1) as last_user_name
from equipment e;

grant select on equipment_progress to authenticated;
