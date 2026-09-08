begin;
select plan(1);

do $test$
declare
  v_customer uuid := 'ef300000-0000-4000-8000-000000000001';
  v_case uuid;
  v_file uuid;
  v_day uuid;
  v_event uuid;
  v_code_1 text;
  v_code_2 text;
begin
  insert into public.customers(id,name,source,first_inquiry_at,profile,expected_amount,level,system_suggested_level,priority,communication_status,status,won_at,won_amount,service_assignment_mode)
  values(v_customer,'[DB测试] 客户档案','官网',now(),'未确定',10000,'C','C','中','待首次跟进','已成交',now(),10000,'round_robin');
  insert into public.travel_needs(customer_id,expected_start_date,expected_end_date,traveler_count,destinations)
  values(v_customer,(now() at time zone 'Asia/Shanghai')::date,(now() at time zone 'Asia/Shanghai')::date,'2','北京');
  select id into v_case from public.operation_cases where customer_id=v_customer;
  if v_case is null then raise exception '成交客户未自动创建服务清单'; end if;
  if not exists(select 1 from public.operation_cases where id=v_case and start_date=(now() at time zone 'Asia/Shanghai')::date) then raise exception '旅行需求未同步到服务清单'; end if;

  v_code_1 := public.next_operation_tour_code(2098);
  v_code_2 := public.next_operation_tour_code(2098);
  if v_code_1 <> 'TB-2098-00001' or v_code_2 <> 'TB-2098-00002' then raise exception '年度团号不连续或格式错误: %, %',v_code_1,v_code_2; end if;

  insert into public.customer_files(customer_id,name,storage_path,size_bytes,mime_type)
  values(v_customer,'contract.pdf','db-test/contract.pdf',1,'application/pdf') returning id into v_file;
  insert into public.customer_document_links(customer_id,customer_file_id,document_type) values(v_customer,v_file,'contract');
  if not exists(select 1 from public.customer_document_links where customer_id=v_customer and replaced_at is null) then raise exception '成交文件未关联'; end if;

  insert into public.operation_travelers(case_id,traveler_type,full_name,age,nationality,passport_file_id)
  values(v_case,'adult','Test Guest',30,'US',v_file);
  insert into public.operation_days(case_id,day_number,service_date,city,sort_order)
  values(v_case,1,(now() at time zone 'Asia/Shanghai')::date,'北京',1) returning id into v_day;
  select id into v_event from public.operation_change_events where case_id=v_case and entity_id=v_day order by created_at desc limit 1;
  if not exists(select 1 from public.operation_change_events where id=v_event and strong_alert) then raise exception '行程中清单变更未生成强提醒'; end if;
  update public.operation_change_events set planner_ack_at=now(),operations_ack_at=now() where id=v_event;
  if exists(select 1 from public.operation_change_events where id=v_event and (planner_ack_at is null or operations_ack_at is null)) then raise exception '双角色确认未永久保存'; end if;

  if has_table_privilege('authenticated','public.operation_travelers','select') or has_table_privilege('anon','public.customer_document_links','select') then raise exception '敏感档案表不应向客户端角色直接授权'; end if;
end;
$test$;
select pass('planner customer archive');
select * from finish();

rollback;
