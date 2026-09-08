begin;
select plan(1);

do $$
declare
  slots text[];
  pointer_before text;
  pointer_after text;
begin
  if (select count(*) from public.service_workbench_slots where enabled and user_id is not null) <> 5 then
    raise exception '需要五名有效规划师账号才能运行数据库分配测试';
  end if;

  select next_slot into pointer_before from public.service_assignment_state where singleton;

  insert into public.customers (id,name,source,first_inquiry_at,profile,expected_amount,level,system_suggested_level,priority,communication_status,status,itinerary_status,quotation_status,service_assignment_mode)
  values
    ('ef100000-0000-4000-8000-000000000001','[DB测试] round robin 1','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin'),
    ('ef100000-0000-4000-8000-000000000002','[DB测试] round robin 2','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin'),
    ('ef100000-0000-4000-8000-000000000003','[DB测试] round robin 3','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin'),
    ('ef100000-0000-4000-8000-000000000005','[DB测试] round robin 4','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin'),
    ('ef100000-0000-4000-8000-000000000006','[DB测试] round robin 5','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin');

  select array_agg(service_workbench order by id) into slots
  from public.customers where id::text like 'ef100000-0000-4000-8000-%';
  if slots <> array[pointer_before, public.next_service_slot(pointer_before), public.next_service_slot(public.next_service_slot(pointer_before)), public.next_service_slot(public.next_service_slot(public.next_service_slot(pointer_before))), public.next_service_slot(public.next_service_slot(public.next_service_slot(public.next_service_slot(pointer_before))))] then
    raise exception '公共轮转顺序错误: %', slots;
  end if;

  select next_slot into pointer_before from public.service_assignment_state where singleton;
  insert into public.customers (id,name,source,first_inquiry_at,profile,expected_amount,level,system_suggested_level,priority,communication_status,status,itinerary_status,quotation_status,service_assignment_mode,service_workbench)
  values ('ef100000-0000-4000-8000-000000000004','[DB测试] exclusive','官网',now(),'未确定',10000,'C','C','中','待首次跟进','跟进中','暂不需要','暂不需要','exclusive','B');
  select next_slot into pointer_after from public.service_assignment_state where singleton;
  if pointer_after <> pointer_before then raise exception '专属客户错误消耗了公共轮转序号'; end if;

  begin
    update public.customers set service_workbench='C' where id='ef100000-0000-4000-8000-000000000004';
    raise exception '专属客户直接改派未被拒绝';
  exception when others then
    if sqlerrm = '专属客户直接改派未被拒绝' then raise; end if;
  end;
end $$;
select pass('service workbench assignment');
select * from finish();

rollback;
