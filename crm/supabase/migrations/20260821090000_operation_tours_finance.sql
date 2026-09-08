begin;




alter table public.operation_cases
  drop constraint if exists operation_cases_customer_id_key,
  add column if not exists tour_code text,
  add column if not exists tour_name text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists traveler_count text,
  add column if not exists route_info text,
  add column if not exists order_total numeric(14,2) check (order_total is null or order_total >= 0),
  add column if not exists budget_cost numeric(14,2) check (budget_cost is null or budget_cost >= 0),
  add column if not exists special_requirements text,
  add column if not exists record_status text not null default 'draft' check (record_status in ('draft','active','cancelled','archived')),
  add column if not exists creation_source text not null default 'won_auto' check (creation_source in ('won_auto','manual')),
  add column if not exists archived_at timestamptz;

update public.operation_cases operation_case
set start_date = coalesce(operation_case.start_date, travel.expected_start_date),
    end_date = coalesce(operation_case.end_date, travel.expected_end_date),
    traveler_count = coalesce(operation_case.traveler_count, travel.traveler_count),
    route_info = coalesce(operation_case.route_info, travel.destinations),
    special_requirements = coalesce(operation_case.special_requirements, travel.special_requirements),
    order_total = coalesce(operation_case.order_total, customer.won_amount),
    tour_name = coalesce(nullif(operation_case.tour_name, ''), customer.name || ' 团'),
    record_status = case when operation_case.record_status = 'draft' then 'active' else operation_case.record_status end,
    creation_source = case when operation_case.creation_source = 'won_auto' then 'won_auto' else operation_case.creation_source end
from public.customers customer
left join public.travel_needs travel on travel.customer_id = customer.id
where customer.id = operation_case.customer_id;

create sequence if not exists public.operation_tour_code_seq;
update public.operation_cases
set tour_code = 'TB-' || to_char(created_at at time zone 'Asia/Shanghai', 'YYYY') || '-' || lpad(nextval('public.operation_tour_code_seq')::text, 6, '0')
where tour_code is null or btrim(tour_code) = '';

alter table public.operation_cases
  alter column tour_code set not null,
  alter column tour_name set not null;
create unique index if not exists operation_cases_tour_code_unique on public.operation_cases (tour_code);
create index if not exists operation_cases_customer_start_idx on public.operation_cases (customer_id, start_date desc nulls last);
create index if not exists operation_cases_status_start_idx on public.operation_cases (record_status, start_date);

create table if not exists public.operation_contacts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operation_cases(id) on delete cascade,
  service_item_id uuid references public.operation_service_items(id) on delete set null,
  role text not null check (role in ('project_manager','guide','driver','emergency','other')),
  name text not null check (char_length(btrim(name)) > 0),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operation_contacts_case_idx on public.operation_contacts (case_id, role);
create trigger operation_contacts_set_updated_at before update on public.operation_contacts for each row execute function public.set_updated_at();

create table if not exists public.operation_revenue_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.operation_cases(id) on delete restrict,
  kind text not null check (kind in ('group_fee','deposit','balance','addon','other')),
  title text not null check (char_length(btrim(title)) > 0),
  planned_amount numeric(14,2) not null check (planned_amount > 0),
  note text,
  voided_at timestamptz,
  voided_by_name text,
  void_reason text,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operation_revenue_items_case_idx on public.operation_revenue_items (case_id, created_at desc);
create trigger operation_revenue_items_set_updated_at before update on public.operation_revenue_items for each row execute function public.set_updated_at();

create table if not exists public.operation_revenue_receipts (
  id uuid primary key default gen_random_uuid(),
  revenue_item_id uuid not null references public.operation_revenue_items(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  received_at timestamptz not null,
  method text not null check (method in ('bank_transfer','alipay','wechat','cash','paypal','other')),
  receipt_file_id uuid references public.customer_files(id) on delete restrict,
  note text,
  received_by_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists operation_revenue_receipts_received_idx on public.operation_revenue_receipts (received_at desc);

drop trigger if exists customers_create_operation_case on public.customers;
create or replace function public.create_operation_case_for_won_customer()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = '已成交' and not exists (select 1 from public.operation_cases where customer_id = new.id) then
    insert into public.operation_cases (
      customer_id,tour_code,tour_name,start_date,end_date,traveler_count,route_info,order_total,special_requirements,record_status,creation_source
    )
    select new.id,
      'TB-' || to_char(now() at time zone 'Asia/Shanghai', 'YYYY') || '-' || lpad(nextval('public.operation_tour_code_seq')::text, 6, '0'),
      new.name || ' 团', travel.expected_start_date, travel.expected_end_date, travel.traveler_count, travel.destinations, new.won_amount, travel.special_requirements,
      'draft','won_auto'
    from public.travel_needs travel where travel.customer_id = new.id
    union all select new.id,
      'TB-' || to_char(now() at time zone 'Asia/Shanghai', 'YYYY') || '-' || lpad(nextval('public.operation_tour_code_seq')::text, 6, '0'),
      new.name || ' 团', null,null,null,null,new.won_amount,null,'draft','won_auto'
    where not exists (select 1 from public.travel_needs where customer_id = new.id);
  end if;
  return new;
end;
$$;
create trigger customers_create_operation_case after insert or update of status on public.customers for each row execute function public.create_operation_case_for_won_customer();


create or replace function public.sync_operation_reminders_from_travel_dates()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  return new;
end;
$$;




create or replace function public.sync_operation_default_reminders(p_case_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arrival date;
begin
  select start_date into v_arrival
  from public.operation_cases
  where id = p_case_id;

  if v_arrival is null then
    update public.operation_reminders
    set due_date = null
    where case_id = p_case_id and is_auto and status = 'pending' and not is_customized;
    return;
  end if;

  insert into public.operation_reminders (case_id, title, due_date, anchor_type, offset_days, auto_key, is_auto)
  values
    (p_case_id, '检查酒店、大交通和重点门票预订', v_arrival - 15, 'arrival', 15, 'arrival-15', true),
    (p_case_id, '复核所有预订、导游、司机和服务清单', v_arrival - 7, 'arrival', 7, 'arrival-7', true),
    (p_case_id, '最终确认接机、车辆、导游及客户联络', v_arrival - 1, 'arrival', 1, 'arrival-1', true)
  on conflict (case_id, auto_key) where auto_key is not null do update
  set due_date = case when operation_reminders.status = 'pending' and not operation_reminders.is_customized then excluded.due_date else operation_reminders.due_date end,
      title = case when operation_reminders.status = 'pending' and not operation_reminders.is_customized then excluded.title else operation_reminders.title end,
      anchor_type = case when operation_reminders.status = 'pending' and not operation_reminders.is_customized then excluded.anchor_type else operation_reminders.anchor_type end,
      offset_days = case when operation_reminders.status = 'pending' and not operation_reminders.is_customized then excluded.offset_days else operation_reminders.offset_days end,
      updated_at = now();
end;
$$;

create or replace function public.sync_operation_checklist_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arrival date; v_base_date date; v_template record; v_auto_key text;
begin
  select start_date into v_arrival from public.operation_cases where id = new.case_id;
  v_base_date := coalesce(new.service_date, v_arrival);
  for v_template in
    select * from (values
      ('hotel',30,'booking','确认酒店预订（房型、人数）'), ('hotel',14,'confirmation','获取酒店确认号'), ('hotel',3,'customer','发送酒店信息给客户'),
      ('flight',14,'ticketing','完成出票并核对乘客信息'), ('flight',7,'baggage','确认行李额度及机场交通'), ('flight',1,'final','确认航班动态'),
      ('rail',14,'ticketing','完成出票并核对乘客信息'), ('rail',7,'station','确认车站交通安排'), ('rail',1,'final','确认检票口及出发提醒'),
      ('other_transport',14,'booking','确认大交通预订'), ('other_transport',3,'customer','发送交通信息给客户'),
      ('driver',14,'booking','确认车辆、车型及司机'), ('driver',7,'pickup','确认上车地点及时间'), ('driver',1,'final','与司机最终确认'),
      ('guide',14,'booking','确认导游预订及资质'), ('guide',7,'briefing','沟通客户偏好与集合信息'), ('guide',1,'final','与导游最终确认'),
      ('ticket',14,'booking','完成购票或预约'), ('ticket',7,'entry','确认开放时间和入园方式'), ('ticket',1,'final','确认天气及注意事项'),
      ('meal',14,'booking','完成餐厅预订'), ('meal',7,'diet','确认饮食禁忌及过敏'), ('meal',1,'final','与餐厅最终确认'),
      ('insurance',14,'plan','确认保险方案及保额'), ('insurance',7,'policy','完成投保并获取保单号'), ('insurance',3,'customer','发送保单信息给客户'),
      ('other',14,'booking','确认项目预订'), ('other',7,'details','确认项目细节及时间'), ('other',3,'customer','发送安排给客户')
    ) as templates(category, offset_days, template_key, title)
    where templates.category = new.category
  loop
    v_auto_key := 'checklist:v1:' || new.id::text || ':' || v_template.template_key;
    update public.operation_reminders set
      day_id = new.day_id,
      due_date = case when status = 'pending' and not is_customized then case when v_base_date is null then null else v_base_date - v_template.offset_days end else due_date end,
      anchor_type = case when status = 'pending' and not is_customized then case when new.service_date is null then 'arrival' else 'service' end else anchor_type end,
      offset_days = case when status = 'pending' and not is_customized then v_template.offset_days else offset_days end
    where case_id = new.case_id and auto_key = v_auto_key;
    if not found then
      insert into public.operation_reminders (case_id,day_id,service_item_id,title,due_date,anchor_type,offset_days,auto_key,is_auto,task_kind,template_key,template_version)
      values (new.case_id,new.day_id,new.id,v_template.title,case when v_base_date is null then null else v_base_date - v_template.offset_days end,case when new.service_date is null then 'arrival' else 'service' end,v_template.offset_days,v_auto_key,true,'checklist',v_template.template_key,'1');
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.sync_operation_tasks_from_case_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.start_date is distinct from old.start_date then
    perform public.sync_operation_default_reminders(new.id);
    update public.operation_reminders
    set due_date = case when new.start_date is null then null else new.start_date - offset_days end
    where case_id = new.id and task_kind = 'checklist' and anchor_type = 'arrival'
      and status = 'pending' and not is_customized;
  end if;
  return new;
end;
$$;
drop trigger if exists operation_cases_sync_tasks_from_dates on public.operation_cases;
create trigger operation_cases_sync_tasks_from_dates
after update of start_date on public.operation_cases
for each row execute function public.sync_operation_tasks_from_case_dates();

alter table public.operation_cases enable row level security;
alter table public.operation_contacts enable row level security;
alter table public.operation_revenue_items enable row level security;
alter table public.operation_revenue_receipts enable row level security;
revoke all on public.operation_contacts, public.operation_revenue_items, public.operation_revenue_receipts from anon, authenticated;
grant select, insert, update, delete on public.operation_contacts, public.operation_revenue_items, public.operation_revenue_receipts to service_role;

commit;
