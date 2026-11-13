-- Hazri Register: monthly attendance totals.
-- The registrar (a manager) enables a month; teachers then see it and enter, for each of their
-- subject registers, the lectures delivered that month and each student's lectures attended.
-- Teachers cannot see or change months that are not enabled. Managers can always.
-- Run once in Supabase > SQL Editor. Safe to re-run.

create table if not exists public.attendance_months (
  month       text primary key check (month ~ '^\d{4}-\d{2}$'),
  open        boolean not null default false,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
alter table public.attendance_months enable row level security;
drop policy if exists am_read on public.attendance_months;
create policy am_read on public.attendance_months for select to authenticated using (public.is_college_user());
drop policy if exists am_manage on public.attendance_months;
create policy am_manage on public.attendance_months for all to authenticated using (public.is_manager()) with check (public.is_manager());

create or replace function public.month_enabled(m text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.attendance_months where month = m and open);
$$;
grant execute on function public.month_enabled(text) to authenticated;

-- One row per subject register per month. attended = {"<student id>": lectures attended}.
create table if not exists public.monthly_totals (
  class_id    uuid not null references public.classes(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  delivered   integer not null default 0 check (delivered between 0 and 500),
  attended    jsonb not null default '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (class_id, month)
);
alter table public.monthly_totals enable row level security;
drop policy if exists mt_manager_all on public.monthly_totals;
create policy mt_manager_all on public.monthly_totals for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists mt_admin_read on public.monthly_totals;
create policy mt_admin_read on public.monthly_totals for select to authenticated using (public.is_admin());
drop policy if exists mt_teacher_read on public.monthly_totals;
create policy mt_teacher_read on public.monthly_totals for select to authenticated
  using (public.is_assigned(class_id) and public.month_enabled(month));
drop policy if exists mt_teacher_insert on public.monthly_totals;
create policy mt_teacher_insert on public.monthly_totals for insert to authenticated
  with check (public.is_assigned(class_id) and public.month_enabled(month));
drop policy if exists mt_teacher_update on public.monthly_totals;
create policy mt_teacher_update on public.monthly_totals for update to authenticated
  using (public.is_assigned(class_id) and public.month_enabled(month))
  with check (public.is_assigned(class_id) and public.month_enabled(month));

-- Admins (Reports) can read every class and student.
drop policy if exists classes_admin_read on public.classes;
create policy classes_admin_read on public.classes for select to authenticated using (public.is_admin());
drop policy if exists students_admin_read on public.students;
create policy students_admin_read on public.students for select to authenticated using (public.is_admin());
