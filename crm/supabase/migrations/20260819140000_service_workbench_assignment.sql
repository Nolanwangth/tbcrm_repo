begin;

alter table public.customers
  add column if not exists service_workbench text,
  add column if not exists service_assignment_mode text,
  add column if not exists service_owner_user_id uuid references public.crm_users(id) on delete set null,
  add column if not exists service_assigned_at timestamptz,
  add column if not exists current_callback_at timestamptz,
  add column if not exists callback_not_required boolean not null default false,
  add column if not exists callback_skip_reason text;

alter table public.customers
  drop constraint if exists customers_service_workbench_check,
  add constraint customers_service_workbench_check check (service_workbench is null or service_workbench in ('A','B','C')),
  drop constraint if exists customers_service_assignment_mode_check,
  add constraint customers_service_assignment_mode_check check (service_assignment_mode is null or service_assignment_mode in ('round_robin','exclusive')),
  drop constraint if exists customers_callback_state_check,
  add constraint customers_callback_state_check check (
    (callback_not_required = false and callback_skip_reason is null)
    or (callback_not_required = true and current_callback_at is null and nullif(btrim(callback_skip_reason), '') is not null)
  );

create index if not exists customers_service_workbench_idx
  on public.customers(service_workbench, status, priority, current_callback_at)
  where service_workbench is not null;

alter table public.follow_ups
  add column if not exists next_callback_at timestamptz,
  add column if not exists callback_not_required boolean not null default false,
  add column if not exists callback_skip_reason text;

alter table public.follow_ups
  drop constraint if exists follow_ups_callback_state_check,
  add constraint follow_ups_callback_state_check check (
    (callback_not_required = false and callback_skip_reason is null)
    or (callback_not_required = true and next_callback_at is null and nullif(btrim(callback_skip_reason), '') is not null)
  );

alter table public.follow_up_versions
  add column if not exists next_callback_at timestamptz,
  add column if not exists callback_not_required boolean not null default false,
  add column if not exists callback_skip_reason text;

create table if not exists public.service_workbench_slots (
  slot text primary key check (slot in ('A','B','C')),
  user_id uuid unique references public.crm_users(id) on delete set null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.service_workbench_slots(slot) values ('A'),('B'),('C')
on conflict (slot) do nothing;

update public.service_workbench_slots slots
set user_id = users.id, updated_at = now()
from public.crm_users users
where (slots.slot, users.username) in (
  ('A','service_gaoyuanbo'),
  ('B','service_caijinyang'),
  ('C','service_huangchuqiao')
);

create table if not exists public.service_assignment_state (
  singleton boolean primary key default true check (singleton),
  next_slot text not null default 'A' check (next_slot in ('A','B','C')),
  updated_at timestamptz not null default now()
);

insert into public.service_assignment_state(singleton, next_slot)
values (true, 'A')
on conflict (singleton) do nothing;

create table if not exists public.service_assignment_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  action text not null check (action in ('auto_assigned','exclusive_assigned','manually_assigned','reassigned','exclusive_unlocked','assignment_failed')),
  assignment_mode text check (assignment_mode is null or assignment_mode in ('round_robin','exclusive')),
  from_workbench text check (from_workbench is null or from_workbench in ('A','B','C')),
  to_workbench text check (to_workbench is null or to_workbench in ('A','B','C')),
  actor_id uuid references public.crm_users(id) on delete set null,
  actor_name_snapshot text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists service_assignment_events_customer_idx
  on public.service_assignment_events(customer_id, created_at desc);

create table if not exists public.service_assignment_exceptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace function public.next_service_slot(current_slot text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case current_slot when 'A' then 'B' when 'B' then 'C' else 'A' end;
$$;

create or replace function public.prepare_customer_service_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  state_row public.service_assignment_state%rowtype;
  candidate_slot text;
  matched_user_id uuid;
  attempts integer := 0;
begin
  if new.service_assignment_mode is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.service_assignment_mode = 'exclusive'
     and new.service_assignment_mode = 'exclusive'
     and new.service_workbench is distinct from old.service_workbench then
    raise exception '专属客户必须先解除专属归属后才能改派';
  end if;

  if new.service_assignment_mode = 'exclusive' then
    if new.service_workbench is null then
      raise exception '专属客户必须选择客服工作台';
    end if;
    select slots.user_id into matched_user_id
    from public.service_workbench_slots slots
    join public.crm_users users on users.id = slots.user_id
    where slots.slot = new.service_workbench and slots.enabled = true and users.active = true and users.role = 'service';
    if matched_user_id is null then
      raise exception '所选客服工作台当前不可分配';
    end if;
    new.service_owner_user_id := matched_user_id;
  elsif tg_op = 'INSERT' and new.service_workbench is null then
    select * into state_row from public.service_assignment_state where singleton = true for update;
    candidate_slot := state_row.next_slot;
    while attempts < 3 loop
      select slots.user_id into matched_user_id
      from public.service_workbench_slots slots
      join public.crm_users users on users.id = slots.user_id
      where slots.slot = candidate_slot and slots.enabled = true and users.active = true and users.role = 'service';
      exit when matched_user_id is not null;
      candidate_slot := public.next_service_slot(candidate_slot);
      attempts := attempts + 1;
    end loop;
    if matched_user_id is not null then
      new.service_workbench := candidate_slot;
      new.service_owner_user_id := matched_user_id;
      update public.service_assignment_state
      set next_slot = public.next_service_slot(candidate_slot), updated_at = now()
      where singleton = true;
    else
      new.service_workbench := null;
      new.service_owner_user_id := null;
    end if;
  elsif new.service_workbench is not null then
    select slots.user_id into matched_user_id
    from public.service_workbench_slots slots
    join public.crm_users users on users.id = slots.user_id
    where slots.slot = new.service_workbench and slots.enabled = true and users.active = true and users.role = 'service';
    if matched_user_id is null then
      raise exception '所选客服工作台当前不可分配';
    end if;
    new.service_owner_user_id := matched_user_id;
  else
    new.service_owner_user_id := null;
  end if;

  if tg_op = 'INSERT' or new.service_workbench is distinct from old.service_workbench then
    new.service_assigned_at := case when new.service_workbench is null then null else now() end;
    new.current_callback_at := null;
    new.callback_not_required := false;
    new.callback_skip_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_prepare_service_assignment on public.customers;
create trigger customers_prepare_service_assignment
before insert or update of service_assignment_mode, service_workbench on public.customers
for each row execute function public.prepare_customer_service_assignment();

create or replace function public.record_service_assignment_exception()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.service_assignment_mode = 'round_robin' and new.service_owner_user_id is null then
    insert into public.service_assignment_exceptions(customer_id, reason)
    values (new.id, '三位客服当前均不可分配，请人工处理')
    on conflict (customer_id) do update set reason = excluded.reason, resolved_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_record_service_assignment_exception on public.customers;
create trigger customers_record_service_assignment_exception
after insert on public.customers
for each row execute function public.record_service_assignment_exception();

alter table public.service_workbench_slots enable row level security;
alter table public.service_assignment_state enable row level security;
alter table public.service_assignment_events enable row level security;
alter table public.service_assignment_exceptions enable row level security;
revoke all on table public.service_workbench_slots, public.service_assignment_state, public.service_assignment_events, public.service_assignment_exceptions from anon, authenticated;
grant all on table public.service_workbench_slots, public.service_assignment_state, public.service_assignment_events, public.service_assignment_exceptions to service_role;
grant execute on function public.next_service_slot(text), public.prepare_customer_service_assignment(), public.record_service_assignment_exception() to service_role;

commit;
