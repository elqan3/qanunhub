-- QanunHub launch: student groups and subject-group mapping.
-- Keep the updated_at trigger function's search_path fixed for security.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  number smallint not null default 1 check (number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_groups_year_name_unique unique (semester_id, name)
);

create index if not exists student_groups_year_idx
  on public.student_groups (semester_id, number);

drop trigger if exists student_groups_set_updated_at on public.student_groups;
create trigger student_groups_set_updated_at
  before update on public.student_groups
  for each row execute function public.set_updated_at();

create table if not exists public.subject_groups (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  group_id uuid not null references public.student_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subject_id, group_id)
);

create index if not exists subject_groups_group_idx
  on public.subject_groups (group_id);

alter table public.student_groups enable row level security;
alter table public.subject_groups enable row level security;

drop policy if exists "Anyone can read active student groups" on public.student_groups;
create policy "Anyone can read active student groups"
  on public.student_groups for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Anyone can read subject group mappings" on public.subject_groups;
create policy "Anyone can read subject group mappings"
  on public.subject_groups for select to anon, authenticated
  using (true);
