begin;

create table if not exists public.crm_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  password_salt text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_auth_sessions (
  token_hash text primary key,
  user_id uuid not null references public.crm_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists crm_auth_sessions_expiry_idx on public.crm_auth_sessions(expires_at);

alter table public.customer_collaboration_messages
  add column if not exists author_id uuid references public.crm_users(id) on delete set null,
  add column if not exists topic text not null default 'general';

alter table public.crm_users enable row level security;
alter table public.crm_auth_sessions enable row level security;
revoke all on table public.crm_users, public.crm_auth_sessions from anon, authenticated;
grant all on table public.crm_users, public.crm_auth_sessions to service_role;

commit;
