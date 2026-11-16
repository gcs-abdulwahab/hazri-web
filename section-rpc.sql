
create or replace function public.create_section(
  p_name text,
  p_subjects text[]
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_name text := trim(p_name);
begin
  if not public.is_manager() then
    raise exception 'Only managers can create sections.';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'Section name cannot be blank.';
  end if;

  if p_subjects is null or cardinality(p_subjects) = 0 then
    raise exception 'At least one subject is required.';
  end if;

  if exists (
    select 1
    from public.classes c
    join unnest(p_subjects) as s on lower(trim(c.subject)) = lower(trim(s))
    where lower(trim(c.name)) = lower(v_name)
      and c.archived_at is null
  ) then
    raise exception 'A class with name "%" and one of the specified subjects already exists.', v_name;
  end if;

  insert into public.classes (
    id, name, subject, threshold, leave_as_present, next_idx, created_at, owner, owner_email, archived_at
  )
  select
    gen_random_uuid(),
    v_name,
    trim(s),
    75,
    false,
    0,
    now(),
    auth.uid(),
    lower(auth.jwt() ->> 'email'),
    null
  from unnest(p_subjects) as s;
end;
$$;
grant execute on function public.create_section(text, text[]) to authenticated;


create or replace function public.rename_section(
  p_old text,
  p_new text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_old text := trim(p_old);
  v_new text := trim(p_new);
begin
  if not public.is_manager() then
    raise exception 'Only managers can rename sections.';
  end if;

  if v_new is null or v_new = '' then
    raise exception 'New section name cannot be blank.';
  end if;

  if lower(v_old) = lower(v_new) then
    return;
  end if;

  if exists (
    select 1
    from public.classes old_c
    join public.classes new_c
      on lower(trim(new_c.subject)) = lower(trim(old_c.subject))
     and new_c.archived_at is null
     and lower(trim(new_c.name)) = lower(v_new)
    where lower(trim(old_c.name)) = lower(v_old)
      and old_c.archived_at is null
  ) then
    raise exception 'Cannot rename: a section with name "%" already has conflicting subjects.', v_new;
  end if;

  update public.classes
  set name = v_new
  where lower(trim(name)) = lower(v_old)
    and archived_at is null;
end;
$$;
grant execute on function public.rename_section(text, text) to authenticated;


create or replace function public.archive_section(
  p_name text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_name text := trim(p_name);
begin
  if not public.is_manager() then
    raise exception 'Only managers can archive sections.';
  end if;

  update public.classes
  set archived_at = now()
  where lower(trim(name)) = lower(v_name)
    and archived_at is null;
end;
$$;
grant execute on function public.archive_section(text) to authenticated;


create or replace function public.add_student(
  p_section text,
  p_roll text,
  p_name text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_sec text := trim(p_section);
  v_roll text := trim(p_roll);
  v_name text := coalesce(trim(p_name), '');
  r_class record;
  v_found boolean := false;
begin
  if not public.is_manager() then
    raise exception 'Only managers can add students.';
  end if;

  if v_roll is null or v_roll = '' then
    raise exception 'Roll number cannot be blank.';
  end if;

  -- Check for duplicate roll within active registers of this section
  if exists (
    select 1
    from public.students s
    where s.class_id in (
      select c.id from public.classes c
      where lower(trim(c.name)) = lower(v_sec)
        and c.archived_at is null
    )
    and lower(trim(s.roll)) = lower(v_roll)
  ) then
    raise exception 'Student with roll "%" already exists in section "%".', v_roll, v_sec;
  end if;

  for r_class in
    select id, next_idx
    from public.classes
    where lower(trim(name)) = lower(v_sec)
      and archived_at is null
    order by id
    for update
  loop
    v_found := true;
    insert into public.students (
      id, class_id, idx, roll, name, prior_present, prior_held
    ) values (
      gen_random_uuid(), r_class.id, r_class.next_idx, v_roll, v_name, 0, 0
    );

    update public.classes
    set next_idx = next_idx + 1
    where id = r_class.id;
  end loop;

  if not v_found then
    raise exception 'Section "%" not found or has no active registers.', v_sec;
  end if;
end;
$$;
grant execute on function public.add_student(text, text, text) to authenticated;


-- Note: Student removal preserves idx positions for existing attendance marks,
-- but removal drops the student from reports once attendance exists.
create or replace function public.remove_student(
  p_section text,
  p_roll text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_sec text := trim(p_section);
  v_roll text := trim(p_roll);
begin
  if not public.is_manager() then
    raise exception 'Only managers can remove students.';
  end if;

  if v_roll is null or v_roll = '' then
    raise exception 'Roll number cannot be blank.';
  end if;

  delete from public.students
  where class_id in (
    select id from public.classes
    where lower(trim(name)) = lower(v_sec)
      and archived_at is null
  )
  and lower(trim(roll)) = lower(v_roll);
end;
$$;
grant execute on function public.remove_student(text, text) to authenticated;


create or replace function public.assign_teacher(
  p_section text,
  p_email text,
  p_from date,
  p_subjects text[] default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_sec text := trim(p_section);
  v_email text := lower(trim(p_email));
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Karachi')::date);
  r_class record;
begin
  if not public.is_manager() then
    raise exception 'Only managers can assign teachers.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Teacher email cannot be blank.';
  end if;

  for r_class in
    select id, subject
    from public.classes
    where lower(trim(name)) = lower(v_sec)
      and archived_at is null
      and (
        p_subjects is null
        or cardinality(p_subjects) = 0
        or lower(trim(subject)) = any(select lower(trim(s)) from unnest(p_subjects) s)
      )
  loop
    if not exists (
      select 1 from public.class_teachers
      where class_id = r_class.id
        and lower(trim(teacher_email)) = v_email
        and to_day is null
    ) then
      insert into public.class_teachers (
        id, class_id, teacher_email, from_day, to_day, created_by, created_at
      ) values (
        gen_random_uuid(),
        r_class.id,
        v_email,
        v_from,
        null,
        lower(auth.jwt() ->> 'email'),
        now()
      );
    end if;
  end loop;
end;
$$;
grant execute on function public.assign_teacher(text, text, date, text[]) to authenticated;


create or replace function public.unassign_teacher(
  p_section text,
  p_email text,
  p_subjects text[] default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_sec text := trim(p_section);
  v_email text := lower(trim(p_email));
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  r_asg record;
begin
  if not public.is_manager() then
    raise exception 'Only managers can unassign teachers.';
  end if;

  for r_asg in
    select ct.id, ct.from_day
    from public.class_teachers ct
    join public.classes c on c.id = ct.class_id
    where lower(trim(c.name)) = lower(v_sec)
      and c.archived_at is null
      and lower(trim(ct.teacher_email)) = v_email
      and (ct.to_day is null or ct.to_day >= v_today)
      and (
        p_subjects is null
        or cardinality(p_subjects) = 0
        or lower(trim(c.subject)) = any(select lower(trim(s)) from unnest(p_subjects) s)
      )
    for update of ct
  loop
    if r_asg.from_day >= v_today then
      delete from public.class_teachers where id = r_asg.id;
    else
      update public.class_teachers
      set to_day = v_today - 1
      where id = r_asg.id;
    end if;
  end loop;
end;
$$;
grant execute on function public.unassign_teacher(text, text, text[]) to authenticated;


  p_class uuid,
  p_day date,
  p_changes jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_next_idx integer;
  v_marks text;
  v_idx integer;
  v_char text;
  r_change record;
begin
  select next_idx into v_next_idx
  from public.classes
  where id = p_class;

  if not found then
    raise exception 'Class % not found.', p_class;
  end if;

  v_next_idx := coalesce(v_next_idx, 0);

  -- Insert row if missing (marked_by populated by DB trigger)
  insert into public.attendance_days (class_id, day, marks, updated_at)
  values (p_class, p_day, repeat('-', v_next_idx), now())
  on conflict (class_id, day) do nothing;

  -- Lock row for update
  select marks into v_marks
  from public.attendance_days
  where class_id = p_class and day = p_day
  for update;

  if v_marks is null then
    v_marks := repeat('-', v_next_idx);
  elsif length(v_marks) < v_next_idx then
    v_marks := v_marks || repeat('-', v_next_idx - length(v_marks));
  end if;

  -- Apply only the changed students
  if p_changes is not null then
    for r_change in
      select key::uuid as sid, value#>>'{}' as val
      from jsonb_each(p_changes)
    loop
      select idx into v_idx
      from public.students
      where id = r_change.sid and class_id = p_class;

      if found and v_idx is not null and v_idx >= 0 then
        if length(v_marks) <= v_idx then
          v_marks := rpad(v_marks, v_idx + 1, '-');
        end if;

        v_char := case
          when upper(trim(r_change.val)) in ('P', 'A', 'L') then upper(trim(r_change.val))
          else '-'
        end;

        -- overlay position is 1-based
        v_marks := overlay(v_marks placing v_char from (v_idx + 1) for 1);
      end if;
    end loop;
  end if;

  -- Ensure padded to classes.next_idx
  if length(v_marks) < v_next_idx then
    v_marks := rpad(v_marks, v_next_idx, '-');
  end if;

  update public.attendance_days
  set marks = v_marks,
      updated_at = now()
  where class_id = p_class and day = p_day;
end;
$$;
grant execute on function public.save_day(uuid, date, jsonb) to authenticated;


create or replace function public.save_month(
  p_class uuid,
  p_month text,
  p_delivered integer,
  p_changes jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_attended jsonb;
  r_change record;
begin
  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month format: %. Expected YYYY-MM.', p_month;
  end if;

  if p_delivered is null or p_delivered < 0 or p_delivered > 500 then
    raise exception 'Lectures delivered must be between 0 and 500.';
  end if;

  -- Insert if missing
  insert into public.monthly_totals (
    class_id, month, delivered, attended, updated_by, updated_at
  ) values (
    p_class, p_month, p_delivered, '{}'::jsonb, lower(auth.jwt() ->> 'email'), now()
  )
  on conflict (class_id, month) do nothing;

  -- Lock row for update
  select attended into v_attended
  from public.monthly_totals
  where class_id = p_class and month = p_month
  for update;

  v_attended := coalesce(v_attended, '{}'::jsonb);

  if p_changes is not null then
    for r_change in
      select key, value
      from jsonb_each(p_changes)
    loop
      if r_change.value is null or jsonb_typeof(r_change.value) = 'null' or r_change.value#>>'{}' = '' then
        v_attended := v_attended - r_change.key;
      else
        v_attended := jsonb_set(v_attended, array[r_change.key], r_change.value);
      end if;
    end loop;
  end if;

  update public.monthly_totals
  set delivered = p_delivered,
      attended = v_attended,
      updated_by = lower(auth.jwt() ->> 'email'),
      updated_at = now()
  where class_id = p_class and month = p_month;
end;
$$;
grant execute on function public.save_month(uuid, text, integer, jsonb) to authenticated;
