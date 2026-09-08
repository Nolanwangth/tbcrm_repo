
create table public.crm_customer_deletions (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null,
 actor_id uuid not null, actor_name text not null, actor_role text not null,
 reason text not null, before_data jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table public.crm_customer_deletions enable row level security;
revoke all on public.crm_customer_deletions from public,anon,authenticated;
grant select,insert on public.crm_customer_deletions to service_role;

create function public.crm_customer_workflow(p_actor uuid,p_customers uuid[],p_operation text,p_input jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; c customers%rowtype; after_customer customers%rowtype;
 f follow_ups%rowtype; new_f follow_ups%rowtype; latest_id uuid; record_id uuid;
 field text; old_value text; new_value text; label text; status_field text; at_time timestamptz;
 callback_at timestamptz; skip_callback boolean; old_request text; before_follow jsonb;
begin
 select * into actor from crm_users where id=p_actor and active and not must_change_password;
 if not found then raise exception '未授权' using errcode='42501';end if;
 if p_operation not in ('planning','won-info','follow-up','expected-amount','won','close','recover','delete') then raise exception '操作无效';end if;
 if coalesce(array_length(p_customers,1),0)=0 or array_length(p_customers,1)>500 then raise exception '请选择 1–500 个客户';end if;
 if (select count(*) from customers where id=any(p_customers))<>array_length(p_customers,1) then raise exception '客户不存在或重复';end if;
 perform set_config('crm.actor_id',p_actor::text,true);
 
 for c in select * from customers where id=any(p_customers) order by id for update loop
  if p_operation='planning' then
   if c.status='已关闭' then raise exception '已关闭客户仅可查看历史方案';end if;
   if p_input->>'requestType' not in ('itinerary','quotation') then raise exception '制作类型无效';end if;
   status_field:=case when p_input->>'requestType'='itinerary' then 'itinerary_status' else 'quotation_status' end;
   execute format('update customers set %I=$1 where id=$2',status_field) using p_input->>'status',c.id;
   if nullif(btrim(p_input->>'content'),'') is not null then
    select content into old_request from planning_requests where customer_id=c.id and request_type=p_input->>'requestType' order by created_at desc limit 1;
    insert into planning_requests(customer_id,request_type,status,content) values(c.id,p_input->>'requestType',p_input->>'status',btrim(p_input->>'content'));
    insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
    values(c.id,case when status_field='itinerary_status' then '行程规划要求' else '报价规划要求' end,old_request,btrim(p_input->>'content'),actor.id,actor.display_name,actor.role);
   end if;
  elsif p_operation in ('won','won-info') then
   if p_operation='won-info' and c.status<>'已成交' then raise exception '只有已成交客户可以修改成交信息';end if;
   if (p_input->>'wonAmount')::numeric is null or (p_input->>'wonAmount')::numeric<0 then raise exception '成交金额无效';end if;
   at_time:=((p_input->>'wonDate')::date::timestamp at time zone 'Asia/Shanghai');
   if at_time is null then raise exception '成交日期无效';end if;
   update customers set status='已成交',won_amount=(p_input->>'wonAmount')::numeric,won_at=at_time,closed_at=null,close_reason=null,
    current_callback_at=null,callback_not_required=false,callback_skip_reason=null where id=c.id;
   record_id:=null;
   if p_operation='won-info' then select id into record_id from won_records where customer_id=c.id order by won_at desc limit 1;end if;
   if record_id is null then insert into won_records(customer_id,amount,won_at) values(c.id,(p_input->>'wonAmount')::numeric,at_time);
   else update won_records set amount=(p_input->>'wonAmount')::numeric,won_at=at_time where id=record_id;end if;
  elsif p_operation='close' then
   update customers set status='已关闭',close_reason=p_input->>'closeReason',closed_at=clock_timestamp(),won_at=null,
    current_callback_at=null,callback_not_required=false,callback_skip_reason=null where id=c.id;
   insert into close_records(customer_id,reason) values(c.id,p_input->>'closeReason');
  elsif p_operation='recover' then
   update customers set status='跟进中',priority=coalesce(p_input->>'priority','中'),communication_status=p_input->>'communicationStatus',
    won_at=null,closed_at=null,close_reason=null where id=c.id;
   insert into restore_records(customer_id,restored_level,priority,communication_status)
   values(c.id,c.level,coalesce(p_input->>'priority','中'),p_input->>'communicationStatus');
  elsif p_operation='expected-amount' then
   perform fill_customer_expected_amount(c.id,(p_input->>'expectedAmount')::numeric);
   
   
   update audit_logs set actor_user_id=actor.id,actor_name_snapshot=actor.display_name,actor_role_snapshot=actor.role
   where customer_id=c.id and actor_user_id is null and xmin::text=pg_current_xact_id()::text;
  elsif p_operation='follow-up' then
   skip_callback:=coalesce((p_input->>'callbackNotRequired')::boolean,false);
   callback_at:=case when skip_callback then null else (p_input->>'nextCallbackAt')::timestamptz end;
   if not skip_callback and callback_at is null then raise exception '请填写回访时间';end if;
   if skip_callback and nullif(btrim(p_input->>'callbackSkipReason'),'') is null then raise exception '请填写无需回访原因';end if;
   select id into latest_id from follow_ups where customer_id=c.id order by created_at desc,id desc limit 1;
   if nullif(p_input->>'followUpId','') is not null then
    select * into f from follow_ups where id=(p_input->>'followUpId')::uuid and customer_id=c.id for update;
    if not found then raise exception '跟进记录不属于此客户';end if;
    before_follow:=to_jsonb(f);
    insert into follow_up_versions(follow_up_id,summary,communication_status,next_callback_at,callback_not_required,callback_skip_reason)
    values(f.id,f.summary,f.communication_status,f.next_callback_at,f.callback_not_required,f.callback_skip_reason);
    update follow_ups set summary=p_input->>'summary',communication_status=p_input->>'communicationStatus',next_callback_at=callback_at,
     callback_not_required=skip_callback,callback_skip_reason=case when skip_callback then p_input->>'callbackSkipReason' end
     where id=f.id returning * into new_f;
   else
    before_follow:=null;
    insert into follow_ups(customer_id,summary,communication_status,next_callback_at,callback_not_required,callback_skip_reason,previous_interval)
    values(c.id,p_input->>'summary',p_input->>'communicationStatus',callback_at,skip_callback,
      case when skip_callback then p_input->>'callbackSkipReason' end,
      clock_timestamp()-(select updated_at from follow_ups where customer_id=c.id order by updated_at desc limit 1)) returning * into new_f;
    update customer_service_handoffs set completed_at=clock_timestamp(),completed_by_user_id=actor.id,completed_by_name_snapshot=actor.display_name,
     updated_at=clock_timestamp() where customer_id=c.id and completed_at is null and triggered_at<=clock_timestamp();
   end if;
   update customers set communication_status=new_f.communication_status,latest_follow_up_at=clock_timestamp(),
    current_callback_at=case when before_follow is null or latest_id=new_f.id then callback_at else c.current_callback_at end,
    callback_not_required=case when before_follow is null or latest_id=new_f.id then skip_callback else c.callback_not_required end,
    callback_skip_reason=case when before_follow is null or latest_id=new_f.id then new_f.callback_skip_reason else c.callback_skip_reason end where id=c.id;
   insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
   values(c.id,case when before_follow is null then '新增跟进' else '修改跟进' end,before_follow::text,to_jsonb(new_f)::text,actor.id,actor.display_name,actor.role);
  else
   if p_input->>'deleteReason' not in ('录入错误','测试数据','重复客户') or p_input->>'deleteReason' is null then raise exception '删除原因无效';end if;
   insert into crm_customer_deletions(customer_id,actor_id,actor_name,actor_role,reason,before_data)
   values(c.id,actor.id,actor.display_name,actor.role,p_input->>'deleteReason',jsonb_build_object('customer',to_jsonb(c),
    'travel',(select to_jsonb(t) from travel_needs t where customer_id=c.id),
    'audit',coalesce((select jsonb_agg(a) from audit_logs a where customer_id=c.id),'[]'::jsonb)));
   delete from customers where id=c.id;
   continue;
  end if;
  select * into after_customer from customers where id=c.id;
  foreach field in array array['status','won_amount','won_at','close_reason','priority','communication_status','business_stage','itinerary_status','quotation_status','expected_amount'] loop
   old_value:=to_jsonb(c)->>field;new_value:=to_jsonb(after_customer)->>field;
   if old_value is distinct from new_value then
    label:=case field when 'status' then '客户状态' when 'won_amount' then '成交总金额' when 'won_at' then '成交日期' when 'close_reason' then '关闭原因'
     when 'priority' then '优先级' when 'communication_status' then '沟通状态' when 'business_stage' then '业务阶段'
     when 'itinerary_status' then '行程状态' when 'quotation_status' then '报价状态' else '预计具体金额' end;
    insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
    values(c.id,label,old_value,new_value,actor.id,actor.display_name,actor.role);
   end if;
  end loop;
 end loop;
end $$;
revoke all on function public.crm_customer_workflow(uuid,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_customer_workflow(uuid,uuid[],text,jsonb) to service_role;
