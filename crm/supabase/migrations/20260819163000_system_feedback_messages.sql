begin;

create table if not exists public.system_feedback_messages (
  id uuid primary key default gen_random_uuid(),
  parent_message_id uuid references public.system_feedback_messages(id) on delete cascade,
  author_id uuid references public.crm_users(id) on delete set null,
  author_name text not null,
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_feedback_messages_created_idx
  on public.system_feedback_messages(created_at desc);
create index if not exists system_feedback_messages_parent_idx
  on public.system_feedback_messages(parent_message_id, created_at asc);

drop trigger if exists system_feedback_messages_set_updated_at
  on public.system_feedback_messages;
create trigger system_feedback_messages_set_updated_at
before update on public.system_feedback_messages
for each row execute function public.set_updated_at();

alter table public.system_feedback_messages enable row level security;
revoke all on table public.system_feedback_messages from anon, authenticated;
grant select, insert, update, delete on table public.system_feedback_messages to service_role;

commit;
