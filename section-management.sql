begin;

create unique index if not exists students_class_roll_unique
  on public.students (class_id, lower(trim(roll)))
  where nullif(trim(roll),'') is not null;

create unique index if not exists class_teachers_unique_active
  on public.class_teachers (class_id, lower(trim(teacher_email)))
  where to_day is null;

create or replace function public.is_assigned(cid uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.is_college_user() and exists (
    select 1 from public.class_teachers
    where class_id = cid
      and teacher_email = lower(auth.jwt() ->> 'email')
      and (to_day is null or to_day >= (now() at time zone 'Asia/Karachi')::date));
$$;

create or replace function public.set_marked_by() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.marked_by := lower(auth.jwt() ->> 'email');
  return new;
end $$;

drop trigger if exists attendance_marked_by on public.attendance_days;
create trigger attendance_marked_by
  before insert or update on public.attendance_days
  for each row execute function public.set_marked_by();

commit;
