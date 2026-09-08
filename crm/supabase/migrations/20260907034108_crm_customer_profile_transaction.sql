create function public.crm_update_customer_profile(p_actor uuid,p_customer uuid,p_expected_updated_at timestamptz,p_basic jsonb,p_travel jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; previous jsonb; before_row jsonb; after_row jsonb; patch jsonb; object_name text; field text; assignments text;
begin
 select * into actor from crm_users where id=p_actor and active and not must_change_password;
 if not found then raise exception '未授权' using errcode='42501';end if;
 select to_jsonb(c) into previous from customers c where id=p_customer for update;
 if not found then raise exception '客户不存在';end if;
 if p_expected_updated_at is null or (previous->>'updated_at')::timestamptz<>p_expected_updated_at then raise exception 'CONFLICT: 客户资料已更新。请重新加载核对，本地输入仍保留';end if;
 perform set_config('crm.actor_id',p_actor::text,true);
 foreach object_name in array array['customers','travel_needs'] loop
  patch:=case when object_name='customers' then p_basic else p_travel end;
  if patch is null or patch='{}'::jsonb then continue;end if;
  for field in select jsonb_object_keys(patch) loop
   if (object_name='customers' and field not in ('name','source','source_detail','first_inquiry_at','nationality','contact','whatsapp_status','profile','amount_range','expected_amount')) or
      (object_name='travel_needs' and field not in ('expected_start_date','expected_end_date','fuzzy_travel_time','traveler_count','travel_days','destinations','flight_status','hotel_status','service_type','domestic_transport_status','special_requirements')) then raise exception '不允许修改字段 %',field;end if;
  end loop;
  if object_name='travel_needs' then
   insert into travel_needs(customer_id) values(p_customer) on conflict(customer_id) do nothing;
   select to_jsonb(t) into before_row from travel_needs t where customer_id=p_customer for update;
  else before_row:=previous;end if;
  select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,object_name,key),',') into assignments from jsonb_object_keys(patch) key;
  execute format('update public.%I set %s where %I=$2 returning to_jsonb(%I)',object_name,assignments,case when object_name='customers' then 'id' else 'customer_id' end,object_name) into after_row using patch,p_customer;
  for field in select jsonb_object_keys(patch) loop
   if before_row->field is distinct from after_row->field then
    insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
    values(p_customer,field,before_row->>field,after_row->>field,p_actor,actor.display_name,actor.role);
   end if;
  end loop;
 end loop;
 update customers set updated_at=clock_timestamp() where id=p_customer;
end $$;
revoke all on function public.crm_update_customer_profile(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_update_customer_profile(uuid,uuid,timestamptz,jsonb,jsonb) to service_role;
