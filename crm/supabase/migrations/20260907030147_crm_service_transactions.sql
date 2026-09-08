begin;
alter table public.audit_logs drop constraint if exists audit_logs_actor_role_snapshot_check;
alter table public.audit_logs add constraint audit_logs_actor_role_snapshot_check check(actor_role_snapshot is null or actor_role_snapshot in ('planner','service','operations','admin'));
alter table public.operation_cases add column revision integer not null default 0;
alter table public.operation_days add column revision integer not null default 0;
alter table public.operation_service_items add column revision integer not null default 0;
alter table public.operation_service_items add column route_text text;
alter table public.operation_travelers add column revision integer not null default 0;
alter table public.operation_contacts add column revision integer not null default 0;
alter table public.operation_change_events drop constraint if exists operation_change_events_entity_type_check;
alter table public.operation_change_events add constraint operation_change_events_entity_type_check check(entity_type in ('case','day','service_item','traveler','contact'));
create index operation_change_events_pending_all_idx on public.operation_change_events(case_id,created_at desc) where strong_alert and (planner_ack_at is null or operations_ack_at is null);

create or replace function public.capture_operation_service_change()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_case uuid; v_start date; v_end date; v_today date; v_entity text; v_actor uuid; v_name text; v_old jsonb; v_new jsonb;
begin
  v_old:=case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_new:=case when tg_op='DELETE' then null else to_jsonb(new) end;
  if tg_op='UPDATE' and (v_old-'updated_at'-'revision')=(v_new-'updated_at'-'revision') then return new; end if;
  v_case:=case when tg_table_name='operation_cases' then coalesce(v_new->>'id',v_old->>'id')::uuid else coalesce(v_new->>'case_id',v_old->>'case_id')::uuid end;
  select start_date,end_date into v_start,v_end from operation_cases where id=v_case;
  if not found then if tg_op='DELETE' then return old; else return new; end if; end if;
  v_entity:=case tg_table_name when 'operation_cases' then 'case' when 'operation_days' then 'day' when 'operation_travelers' then 'traveler' when 'operation_contacts' then 'contact' else 'service_item' end;
  v_today:=(now() at time zone 'Asia/Shanghai')::date;
  v_actor:=nullif(current_setting('crm.actor_id',true),'')::uuid;
  select display_name into v_name from crm_users where id=v_actor;
  insert into operation_change_events(case_id,entity_type,entity_id,action,old_value,new_value,actor_user_id,actor_name_snapshot,strong_alert)
  values(v_case,v_entity,coalesce(v_new->>'id',v_old->>'id')::uuid,case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,v_old,v_new,v_actor,v_name,
    coalesce(v_today>=v_start and (v_end is null or v_today<=v_end),false) or
    (tg_table_name='operation_cases' and coalesce(v_today>=(v_old->>'start_date')::date and (v_old->>'end_date' is null or v_today<=(v_old->>'end_date')::date),false)));
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create function public.crm_bump_operation_revision() returns trigger language plpgsql as $$ begin new.revision:=old.revision+1;return new;end $$;
do $$ declare t text; begin
  foreach t in array array['operation_cases','operation_days','operation_service_items','operation_travelers','operation_contacts'] loop
    execute format('create trigger crm_revision before update on public.%I for each row execute function public.crm_bump_operation_revision()',t);
    if t not in ('operation_days','operation_service_items') then execute format('create trigger crm_capture_change after insert or update or delete on public.%I for each row execute function public.capture_operation_service_change()',t); end if;
  end loop;
end $$;

create function public.crm_mutate_operation(p_actor uuid,p_case uuid,p_table text,p_id uuid,p_expected_revision integer,p_values jsonb,p_delete boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare old_row jsonb; result jsonb; assignments text; columns text; expressions text; field text;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  if p_table not in ('operation_cases','operation_days','operation_service_items','operation_travelers','operation_contacts') then raise exception '不支持的业务对象';end if;
  perform set_config('crm.actor_id',p_actor::text,true);
  perform 1 from operation_cases where id=p_case for update;
  if not found then raise exception '服务清单不存在';end if;
  if p_table='operation_cases' and (p_id is distinct from p_case or p_delete) then raise exception '不能删除或变更客户关联';end if;
  if p_values ? 'case_id' and p_values->>'case_id'<>p_case::text then raise exception '清单关联不一致';end if;
  p_values:=p_values-'case_id';
  if p_id is not null then
    execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_table) into old_row using p_id;
    if old_row is null or (p_table<>'operation_cases' and old_row->>'case_id'<>p_case::text) then raise exception '业务对象不存在';end if;
    if p_expected_revision is null or (old_row->>'revision')::integer<>p_expected_revision then raise exception 'CONFLICT: 该记录已被其他人修改。请重新加载核对，本地输入仍保留';end if;
    if p_delete then execute format('delete from public.%I where id=$1',p_table) using p_id; return old_row;end if;
  elsif p_expected_revision is not null and p_expected_revision<>0 then raise exception '新增记录的版本无效';end if;
  for field in select jsonb_object_keys(p_values) loop
    if field in ('id','customer_id','created_at','updated_at','revision','tour_code') or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=field) then raise exception '不允许修改字段 %',field;end if;
  end loop;
  if p_values ? 'day_id' and p_values->>'day_id' is not null and not exists(select 1 from operation_days where id=(p_values->>'day_id')::uuid and case_id=p_case) then raise exception 'Day 不属于当前服务清单';end if;
  if p_id is null then p_values:=p_values||jsonb_build_object('case_id',p_case);end if;
  select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,p_table,key),','),string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',p_table,key),',') into assignments,columns,expressions from jsonb_object_keys(p_values) key;
  if assignments is null then raise exception '没有待保存内容';end if;
  if p_id is null then execute format('insert into public.%I(%s) select %s returning to_jsonb(%I)',p_table,columns,expressions,p_table) into result using p_values;
  else execute format('update public.%I set %s where id=$2 returning to_jsonb(%I)',p_table,assignments,p_table) into result using p_values,p_id;end if;
  return result;
end $$;
revoke all on function public.crm_mutate_operation(uuid,uuid,text,uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.crm_mutate_operation(uuid,uuid,text,uuid,integer,jsonb,boolean) to service_role;

create table public.operation_change_acknowledgements (
  id uuid primary key default gen_random_uuid(),event_id uuid not null references public.operation_change_events(id),
  actor_user_id uuid not null references public.crm_users(id), confirmation_role text not null check(confirmation_role in ('planner','operations')),
  actor_role text not null, actor_name_snapshot text not null, reason text,
  created_at timestamptz not null default now(), unique(event_id,confirmation_role)
);
alter table public.operation_change_acknowledgements enable row level security;
revoke all on public.operation_change_acknowledgements from anon,authenticated;
grant select,insert on public.operation_change_acknowledgements to service_role;
create function public.crm_acknowledge_operation_change(p_actor uuid,p_customer uuid,p_event uuid,p_role text,p_reason text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; ev operation_change_events%rowtype;
begin
  select * into actor from crm_users where id=p_actor and active and not must_change_password;
  if not found then raise exception '未授权' using errcode='42501';end if;
  if p_role not in ('planner','operations') or (actor.role<>'admin' and actor.role<>p_role) then raise exception '当前账号不能按此身份确认' using errcode='42501';end if;
  if actor.role='admin' and length(trim(coalesce(p_reason,'')))<2 then raise exception '管理员代确认必须选择身份并填写原因';end if;
  select e.* into ev from operation_change_events e join operation_cases c on c.id=e.case_id where e.id=p_event and c.customer_id=p_customer for update of e;
  if not found or not ev.strong_alert then raise exception '未找到当前客户的强提醒';end if;
  if (p_role='planner' and ev.planner_ack_at is not null) or (p_role='operations' and ev.operations_ack_at is not null) then return;end if;
  insert into operation_change_acknowledgements(event_id,actor_user_id,confirmation_role,actor_role,actor_name_snapshot,reason)
  values(p_event,p_actor,p_role,actor.role,actor.display_name,nullif(trim(p_reason),''));
  if p_role='planner' then update operation_change_events set planner_ack_at=now(),planner_ack_by=p_actor where id=p_event;
  else update operation_change_events set operations_ack_at=now(),operations_ack_by=p_actor where id=p_event;end if;
end $$;
revoke all on function public.crm_acknowledge_operation_change(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.crm_acknowledge_operation_change(uuid,uuid,uuid,text,text) to service_role;
create function public.crm_update_operation_case(p_actor uuid,p_case uuid,p_revision integer,p_values jsonb,p_priority text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb; customer uuid; previous text; actor crm_users%rowtype;
begin
  result:=crm_mutate_operation(p_actor,p_case,'operation_cases',p_case,p_revision,p_values,false);
  select customer_id into customer from operation_cases where id=p_case;
  select priority into previous from customers where id=customer for update;
  if previous is distinct from p_priority then
    select * into actor from crm_users where id=p_actor;
    update customers set priority=p_priority where id=customer;
    insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
    values(customer,'优先级',previous,p_priority,p_actor,actor.display_name,actor.role);
  end if;
  return result;
end $$;
revoke all on function public.crm_update_operation_case(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.crm_update_operation_case(uuid,uuid,integer,jsonb,text) to service_role;
create function public.crm_import_operation_service_list(p_actor uuid,p_case_id uuid,p_file_id uuid,p_content_hash text,p_payload jsonb,p_replace_existing boolean)
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  perform set_config('crm.actor_id',p_actor::text,true);
  perform 1 from operation_cases where id=p_case_id for update;
  return import_operation_service_list_v2(p_case_id,p_file_id,p_content_hash,p_payload,p_replace_existing);
end $$;
revoke all on function public.crm_import_operation_service_list(uuid,uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.crm_import_operation_service_list(uuid,uuid,uuid,text,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
commit;
