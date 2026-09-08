begin;

delete from public.customers where id::text like 'ef100000-0000-4000-8000-%';

insert into public.customers (
  id, name, source, first_inquiry_at, contact, whatsapp_status, profile,
  expected_amount, level, system_suggested_level, priority, communication_status,
  status, itinerary_status, quotation_status, service_assignment_mode,
  service_workbench, service_owner_user_id, service_assigned_at, created_at, updated_at
) values
  (
    'ef100000-0000-4000-8000-000000000001',
    '[客服接手测试] 客服A｜双已出待接手', '官网', now() - interval '2 hours',
    'handoff-a@example.test', '已添加邮箱', '家庭', 50000,
    'A', 'A', '高', '我方已回复，等待客户', '跟进中', '暂不需要', '暂不需要',
    'exclusive', 'A', (select id from public.crm_users where username = 'service_gaoyuanbo'), now() - interval '2 hours', now() - interval '2 hours', now()
  ),
  (
    'ef100000-0000-4000-8000-000000000002',
    '[客服接手测试] 未分配｜双已出待人工分配', '官网', now() - interval '2 hours',
    'handoff-unassigned@example.test', '未添加', '个人', 30000,
    'B', 'B', '中', '待首次跟进', '跟进中', '暂不需要', '暂不需要',
    'round_robin', null, null, null, now() - interval '2 hours', now()
  );


update public.customers
set service_workbench = null, service_owner_user_id = null, service_assigned_at = null
where id = 'ef100000-0000-4000-8000-000000000002';


update public.customers set itinerary_status = '已出行程', itinerary_status_updated_at = now()
where id::text like 'ef100000-0000-4000-8000-%';
update public.customers set quotation_status = '已出报价', quotation_status_updated_at = now()
where id::text like 'ef100000-0000-4000-8000-%';

commit;
