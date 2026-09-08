begin;



drop function if exists public.create_operation_snapshot(uuid, uuid, numeric);
drop function if exists public.confirm_customer_with_operation(uuid, uuid, numeric, date, boolean);
drop table if exists public.operation_payments cascade;
drop table if exists public.operation_reminders cascade;
drop table if exists public.operation_services cascade;
drop table if exists public.operation_orders cascade;
drop table if exists public.proposal_quote_items cascade;
drop table if exists public.itinerary_services cascade;
drop table if exists public.proposal_days cascade;
drop table if exists public.trip_proposals cascade;
drop table if exists public.price_catalog_items cascade;
drop table if exists public.suppliers cascade;

create table public.operation_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  owner_name text,
  service_list_status text not null default 'not_uploaded'
    check (service_list_status in ('not_uploaded', 'uploaded')),
  service_list_manual boolean not null default false,
  service_list_file_id uuid references public.customer_files(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operation_days (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operation_cases(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  service_date date,
  city text,
  summary text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, day_number)
);

create table public.operation_service_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operation_cases(id) on delete cascade,
  day_id uuid references public.operation_days(id) on delete cascade,
  section text not null check (section in ('daily', 'hotel', 'transport')),
  category text not null check (
    category in (
      'guide', 'driver', 'ticket', 'other',
      'hotel',
      'flight', 'rail', 'other_transport'
    )
  ),
  title text not null check (char_length(btrim(title)) > 0),
  details text,
  city text,
  service_date date,
  booking_status text not null default 'pending'
    check (booking_status in ('pending', 'booking', 'confirmed', 'not_required', 'cancelled')),
  supplier_name text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit text not null default '项',
  invoice_unit_cost numeric(14,2) check (invoice_unit_cost is null or invoice_unit_cost >= 0),
  customer_unit_quote numeric(14,2) check (customer_unit_quote is null or customer_unit_quote >= 0),
  final_supplier_settlement numeric(14,2)
    check (final_supplier_settlement is null or final_supplier_settlement >= 0),
  final_customer_settlement numeric(14,2)
    check (final_customer_settlement is null or final_customer_settlement >= 0),
  confirmation_file_id uuid references public.customer_files(id) on delete restrict,
  invoice_file_id uuid references public.customer_files(id) on delete restrict,
  check_in_date date,
  check_out_date date,
  room_type text,
  room_count integer check (room_count is null or room_count > 0),
  night_count integer check (night_count is null or night_count > 0),
  transport_type text,
  origin text,
  destination text,
  reference_number text,
  departure_time time,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (section = 'daily' and day_id is not null and category in ('guide', 'driver', 'ticket', 'other'))
    or (section = 'hotel' and day_id is null and category = 'hotel')
    or (section = 'transport' and day_id is null and category in ('flight', 'rail', 'other_transport'))
  ),
  check (booking_status <> 'confirmed' or confirmation_file_id is not null),
  check (check_out_date is null or check_in_date is null or check_out_date >= check_in_date)
);

create table public.operation_reminders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operation_cases(id) on delete cascade,
  day_id uuid references public.operation_days(id) on delete cascade,
  service_item_id uuid references public.operation_service_items(id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  due_date date not null,
  anchor_type text not null default 'fixed'
    check (anchor_type in ('arrival', 'service', 'fixed')),
  offset_days integer check (offset_days is null or offset_days >= 0),
  auto_key text,
  is_auto boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'ignored')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (anchor_type = 'arrival' and offset_days is not null)
    or (anchor_type = 'service' and service_item_id is not null and offset_days is not null)
    or anchor_type = 'fixed'
  ),
  unique nulls not distinct (case_id, auto_key)
);

create index operation_cases_updated_idx on public.operation_cases (updated_at desc);
create index operation_days_case_sort_idx on public.operation_days (case_id, sort_order, day_number);
create index operation_service_items_case_section_idx
  on public.operation_service_items (case_id, section, service_date, sort_order);
create index operation_service_items_booking_idx
  on public.operation_service_items (case_id, booking_status)
  where category in ('hotel', 'ticket', 'flight', 'rail', 'other_transport');
create index operation_reminders_due_idx
  on public.operation_reminders (due_date, status)
  where status = 'pending';

create trigger operation_cases_set_updated_at
before update on public.operation_cases
for each row execute function public.set_updated_at();

create trigger operation_days_set_updated_at
before update on public.operation_days
for each row execute function public.set_updated_at();

create trigger operation_service_items_set_updated_at
before update on public.operation_service_items
for each row execute function public.set_updated_at();

create trigger operation_reminders_set_updated_at
before update on public.operation_reminders
for each row execute function public.set_updated_at();

create or replace function public.sync_operation_service_list_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.service_list_manual then
    new.service_list_status :=
      case when new.service_list_file_id is null then 'not_uploaded' else 'uploaded' end;
  end if;
  return new;
end;
$$;

create trigger operation_cases_sync_service_list_status
before insert or update of service_list_file_id, service_list_manual, service_list_status
on public.operation_cases
for each row execute function public.sync_operation_service_list_status();

create or replace function public.sync_operation_default_reminders(p_case_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arrival date;
begin
  select t.expected_start_date
  into v_arrival
  from public.operation_cases o
  join public.travel_needs t on t.customer_id = o.customer_id
  where o.id = p_case_id;

  if v_arrival is null then
    delete from public.operation_reminders
    where case_id = p_case_id
      and is_auto
      and status = 'pending';
    return;
  end if;

  insert into public.operation_reminders (
    case_id, title, due_date, anchor_type, offset_days, auto_key, is_auto
  )
  values
    (
      p_case_id,
      '检查酒店、大交通和重点门票预订',
      v_arrival - 15,
      'arrival',
      15,
      'arrival-15',
      true
    ),
    (
      p_case_id,
      '复核所有预订、导游、司机和服务清单',
      v_arrival - 7,
      'arrival',
      7,
      'arrival-7',
      true
    ),
    (
      p_case_id,
      '最终确认接机、车辆、导游及客户联络',
      v_arrival - 1,
      'arrival',
      1,
      'arrival-1',
      true
    )
  on conflict (case_id, auto_key) do update
  set due_date = excluded.due_date,
      title = excluded.title,
      anchor_type = excluded.anchor_type,
      offset_days = excluded.offset_days,
      updated_at = now()
  where operation_reminders.status = 'pending';
end;
$$;

create or replace function public.create_operation_case_for_won_customer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case_id uuid;
begin
  if new.status = '已成交' then
    insert into public.operation_cases (customer_id)
    values (new.id)
    on conflict (customer_id) do nothing
    returning id into v_case_id;

    if v_case_id is not null then
      perform public.sync_operation_default_reminders(v_case_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger customers_create_operation_case
after insert or update of status on public.customers
for each row execute function public.create_operation_case_for_won_customer();

create or replace function public.sync_operation_reminders_from_travel_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case_id uuid;
begin
  if tg_op = 'INSERT'
     or new.expected_start_date is distinct from old.expected_start_date then
    select id into v_case_id
    from public.operation_cases
    where customer_id = new.customer_id;

    if v_case_id is not null then
      perform public.sync_operation_default_reminders(v_case_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger travel_needs_sync_operation_reminders
after insert or update of expected_start_date on public.travel_needs
for each row execute function public.sync_operation_reminders_from_travel_dates();

alter table public.operation_cases enable row level security;
alter table public.operation_days enable row level security;
alter table public.operation_service_items enable row level security;
alter table public.operation_reminders enable row level security;

revoke all on table
  public.operation_cases,
  public.operation_days,
  public.operation_service_items,
  public.operation_reminders
from anon, authenticated;

grant select, insert, update, delete on table
  public.operation_cases,
  public.operation_days,
  public.operation_service_items,
  public.operation_reminders
to service_role;

revoke all on function public.sync_operation_service_list_status()
  from public, anon, authenticated;
revoke all on function public.sync_operation_default_reminders(uuid)
  from public, anon, authenticated;
revoke all on function public.create_operation_case_for_won_customer()
  from public, anon, authenticated;
revoke all on function public.sync_operation_reminders_from_travel_dates()
  from public, anon, authenticated;

grant execute on function public.sync_operation_service_list_status() to service_role;
grant execute on function public.sync_operation_default_reminders(uuid) to service_role;
grant execute on function public.create_operation_case_for_won_customer() to service_role;
grant execute on function public.sync_operation_reminders_from_travel_dates() to service_role;

insert into public.operation_cases (customer_id)
select id
from public.customers
where status = '已成交'
on conflict (customer_id) do nothing;

select public.sync_operation_default_reminders(id)
from public.operation_cases;

commit;
