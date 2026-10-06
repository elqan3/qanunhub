-- ============================================================
-- QanunHub
-- Migration 001: Core Schema
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

create type public.user_role as enum (
  'student',
  'moderator',
  'admin',
  'owner'
);

create type public.file_type as enum (
  'document',
  'image',
  'video',
  'audio',
  'other'
);

-- ============================================================
-- UPDATED_AT HELPER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- SEMESTERS
-- ============================================================

create table public.semesters (
  id uuid primary key default gen_random_uuid(),

  number smallint not null,
  name text not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint semesters_number_positive
    check (number > 0),

  constraint semesters_number_unique
    unique (number)
);

create index semesters_active_idx
  on public.semesters (is_active);

create trigger semesters_set_updated_at
before update on public.semesters
for each row
execute function public.set_updated_at();

-- ============================================================
-- SUBJECTS
-- ============================================================

create table public.subjects (
  id uuid primary key default gen_random_uuid(),

  semester_id uuid not null
    references public.semesters(id)
    on delete restrict,

  name text not null,
  code text,
  description text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subjects_name_not_empty
    check (length(trim(name)) > 0)
);

create index subjects_semester_idx
  on public.subjects (semester_id);

create index subjects_active_idx
  on public.subjects (is_active);

create unique index subjects_semester_name_unique
  on public.subjects (semester_id, lower(name));

create trigger subjects_set_updated_at
before update on public.subjects
for each row
execute function public.set_updated_at();

-- ============================================================
-- LECTURERS
-- ============================================================

create table public.lecturers (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  bio text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lecturers_name_not_empty
    check (length(trim(name)) > 0)
);

create index lecturers_active_idx
  on public.lecturers (is_active);

create unique index lecturers_name_unique
  on public.lecturers (lower(name));

create trigger lecturers_set_updated_at
before update on public.lecturers
for each row
execute function public.set_updated_at();

-- ============================================================
-- SUBJECT ↔ LECTURER
-- MANY-TO-MANY
-- ============================================================

create table public.subject_lecturers (
  subject_id uuid not null
    references public.subjects(id)
    on delete cascade,

  lecturer_id uuid not null
    references public.lecturers(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  primary key (subject_id, lecturer_id)
);

create index subject_lecturers_lecturer_idx
  on public.subject_lecturers (lecturer_id);

-- ============================================================
-- CATEGORIES
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null,
  icon text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_name_not_empty
    check (length(trim(name)) > 0),

  constraint categories_slug_not_empty
    check (length(trim(slug)) > 0),

  constraint categories_slug_unique
    unique (slug)
);

create index categories_active_idx
  on public.categories (is_active);

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

-- ============================================================
-- USERS
-- ============================================================

create table public.users (
  id uuid primary key default gen_random_uuid(),

  telegram_id bigint not null,
  username text,
  first_name text,
  last_name text,

  role public.user_role not null default 'student',

  semester_id uuid
    references public.semesters(id)
    on delete set null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,

  constraint users_telegram_id_unique
    unique (telegram_id)
);

create index users_role_idx
  on public.users (role);

create index users_semester_idx
  on public.users (semester_id);

create index users_active_idx
  on public.users (is_active);

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- ============================================================
-- FILES
-- ============================================================

create table public.files (
  id uuid primary key default gen_random_uuid(),

  subject_id uuid not null
    references public.subjects(id)
    on delete cascade,

  lecturer_id uuid
    references public.lecturers(id)
    on delete set null,

  category_id uuid not null
    references public.categories(id)
    on delete restrict,

  title text not null,
  description text,

  telegram_file_id text not null,
  telegram_file_unique_id text,

  file_type public.file_type not null default 'document',
  file_size bigint,

  uploader_id uuid
    references public.users(id)
    on delete set null,

  downloads bigint not null default 0,

  is_public boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint files_title_not_empty
    check (length(trim(title)) > 0),

  constraint files_downloads_non_negative
    check (downloads >= 0),

  constraint files_size_non_negative
    check (file_size is null or file_size >= 0)
);

create index files_subject_idx
  on public.files (subject_id);

create index files_lecturer_idx
  on public.files (lecturer_id);

create index files_category_idx
  on public.files (category_id);

create index files_uploader_idx
  on public.files (uploader_id);

create index files_public_idx
  on public.files (is_public);

create index files_created_at_idx
  on public.files (created_at desc);

create trigger files_set_updated_at
before update on public.files
for each row
execute function public.set_updated_at();

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  content text not null,

  created_by uuid
    references public.users(id)
    on delete set null,

  is_pinned boolean not null default false,

  published_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcements_title_not_empty
    check (length(trim(title)) > 0),

  constraint announcements_content_not_empty
    check (length(trim(content)) > 0),

  constraint announcements_dates_valid
    check (
      expires_at is null
      or published_at is null
      or expires_at > published_at
    )
);

create index announcements_published_idx
  on public.announcements (published_at desc);

create index announcements_pinned_idx
  on public.announcements (is_pinned);

create index announcements_expires_idx
  on public.announcements (expires_at);

create trigger announcements_set_updated_at
before update on public.announcements
for each row
execute function public.set_updated_at();

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.users(id)
    on delete set null,

  action text not null,
  entity_type text,
  entity_id uuid,

  metadata jsonb,

  created_at timestamptz not null default now(),

  constraint audit_logs_action_not_empty
    check (length(trim(action)) > 0)
);

create index audit_logs_user_idx
  on public.audit_logs (user_id);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

create index audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.semesters enable row level security;
alter table public.subjects enable row level security;
alter table public.lecturers enable row level security;
alter table public.subject_lecturers enable row level security;
alter table public.categories enable row level security;
alter table public.users enable row level security;
alter table public.files enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- PUBLIC READ POLICIES
-- ============================================================

create policy "Anyone can read active semesters"
on public.semesters
for select
to anon, authenticated
using (is_active = true);

create policy "Anyone can read active subjects"
on public.subjects
for select
to anon, authenticated
using (is_active = true);

create policy "Anyone can read active lecturers"
on public.lecturers
for select
to anon, authenticated
using (is_active = true);

create policy "Anyone can read subject lecturers"
on public.subject_lecturers
for select
to anon, authenticated
using (true);

create policy "Anyone can read active categories"
on public.categories
for select
to anon, authenticated
using (is_active = true);

create policy "Anyone can read public files"
on public.files
for select
to anon, authenticated
using (is_public = true);

create policy "Anyone can read published announcements"
on public.announcements
for select
to anon, authenticated
using (
  published_at is not null
  and published_at <= now()
  and (
    expires_at is null
    or expires_at > now()
  )
);

-- ============================================================
-- USERS
-- ============================================================

create policy "Users can read their own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

-- ============================================================
-- DEFAULT CATEGORIES
-- ============================================================

insert into public.categories (name, slug, icon)
values
  ('محاضرات', 'lectures', '📚'),
  ('ملخصات', 'summaries', '📝'),
  ('أسئلة سنوات', 'previous-exams', '📋'),
  ('تكليفات', 'assignments', '📌'),
  ('كتب', 'books', '📖'),
  ('أخرى', 'other', '📂')
on conflict (slug) do nothing;