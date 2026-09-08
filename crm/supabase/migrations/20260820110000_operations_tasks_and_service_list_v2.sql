begin;

alter table public.operation_service_items
  drop constraint if exists operation_service_items_category_check,
  drop constraint if exists operation_service_items_check,
  drop constraint if exists operation_service_items_section_category_check;

alter table public.operation_service_items
  add constraint operation_service_items_category_check check (
    category in ('guide','driver','ticket','meal','insurance','other','hotel','flight','rail','other_transport')
  ),
  add constraint operation_service_items_section_category_check check (
    (section = 'daily' and day_id is not null and category in ('guide','driver','ticket','meal','insurance','other'))
    or (section = 'hotel' and day_id is null and category = 'hotel')
    or (section = 'transport' and day_id is null and category in ('flight','rail','other_transport'))
  );

alter table public.operation_reminders
  alter column due_date drop not null,
  add column task_kind text not null default 'reminder' check (task_kind in ('reminder','checklist')),
  add column template_key text,
  add column template_version text,
  add column assignee_user_id uuid references public.crm_users(id) on delete set null,
  add column is_customized boolean not null default false;

create index operation_reminders_assignee_due_idx
  on public.operation_reminders (assignee_user_id, due_date, status)
  where status = 'pending';

create or replace function public.sync_operation_checklist_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arrival date;
  v_base_date date;
  v_template record;
  v_auto_key text;
begin
  select travel.expected_start_date into v_arrival
  from public.operation_cases cases
  left join public.travel_needs travel on travel.customer_id = cases.customer_id
  where cases.id = new.case_id;
  v_base_date := coalesce(new.service_date, v_arrival);

  for v_template in
    select * from (values
      ('hotel',30,'booking','确认酒店预订（房型、人数）'), ('hotel',14,'confirmation','获取酒店确认号'), ('hotel',3,'customer','发送酒店信息给客户'),
      ('flight',14,'ticketing','完成出票并核对乘客信息'), ('flight',7,'baggage','确认行李额度及机场交通'), ('flight',1,'final','确认航班动态'),
      ('rail',14,'ticketing','完成出票并核对乘客信息'), ('rail',7,'station','确认车站交通安排'), ('rail',1,'final','确认检票口及出发提醒'),
      ('other_transport',14,'booking','确认大交通预订'), ('other_transport',3,'customer','发送交通信息给客户'),
      ('driver',14,'booking','确认车辆、车型及司机'), ('driver',7,'pickup','确认上车地点及时间'), ('driver',1,'final','与司机最终确认'),
      ('guide',14,'booking','确认导游预订及资质'), ('guide',7,'briefing','沟通客户偏好与集合信息'), ('guide',1,'final','与导游最终确认'),
      ('ticket',14,'booking','完成购票或预约'), ('ticket',7,'entry','确认开放时间和入园方式'), ('ticket',1,'final','确认天气及注意事项'),
      ('meal',14,'booking','完成餐厅预订'), ('meal',7,'diet','确认饮食禁忌及过敏'), ('meal',1,'final','与餐厅最终确认'),
      ('insurance',14,'plan','确认保险方案及保额'), ('insurance',7,'policy','完成投保并获取保单号'), ('insurance',3,'customer','发送保单信息给客户'),
      ('other',14,'booking','确认项目预订'), ('other',7,'details','确认项目细节及时间'), ('other',3,'customer','发送安排给客户')
    ) as templates(category, offset_days, template_key, title)
    where templates.category = new.category
  loop
    v_auto_key := 'checklist:v1:' || new.id::text || ':' || v_template.template_key;
    update public.operation_reminders
    set day_id = new.day_id,
      due_date = case when status = 'pending' and not is_customized then case when v_base_date is null then null else v_base_date - v_template.offset_days end else due_date end,
      anchor_type = case when status = 'pending' and not is_customized then case when new.service_date is null then 'arrival' else 'service' end else anchor_type end,
      offset_days = case when status = 'pending' and not is_customized then v_template.offset_days else offset_days end
    where case_id = new.case_id and auto_key = v_auto_key;

    if not found then
      insert into public.operation_reminders (
      case_id, day_id, service_item_id, title, due_date, anchor_type, offset_days,
      auto_key, is_auto, task_kind, template_key, template_version
      ) values (
        new.case_id, new.day_id, new.id, v_template.title,
        case when v_base_date is null then null else v_base_date - v_template.offset_days end,
        case when new.service_date is null then 'arrival' else 'service' end,
        v_template.offset_days, v_auto_key, true, 'checklist', v_template.template_key, '1'
      );
    end if;
  end loop;
  return new;
end;
$$;

create trigger operation_service_items_sync_checklist
after insert or update of category, service_date, day_id on public.operation_service_items
for each row execute function public.sync_operation_checklist_tasks();

create or replace function public.sync_operation_reminders_from_travel_dates()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_case_id uuid;
begin
  if tg_op = 'INSERT' or new.expected_start_date is distinct from old.expected_start_date then
    select id into v_case_id from public.operation_cases where customer_id = new.customer_id;
    if v_case_id is not null then
      perform public.sync_operation_default_reminders(v_case_id);
      update public.operation_reminders
      set due_date = case when new.expected_start_date is null then null else new.expected_start_date - offset_days end
      where case_id = v_case_id and task_kind = 'checklist' and anchor_type = 'arrival'
        and status = 'pending' and not is_customized;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.import_operation_service_list_v2(
  p_case_id uuid, p_file_id uuid, p_content_hash text, p_payload jsonb, p_replace_existing boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import_id uuid; v_existing uuid; v_day jsonb; v_item jsonb; v_day_id uuid;
  v_inserted integer := 0; v_skipped integer := 0; v_customer uuid; v_order integer := 0;
begin
  select customer_id into v_customer from public.operation_cases where id = p_case_id for update;
  if v_customer is null then raise exception '计调客户不存在'; end if;
  perform 1 from public.customer_files where id = p_file_id and customer_id = v_customer;
  if not found then raise exception '服务清单文件不存在或不属于当前客户'; end if;
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then raise exception '服务清单没有可导入项目'; end if;
  select id into v_existing from public.operation_cost_sheet_imports where case_id = p_case_id and content_hash = p_content_hash order by created_at desc limit 1;
  if v_existing is not null then return jsonb_build_object('importId',v_existing,'inserted',0,'skippedManual',0,'duplicate',true); end if;
  if p_replace_existing then
    delete from public.operation_service_items where case_id = p_case_id and import_id is not null;
    delete from public.operation_days where case_id = p_case_id and import_id is not null and not exists (select 1 from public.operation_service_items i where i.day_id = operation_days.id);
  end if;
  insert into public.operation_cost_sheet_imports(case_id,source_file_id,content_hash,item_count,total_cost,total_quote,total_gross_profit)
  values(p_case_id,p_file_id,p_content_hash,jsonb_array_length(p_payload->'items'),(p_payload->'totals'->>'cost')::numeric,(p_payload->'totals'->>'quote')::numeric,(p_payload->'totals'->>'grossProfit')::numeric)
  returning id into v_import_id;
  for v_day in select value from jsonb_array_elements(p_payload->'days') loop
    insert into public.operation_days(case_id,day_number,service_date,city,sort_order,import_id)
    values(p_case_id,(v_day->>'dayNumber')::integer,(v_day->>'serviceDate')::date,nullif(btrim(v_day->>'city'),''),(v_day->>'dayNumber')::integer,v_import_id)
    on conflict(case_id,day_number) do update set service_date=coalesce(operation_days.service_date,excluded.service_date), city=coalesce(operation_days.city,excluded.city)
    returning id into v_day_id;
  end loop;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_order := v_order + 1;
    if (v_item->>'quantity')::numeric <= 0 or (v_item->>'invoiceUnitCost')::numeric < 0 or (v_item->>'customerUnitQuote')::numeric < 0 then raise exception '服务项目包含不允许的数量或金额'; end if;
    if v_item->>'section' = 'daily' and v_item->>'category' not in ('guide','driver','ticket','meal','insurance','other') then raise exception '每日服务分类无效'; end if;
    if v_item->>'section' = 'hotel' and v_item->>'category' <> 'hotel' then raise exception '酒店分类无效'; end if;
    if v_item->>'section' = 'transport' and v_item->>'category' not in ('flight','rail','other_transport') then raise exception '大交通分类无效'; end if;
    perform 1 from public.operation_service_items where case_id=p_case_id and import_row_key=v_item->>'rowKey' and import_id is null;
    if found then v_skipped := v_skipped + 1; continue; end if;
    v_day_id := null;
    if v_item->>'section' = 'daily' then select id into v_day_id from public.operation_days where case_id=p_case_id and day_number=(v_item->>'dayNumber')::integer; end if;
    insert into public.operation_service_items(case_id,day_id,section,category,title,details,city,service_date,booking_status,supplier_name,quantity,unit,invoice_unit_cost,customer_unit_quote,check_in_date,check_out_date,room_type,room_count,transport_type,origin,destination,reference_number,departure_time,notes,sort_order,import_id,import_row_key)
    values(p_case_id,v_day_id,v_item->>'section',v_item->>'category',btrim(v_item->>'title'),nullif(btrim(v_item->>'details'),''),nullif(btrim(v_item->>'city'),''),(v_item->>'serviceDate')::date,v_item->>'bookingStatus',nullif(btrim(v_item->>'supplierName'),''),(v_item->>'quantity')::numeric,coalesce(nullif(btrim(v_item->>'unit'),''),'项'),(v_item->>'invoiceUnitCost')::numeric,(v_item->>'customerUnitQuote')::numeric,nullif(v_item->>'checkInDate','')::date,nullif(v_item->>'checkOutDate','')::date,nullif(btrim(v_item->>'roomType'),''),nullif(v_item->>'roomCount','')::integer,nullif(btrim(v_item->>'transportType'),''),nullif(btrim(v_item->>'origin'),''),nullif(btrim(v_item->>'destination'),''),nullif(btrim(v_item->>'referenceNumber'),''),nullif(v_item->>'departureTime','')::time,coalesce(nullif(btrim(v_item->>'details'),''),'由服务清单自动导入'),v_order,v_import_id,v_item->>'rowKey');
    v_inserted := v_inserted + 1;
  end loop;
  update public.operation_cases set service_list_file_id=p_file_id,service_list_status='uploaded',service_list_manual=false where id=p_case_id;
  return jsonb_build_object('importId',v_import_id,'inserted',v_inserted,'skippedManual',v_skipped,'duplicate',false);
end;
$$;

revoke all on function public.import_operation_service_list_v2(uuid,uuid,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.import_operation_service_list_v2(uuid,uuid,text,jsonb,boolean) to service_role;
grant execute on function public.sync_operation_checklist_tasks() to service_role;

commit;
