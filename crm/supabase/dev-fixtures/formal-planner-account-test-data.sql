begin;



delete from public.customers where name like '[规划师账号测试]%';

insert into public.customers (
  id,name,source,first_inquiry_at,nationality,contact,whatsapp_status,profile,amount_range,expected_amount,
  level,system_suggested_level,priority,communication_status,status,assignee,assignee_user_id,
  itinerary_status,quotation_status,itinerary_status_updated_at,quotation_status_updated_at,created_at,updated_at
) values
  ('de100000-0000-4000-8000-000000000001','[规划师账号测试] 张01 行程已超时','官网',now()-interval '3 days','英国','planner-zhang-01@example.test','已添加邮箱','家庭','3万至5万元',45000,'A','A','高','客户已回复，待我方处理','跟进中','张栩杰','aa100000-0000-4000-8000-000000000001','未出行程','暂不需要',now()-interval '25 hours',now(),now()-interval '3 days',now()),
  ('de100000-0000-4000-8000-000000000002','[规划师账号测试] 张02 报价剩余30分钟','官网',now()-interval '2 days','法国','planner-zhang-02@example.test','已添加whatsapp','情侣','5万至10万元',72000,'A','A','紧急','客户已回复，待我方处理','跟进中','张栩杰','aa100000-0000-4000-8000-000000000001','暂不需要','未出报价',now(),now()-interval '47 hours 30 minutes',now()-interval '2 days',now()),
  ('de100000-0000-4000-8000-000000000003','[规划师账号测试] 张03 无规划师提醒','官网',now()-interval '1 day','德国','planner-zhang-03@example.test','已添加微信','个人','1万至3万元',26000,'B','B','中','我方已回复，等待客户','跟进中','张栩杰','aa100000-0000-4000-8000-000000000001','已出行程','已出报价',now(),now(),now()-interval '1 day',now()),
  ('de100000-0000-4000-8000-000000000004','[规划师账号测试] 徐01 报价已超时','官网',now()-interval '4 days','加拿大','planner-xu-01@example.test','已添加邮箱','家庭','5万至10万元',68000,'A','A','高','客户已回复，待我方处理','跟进中','徐晨雷','aa100000-0000-4000-8000-000000000002','暂不需要','报价待修改',now(),now()-interval '49 hours',now()-interval '4 days',now()),
  ('de100000-0000-4000-8000-000000000005','[规划师账号测试] 徐02 行程剩余30分钟','官网',now()-interval '2 days','澳大利亚','planner-xu-02@example.test','已添加whatsapp','朋友','3万至5万元',39000,'B','B','紧急','客户已回复，待我方处理','跟进中','徐晨雷','aa100000-0000-4000-8000-000000000002','行程待修改','暂不需要',now()-interval '23 hours 30 minutes',now(),now()-interval '2 days',now()),
  ('de100000-0000-4000-8000-000000000006','[规划师账号测试] 徐03 无规划师提醒','官网',now()-interval '1 day','新加坡','planner-xu-03@example.test','已添加微信','个人','1万至3万元',24000,'B','B','低','客户暂缓决定','跟进中','徐晨雷','aa100000-0000-4000-8000-000000000002','暂不需要','暂不需要',now(),now(),now()-interval '1 day',now());



update public.customers set itinerary_status_updated_at=now()-interval '25 hours', quotation_status_updated_at=now() where id='de100000-0000-4000-8000-000000000001';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now()-interval '47 hours 30 minutes' where id='de100000-0000-4000-8000-000000000002';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now() where id='de100000-0000-4000-8000-000000000003';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now()-interval '49 hours' where id='de100000-0000-4000-8000-000000000004';
update public.customers set itinerary_status_updated_at=now()-interval '23 hours 30 minutes', quotation_status_updated_at=now() where id='de100000-0000-4000-8000-000000000005';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now() where id='de100000-0000-4000-8000-000000000006';

commit;
