begin;
select plan(1);

do $test$
declare
  v_customer_id uuid;
  v_case_id uuid;
  v_file_id uuid;
  v_first_import jsonb;
  v_second_import jsonb;
  v_duplicate jsonb;
  v_payload jsonb := '{
    "template": "tripbook-internal-cost-sheet-v1",
    "days": [
      {"dayNumber": 1, "serviceDate": "2026-08-06", "city": "成都"},
      {"dayNumber": 2, "serviceDate": "2026-08-07", "city": "重庆"}
    ],
    "items": [
      {
        "rowKey": "2026-08-06:市区用车:5座用车:1",
        "dayNumber": 1,
        "serviceDate": "2026-08-06",
        "city": "成都",
        "section": "daily",
        "category": "driver",
        "title": "5座用车",
        "details": "来源分类：市区用车",
        "bookingStatus": "not_required",
        "quantity": 1,
        "unit": "项",
        "invoiceUnitCost": 100,
        "customerUnitQuote": 200,
        "checkInDate": null,
        "transportType": null,
        "origin": null,
        "destination": null
      },
      {
        "rowKey": "2026-08-06:酒店:成都测试酒店:1",
        "dayNumber": 1,
        "serviceDate": "2026-08-06",
        "city": "成都",
        "section": "hotel",
        "category": "hotel",
        "title": "成都测试酒店",
        "details": null,
        "bookingStatus": "pending",
        "quantity": 1,
        "unit": "间夜",
        "invoiceUnitCost": 500,
        "customerUnitQuote": 525,
        "checkInDate": "2026-08-06",
        "transportType": null,
        "origin": null,
        "destination": null
      },
      {
        "rowKey": "2026-08-07:机票:北京-成都机票:1",
        "dayNumber": 2,
        "serviceDate": "2026-08-07",
        "city": "重庆",
        "section": "transport",
        "category": "flight",
        "title": "北京-成都机票",
        "details": "来源分类：机票",
        "bookingStatus": "pending",
        "quantity": 1,
        "unit": "张",
        "invoiceUnitCost": 1000,
        "customerUnitQuote": 0,
        "checkInDate": null,
        "transportType": "国内航班",
        "origin": "北京",
        "destination": "成都"
      }
    ],
    "totals": {"cost": 1600, "quote": 725, "grossProfit": -875}
  }'::jsonb;
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
    '成本表导入事务测试',
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

  insert into public.customer_files (
    customer_id,
    name,
    storage_path,
    size_bytes,
    mime_type
  )
  values (
    v_customer_id,
    'test-cost-sheet.docx',
    'tests/' || gen_random_uuid()::text || '-cost-sheet.docx',
    1,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
  returning id into v_file_id;

  v_first_import := public.import_operation_cost_sheet(
    v_case_id,
    v_file_id,
    repeat('a', 64),
    v_payload,
    true
  );
  if (v_first_import->>'inserted')::integer <> 3 then
    raise exception '测试失败：首次导入数量不正确 %', v_first_import;
  end if;
  if (
    select count(*)
    from public.operation_service_items
    where case_id = v_case_id
  ) <> 3 then
    raise exception '测试失败：首次导入未写入 3 条服务';
  end if;
  if (
    select count(*)
    from public.operation_days
    where case_id = v_case_id
      and city is not null
  ) <> 2 then
    raise exception '测试失败：Day 城市未写入';
  end if;
  if (
    select count(*)
    from public.operation_service_items
    where case_id = v_case_id
      and city is not null
  ) <> 3 then
    raise exception '测试失败：服务城市未写入';
  end if;

  update public.operation_service_items
  set title = '人工修改后的用车',
      import_id = null
  where case_id = v_case_id
    and import_row_key = '2026-08-06:市区用车:5座用车:1';

  v_second_import := public.import_operation_cost_sheet(
    v_case_id,
    v_file_id,
    repeat('b', 64),
    v_payload,
    true
  );
  if (v_second_import->>'inserted')::integer <> 2
     or (v_second_import->>'skippedManual')::integer <> 1 then
    raise exception '测试失败：替换导入未保留人工记录 %', v_second_import;
  end if;
  if not exists (
    select 1
    from public.operation_service_items
    where case_id = v_case_id
      and title = '人工修改后的用车'
      and import_id is null
  ) then
    raise exception '测试失败：人工编辑记录被覆盖';
  end if;

  v_duplicate := public.import_operation_cost_sheet(
    v_case_id,
    v_file_id,
    repeat('b', 64),
    v_payload,
    true
  );
  if not (v_duplicate->>'duplicate')::boolean then
    raise exception '测试失败：相同内容未被识别为重复导入';
  end if;
end;
$test$;
select pass('operation cost sheet import');
select * from finish();

rollback;
