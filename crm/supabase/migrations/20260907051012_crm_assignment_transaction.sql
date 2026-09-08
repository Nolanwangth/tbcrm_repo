create function public.crm_change_customer_assignment(p_actor uuid,p_customer uuid,p_slot text,p_unlock boolean,p_reason text)
returns void language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; old_customer customers%rowtype; action_name text; target_slot text;
begin
 select * into actor from crm_users where id=p_actor and active and not must_change_password;
 if not found then raise exception '未授权' using errcode='42501';end if;
 select * into old_customer from customers where id=p_customer for update;
 if not found then raise exception '客户不存在';end if;
 perform set_config('crm.actor_id',p_actor::text,true);
 if p_unlock then
  if old_customer.service_assignment_mode is distinct from 'exclusive' then raise exception '该客户不是专属客户';end if;
  if length(trim(coalesce(p_reason,'')))<2 then raise exception '请填写解除原因';end if;
  target_slot:=old_customer.service_workbench;action_name:='exclusive_unlocked';
 else
  if old_customer.service_assignment_mode='exclusive' then raise exception '专属客户必须先解除专属归属后才能改派';end if;
  if p_slot not in ('A','B','C','D','E') or p_slot is null then raise exception '席位无效';end if;
  if not exists(select 1 from service_workbench_slots s join crm_users u on u.id=s.user_id where s.slot=p_slot and s.enabled and u.active and u.role='planner') then raise exception '席位当前不可分配';end if;
  if old_customer.service_workbench=p_slot then return;end if;
  target_slot:=p_slot;action_name:=case when old_customer.service_workbench is null then 'manually_assigned' else 'reassigned' end;
 end if;
 update customers set service_assignment_mode='round_robin',service_workbench=target_slot where id=p_customer;
 update service_assignment_exceptions set resolved_at=clock_timestamp() where customer_id=p_customer and resolved_at is null;
 insert into service_assignment_events(customer_id,action,assignment_mode,from_workbench,to_workbench,actor_id,actor_name_snapshot,reason)
 values(p_customer,action_name,'round_robin',old_customer.service_workbench,target_slot,actor.id,actor.display_name,coalesce(nullif(trim(p_reason),''),'手工调整规划师归属'));
 insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
 values(p_customer,case when p_unlock then '分配方式' else '规划师归属' end,
  case when p_unlock then '专属规划师' else coalesce(old_customer.service_workbench,'待分配') end,
  case when p_unlock then '公共轮转' else target_slot end,actor.id,actor.display_name,actor.role);
end $$;
revoke all on function public.crm_change_customer_assignment(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.crm_change_customer_assignment(uuid,uuid,text,boolean,text) to service_role;
