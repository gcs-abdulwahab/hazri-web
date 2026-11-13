-- Removing a teacher hides them (removed_at) instead of deleting, so they can be restored to their department.
alter table public.teachers add column if not exists removed_at timestamptz;
