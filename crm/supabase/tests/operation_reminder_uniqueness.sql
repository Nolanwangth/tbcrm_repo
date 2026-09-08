begin;
select plan(1);

do $test$
declare
  v_customer_id uuid;
  v_case_id uuid;
  v_day_id uuid;
  v_service_id uuid;
begin
  insert into public.customers (
    name,
    source,
    first_inquiry_at,
    level,
    system_suggested_level,
    status,
    won_at,
    won_amount
  )
  values (
    '提醒唯一约束事务测试',
    '官网',
    now(),
    'A',
    'A',
    '已成交',
    now(),
    100
  )
  returning id into v_customer_id;

  select id
  into v_case_id
  from public.operation_cases
  where customer_id = v_customer_id;

  if v_case_id is null then
    raise exception '测试失败：成交客户未创建计调记录';
  end if;

  insert into public.travel_needs (
    customer_id,
    expected_start_date,
    expected_end_date
  )
  values (
    v_customer_id,
    '2026-08-06',
    '2026-08-12'
  );

  insert into public.operation_days (
    case_id,
    day_number,
    service_date,
    city,
    sort_order
  )
  values (
    v_case_id,
    1,
    '2026-08-06',
    '北京',
    1
  )
  returning id into v_day_id;

  insert into public.operation_service_items (
    case_id,
    day_id,
    section,
    category,
    title,
    service_date,
    booking_status,
    quantity,
    unit,
    sort_order
  )
  values (
    v_case_id,
    v_day_id,
    'daily',
    'driver',
    '机场接送',
    '2026-08-06',
    'not_required',
    1,
    '项',
    1
  )
  returning id into v_service_id;

  insert into public.operation_reminders (
    case_id,
    title,
    due_date,
    anchor_type,
    is_auto
  )
  values (
    v_case_id,
    '普通提醒内容可见',
    '2026-08-01',
    'fixed',
    false
  );

  insert into public.operation_reminders (
    case_id,
    day_id,
    service_item_id,
    title,
    due_date,
    anchor_type,
    offset_days,
    is_auto
  )
  values (
    v_case_id,
    v_day_id,
    v_service_id,
    '关联服务提醒内容可见',
    '2026-08-03',
    'service',
    3,
    false
  );

  insert into public.operation_reminders (
    case_id,
    title,
    due_date,
    anchor_type,
    offset_days,
    is_auto
  )
  values (
    v_case_id,
    '自定义来华前 7 天提醒',
    '2026-07-30',
    'arrival',
    7,
    false
  );

  if (
    select count(*)
    from public.operation_reminders
    where case_id = v_case_id
      and auto_key is null
  ) <> 3 then
    raise exception '测试失败：同一项目无法保存多条人工提醒或同日期自定义提醒';
  end if;

  perform public.sync_operation_default_reminders(v_case_id);

  if (
    select count(*)
    from public.operation_reminders
    where case_id = v_case_id
      and auto_key in ('arrival-15','arrival-7','arrival-1')
  ) <> 3 then
    raise exception '测试失败：三条到达日前自动提醒不完整';
  end if;

  if not exists (
    select 1
    from public.operation_reminders
    where case_id = v_case_id
      and service_item_id = v_service_id
      and title = '关联服务提醒内容可见'
  ) then
    raise exception '测试失败：关联服务提醒未保留';
  end if;
end;
$test$;
select pass('operation reminder uniqueness');
select * from finish();

rollback;
