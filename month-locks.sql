-- Hazri Register: closed months.
-- A manager (the registrar) closes a month after collecting its attendance.
-- Teachers then cannot see or change that month; managers still can.
-- Run once in Supabase > SQL Editor. Safe to re-run.

create table if not exists public.closed_months (
  month      text primary key check (month ~ '^\d{4}-\d{2}$'),
  closed_by  text,
  closed_at  timestamptz not null default now()
);
alter table public.closed_months enable row level security;

drop policy if exists closed_months_read on public.closed_months;
create policy closed_months_read on public.closed_months for select to authenticated using (public.is_college_user());
drop policy if exists closed_months_manage on public.closed_months;
create policy closed_months_manage on public.closed_months for all to authenticated using (public.is_manager()) with check (public.is_manager());

create or replace function public.month_open(d date) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select not exists (select 1 from public.closed_months where month = to_char(d, 'YYYY-MM'));
$$;
grant execute on function public.month_open(date) to authenticated;

-- Teachers: read, mark and change attendance only in open months.
drop policy if exists attendance_teacher_read on public.attendance_days;
create policy attendance_teacher_read on public.attendance_days for select to authenticated
  using (public.is_assigned(class_id) and public.month_open(day));
drop policy if exists attendance_teacher_insert on public.attendance_days;
create policy attendance_teacher_insert on public.attendance_days for insert to authenticated
  with check (public.is_assigned_on(class_id, day) and public.month_open(day));
drop policy if exists attendance_teacher_update on public.attendance_days;
create policy attendance_teacher_update on public.attendance_days for update to authenticated
  using (public.is_assigned_on(class_id, day) and public.month_open(day))
  with check (public.is_assigned_on(class_id, day) and public.month_open(day));
drop policy if exists attendance_teacher_delete on public.attendance_days;
create policy attendance_teacher_delete on public.attendance_days for delete to authenticated
  using (public.is_assigned_on(class_id, day) and public.month_open(day));
