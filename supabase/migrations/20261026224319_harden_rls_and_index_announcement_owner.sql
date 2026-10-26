-- QanunHub security and performance follow-up.
create index if not exists announcements_created_by_idx
  on public.announcements (created_by);

drop policy if exists "Service role can manage audit logs" on public.audit_logs;
create policy "Service role can manage audit logs"
  on public.audit_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));
