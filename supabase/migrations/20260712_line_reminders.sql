-- FlowPal LINE reminder additions. Run this once in Supabase SQL Editor.
alter table public.flowpal_users
  add column if not exists link_code text unique;

alter table public.tasks
  add column if not exists source_id text,
  add column if not exists due_label text,
  add column if not exists time_label text not null default '16:00',
  add column if not exists color text not null default 'yellow';

create unique index if not exists tasks_user_source_id_unique
  on public.tasks (user_id, source_id)
  where source_id is not null;

create unique index if not exists reminder_log_one_per_reminder
  on public.reminder_log (user_id, reminder_type);
