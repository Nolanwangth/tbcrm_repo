begin;


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
  select start_date into v_arrival from public.operation_cases where id = new.case_id;
  v_base_date := coalesce(new.service_date, v_arrival);

  for v_template in
    select * from (values
      ('hotel',30,'booking','确认酒店预订（房型、人数）'),
      ('hotel',30,'child_policy','确认儿童入住政策'),
      ('hotel',14,'confirmation','获取酒店确认号'),
      ('hotel',7,'address','确认酒店地址及交通'),
      ('hotel',3,'customer','发送酒店信息给客户'),
      ('rail',14,'passport','确认乘车人护照信息'),
      ('rail',14,'ticketing','完成出票，获取座位号'),
      ('rail',14,'child_policy','确认儿童票政策'),
      ('rail',7,'station','确认出发站交通方式'),
      ('rail',7,'transfer','安排送站服务（如需）'),
      ('rail',3,'customer','发送车票信息给客户'),
      ('rail',1,'final','确认检票口及出发提醒'),
      ('flight',14,'passport','确认乘机人护照信息'),
      ('flight',14,'ticketing','完成出票，获取座位号'),
      ('flight',7,'baggage','确认行李额度'),
      ('flight',7,'airport_transfer','确认机场交通（送机/接机）'),
      ('flight',3,'customer','发送航班信息给客户'),
      ('flight',1,'final','确认航班动态'),
      ('other_transport',14,'booking','确认大交通预订'),
      ('other_transport',7,'transfer','确认衔接交通安排'),
      ('other_transport',3,'customer','发送交通信息给客户'),
      ('driver',14,'booking','确认车辆预订（车型、车牌）'),
      ('driver',14,'contact','确认司机联系方式及语言'),
      ('driver',7,'luggage','确认行李空间'),
      ('driver',7,'pickup','确认上车地点及时间'),
      ('driver',3,'customer','发送包车安排给客户'),
      ('driver',1,'final','与司机最终确认'),
      ('guide',14,'booking','确认导游预订及资质'),
      ('guide',14,'contact','确认导游联系方式'),
      ('guide',7,'meeting','确认集合时间地点'),
      ('guide',7,'briefing','与导游沟通客户偏好'),
      ('guide',3,'customer','发送导游安排给客户'),
      ('guide',1,'final','与导游最终确认'),
      ('ticket',14,'booking','完成购票或预约'),
      ('ticket',14,'child_policy','确认儿童票政策'),
      ('ticket',7,'opening','确认景点开放时间'),
      ('ticket',7,'entry','确认入园方式'),
      ('ticket',3,'customer','发送门票信息给客户'),
      ('ticket',1,'final','确认天气及注意事项'),
      ('meal',14,'booking','完成餐厅预订（时间、人数）'),
      ('meal',7,'diet','确认饮食禁忌及过敏'),
      ('meal',3,'transport','确认到店交通'),
      ('meal',1,'final','与餐厅最终确认'),
      ('insurance',14,'plan','确认保险方案及保额'),
      ('insurance',7,'policy','完成投保并获取保单号'),
      ('insurance',3,'customer','发送保单信息给客户'),
      ('other',14,'booking','确认项目预订'),
      ('other',7,'details','确认细节及时间安排'),
      ('other',3,'customer','发送安排给客户')
    ) as templates(category, offset_days, template_key, title)
    where templates.category = new.category
  loop
    v_auto_key := 'checklist:v1:' || new.id::text || ':' || v_template.template_key;
    update public.operation_reminders
    set day_id = new.day_id,
      service_item_id = new.id,
      title = case when status = 'pending' and not is_customized then v_template.title else title end,
      due_date = case when status = 'pending' and not is_customized then case when v_base_date is null then null else v_base_date - v_template.offset_days end else due_date end,
      anchor_type = case when status = 'pending' and not is_customized then case when new.service_date is null then 'arrival' else 'service' end else anchor_type end,
      offset_days = case when status = 'pending' and not is_customized then v_template.offset_days else offset_days end
    where case_id = new.case_id and auto_key = v_auto_key;

    if not found then
      insert into public.operation_reminders (
        case_id,day_id,service_item_id,title,due_date,anchor_type,offset_days,
        auto_key,is_auto,task_kind,template_key,template_version
      ) values (
        new.case_id,new.day_id,new.id,v_template.title,
        case when v_base_date is null then null else v_base_date - v_template.offset_days end,
        case when new.service_date is null then 'arrival' else 'service' end,
        v_template.offset_days,v_auto_key,true,'checklist',v_template.template_key,'2'
      );
    end if;
  end loop;
  return new;
end;
$$;


alter table public.operation_service_items disable trigger operation_service_items_set_updated_at;
update public.operation_service_items set category = category;
alter table public.operation_service_items enable trigger operation_service_items_set_updated_at;

commit;
