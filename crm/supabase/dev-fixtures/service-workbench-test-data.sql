begin;

delete from public.customers where id::text like 'ee100000-0000-4000-8000-%';

update public.service_workbench_slots slots
set user_id = users.id, enabled = true, updated_at = now()
from public.crm_users users
where (slots.slot, users.username) in (
  ('A','service_gaoyuanbo'),
  ('B','service_caijinyang'),
  ('C','service_huangchuqiao')
);

do $$
begin
  if (select count(*) from public.service_workbench_slots where enabled and user_id is not null) <> 3 then
    raise exception '正式客服测试账号不完整，无法装载客服工作台 fixture';
  end if;
end $$;

update public.service_assignment_state set next_slot = 'A', updated_at = now() where singleton = true;

insert into public.customers (
  id,name,source,first_inquiry_at,nationality,contact,whatsapp_status,profile,amount_range,expected_amount,
  level,system_suggested_level,priority,communication_status,status,itinerary_status,quotation_status,
  service_assignment_mode,created_at,updated_at
) values
  ('ee100000-0000-4000-8000-000000000001','[客服工作台测试] 公共01｜A｜紧急客户','官网',now()-interval '10 minutes','英国','service-01@example.test','已添加邮箱','家庭','5万至10万元',68000,'A','A','需立即处理','待首次跟进','跟进中','暂不需要','暂不需要','round_robin',now()-interval '10 minutes',now()),
  ('ee100000-0000-4000-8000-000000000002','[客服工作台测试] 公共02｜B｜已到期回访','官网',now()-interval '2 hours','法国','service-02@example.test','已添加微信','情侣','3万至5万元',42000,'B','B','中','我方已回复，等待客户','跟进中','暂不需要','暂不需要','round_robin',now()-interval '2 hours',now()),
  ('ee100000-0000-4000-8000-000000000003','[客服工作台测试] 公共03｜C｜新跟进','官网',now()-interval '30 minutes','德国','service-03@example.test','已添加whatsapp','个人','1万至3万元',25000,'B','B','中','待首次跟进','跟进中','暂不需要','暂不需要','round_robin',now()-interval '30 minutes',now()),
  ('ee100000-0000-4000-8000-000000000004','[客服工作台测试] 公共04｜A｜未来回访','官网',now()-interval '1 day','意大利','service-04@example.test','已添加邮箱','家庭','5万至10万元',74000,'A','A','中','我方已回复，等待客户','跟进中','暂不需要','暂不需要','round_robin',now()-interval '1 day',now()),
  ('ee100000-0000-4000-8000-000000000005','[客服工作台测试] 公共05｜B｜新跟进','官网',now()-interval '40 minutes','西班牙','service-05@example.test','已添加微信','朋友','3万至5万元',46000,'B','B','高','待首次跟进','跟进中','暂不需要','暂不需要','round_robin',now()-interval '40 minutes',now()),
  ('ee100000-0000-4000-8000-000000000006','[客服工作台测试] 公共06｜C｜紧急优先于回访','官网',now()-interval '2 days','荷兰','service-06@example.test','已添加whatsapp','情侣','5万至10万元',81000,'A','A','紧急','客户已回复，待我方处理','跟进中','暂不需要','暂不需要','round_robin',now()-interval '2 days',now());

insert into public.customers (
  id,name,source,first_inquiry_at,contact,whatsapp_status,profile,expected_amount,level,system_suggested_level,
  priority,communication_status,status,won_at,won_amount,itinerary_status,quotation_status,service_assignment_mode,service_workbench,created_at,updated_at
) values
  ('ee100000-0000-4000-8000-000000000007','[客服工作台测试] 专属A｜无需回访','官网',now()-interval '3 hours','exclusive-a@example.test','已添加邮箱','个人',18000,'C','C','低','客户暂缓决定','跟进中',null,null,'暂不需要','暂不需要','exclusive','A',now()-interval '3 hours',now()),
  ('ee100000-0000-4000-8000-000000000008','[客服工作台测试] 专属B｜未来30分钟回访','官网',now()-interval '4 hours','exclusive-b@example.test','已添加微信','家庭',53000,'B','B','中','我方已回复，等待客户','跟进中',null,null,'暂不需要','暂不需要','exclusive','B',now()-interval '4 hours',now()),
  ('ee100000-0000-4000-8000-000000000009','[客服工作台测试] 专属C｜已成交退出任务','官网',now()-interval '5 days','exclusive-c@example.test','已添加whatsapp','情侣',96000,'A','A','高','我方已回复，等待客户','已成交',now()-interval '1 day',96000,'暂不需要','已出报价','exclusive','C',now()-interval '5 days',now());


update public.customers
set service_assigned_at = created_at
where id::text like 'ee100000-0000-4000-8000-%'
  and service_workbench is not null;

insert into public.follow_ups (id,customer_id,summary,communication_status,next_callback_at,callback_not_required,callback_skip_reason,created_at,updated_at) values
  ('ee200000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000002','已完成首次联系，约定再次确认预算。','我方已回复，等待客户',now()-interval '15 minutes',false,null,now()-interval '90 minutes',now()-interval '90 minutes'),
  ('ee200000-0000-4000-8000-000000000002','ee100000-0000-4000-8000-000000000004','客户暂时无法确认同行人，明天再联系。','我方已回复，等待客户',now()+interval '20 hours',false,null,now()-interval '20 hours',now()-interval '20 hours'),
  ('ee200000-0000-4000-8000-000000000003','ee100000-0000-4000-8000-000000000006','已发送资料但客户要求今天再次联系。','客户已回复，待我方处理',now()-interval '2 hours',false,null,now()-interval '1 day',now()-interval '1 day'),
  ('ee200000-0000-4000-8000-000000000004','ee100000-0000-4000-8000-000000000007','客户明确表示本阶段无需电话回访。','客户暂缓决定',null,true,'客户主动联系时再继续',now()-interval '2 hours',now()-interval '2 hours'),
  ('ee200000-0000-4000-8000-000000000005','ee100000-0000-4000-8000-000000000008','已沟通基础需求，半小时后补充确认。','我方已回复，等待客户',now()+interval '30 minutes',false,null,now()-interval '3 hours',now()-interval '3 hours');

update public.customers customers
set current_callback_at = follow_ups.next_callback_at,
    callback_not_required = follow_ups.callback_not_required,
    callback_skip_reason = follow_ups.callback_skip_reason,
    latest_follow_up_at = follow_ups.created_at
from public.follow_ups
where follow_ups.customer_id = customers.id
  and follow_ups.id::text like 'ee200000-0000-4000-8000-%';

insert into public.service_assignment_events(customer_id,action,assignment_mode,to_workbench,actor_name_snapshot,reason,created_at)
select id,
       case when service_assignment_mode='exclusive' then 'exclusive_assigned' else 'auto_assigned' end,
       service_assignment_mode,service_workbench,'dev fixture','客服工作台功能测试数据',service_assigned_at
from public.customers where id::text like 'ee100000-0000-4000-8000-%';


update public.service_workbench_slots set enabled = false, updated_at = now();
insert into public.customers (
  id,name,source,first_inquiry_at,contact,whatsapp_status,profile,expected_amount,level,system_suggested_level,
  priority,communication_status,status,itinerary_status,quotation_status,service_assignment_mode,created_at,updated_at
) values (
  'ee100000-0000-4000-8000-000000000010','[客服工作台测试] 三客服不可用｜待人工分配','官网',now(),'unassigned@example.test','未添加','未确定',12000,'C','C',
  '中','待首次跟进','跟进中','暂不需要','已出报价','round_robin',now(),now()
);
update public.customers
set quotation_status_updated_at = now()-interval '49 hours'
where id = 'ee100000-0000-4000-8000-000000000010';
update public.service_workbench_slots set enabled = true, updated_at = now();

commit;
