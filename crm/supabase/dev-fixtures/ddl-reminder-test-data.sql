begin;

delete from public.customers where name like '[DDL测试]%';
delete from public.crm_users where username in ('ddl_planner_a','ddl_planner_b','ddl_service');

insert into public.crm_users (id, username, display_name, password_salt, password_hash)
values
  ('dd000000-0000-4000-8000-000000000001','ddl_planner_a','DDL测试-规划师甲','ce0fae0dad9be19066bc258ff328f8d5','e721e57075c98fed279dfcc5b0c52fa0a85e1ffaaeef7dbe9f7c5e4cf095bae2c7ec6e32f36b24d1b7de355d8dbc8b5e353a1a96b3ee6f6b25e157f75cc2b557'),
  ('dd000000-0000-4000-8000-000000000002','ddl_planner_b','DDL测试-规划师乙','3bb2aecc777c28b94a62b08912f93d07','e838663a56c3bf9833a1f38b3c77101b46ebd3bd3cf33ace80295c80738a139f4a90ae039d9df1c53b6e29adf40a9873b962eb1bbae67064befdbc816cfd179b'),
  ('dd000000-0000-4000-8000-000000000003','ddl_service','DDL测试-客服','c882e2e8be73dc9391362c175b729776','940adf0e5de40031d17b7887ca3e4990327e31972f76f970ca1b85b9fdac455159c8a3da5b045bb645d2d63ef8554b26502874a22d6d009a64a0bcb05af83d20');

update public.crm_users
set role = case when username like 'ddl_planner_%' then 'planner' else 'service' end
where username in ('ddl_planner_a','ddl_planner_b','ddl_service');

insert into public.customers (
  id,name,source,first_inquiry_at,nationality,contact,whatsapp_status,profile,amount_range,expected_amount,
  level,system_suggested_level,priority,communication_status,status,assignee,itinerary_status,quotation_status,created_at,updated_at
) values
  ('dd100000-0000-4000-8000-000000000001','[DDL测试] A01 行程超时｜预期1条','官网',now()-interval '4 days','英国','ddl-a01@example.test','已添加邮箱','情侣','3万至5万元',42000,'A','A','高','客户已回复，待我方处理','跟进中','DDL测试-规划师甲','未出行程','暂不需要',now()-interval '4 days',now()),
  ('dd100000-0000-4000-8000-000000000002','[DDL测试] A02 报价超时｜预期1条','官网',now()-interval '5 days','法国','ddl-a02@example.test','已添加邮箱','家庭','5万至10万元',68000,'A','A','高','客户已回复，待我方处理','跟进中','DDL测试-规划师甲','暂不需要','未出报价',now()-interval '5 days',now()),
  ('dd100000-0000-4000-8000-000000000003','[DDL测试] A03 行程报价双超时｜预期2条','官网',now()-interval '6 days','德国','ddl-a03@example.test','已添加whatsapp','家庭','10万元以上',128000,'S','S','需立即处理','客户已回复，待我方处理','跟进中','DDL测试-规划师甲','未出行程','未出报价',now()-interval '6 days',now()),
  ('dd100000-0000-4000-8000-000000000004','[DDL测试] A04 报价后未跟进｜预期1条','官网',now()-interval '7 days','西班牙','ddl-a04@example.test','已添加whatsapp','情侣','5万至10万元',76000,'A','A','高','我方已回复，等待客户','跟进中','DDL测试-规划师甲','已出行程','已出报价',now()-interval '7 days',now()),
  ('dd100000-0000-4000-8000-000000000005','[DDL测试] A05 23h与47h未到期｜预期0条','官网',now()-interval '2 days','意大利','ddl-a05@example.test','已添加邮箱','个人','3万至5万元',36000,'B','B','中','客户已读未回','跟进中','DDL测试-规划师甲','未出行程','未出报价',now()-interval '2 days',now()),
  ('dd100000-0000-4000-8000-000000000006','[DDL测试] A06 报价后47h已跟进｜预期0条','官网',now()-interval '4 days','荷兰','ddl-a06@example.test','已添加微信','朋友','5万至10万元',59000,'A','A','中','我方已回复，等待客户','跟进中','DDL测试-规划师甲','已出行程','已出报价',now()-interval '4 days',now()),
  ('dd100000-0000-4000-8000-000000000007','[DDL测试] B01 行程待修改超时｜预期1条','官网',now()-interval '4 days','美国','ddl-b01@example.test','已添加邮箱','家庭','10万元以上',108000,'A','A','高','客户已回复，待我方处理','跟进中','DDL测试-规划师乙','行程待修改','暂不需要',now()-interval '4 days',now()),
  ('dd100000-0000-4000-8000-000000000008','[DDL测试] B02 报价待修改超时｜预期1条','官网',now()-interval '5 days','加拿大','ddl-b02@example.test','已添加whatsapp','情侣','5万至10万元',82000,'A','A','高','客户已回复，待我方处理','跟进中','DDL测试-规划师乙','暂不需要','报价待修改',now()-interval '5 days',now()),
  ('dd100000-0000-4000-8000-000000000009','[DDL测试] B03 两项待修改超时｜预期2条','官网',now()-interval '6 days','澳大利亚','ddl-b03@example.test','已添加whatsapp','家庭','10万元以上',138000,'S','S','需立即处理','客户已回复，待我方处理','跟进中','DDL测试-规划师乙','行程待修改','报价待修改',now()-interval '6 days',now()),
  ('dd100000-0000-4000-8000-000000000010','[DDL测试] B04 倒计时4h与30m｜预期0条','官网',now()-interval '2 days','新西兰','ddl-b04@example.test','已添加邮箱','个人','1万至3万元',26000,'B','B','低','客户暂缓决定','跟进中','DDL测试-规划师乙','未出行程','未出报价',now()-interval '2 days',now()),
  ('dd100000-0000-4000-8000-000000000013','[DDL测试] B05 暂不需要｜无提醒','官网',now()-interval '2 days','瑞士','ddl-b05@example.test','已添加邮箱','个人','1万至3万元',28000,'B','B','低','客户暂缓决定','跟进中','DDL测试-规划师乙','暂不需要','暂不需要',now()-interval '2 days',now()),
  ('dd100000-0000-4000-8000-000000000011','[DDL测试] C01 客服报价超时｜预期1条','官网',now()-interval '5 days','日本','ddl-c01@example.test','已添加微信','朋友','3万至5万元',48000,'B','B','中','客户已读未回','跟进中','DDL测试-客服','暂不需要','未出报价',now()-interval '5 days',now()),
  ('dd100000-0000-4000-8000-000000000012','[DDL测试] C02 客服未到期｜预期0条','官网',now()-interval '2 days','新加坡','ddl-c02@example.test','已添加邮箱','个人','1万至3万元',22000,'B','B','低','待首次跟进','跟进中','DDL测试-客服','未出行程','未出报价',now()-interval '2 days',now());

update public.customers
set assignee_user_id = case assignee
  when 'DDL测试-规划师甲' then 'dd000000-0000-4000-8000-000000000001'::uuid
  when 'DDL测试-规划师乙' then 'dd000000-0000-4000-8000-000000000002'::uuid
  when 'DDL测试-客服' then 'dd000000-0000-4000-8000-000000000003'::uuid
end
where name like '[DDL测试]%';

update public.customers set itinerary_status_updated_at=now()-interval '25 hours', quotation_status_updated_at=now() where id='dd100000-0000-4000-8000-000000000001';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now()-interval '49 hours' where id='dd100000-0000-4000-8000-000000000002';
update public.customers set itinerary_status_updated_at=now()-interval '25 hours', quotation_status_updated_at=now()-interval '49 hours' where id='dd100000-0000-4000-8000-000000000003';
update public.customers set itinerary_status_updated_at=now()-interval '3 days', quotation_status_updated_at=now()-interval '3 days', latest_follow_up_at=now()-interval '49 hours' where id='dd100000-0000-4000-8000-000000000004';
update public.customers set itinerary_status_updated_at=now()-interval '23 hours 30 minutes', quotation_status_updated_at=now()-interval '46 hours' where id='dd100000-0000-4000-8000-000000000005';
update public.customers set itinerary_status_updated_at=now()-interval '3 days', quotation_status_updated_at=now()-interval '3 days', latest_follow_up_at=now()-interval '47 hours' where id='dd100000-0000-4000-8000-000000000006';
update public.customers set itinerary_status_updated_at=now()-interval '25 hours', quotation_status_updated_at=now() where id='dd100000-0000-4000-8000-000000000007';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now()-interval '49 hours' where id='dd100000-0000-4000-8000-000000000008';
update public.customers set itinerary_status_updated_at=now()-interval '25 hours', quotation_status_updated_at=now()-interval '49 hours' where id='dd100000-0000-4000-8000-000000000009';
update public.customers set itinerary_status_updated_at=now()-interval '20 hours', quotation_status_updated_at=now()-interval '47 hours 30 minutes' where id='dd100000-0000-4000-8000-000000000010';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now() where id='dd100000-0000-4000-8000-000000000013';
update public.customers set itinerary_status_updated_at=now(), quotation_status_updated_at=now()-interval '49 hours' where id='dd100000-0000-4000-8000-000000000011';
update public.customers set itinerary_status_updated_at=now()-interval '23 hours 45 minutes', quotation_status_updated_at=now()-interval '47 hours' where id='dd100000-0000-4000-8000-000000000012';

insert into public.planning_requests (id,customer_id,request_type,status,content,created_at) values
  ('dd200000-0000-4000-8000-000000000001','dd100000-0000-4000-8000-000000000003','itinerary','未出行程','客户希望第三天减少步行，并增加适合儿童的室内活动。',now()-interval '25 hours'),
  ('dd200000-0000-4000-8000-000000000002','dd100000-0000-4000-8000-000000000003','quotation','未出报价','请提供经济型和舒适型两档报价，并分别列出酒店差价。',now()-interval '49 hours');

insert into public.customer_collaboration_messages (id,customer_id,parent_message_id,author_id,author_name,topic,body,created_at,updated_at) values
  ('dd300000-0000-4000-8000-000000000001','dd100000-0000-4000-8000-000000000003',null,'dd000000-0000-4000-8000-000000000001','DDL测试-规划师甲','itinerary','我已整理儿童友好景点，准备调整第三天行程。',now()-interval '5 hours',now()-interval '5 hours'),
  ('dd300000-0000-4000-8000-000000000002','dd100000-0000-4000-8000-000000000003','dd300000-0000-4000-8000-000000000001','dd000000-0000-4000-8000-000000000003','DDL测试-客服','itinerary','客户补充：儿童今年八岁，不希望安排过早出发。',now()-interval '4 hours',now()-interval '4 hours'),
  ('dd300000-0000-4000-8000-000000000003','dd100000-0000-4000-8000-000000000003','dd300000-0000-4000-8000-000000000002','dd000000-0000-4000-8000-000000000002','DDL测试-规划师乙','itinerary','收到，我建议将出发时间调整到上午九点半。',now()-interval '3 hours',now()-interval '3 hours'),
  ('dd300000-0000-4000-8000-000000000004','dd100000-0000-4000-8000-000000000003',null,'dd000000-0000-4000-8000-000000000003','DDL测试-客服','quotation','客户希望两档报价都包含接送机服务。',now()-interval '4 hours',now()-interval '4 hours'),
  ('dd300000-0000-4000-8000-000000000005','dd100000-0000-4000-8000-000000000003','dd300000-0000-4000-8000-000000000004','dd000000-0000-4000-8000-000000000001','DDL测试-规划师甲','quotation','已记录，报价中会单独列明接送机费用。',now()-interval '2 hours',now()-interval '2 hours');

commit;
