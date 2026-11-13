-- Hazri Register: teachers, class assignments, and teacher access to manager-created classes.
-- Run once in Supabase → SQL Editor. Safe to re-run.
begin;

-- 1. Teacher directory -------------------------------------------------------
create table if not exists public.teachers (
  email      text primary key check (email = lower(email) and email like '%@gcslahore.edu.pk'),
  name       text not null default '',
  department text not null default '',
  added_by   text,
  created_at timestamptz not null default now()
);
alter table public.teachers add column if not exists department text not null default '';
alter table public.teachers enable row level security;
drop policy if exists teachers_read on public.teachers;
create policy teachers_read on public.teachers for select to authenticated using (public.is_college_user());
drop policy if exists teachers_manage on public.teachers;
create policy teachers_manage on public.teachers for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- 2. Which teacher teaches which register, and when ------------------------
create table if not exists public.class_teachers (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  teacher_email text not null check (teacher_email = lower(teacher_email) and teacher_email like '%@gcslahore.edu.pk'),
  from_day      date not null default current_date,
  to_day        date,
  created_by    text,
  created_at    timestamptz not null default now(),
  check (to_day is null or to_day >= from_day)
);
create index if not exists class_teachers_class_idx on public.class_teachers(class_id);
create index if not exists class_teachers_teacher_idx on public.class_teachers(teacher_email);
alter table public.class_teachers enable row level security;
drop policy if exists ct_read on public.class_teachers;
create policy ct_read on public.class_teachers for select to authenticated
  using (public.is_admin() or teacher_email = lower(auth.jwt() ->> 'email'));
drop policy if exists ct_manage on public.class_teachers;
create policy ct_manage on public.class_teachers for all to authenticated using (public.is_manager()) with check (public.is_manager());

create or replace function public.is_assigned(cid uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.is_college_user() and exists (
    select 1 from public.class_teachers where class_id = cid and teacher_email = lower(auth.jwt() ->> 'email'));
$$;
create or replace function public.is_assigned_on(cid uuid, d date) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.is_college_user() and exists (
    select 1 from public.class_teachers where class_id = cid and teacher_email = lower(auth.jwt() ->> 'email')
      and from_day <= d and (to_day is null or d <= to_day));
$$;
grant execute on function public.is_assigned(uuid), public.is_assigned_on(uuid, date) to authenticated;

-- 3. Managers manage everything; assigned teachers see their registers -------
drop policy if exists classes_manager_all on public.classes;
create policy classes_manager_all on public.classes for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists classes_teacher_read on public.classes;
create policy classes_teacher_read on public.classes for select to authenticated using (public.is_assigned(id));

drop policy if exists students_manager_all on public.students;
create policy students_manager_all on public.students for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists students_teacher_read on public.students;
create policy students_teacher_read on public.students for select to authenticated using (public.is_assigned(class_id));

drop policy if exists attendance_manager_all on public.attendance_days;
create policy attendance_manager_all on public.attendance_days for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists attendance_teacher_read on public.attendance_days;
create policy attendance_teacher_read on public.attendance_days for select to authenticated using (public.is_assigned(class_id));
drop policy if exists attendance_teacher_insert on public.attendance_days;
create policy attendance_teacher_insert on public.attendance_days for insert to authenticated with check (public.is_assigned_on(class_id, day));
drop policy if exists attendance_teacher_update on public.attendance_days;
create policy attendance_teacher_update on public.attendance_days for update to authenticated
  using (public.is_assigned_on(class_id, day)) with check (public.is_assigned_on(class_id, day));
drop policy if exists attendance_teacher_delete on public.attendance_days;
create policy attendance_teacher_delete on public.attendance_days for delete to authenticated using (public.is_assigned_on(class_id, day));

-- 4. Columns the app already uses -------------------------------------------
alter table public.attendance_days add column if not exists marked_by text;
create or replace function public.set_marked_by() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.marked_by is null then new.marked_by := lower(auth.jwt() ->> 'email'); end if;
  return new;
end $$;
drop trigger if exists attendance_marked_by on public.attendance_days;
create trigger attendance_marked_by before insert on public.attendance_days for each row execute function public.set_marked_by();

alter table public.students add column if not exists prior_present integer not null default 0;
alter table public.students add column if not exists prior_held integer not null default 0;

-- 4b. Deleting a section with students only hides it (keeps students and attendance)
alter table public.classes add column if not exists archived_at timestamptz;
create or replace function public.admin_overview()
 returns table(class_id uuid, owner_email text, class_name text, subject text, students integer, sessions integer, p integer, a integer, l integer, threshold integer, leave_as_present boolean, last_day date)
 language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
  select c.id, c.owner_email, c.name, c.subject,
    (select count(*)::int from public.students s where s.class_id = c.id),
    count(d.day)::int,
    coalesce(sum(length(d.marks) - length(replace(d.marks,'P','')))::int,0),
    coalesce(sum(length(d.marks) - length(replace(d.marks,'A','')))::int,0),
    coalesce(sum(length(d.marks) - length(replace(d.marks,'L','')))::int,0),
    c.threshold, c.leave_as_present, max(d.day)
  from public.classes c left join public.attendance_days d on d.class_id = c.id
  where c.archived_at is null
  group by c.id order by c.owner_email, c.name;
end $$;

-- 5. Logins for teachers ------------------------------------------------------
-- Creates a confirmed email+password login if the email has none. Not callable from the app directly.
create or replace function public.create_login(em text, nm text, pw text) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare uid uuid;
begin
  em := lower(trim(em));
  if exists (select 1 from auth.users where lower(email) = em) then return 'exists'; end if;
  if coalesce(length(pw), 0) < 6 then raise exception 'Password must be at least 6 characters.'; end if;
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      extensions.crypt(pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', coalesce(trim(nm), '')), now(), now(),
      '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  return 'created';
end $$;
revoke all on function public.create_login(text, text, text) from public, anon, authenticated;

-- Managers add teachers (and their login) from the app's Teachers page.
drop function if exists public.add_teacher(text, text, text);
create or replace function public.add_teacher(p_email text, p_name text, p_department text, p_password text) returns text
language plpgsql security definer set search_path to 'public' as $$
declare em text := lower(trim(p_email));
begin
  if not public.is_manager() then raise exception 'Only managers can add teachers.'; end if;
  if em !~ '^[^@\s]+@gcslahore\.edu\.pk$' then raise exception 'Use a full @gcslahore.edu.pk email.'; end if;
  insert into public.teachers (email, name, department, added_by)
    values (em, coalesce(trim(p_name), ''), coalesce(trim(p_department), ''), lower(auth.jwt() ->> 'email'))
    on conflict (email) do update set name = excluded.name, department = excluded.department;
  return public.create_login(em, p_name, p_password);
end $$;
revoke all on function public.add_teacher(text, text, text, text) from public, anon;
grant execute on function public.add_teacher(text, text, text, text) to authenticated;

-- 6. First teachers ------------------------------------------------------------
insert into public.teachers (email, name, department, added_by) values
  ('zeeshan@gcslahore.edu.pk', 'Zeeshan', 'Computer Science', 'setup'),
  ('sadaf@gcslahore.edu.pk',   'Sadaf',   'Computer Science', 'setup')
  on conflict (email) do update set name = excluded.name, department = excluded.department;
select public.create_login('sadaf@gcslahore.edu.pk', 'Sadaf', '123456');

commit;
notify pgrst, 'reload schema';
select email, name, department from public.teachers order by name;
