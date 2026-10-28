create table if not exists public.admin_upload_sessions (
  telegram_id bigint primary key,
  step text not null check (step in ('select_year', 'select_group', 'select_subject', 'awaiting_subject_name', 'select_category', 'awaiting_file')),
  semester_id uuid references public.semesters(id) on delete cascade,
  group_id uuid references public.student_groups(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_upload_sessions enable row level security;

comment on table public.admin_upload_sessions is 'Persistent state for the Telegram bot admin file-upload wizard. Accessed only by the server-side service-role client.';
