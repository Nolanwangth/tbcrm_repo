begin;

do $$ begin
  if exists (select customer_id from public.operation_cases group by customer_id having count(*) > 1) then
    raise exception '无法回滚：已有客户拥有多个团组，请先导出并处理多团数据';
  end if;
end $$;
drop trigger if exists operation_cases_sync_tasks_from_dates on public.operation_cases;
drop function if exists public.sync_operation_tasks_from_case_dates();
drop trigger if exists customers_create_operation_case on public.customers;
drop table if exists public.operation_revenue_receipts;
drop table if exists public.operation_revenue_items;
drop table if exists public.operation_contacts;
drop index if exists public.operation_cases_tour_code_unique;
alter table public.operation_cases
  drop column if exists tour_code,
  drop column if exists tour_name,
  drop column if exists start_date,
  drop column if exists end_date,
  drop column if exists traveler_count,
  drop column if exists route_info,
  drop column if exists order_total,
  drop column if exists budget_cost,
  drop column if exists special_requirements,
  drop column if exists record_status,
  drop column if exists creation_source,
  drop column if exists archived_at;
alter table public.operation_cases add constraint operation_cases_customer_id_key unique (customer_id);
create or replace function public.sync_operation_default_reminders(p_case_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_arrival date;
begin
  select travel.expected_start_date into v_arrival
  from public.operation_cases cases left join public.travel_needs travel on travel.customer_id = cases.customer_id
  where cases.id = p_case_id;
  if v_arrival is null then
    update public.operation_reminders set due_date = null where case_id = p_case_id and is_auto and status = 'pending' and not is_customized;
    return;
  end if;
  insert into public.operation_reminders(case_id,title,due_date,anchor_type,offset_days,auto_key,is_auto)
  values (p_case_id,'检查酒店、大交通和重点门票预订',v_arrival-15,'arrival',15,'arrival-15',true),
    (p_case_id,'复核所有预订、导游、司机和服务清单',v_arrival-7,'arrival',7,'arrival-7',true),
    (p_case_id,'最终确认接机、车辆、导游及客户联络',v_arrival-1,'arrival',1,'arrival-1',true)
  on conflict (case_id,auto_key) where auto_key is not null do update set due_date = excluded.due_date, updated_at = now()
  where operation_reminders.status = 'pending' and not operation_reminders.is_customized;
end;
$$;
create or replace function public.create_operation_case_for_won_customer()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_case_id uuid;
begin
  if new.status = '已成交' and not exists (select 1 from public.operation_cases where customer_id = new.id) then
    insert into public.operation_cases(customer_id) values(new.id) returning id into v_case_id;
    perform public.sync_operation_default_reminders(v_case_id);
  end if;
  return new;
end;
$$;
create trigger customers_create_operation_case after insert or update of status on public.customers for each row execute function public.create_operation_case_for_won_customer();
drop sequence if exists public.operation_tour_code_seq;
commit;
