-- Hazri Register: remove Library staff from the teacher list.
-- Run once in Supabase > SQL Editor.
-- Library staff have no class assignments; any they did have are ended first so history stays intact.

update public.class_teachers ct set to_day = current_date
  from public.teachers t
  where t.department = 'Library' and t.email is not null and ct.teacher_email = t.email and ct.to_day is null;

delete from public.teachers where department = 'Library' returning name, designation;
