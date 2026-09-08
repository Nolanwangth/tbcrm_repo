begin;
create function public.crm_create_customer_bundle(p_actor uuid,p_customer jsonb,p_travel jsonb,p_score jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; customer jsonb; customer_id uuid; table_name text; payload jsonb; columns text; expressions text;
begin
 select * into actor from crm_users where id=p_actor and active and not must_change_password;
 if not found then raise exception '未授权' using errcode='42501';end if;
 perform set_config('crm.actor_id',p_actor::text,true);
 p_customer:=p_customer-'id'-'created_at'-'updated_at'||'{"status":"跟进中"}'::jsonb;
 foreach table_name in array array['customers','travel_needs','initial_scores','score_versions'] loop
  payload:=case table_name when 'customers' then p_customer when 'travel_needs' then p_travel else p_score end;
  if table_name<>'customers' then payload:=payload-'id'||jsonb_build_object('customer_id',customer_id);end if;
  if table_name='score_versions' then payload:=payload||jsonb_build_object('reason','新增客户首次评分');end if;
  select string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',table_name,key),',') into columns,expressions from jsonb_object_keys(payload) key;
  if table_name='customers' then
   execute format('insert into public.customers(%s) select %s returning to_jsonb(customers)',columns,expressions) into customer using payload;
   customer_id:=(customer->>'id')::uuid;
  else execute format('insert into public.%I(%s) select %s',table_name,columns,expressions) using payload;end if;
 end loop;
 insert into level_changes(customer_id,from_level,to_level) values(customer_id,null,customer->>'level');
 insert into service_assignment_events(customer_id,action,assignment_mode,to_workbench,actor_id,actor_name_snapshot,reason)
 values(customer_id,case when customer->>'service_workbench' is null then 'assignment_failed' when customer->>'service_assignment_mode'='exclusive' then 'exclusive_assigned' else 'auto_assigned' end,customer->>'service_assignment_mode',customer->>'service_workbench',p_actor,actor.display_name,case when customer->>'service_workbench' is null then '规划师 A-E 当前均不可分配，请人工处理' end);
 insert into audit_logs(customer_id,field_name,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot) values(customer_id,'客户创建',customer::text,p_actor,actor.display_name,actor.role);
 return customer;
end $$;
revoke all on function public.crm_create_customer_bundle(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_create_customer_bundle(uuid,jsonb,jsonb,jsonb) to service_role;

create function public.crm_update_customer_control(p_actor uuid,p_customer uuid,p_field text,p_value text,p_expected_old text)
returns void language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; previous text; row jsonb; label text;
begin
 select * into actor from crm_users where id=p_actor and active and not must_change_password;
 if not found then raise exception '未授权' using errcode='42501';end if;
 if p_field not in ('level','priority','communication_status','whatsapp_status','business_stage') then raise exception '字段不允许';end if;
 select to_jsonb(c) into row from customers c where id=p_customer for update;
 if not found then raise exception '客户不存在';end if;
 previous:=row->>p_field;
 if previous is distinct from p_expected_old then raise exception 'CONFLICT: 客户状态已变化，请重新核对';end if;
 if previous is not distinct from p_value then return;end if;
 perform set_config('crm.actor_id',p_actor::text,true);
 execute format('update customers set %I=$1,updated_at=clock_timestamp() where id=$2',p_field) using p_value,p_customer;
 if p_field='level' then insert into level_changes(customer_id,from_level,to_level) values(p_customer,previous,p_value);end if;
 label:=case p_field when 'level' then '客户等级' when 'priority' then '优先级' when 'communication_status' then '沟通状态' when 'whatsapp_status' then '沟通方式' else '业务阶段' end;
 insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot) values(p_customer,label,previous,p_value,p_actor,actor.display_name,actor.role);
end $$;
revoke all on function public.crm_update_customer_control(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_update_customer_control(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
