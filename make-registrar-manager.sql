begin;
alter table public.admins drop constraint admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('super','admin','manager'));
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@gcslahore.edu.pk', false)
     and exists (select 1 from public.admins where role in ('super','manager') and email = lower(auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_manager() to authenticated;
drop policy admins_add on public.admins;
create policy admins_add on public.admins for insert to authenticated with check (is_super() and role in ('admin','manager'));
drop policy admins_remove on public.admins;
create policy admins_remove on public.admins for delete to authenticated using (is_super() and role in ('admin','manager'));
insert into public.admins (email, role, added_by) values ('registrar@gcslahore.edu.pk','manager','abdul.wahab@gcslahore.edu.pk')
  on conflict (email) do update set role = 'manager';
commit;
select email, role from public.admins;
