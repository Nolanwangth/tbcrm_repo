begin;

create or replace function public.capture_operation_service_change()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_case_id uuid;
  v_start date;
  v_end date;
  v_today date;
  v_entity text;
begin
  if tg_op='DELETE' then v_case_id:=old.case_id; else v_case_id:=new.case_id; end if;
  v_entity:=case tg_table_name when 'operation_days' then 'day' else 'service_item' end;
  select start_date,end_date into v_start,v_end from public.operation_cases where id=v_case_id;

  
  
  if not found then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  v_today:=(now() at time zone 'Asia/Shanghai')::date;
  insert into public.operation_change_events(case_id,entity_type,entity_id,action,old_value,new_value,strong_alert)
  values(
    v_case_id,
    v_entity,
    case when tg_op='DELETE' then old.id else new.id end,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    case when tg_op='DELETE' then null else to_jsonb(new) end,
    v_start is not null and v_today>=v_start and (v_end is null or v_today<=v_end)
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

commit;
