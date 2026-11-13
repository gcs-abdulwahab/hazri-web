-- Hazri Register: pending updates from 13-10-2026. Paste all of this into Supabase > SQL Editor and press Run.
-- Safe to re-run: every step skips what already exists.

-- 1. Removing a teacher hides them so they can be restored to their department.
alter table public.teachers add column if not exists removed_at timestamptz;

-- 2. Put Mr. Attiq-us-Salam back in Physics, linked to his existing login and registers.
insert into public.teachers (name, department, designation, qualification, sort_no, email)
select 'Mr. Attiq-us-Salam', 'Physics', 'Asso. Prof', 'M.Phil', 120, 'atiq@gcslahore.edu.pk'
where not exists (select 1 from public.teachers where email = 'atiq@gcslahore.edu.pk');

-- 3. Second Year classes and sections, same as First Year (without DIT).

with src as (
  select c.created_at,
         'Second Year · ' || substr(c.name, length('First Year · ') + 1) as name,
         case when lower(c.subject) = 'islamiat' then 'Pakistan Studies' else c.subject end as subject,
         c.threshold, c.leave_as_present, c.owner, c.owner_email
  from public.classes c
  where c.name like 'First Year · %' and c.archived_at is null
    and c.name not like 'First Year · DIT%'  -- DIT is a one-year course
), one as (
  -- one row per class · section · subject (the earliest), keeping First Year's order
  select distinct on (name, lower(subject)) *
  from src
  order by name, lower(subject), created_at
)
insert into public.classes (id, owner, name, subject, threshold, leave_as_present, next_idx, owner_email, created_at)
select gen_random_uuid(), v.owner, v.name, v.subject, v.threshold, v.leave_as_present, 0, v.owner_email,
       now() + (row_number() over (order by v.created_at)) * interval '1 millisecond'  -- keeps subjects in First Year's order
from one v
where not exists (
  select 1 from public.classes x
  where x.name = v.name and lower(x.subject) = lower(v.subject) and x.archived_at is null
)
order by v.created_at;

-- Check: registers per class, First Year next to Second Year.
select substr(name, strpos(name, ' · ') + 3) as class_section,
       count(*) filter (where name like 'First Year · %')  as first_year,
       count(*) filter (where name like 'Second Year · %') as second_year
from public.classes
where archived_at is null and (name like 'First Year · %' or name like 'Second Year · %')
group by 1 order by 1;
