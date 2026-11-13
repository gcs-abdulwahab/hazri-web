-- Hazri Register: class names (programmes) managed in the app, e.g. "FSc Pre-Engineering".
-- Each has its usual subjects. "core" = also add English, Urdu and Islamiat (First Year)
-- or Pakistan Studies (Second Year) when a class is created.
-- Run once in Supabase > SQL Editor. Safe to re-run: existing names are kept as they are.

create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  subjects    text[] not null default '{}',
  core        boolean not null default true,
  sort_no     integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists programs_name_unique on public.programs (lower(name));
alter table public.programs enable row level security;

drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs for select to authenticated using (public.is_college_user());
drop policy if exists programs_manage on public.programs;
create policy programs_manage on public.programs for all to authenticated using (public.is_manager()) with check (public.is_manager());

insert into public.programs (name, subjects, core, sort_no)
select v.name, v.subjects, v.core, v.sort_no
from (values
  ('FSc Pre-Engineering', array['Physics','Chemistry','Mathematics'], true, 1),
  ('FSc Pre-Medical',     array['Physics','Chemistry','Biology'], true, 2),
  ('ICS Physics',         array['Computer Science','Mathematics','Physics'], true, 3),
  ('ICS Statistics',      array['Computer Science','Mathematics','Statistics'], true, 4),
  ('ICS Economics',       array['Computer Science','Mathematics','Economics'], true, 5),
  ('I.Com',               array['Principles of Accounting','Principles of Economics','Principles of Commerce','Business Mathematics'], true, 6),
  ('Arts A1',             array[]::text[], true, 7),
  ('Arts A2',             array[]::text[], true, 8),
  ('Arts A3',             array[]::text[], true, 9),
  ('FA General Science',  array[]::text[], true, 10),
  ('FA Humanities',       array[]::text[], true, 11),
  ('DIT',                 array['Introduction to Office','Introduction to Programming','Operating System'], false, 12)
) as v(name, subjects, core, sort_no)
where not exists (select 1 from public.programs p where lower(p.name) = lower(v.name));

select name, subjects, core from public.programs order by sort_no, name;
