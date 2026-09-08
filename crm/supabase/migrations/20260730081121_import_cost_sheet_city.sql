begin;

create or replace function public.import_operation_cost_sheet(
  p_case_id uuid,
  p_file_id uuid,
  p_content_hash text,
  p_payload jsonb,
  p_replace_existing boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_import_id uuid;
  v_existing_import_id uuid;
  v_day jsonb;
  v_item jsonb;
  v_day_id uuid;
  v_day_number integer;
  v_service_date date;
  v_existing_date date;
  v_city text;
  v_section text;
  v_category text;
  v_booking_status text;
  v_row_key text;
  v_quantity numeric;
  v_unit_cost numeric;
  v_unit_quote numeric;
  v_item_order integer := 0;
  v_inserted integer := 0;
  v_skipped_manual integer := 0;
begin
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception '成本表内容指纹无效';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or p_payload->>'template' <> 'tripbook-internal-cost-sheet-v1'
     or jsonb_typeof(p_payload->'days') <> 'array'
     or jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') = 0 then
    raise exception '成本表导入数据结构无效';
  end if;

  select customer_id
  into v_customer_id
  from public.operation_cases
  where id = p_case_id;
  if v_customer_id is null then
    raise exception '计调客户不存在';
  end if;

  perform 1
  from public.customer_files
  where id = p_file_id
    and customer_id = v_customer_id;
  if not found then
    raise exception '成本表文件不存在或不属于当前客户';
  end if;

  select id
  into v_existing_import_id
  from public.operation_cost_sheet_imports
  where case_id = p_case_id
    and content_hash = p_content_hash;
  if v_existing_import_id is not null then
    return jsonb_build_object(
      'importId', v_existing_import_id,
      'inserted', 0,
      'skippedManual', 0,
      'duplicate', true
    );
  end if;

  if exists (
    select 1
    from public.operation_cost_sheet_imports
    where case_id = p_case_id
  ) and not p_replace_existing then
    raise exception '该客户已有成本表导入记录，请确认替换后重试';
  end if;

  if p_replace_existing then
    delete from public.operation_service_items as item
    using public.operation_cost_sheet_imports as batch
    where item.import_id = batch.id
      and batch.case_id = p_case_id;

    delete from public.operation_cost_sheet_imports
    where case_id = p_case_id;
  end if;

  insert into public.operation_cost_sheet_imports (
    case_id,
    source_file_id,
    content_hash,
    item_count,
    total_cost,
    total_quote,
    total_gross_profit
  )
  values (
    p_case_id,
    p_file_id,
    p_content_hash,
    jsonb_array_length(p_payload->'items'),
    (p_payload->'totals'->>'cost')::numeric,
    (p_payload->'totals'->>'quote')::numeric,
    (p_payload->'totals'->>'grossProfit')::numeric
  )
  returning id into v_import_id;

  for v_day in
    select value
    from jsonb_array_elements(p_payload->'days')
  loop
    v_day_number := (v_day->>'dayNumber')::integer;
    v_service_date := (v_day->>'serviceDate')::date;
    v_city := nullif(btrim(v_day->>'city'), '');
    if v_day_number < 1 then
      raise exception 'Day 序号无效';
    end if;

    select id, service_date
    into v_day_id, v_existing_date
    from public.operation_days
    where case_id = p_case_id
      and day_number = v_day_number;

    if found then
      if v_existing_date is not null and v_existing_date <> v_service_date then
        raise exception 'Day % 已存在且日期为 %，与导入日期 % 冲突',
          v_day_number, v_existing_date, v_service_date;
      end if;
      update public.operation_days
      set service_date = coalesce(service_date, v_service_date),
          city = coalesce(nullif(btrim(city), ''), v_city)
      where id = v_day_id;
    else
      insert into public.operation_days (
        case_id,
        day_number,
        service_date,
        city,
        sort_order,
        import_id
      )
      values (
        p_case_id,
        v_day_number,
        v_service_date,
        v_city,
        v_day_number,
        v_import_id
      )
      returning id into v_day_id;
    end if;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(p_payload->'items')
  loop
    v_item_order := v_item_order + 1;
    v_row_key := btrim(v_item->>'rowKey');
    v_day_number := (v_item->>'dayNumber')::integer;
    v_service_date := (v_item->>'serviceDate')::date;
    v_city := nullif(btrim(v_item->>'city'), '');
    v_section := v_item->>'section';
    v_category := v_item->>'category';
    v_booking_status := v_item->>'bookingStatus';
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := (v_item->>'invoiceUnitCost')::numeric;
    v_unit_quote := (v_item->>'customerUnitQuote')::numeric;

    if v_row_key is null or v_row_key = '' or char_length(v_row_key) > 500 then
      raise exception '成本表行标识无效';
    end if;
    if v_quantity <= 0 or v_unit_cost < 0 or v_unit_quote < 0 then
      raise exception '成本表项目包含不允许的数量或金额';
    end if;
    if v_booking_status not in ('pending', 'booking', 'confirmed', 'not_required', 'cancelled') then
      raise exception '成本表项目预订状态无效';
    end if;
    if not (
      (v_section = 'daily' and v_category in ('guide', 'driver', 'ticket', 'other'))
      or (v_section = 'hotel' and v_category = 'hotel')
      or (v_section = 'transport' and v_category in ('flight', 'rail', 'other_transport'))
    ) then
      raise exception '成本表项目分类无效';
    end if;

    perform 1
    from public.operation_service_items
    where case_id = p_case_id
      and import_row_key = v_row_key
      and import_id is null;
    if found then
      v_skipped_manual := v_skipped_manual + 1;
      continue;
    end if;

    v_day_id := null;
    if v_section = 'daily' then
      select id
      into v_day_id
      from public.operation_days
      where case_id = p_case_id
        and day_number = v_day_number;
      if v_day_id is null then
        raise exception '每日服务缺少对应 Day %', v_day_number;
      end if;
    end if;

    insert into public.operation_service_items (
      case_id,
      day_id,
      section,
      category,
      title,
      details,
      city,
      service_date,
      booking_status,
      quantity,
      unit,
      invoice_unit_cost,
      customer_unit_quote,
      check_in_date,
      transport_type,
      origin,
      destination,
      notes,
      sort_order,
      import_id,
      import_row_key
    )
    values (
      p_case_id,
      v_day_id,
      v_section,
      v_category,
      btrim(v_item->>'title'),
      nullif(btrim(v_item->>'details'), ''),
      v_city,
      v_service_date,
      v_booking_status,
      v_quantity,
      coalesce(nullif(btrim(v_item->>'unit'), ''), '项'),
      v_unit_cost,
      v_unit_quote,
      case when v_section = 'hotel' then nullif(v_item->>'checkInDate', '')::date else null end,
      case when v_section = 'transport' then nullif(btrim(v_item->>'transportType'), '') else null end,
      case when v_section = 'transport' then nullif(btrim(v_item->>'origin'), '') else null end,
      case when v_section = 'transport' then nullif(btrim(v_item->>'destination'), '') else null end,
      '由内部成本表自动导入',
      v_item_order,
      v_import_id,
      v_row_key
    );
    v_inserted := v_inserted + 1;
  end loop;

  update public.operation_cases
  set service_list_file_id = p_file_id,
      service_list_status = 'uploaded',
      service_list_manual = false
  where id = p_case_id;

  update public.customers
  set updated_at = now()
  where id = v_customer_id;

  return jsonb_build_object(
    'importId', v_import_id,
    'inserted', v_inserted,
    'skippedManual', v_skipped_manual,
    'duplicate', false
  );
end;
$$;

revoke all on function public.import_operation_cost_sheet(uuid, uuid, text, jsonb, boolean)
from public, anon, authenticated;

grant execute on function public.import_operation_cost_sheet(uuid, uuid, text, jsonb, boolean)
to service_role;

commit;
