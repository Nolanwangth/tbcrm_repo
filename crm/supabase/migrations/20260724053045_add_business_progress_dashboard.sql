begin;

alter table public.customers
  add column business_stage text not null default '沟通中'
    check (business_stage in ('沟通中', '制作中')),
  add column itinerary_status text not null default '暂不需要'
    check (itinerary_status in ('暂不需要', '未出行程', '已出行程', '行程待修改')),
  add column quotation_status text not null default '暂不需要'
    check (quotation_status in ('暂不需要', '未出报价', '已出报价', '报价待修改')),
  add column itinerary_status_updated_at timestamptz not null default now(),
  add column quotation_status_updated_at timestamptz not null default now(),
  add column won_amount numeric(14,2) check (won_amount is null or won_amount >= 0);

update public.customers
set won_amount = coalesce(expected_amount, 0)
where status = '已成交' and won_amount is null;

alter table public.customers
  add constraint customers_won_amount_required
  check (status <> '已成交' or won_amount is not null);

create table public.planning_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  request_type text not null check (request_type in ('itinerary', 'quotation')),
  status text not null check (status in ('未出行程', '行程待修改', '未出报价', '报价待修改')),
  content text not null check (char_length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  check (
    (request_type = 'itinerary' and status in ('未出行程', '行程待修改'))
    or
    (request_type = 'quotation' and status in ('未出报价', '报价待修改'))
  )
);

create table public.won_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  won_at timestamptz not null default now()
);

create index customers_business_stage_idx on public.customers (business_stage);
create index customers_itinerary_status_idx on public.customers (itinerary_status);
create index customers_quotation_status_idx on public.customers (quotation_status);
create index customers_won_at_idx on public.customers (won_at desc);
create index planning_requests_customer_created_idx
  on public.planning_requests (customer_id, request_type, created_at desc);
create index won_records_customer_won_at_idx on public.won_records (customer_id, won_at desc);

create or replace function public.sync_business_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.itinerary_status is distinct from old.itinerary_status then
    new.itinerary_status_updated_at = now();
  end if;
  if tg_op = 'INSERT' or new.quotation_status is distinct from old.quotation_status then
    new.quotation_status_updated_at = now();
  end if;
  if tg_op = 'INSERT'
     or new.itinerary_status is distinct from old.itinerary_status
     or new.quotation_status is distinct from old.quotation_status then
    if new.itinerary_status = '暂不需要' and new.quotation_status = '暂不需要' then
      new.business_stage = '沟通中';
    else
      new.business_stage = '制作中';
    end if;
  end if;
  return new;
end;
$$;

create trigger customers_sync_business_progress
before insert or update of itinerary_status, quotation_status on public.customers
for each row execute function public.sync_business_progress();

alter table public.planning_requests enable row level security;
alter table public.won_records enable row level security;
revoke all on table public.planning_requests, public.won_records from anon, authenticated;
grant select, insert, update, delete on table public.planning_requests, public.won_records to service_role;

revoke all on function public.sync_business_progress() from public, anon, authenticated;
grant execute on function public.sync_business_progress() to service_role;

commit;
