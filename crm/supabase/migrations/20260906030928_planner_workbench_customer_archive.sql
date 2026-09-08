begin;

alter table public.customer_proposals add column if not exists tool_type text not null default 'quotation'
  check (tool_type in ('itinerary','quotation'));


alter table public.customers drop constraint if exists customers_service_workbench_check;
alter table public.customers add constraint customers_service_workbench_check check (service_workbench is null or service_workbench in ('A','B','C','D','E'));
alter table public.service_workbench_slots drop constraint if exists service_workbench_slots_slot_check;
alter table public.service_workbench_slots add constraint service_workbench_slots_slot_check check (slot in ('A','B','C','D','E'));
alter table public.service_assignment_state drop constraint if exists service_assignment_state_next_slot_check;
alter table public.service_assignment_state add constraint service_assignment_state_next_slot_check check (next_slot in ('A','B','C','D','E'));
alter table public.service_assignment_events drop constraint if exists service_assignment_events_from_workbench_check;
alter table public.service_assignment_events add constraint service_assignment_events_from_workbench_check check (from_workbench is null or from_workbench in ('A','B','C','D','E'));
alter table public.service_assignment_events drop constraint if exists service_assignment_events_to_workbench_check;
alter table public.service_assignment_events add constraint service_assignment_events_to_workbench_check check (to_workbench is null or to_workbench in ('A','B','C','D','E'));
alter table public.customer_service_handoffs drop constraint if exists customer_service_handoffs_service_workbench_check;
alter table public.customer_service_handoffs add constraint customer_service_handoffs_service_workbench_check check (service_workbench is null or service_workbench in ('A','B','C','D','E'));

insert into public.service_workbench_slots(slot) values ('D'),('E') on conflict (slot) do nothing;
update public.service_workbench_slots s set user_id=u.id, enabled=true, updated_at=now()
from public.crm_users u where (s.slot,u.username) in (('A','service_gaoyuanbo'),('B','service_caijinyang'),('C','service_huangchuqiao'),('D','planner_xuchenlei'),('E','planner_zhangxujie'));

create or replace function public.next_service_slot(current_slot text) returns text language sql immutable set search_path='' as $$
  select case current_slot when 'A' then 'B' when 'B' then 'C' when 'C' then 'D' when 'D' then 'E' else 'A' end;
$$;

create or replace function public.prepare_customer_service_assignment() returns trigger language plpgsql set search_path=public as $$
declare state_row public.service_assignment_state%rowtype; candidate_slot text; matched_user_id uuid; attempts integer := 0;
begin
  if new.service_assignment_mode is null then return new; end if;
  if tg_op='UPDATE' and old.service_assignment_mode='exclusive' and new.service_assignment_mode='exclusive' and new.service_workbench is distinct from old.service_workbench then raise exception '专属客户必须先解除专属归属后才能改派'; end if;
  if new.service_assignment_mode='exclusive' then
    if new.service_workbench is null then raise exception '专属客户必须选择规划师工作台'; end if;
    select s.user_id into matched_user_id from public.service_workbench_slots s join public.crm_users u on u.id=s.user_id where s.slot=new.service_workbench and s.enabled and u.active and u.role in ('service','planner');
    if matched_user_id is null then raise exception '所选规划师工作台当前不可分配'; end if;
    new.service_owner_user_id := matched_user_id;
  elsif tg_op='INSERT' and new.service_workbench is null then
    select * into state_row from public.service_assignment_state where singleton=true for update;
    candidate_slot := state_row.next_slot;
    while attempts < 5 loop
      select s.user_id into matched_user_id from public.service_workbench_slots s join public.crm_users u on u.id=s.user_id where s.slot=candidate_slot and s.enabled and u.active and u.role in ('service','planner');
      exit when matched_user_id is not null; candidate_slot := public.next_service_slot(candidate_slot); attempts := attempts+1;
    end loop;
    if matched_user_id is not null then
      new.service_workbench:=candidate_slot; new.service_owner_user_id:=matched_user_id;
      update public.service_assignment_state set next_slot=public.next_service_slot(candidate_slot),updated_at=now() where singleton=true;
    else new.service_workbench:=null; new.service_owner_user_id:=null; end if;
  elsif new.service_workbench is not null then
    select s.user_id into matched_user_id from public.service_workbench_slots s join public.crm_users u on u.id=s.user_id where s.slot=new.service_workbench and s.enabled and u.active and u.role in ('service','planner');
    if matched_user_id is null then raise exception '所选规划师工作台当前不可分配'; end if;
    new.service_owner_user_id:=matched_user_id;
  else new.service_owner_user_id:=null; end if;
  if tg_op='INSERT' or new.service_workbench is distinct from old.service_workbench then
    new.service_assigned_at:=case when new.service_workbench is null then null else now() end; new.current_callback_at:=null; new.callback_not_required:=false; new.callback_skip_reason:=null;
  end if;
  return new;
end;
$$;

create table public.operation_tour_counters (
  tour_year integer primary key check (tour_year between 2020 and 9999), next_number integer not null check (next_number > 0), updated_at timestamptz not null default now()
);
insert into public.operation_tour_counters(tour_year,next_number)
select extract(year from now() at time zone 'Asia/Shanghai')::integer,
       coalesce(max((regexp_match(tour_code,'-([0-9]+)$'))[1]::integer),0)+1
from public.operation_cases
where tour_code like 'TB-' || extract(year from now() at time zone 'Asia/Shanghai')::integer || '-%'
on conflict (tour_year) do nothing;

create or replace function public.next_operation_tour_code(p_year integer default extract(year from now() at time zone 'Asia/Shanghai')::integer)
returns text language plpgsql security invoker set search_path=public as $$
declare v_number integer;
begin
  insert into public.operation_tour_counters(tour_year,next_number) values(p_year,2)
  on conflict(tour_year) do update set next_number=public.operation_tour_counters.next_number+1,updated_at=now()
  returning next_number-1 into v_number;
  if v_number > 99999 then raise exception '团组编号已超过年度上限'; end if;
  return 'TB-'||p_year::text||'-'||lpad(v_number::text,5,'0');
end;
$$;

create or replace function public.create_operation_case_for_won_customer() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='已成交' and not exists(select 1 from public.operation_cases where customer_id=new.id) then
    insert into public.operation_cases(customer_id,tour_code,tour_name,start_date,end_date,traveler_count,route_info,order_total,special_requirements,record_status,creation_source)
    select new.id,public.next_operation_tour_code(),coalesce(nullif(btrim(new.nationality),''),'未填国家')||new.name||'团',t.expected_start_date,t.expected_end_date,t.traveler_count,t.destinations,new.won_amount,t.special_requirements,'draft','won_auto'
    from public.travel_needs t where t.customer_id=new.id
    union all select new.id,public.next_operation_tour_code(),coalesce(nullif(btrim(new.nationality),''),'未填国家')||new.name||'团',null,null,null,null,new.won_amount,null,'draft','won_auto'
    where not exists(select 1 from public.travel_needs where customer_id=new.id);
  end if;
  return new;
end;
$$;

create table public.customer_document_links (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  customer_file_id uuid not null references public.customer_files(id) on delete restrict,
  document_type text not null check (document_type in ('contract','proforma_invoice','passport')),
  replaced_at timestamptz, created_by_user_id uuid references public.crm_users(id) on delete set null, created_at timestamptz not null default now()
);
create unique index customer_document_links_active_unique on public.customer_document_links(customer_id,document_type) where replaced_at is null and document_type in ('contract','proforma_invoice');
create index customer_document_links_customer_idx on public.customer_document_links(customer_id,created_at desc);

create table public.operation_travelers (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.operation_cases(id) on delete cascade,
  traveler_type text not null check (traveler_type in ('adult','child','senior')), full_name text not null,
  age integer check (age is null or age between 0 and 120), height_cm integer check (height_cm is null or height_cm between 30 and 250),
  nationality text, passport_number text, birth_date date, passport_expiry_date date,
  passport_file_id uuid references public.customer_files(id) on delete set null, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index operation_travelers_case_idx on public.operation_travelers(case_id,sort_order);

alter table public.operation_cases add column if not exists hotel_information text;
alter table public.operation_cases add column if not exists customer_notes text;

create table public.operation_change_events (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.operation_cases(id) on delete cascade,
  entity_type text not null check (entity_type in ('case','traveler','day','service_item')), entity_id uuid,
  action text not null check (action in ('created','updated','deleted')), old_value jsonb, new_value jsonb,
  actor_user_id uuid references public.crm_users(id) on delete set null, actor_name_snapshot text,
  strong_alert boolean not null default false, planner_ack_at timestamptz, planner_ack_by uuid references public.crm_users(id) on delete set null,
  operations_ack_at timestamptz, operations_ack_by uuid references public.crm_users(id) on delete set null, created_at timestamptz not null default now()
);
create index operation_change_events_open_idx on public.operation_change_events(case_id,created_at desc) where strong_alert and (planner_ack_at is null or operations_ack_at is null);

create or replace function public.capture_operation_service_change() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_case_id uuid; v_start date; v_end date; v_today date; v_entity text;
begin
  if tg_op='DELETE' then v_case_id:=old.case_id; else v_case_id:=new.case_id; end if;
  v_entity:=case tg_table_name when 'operation_days' then 'day' else 'service_item' end;
  select start_date,end_date into v_start,v_end from public.operation_cases where id=v_case_id;
  v_today:=(now() at time zone 'Asia/Shanghai')::date;
  insert into public.operation_change_events(case_id,entity_type,entity_id,action,old_value,new_value,strong_alert)
  values(v_case_id,v_entity,case when tg_op='DELETE' then old.id else new.id end,case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
         case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end,
         v_start is not null and v_today>=v_start and (v_end is null or v_today<=v_end));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger operation_days_capture_change after insert or update or delete on public.operation_days for each row execute function public.capture_operation_service_change();
create trigger operation_items_capture_change after insert or update or delete on public.operation_service_items for each row execute function public.capture_operation_service_change();

alter table public.customer_document_links enable row level security;
alter table public.operation_travelers enable row level security;
alter table public.operation_change_events enable row level security;
alter table public.operation_tour_counters enable row level security;
revoke all on public.customer_document_links,public.operation_travelers,public.operation_change_events,public.operation_tour_counters from anon,authenticated;
grant select,insert,update,delete on public.customer_document_links,public.operation_travelers,public.operation_change_events,public.operation_tour_counters to service_role;
grant execute on function public.next_operation_tour_code(integer),public.capture_operation_service_change(),public.prepare_customer_service_assignment(),public.next_service_slot(text) to service_role;

commit;
