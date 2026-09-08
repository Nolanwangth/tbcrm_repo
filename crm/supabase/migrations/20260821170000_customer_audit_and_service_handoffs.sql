begin;

alter table public.audit_logs
  add column if not exists actor_user_id uuid references public.crm_users(id) on delete set null,
  add column if not exists actor_name_snapshot text,
  add column if not exists actor_role_snapshot text check (actor_role_snapshot is null or actor_role_snapshot in ('planner','service','admin'));

create index if not exists audit_logs_customer_actor_changed_idx
  on public.audit_logs(customer_id, changed_at desc);

create table if not exists public.customer_service_handoffs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_workbench text check (service_workbench is null or service_workbench in ('A','B','C')),
  service_owner_user_id uuid references public.crm_users(id) on delete set null,
  triggered_at timestamptz not null default now(),
  read_at timestamptz,
  completed_at timestamptz,
  completed_by_user_id uuid references public.crm_users(id) on delete set null,
  completed_by_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_service_handoffs_one_active_idx
  on public.customer_service_handoffs(customer_id) where completed_at is null;
create index if not exists customer_service_handoffs_owner_active_idx
  on public.customer_service_handoffs(service_owner_user_id, triggered_at desc) where completed_at is null;

create or replace function public.sync_customer_service_handoffs()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.itinerary_status is distinct from old.itinerary_status or new.quotation_status is distinct from old.quotation_status) then
    if new.itinerary_status = '已出行程' and new.quotation_status = '已出报价'
      and not (old.itinerary_status = '已出行程' and old.quotation_status = '已出报价') then
      insert into public.customer_service_handoffs(customer_id, service_workbench, service_owner_user_id)
      values (new.id, new.service_workbench, new.service_owner_user_id)
      on conflict (customer_id) where completed_at is null do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE' and (new.service_workbench is distinct from old.service_workbench or new.service_owner_user_id is distinct from old.service_owner_user_id) then
    update public.customer_service_handoffs
    set service_workbench = new.service_workbench,
        service_owner_user_id = new.service_owner_user_id,
        read_at = null,
        updated_at = now()
    where customer_id = new.id and completed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_sync_service_handoffs on public.customers;
create trigger customers_sync_service_handoffs
after update of itinerary_status, quotation_status, service_workbench, service_owner_user_id on public.customers
for each row execute function public.sync_customer_service_handoffs();

alter table public.customer_service_handoffs enable row level security;
revoke all on table public.customer_service_handoffs from anon, authenticated;
grant all on table public.customer_service_handoffs to service_role;

commit;
