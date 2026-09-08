begin;
select plan(1);

do $$
declare
  target_id uuid;
  original_itinerary text;
  original_quotation text;
  first_task uuid;
  task_count integer;
begin
  insert into public.customers (id,name,source,first_inquiry_at,profile,expected_amount,level,system_suggested_level,priority,communication_status,status,itinerary_status,quotation_status,service_assignment_mode)
  values ('ef200000-0000-4000-8000-000000000001','[DB测试] 制作交接','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin');
  select id, itinerary_status, quotation_status
    into target_id, original_itinerary, original_quotation
  from public.customers
  where id = 'ef200000-0000-4000-8000-000000000001'
  order by created_at
  limit 1;
  if target_id is null then raise exception '需要至少一位已分配客服的测试客户'; end if;

  delete from public.customer_service_handoffs where customer_id = target_id;
  update public.customers set itinerary_status = '未出行程', quotation_status = '未出报价' where id = target_id;
  update public.customers set itinerary_status = '已出行程' where id = target_id;
  if exists (select 1 from public.customer_service_handoffs where customer_id = target_id) then raise exception '单侧已出不应生成客服接手任务'; end if;
  update public.customers set quotation_status = '已出报价' where id = target_id;
  select id into first_task from public.customer_service_handoffs where customer_id = target_id and completed_at is null;
  if first_task is null then raise exception '双已出必须生成客服接手任务'; end if;
  update public.customers set quotation_status = '已出报价' where id = target_id;
  select count(*) into task_count from public.customer_service_handoffs where customer_id = target_id;
  if task_count <> 1 then raise exception '重复保存状态不应重复生成任务'; end if;
  update public.customer_service_handoffs set completed_at = now() where id = first_task;
  update public.customers set quotation_status = '报价待修改' where id = target_id;
  update public.customers set quotation_status = '已出报价' where id = target_id;
  select count(*) into task_count from public.customer_service_handoffs where customer_id = target_id;
  if task_count <> 2 then raise exception '状态回退后再次双已出应生成新任务'; end if;
end $$;
select pass('customer service handoff workflow');
select * from finish();

rollback;
