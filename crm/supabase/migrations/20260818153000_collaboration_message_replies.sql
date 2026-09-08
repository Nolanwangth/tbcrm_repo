alter table public.customer_collaboration_messages
  add column if not exists parent_message_id uuid references public.customer_collaboration_messages(id) on delete cascade;

create index if not exists customer_collaboration_messages_parent_idx
  on public.customer_collaboration_messages(parent_message_id, created_at asc);
