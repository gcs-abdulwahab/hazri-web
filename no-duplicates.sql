-- Hazri Register: no duplicate registers.
-- The same class · section · subject can exist only once (deleted/hidden registers don't count).
-- Run once in Supabase > SQL Editor. Safe to re-run.

-- 1. Remove EMPTY duplicate copies (no students, no attendance). The oldest copy is kept.
delete from public.classes c
using (
  select id, row_number() over (partition by lower(name), lower(subject) order by created_at, id) as n
  from public.classes where archived_at is null
) d
where c.id = d.id and d.n > 1
  and not exists (select 1 from public.students s where s.class_id = c.id)
  and not exists (select 1 from public.attendance_days a where a.class_id = c.id);

-- 2. Any duplicates still listed here have students or attendance: delete the wrong copy in the app
--    (Classes > register > Students > Delete class), then run this file again.
select min(name) as name, min(subject) as subject, count(*) as copies from public.classes
where archived_at is null
group by lower(name), lower(subject) having count(*) > 1;

-- 3. From now on the database refuses duplicates.
create unique index if not exists classes_no_duplicates
  on public.classes (lower(name), lower(subject)) where archived_at is null;
