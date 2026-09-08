begin;




alter table public.customers
  drop constraint if exists customers_priority_check,
  add constraint customers_priority_check
    check (priority in ('需立即处理','紧急','高','中','低')),
  drop constraint if exists customers_whatsapp_status_check;

alter table public.customers
  add constraint customers_whatsapp_status_check
    check (whatsapp_status in ('未添加','已添加','已添加邮箱','已添加微信','已添加whatsapp'));

create table if not exists public.customer_collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_name text not null default '规划师',
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_collaboration_messages_customer_idx
  on public.customer_collaboration_messages(customer_id, created_at desc);

drop trigger if exists customer_collaboration_messages_set_updated_at
  on public.customer_collaboration_messages;
create trigger customer_collaboration_messages_set_updated_at
before update on public.customer_collaboration_messages
for each row execute function public.set_updated_at();

alter table public.customer_collaboration_messages enable row level security;
revoke all on table public.customer_collaboration_messages from anon, authenticated;
grant select, insert, update, delete on table public.customer_collaboration_messages to service_role;

commit;
