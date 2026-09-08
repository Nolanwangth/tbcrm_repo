begin;




insert into public.crm_users (
  id, username, display_name, password_salt, password_hash, active, role
) values
  ('aa100000-0000-4000-8000-000000000001','planner_zhangxujie','张栩杰','65d5dfb7ba50d4c57d030b4b3d17955e','7c4a2ebf45a2488cc1fdd82b12c9bcaa284cc3eb266b0791a39e958470e589e8e88014cfb7b3e6682f7e089e95e189241dcea7be76075bff400bd8d45a18ca50',true,'planner'),
  ('aa100000-0000-4000-8000-000000000002','planner_xuchenlei','徐晨雷','51ba0ee8878c09fa904105105e7166c2','dc7001a17d51298478ca5f0a330d3ea23c62472bc39c1e6069e36d458fe78115ee3b3c809b2b00602a2cadb1b0617f3b42acded78c6644baf0a612e3bdf088fb',true,'planner'),
  ('aa100000-0000-4000-8000-000000000003','service_caijinyang','蔡觐阳','1ab78bd1ac94d51603ae3954c02af59b','f4e1b48c6f4d8deebfcdec1cc7ea27e67d8bc672aba5e2dcd1ac4b1766fc1c55beaad3c2756fe56fbb3fb8da106a96e6064423114a51454706718391308a66d8',true,'planner'),
  ('aa100000-0000-4000-8000-000000000004','service_huangchuqiao','黄楚乔','711ab28be6bf23b50e376c7748c92943','49ef848c862a1d7062a331e254846eca3c6c3ee8bb1445fb4d39177d4051bfcf381f7ae105058fa5431bc3f6f414653ce4ec19b73ba89c2266b5b15b92c0eaa7',true,'planner'),
  ('aa100000-0000-4000-8000-000000000005','service_gaoyuanbo','高苑博','441d08815c32ee90860aba2a802bcbfa','f8ad367f3fe07c7464e7ff53236e3a3306424dd511c3f528c3cfa235c015ebc8e8cf09918bb21481c5dafae0b264e4c0a8875c42021052cad1b4a571fbf5a438',true,'planner'),
  ('aa100000-0000-4000-8000-000000000006','admin','管理员','e4b694992c0d541abaab02615e013f13','1c85529287ad269605313161cd242b159403df35cc872b545a7f5e615b6776e4e716683bb0205860ee1334803f63b1239a76e695509aa11308e520d6b766e7ad',true,'admin')
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  active = true,
  role = excluded.role;

update public.service_workbench_slots slot
set user_id = account.id,
    enabled = true,
    updated_at = now()
from public.crm_users account
where (slot.slot, account.username) in (
  ('A','service_gaoyuanbo'),
  ('B','service_caijinyang'),
  ('C','service_huangchuqiao'),
  ('D','planner_xuchenlei'),
  ('E','planner_zhangxujie')
);














insert into public.customers (
  id,name,source,source_detail,first_inquiry_at,nationality,whatsapp_status,communication_effectiveness,profile,amount_range,expected_amount,
  level,system_suggested_level,priority,communication_status,status,assignee,latest_follow_up_at,won_at,won_amount,closed_at,close_reason,created_at,updated_at
) values

('a0000000-0000-4000-8000-000000000001','Olivia Johnson','Instagram 广告',null,now()-interval '4 days','美国','已添加','沟通积极','家庭','10万元以上',128000,'S','S','紧急','客户已回复，待我方处理','跟进中','小徐',now()-interval '3 hours',null,null,null,null,now()-interval '4 days',now()-interval '3 hours'),
('a0000000-0000-4000-8000-000000000002','Liam Brown','转介绍','同事推荐',now()-interval '2 days','英国','未添加','沟通一般','情侣','10万元以上',96000,'S','S','高','客户已回复，待我方处理','跟进中','小徐',now()-interval '8 hours',null,null,null,null,now()-interval '2 days',now()-interval '8 hours'),
('a0000000-0000-4000-8000-000000000003','Emma Richardson','Facebook 广告',null,now()-interval '6 days','澳大利亚','已添加','沟通积极','家庭','10万元以上',145000,'S','S','紧急','我方已回复，等待客户','跟进中','小王',now()-interval '1 day',null,null,null,null,now()-interval '6 days',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000004','Noah Williams','B2B','欧洲合作方',now()-interval '9 days','法国','已添加','沟通积极','家庭','5万至10万元',88000,'S','A','高','客户已读未回','跟进中','小王',now()-interval '2 days',null,null,null,null,now()-interval '9 days',now()-interval '2 days'),
('a0000000-0000-4000-8000-000000000005','Sophia Chen','官网',null,now()-interval '3 days','新加坡','未添加','沟通一般','朋友','5万至10万元',72000,'S','S','中','待首次跟进','跟进中','小张',null,null,null,null,null,now()-interval '3 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000031','Hannah Müller','B2B','德国合作方',now()-interval '5 days','德国','已添加','沟通积极','家庭','10万元以上',152000,'S','S','紧急','我方已回复，等待客户','跟进中','小张',now()-interval '1 day',null,null,null,null,now()-interval '5 days',now()-interval '1 day'),


('a0000000-0000-4000-8000-000000000006','Mason Davis','Instagram 自然',null,now()-interval '5 days','加拿大','已添加','沟通一般','情侣','5万至10万元',68000,'A','A','高','我方已回复，等待客户','跟进中','小张',now()-interval '1 day',null,null,null,null,now()-interval '5 days',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000007','Ava Thompson','TikTok',null,now()-interval '8 days','新西兰','未添加','沟通一般','朋友','3万至5万元',45000,'A','A','中','客户已读未回','跟进中','小张',now()-interval '3 days',null,null,null,null,now()-interval '8 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000008','Ethan Garcia','YouTube',null,now()-interval '11 days','德国','未添加','沟通较弱','个人','3万至5万元',38000,'A','B','中','客户暂缓决定','跟进中','小李',now()-interval '5 days',null,null,null,null,now()-interval '11 days',now()-interval '5 days'),
('a0000000-0000-4000-8000-000000000009','Isabella Martinez','Facebook 自然',null,now()-interval '7 days','西班牙','已添加','沟通一般','家庭','10万元以上',112000,'A','A','紧急','客户已回复，待我方处理','跟进中','小李',now()-interval '6 hours',null,null,null,null,now()-interval '7 days',now()-interval '6 hours'),
('a0000000-0000-4000-8000-000000000010','Lucas Robinson','公众号',null,now()-interval '4 days','日本','已添加','沟通积极','个人','1万至3万元',25000,'A','A','高','客户已回复，待我方处理','跟进中','小李',now()-interval '1 day',null,null,null,null,now()-interval '4 days',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000032','Zoe Anderson','官网',null,now()-interval '3 days','爱尔兰','已添加','沟通积极','情侣','10万元以上',105000,'A','A','高','客户已回复，待我方处理','跟进中','小李',now()-interval '4 hours',null,null,null,null,now()-interval '3 days',now()-interval '4 hours'),
('a0000000-0000-4000-8000-000000000033','Nathan Kim','TikTok',null,now()-interval '6 days','韩国','未添加','沟通一般','个人','3万至5万元',35000,'A','A','中','客户已读未回','跟进中','小陈',now()-interval '2 days',null,null,null,null,now()-interval '6 days',now()-interval '2 days'),
('a0000000-0000-4000-8000-000000000034','Lily Tanaka','Instagram 自然',null,now()-interval '2 days','日本','已添加','沟通积极','朋友','5万至10万元',62000,'A','A','中','待首次跟进','跟进中','小陈',null,null,null,null,null,now()-interval '2 days',now()-interval '2 days'),


('a0000000-0000-4000-8000-000000000011','Mia Clark','邮箱',null,now()-interval '6 days','意大利','未添加','沟通一般','情侣','3万至5万元',42000,'B','B','中','我方已回复，等待客户','跟进中','小陈',now()-interval '2 days',null,null,null,null,now()-interval '6 days',now()-interval '2 days'),
('a0000000-0000-4000-8000-000000000012','James Walker','其他','携程平台',now()-interval '12 days','泰国','已添加','沟通一般','家庭','1万至3万元',22000,'B','B','低','客户已读未回','跟进中','小陈',now()-interval '6 days',null,null,null,null,now()-interval '12 days',now()-interval '6 days'),
('a0000000-0000-4000-8000-000000000013','Charlotte Hall','转介绍','朋友推荐',now()-interval '3 days','韩国','已添加','沟通积极','朋友','5万至10万元',55000,'B','A','中','待首次跟进','跟进中','小徐',null,null,null,null,null,now()-interval '3 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000014','Benjamin Young','Instagram 广告',null,now()-interval '10 days','巴西','未添加','沟通一般','未确定','1万至3万元',null,'B','B','中','客户未读','跟进中','小徐',now()-interval '4 days',null,null,null,null,now()-interval '10 days',now()-interval '4 days'),
('a0000000-0000-4000-8000-000000000015','Amelia King','TikTok',null,now()-interval '9 days','马来西亚','未添加','沟通较弱','个人','1万元以下',9000,'B','B','低','客户暂缓决定','跟进中','小王',now()-interval '5 days',null,null,null,null,now()-interval '9 days',now()-interval '5 days'),
('a0000000-0000-4000-8000-000000000035','Oscar Wilson','Facebook 广告',null,now()-interval '4 days','瑞典','未添加','沟通一般','个人','3万至5万元',40000,'B','B','中','待首次跟进','跟进中','小王',null,null,null,null,null,now()-interval '4 days',now()-interval '4 days'),
('a0000000-0000-4000-8000-000000000036','Ruby Taylor','YouTube',null,now()-interval '7 days','加拿大','已添加','沟通积极','情侣','5万至10万元',58000,'B','B','中','我方已回复，等待客户','跟进中','小王',now()-interval '1 day',null,null,null,null,now()-interval '7 days',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000037','Leo Harris','直加',null,now()-interval '1 day','印度尼西亚','未添加','沟通较弱','未确定','1万至3万元',null,'B','C','低','待首次跟进','跟进中',null,null,null,null,null,null,now()-interval '1 day',now()-interval '1 day'),


('a0000000-0000-4000-8000-000000000016','Harper Wright','直加',null,now()-interval '1 day','俄罗斯','未添加','沟通较弱','个人','1万元以下',6000,'C','C','低','待首次跟进','跟进中','小张',null,null,null,null,null,now()-interval '1 day',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000017','Alexander Scott','其他','线下展会',now()-interval '15 days','印度','未添加','沟通较弱','未确定','1万至3万元',null,'C','C','中','客户已读未回','跟进中','小张',now()-interval '8 days',null,null,null,null,now()-interval '15 days',now()-interval '8 days'),
('a0000000-0000-4000-8000-000000000018','Abigail Adams','YouTube',null,now()-interval '14 days','菲律宾','未添加','沟通一般','个人','1万元以下',7000,'C','C','低','客户未读','跟进中','小张',now()-interval '7 days',null,null,null,null,now()-interval '14 days',now()-interval '7 days'),
('a0000000-0000-4000-8000-000000000019','Daniel Green','Facebook 自然',null,now()-interval '2 days','墨西哥','未添加','沟通较弱','未确定','1万至3万元',null,'C','C','低','待首次跟进','跟进中','小李',null,null,null,null,null,now()-interval '2 days',now()-interval '2 days'),
('a0000000-0000-4000-8000-000000000020','Emily Baker','邮箱',null,now()-interval '13 days','越南','未添加','沟通较弱','个人','1万元以下',5000,'C','C','低','客户暂缓决定','跟进中','小李',now()-interval '6 days',null,null,null,null,now()-interval '13 days',now()-interval '6 days'),
('a0000000-0000-4000-8000-000000000038','Finn Roberts','Instagram 广告',null,now()-interval '3 days','南非','未添加','沟通一般','个人','1万元以下',8000,'C','C','低','待首次跟进','跟进中','小陈',null,null,null,null,null,now()-interval '3 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000039','Grace Evans','TikTok',null,now()-interval '5 days','尼日利亚','未添加','沟通较弱','未确定','1万至3万元',null,'C','C','低','客户未读','跟进中','小陈',now()-interval '3 days',null,null,null,null,now()-interval '5 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000040','Henry Cooper','邮箱',null,now()-interval '8 days','埃及','未添加','沟通较弱','个人','1万元以下',4500,'C','C','低','客户暂缓决定','跟进中',null,now()-interval '4 days',null,null,null,null,now()-interval '8 days',now()-interval '4 days'),


('a0000000-0000-4000-8000-000000000021','Isabella Moore','B2B','欧洲合作方',now()-interval '18 days','意大利','已添加','沟通积极','家庭','10万元以上',160000,'S','S','紧急','我方已回复，等待客户','已成交','小徐',now()-interval '2 days',now()-interval '2 days',160000,null,null,now()-interval '18 days',now()-interval '2 days'),
('a0000000-0000-4000-8000-000000000022','William Turner','Instagram 自然',null,now()-interval '20 days','荷兰','已添加','沟通积极','情侣','10万元以上',135000,'A','A','高','我方已回复，等待客户','已成交','小王',now()-interval '3 days',now()-interval '3 days',135000,null,null,now()-interval '20 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000023','Grace Nelson','官网',null,now()-interval '25 days','挪威','已添加','沟通一般','家庭','5万至10万元',78000,'A','A','高','我方已回复，等待客户','已成交','小王',now()-interval '5 days',now()-interval '5 days',78000,null,null,now()-interval '25 days',now()-interval '5 days'),
('a0000000-0000-4000-8000-000000000024','Henry Carter','转介绍','老客户推荐',now()-interval '22 days','瑞典','已添加','沟通积极','朋友','5万至10万元',62000,'B','B','中','我方已回复，等待客户','已成交','小张',now()-interval '4 days',now()-interval '4 days',62000,null,null,now()-interval '22 days',now()-interval '4 days'),
('a0000000-0000-4000-8000-000000000025','Scarlett Phillips','Facebook 广告',null,now()-interval '30 days','丹麦','已添加','沟通一般','情侣','3万至5万元',48000,'B','B','中','我方已回复，等待客户','已成交','小陈',now()-interval '7 days',now()-interval '7 days',48000,null,null,now()-interval '30 days',now()-interval '7 days'),
('a0000000-0000-4000-8000-000000000026','Jack Mitchell','Instagram 广告',null,now()-interval '28 days','比利时','已添加','沟通一般','个人','1万至3万元',26000,'C','C','低','我方已回复，等待客户','已成交','小陈',now()-interval '6 days',now()-interval '6 days',26000,null,null,now()-interval '28 days',now()-interval '6 days'),
('a0000000-0000-4000-8000-000000000041','Violet Adams','B2B','美国合作方',now()-interval '15 days','美国','已添加','沟通积极','家庭','10万元以上',175000,'S','S','紧急','我方已回复，等待客户','已成交','小李',now()-interval '1 day',now()-interval '1 day',175000,null,null,now()-interval '15 days',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000042','Dylan Hughes','转介绍','合作伙伴推荐',now()-interval '19 days','澳大利亚','已添加','沟通积极','情侣','5万至10万元',85000,'A','A','高','我方已回复，等待客户','已成交','小徐',now()-interval '2 days',now()-interval '2 days',85000,null,null,now()-interval '19 days',now()-interval '2 days'),


('a0000000-0000-4000-8000-000000000027','Lucas Jackson','Instagram 自然',null,now()-interval '23 days','西班牙','已添加','沟通一般','情侣','3万至5万元',42000,'A','A','低','客户暂缓决定','已关闭','小王',now()-interval '10 days',null,null,now()-interval '1 day','客户取消出行计划',now()-interval '23 days',now()-interval '1 day'),
('a0000000-0000-4000-8000-000000000028','Victoria Lee','Facebook 自然',null,now()-interval '35 days','希腊','已添加','沟通一般','家庭','5万至10万元',56000,'S','S','高','客户已读未回','已关闭','小徐',now()-interval '15 days',null,null,now()-interval '2 days','连续两次已读未回',now()-interval '35 days',now()-interval '2 days'),
('a0000000-0000-4000-8000-000000000029','Sebastian Fischer','TikTok',null,now()-interval '40 days','瑞士','未添加','沟通较弱','个人','1万至3万元',18000,'B','B','低','客户暂缓决定','已关闭','小张',now()-interval '20 days',null,null,now()-interval '3 days','客户已选择其他公司',now()-interval '40 days',now()-interval '3 days'),
('a0000000-0000-4000-8000-000000000030','Chloe Wong','公众号',null,now()-interval '45 days','中国香港','已添加','沟通一般','未确定','1万元以下',null,'C','C','低','客户暂缓决定','已关闭','小李',now()-interval '22 days',null,null,now()-interval '4 days','联系方式无效',now()-interval '45 days',now()-interval '4 days'),
('a0000000-0000-4000-8000-000000000043','Jasper Chen','直加',null,now()-interval '27 days','中国台湾','已添加','沟通一般','个人','3万至5万元',36000,'B','B','中','客户暂缓决定','已关闭','小陈',now()-interval '12 days',null,null,now()-interval '5 days','客户明确表示不购买',now()-interval '27 days',now()-interval '5 days'),
('a0000000-0000-4000-8000-000000000044','Stella Park','Facebook 广告',null,now()-interval '33 days','韩国','已添加','沟通一般','朋友','5万至10万元',52000,'A','A','中','客户已读未回','已关闭','小王',now()-interval '16 days',null,null,now()-interval '3 days','客户已选择其他公司',now()-interval '33 days',now()-interval '3 days')
on conflict (id) do nothing;













update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '6 hours',quotation_status='未出报价',quotation_status_updated_at=now()-interval '4 hours' where id='a0000000-0000-4000-8000-000000000001';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='已出报价',quotation_status_updated_at=now()-interval '12 hours' where id='a0000000-0000-4000-8000-000000000002';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000003';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '3 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '2 days' where id='a0000000-0000-4000-8000-000000000004';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '3 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '3 days' where id='a0000000-0000-4000-8000-000000000005';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='未出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000031';



update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000006';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000007';

update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '5 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '5 days' where id='a0000000-0000-4000-8000-000000000008';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '12 hours',quotation_status='未出报价',quotation_status_updated_at=now()-interval '6 hours' where id='a0000000-0000-4000-8000-000000000009';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000010';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '12 hours',quotation_status='已出报价',quotation_status_updated_at=now()-interval '6 hours' where id='a0000000-0000-4000-8000-000000000032';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000033';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '2 days' where id='a0000000-0000-4000-8000-000000000034';



update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '2 days' where id='a0000000-0000-4000-8000-000000000011';

update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '6 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '6 days' where id='a0000000-0000-4000-8000-000000000012';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '3 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '3 days' where id='a0000000-0000-4000-8000-000000000013';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '4 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '4 days' where id='a0000000-0000-4000-8000-000000000014';

update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '5 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '5 days' where id='a0000000-0000-4000-8000-000000000015';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000035';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='未出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000036';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='未出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000037';



update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='未出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000016';

update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '8 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '8 days' where id='a0000000-0000-4000-8000-000000000017';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '7 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '7 days' where id='a0000000-0000-4000-8000-000000000018';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '2 days' where id='a0000000-0000-4000-8000-000000000019';

update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '6 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '6 days' where id='a0000000-0000-4000-8000-000000000020';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '1 day',quotation_status='已出报价',quotation_status_updated_at=now()-interval '12 hours' where id='a0000000-0000-4000-8000-000000000038';

update public.customers set itinerary_status='未出行程',itinerary_status_updated_at=now()-interval '3 days',quotation_status='未出报价',quotation_status_updated_at=now()-interval '3 days' where id='a0000000-0000-4000-8000-000000000039';

update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000040';


update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '3 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '2 days' where id='a0000000-0000-4000-8000-000000000021';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '4 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '3 days' where id='a0000000-0000-4000-8000-000000000022';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '6 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '5 days' where id='a0000000-0000-4000-8000-000000000023';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '5 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '4 days' where id='a0000000-0000-4000-8000-000000000024';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '8 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '7 days' where id='a0000000-0000-4000-8000-000000000025';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '7 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '6 days' where id='a0000000-0000-4000-8000-000000000026';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '2 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '1 day' where id='a0000000-0000-4000-8000-000000000041';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '3 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '2 days' where id='a0000000-0000-4000-8000-000000000042';


update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '11 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '10 days' where id='a0000000-0000-4000-8000-000000000027';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '17 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '16 days' where id='a0000000-0000-4000-8000-000000000028';
update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '20 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '20 days' where id='a0000000-0000-4000-8000-000000000029';
update public.customers set itinerary_status='暂不需要',itinerary_status_updated_at=now()-interval '22 days',quotation_status='暂不需要',quotation_status_updated_at=now()-interval '22 days' where id='a0000000-0000-4000-8000-000000000030';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '13 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '12 days' where id='a0000000-0000-4000-8000-000000000043';
update public.customers set itinerary_status='已出行程',itinerary_status_updated_at=now()-interval '17 days',quotation_status='已出报价',quotation_status_updated_at=now()-interval '16 days' where id='a0000000-0000-4000-8000-000000000044';




insert into public.planning_requests (id, customer_id, request_type, status, content, created_at) values

('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','itinerary','未出行程','请制作亲子版北京、西安、成都 10 天游览方案，重点安排熊猫基地和儿童友好景点。',now()-interval '6 hours'),
('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','quotation','未出报价','按四星酒店、独立用车和高铁一等座制作报价，需要包含儿童优惠政策。',now()-interval '4 hours'),
('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','itinerary','行程待修改','减少购物安排，增加熊猫基地和亲子体验，将北京段调整为4天。',now()-interval '2 days'),
('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000003','quotation','已出报价','已按客户要求调整，等待确认。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000007','itinerary','行程待修改','客户希望将成都换为桂林，请重新规划行程。',now()-interval '2 days'),
('b0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000007','quotation','报价待修改','将住宿调整为市中心四星酒店后重新报价，增加漓江游船。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000009','itinerary','未出行程','家庭客户，需要涵盖上海、杭州、苏州经典线路，12天。',now()-interval '12 hours'),
('b0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000009','quotation','未出报价','按五星酒店标准报价，含迪士尼乐园门票。',now()-interval '6 hours'),
('b0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000011','itinerary','未出行程','双人蜜月旅行，云南大理、丽江、香格里拉 8 天。',now()-interval '2 days'),
('b0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000011','quotation','未出报价','蜜月套餐报价，含特色民宿和浪漫晚餐。',now()-interval '2 days'),
('b0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000002','itinerary','已出行程','已制作完毕，等待客户对报价的反馈。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000010','itinerary','已出行程','单人深度游，成都、重庆、长江三峡 9 天。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000010','quotation','已出报价','经济型酒店加高铁，总预算控制在2.5万以内。',now()-interval '1 day'),

('b0000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000031','itinerary','已出行程','德国客户，北京、西安、上海 12 天商务+文化行程。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000015','a0000000-0000-4000-8000-000000000031','quotation','未出报价','按五星酒店+商务车标准报价。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000016','a0000000-0000-4000-8000-000000000032','itinerary','已出行程','爱尔兰情侣，云南大理、丽江、香格里拉蜜月之旅。',now()-interval '12 hours'),
('b0000000-0000-4000-8000-000000000017','a0000000-0000-4000-8000-000000000032','quotation','已出报价','蜜月套餐报价已出，含特色民宿和浪漫晚餐。',now()-interval '6 hours'),
('b0000000-0000-4000-8000-000000000018','a0000000-0000-4000-8000-000000000033','itinerary','未出行程','韩国客户，首尔出发的上海、杭州、苏州 8 天行程。',now()-interval '2 days'),
('b0000000-0000-4000-8000-000000000019','a0000000-0000-4000-8000-000000000033','quotation','已出报价','已出报价，等待客户确认。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000020','a0000000-0000-4000-8000-000000000036','itinerary','已出行程','加拿大情侣，北京、西安、成都 10 天行程。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000038','itinerary','已出行程','南非客户，广州、深圳、珠海 7 天经济型行程。',now()-interval '1 day'),
('b0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000038','quotation','已出报价','经济型报价已出，总预算控制在1万以内。',now()-interval '12 hours'),
('b0000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000040','itinerary','已出行程','埃及客户，北京、西安 8 天历史文化行程。',now()-interval '2 days'),
('b0000000-0000-4000-8000-000000000024','a0000000-0000-4000-8000-000000000040','quotation','已出报价','已出报价，等待客户确认。',now()-interval '1 day')
on conflict (id) do nothing;




insert into public.won_records (customer_id, amount, won_at)
select id, won_amount, won_at
from public.customers
where status = '已成交' and won_amount is not null and won_at is not null
on conflict do nothing;




insert into public.travel_needs (
  customer_id,fuzzy_travel_time,traveler_count,travel_days,destinations,flight_status,hotel_status,
  service_type,domestic_transport_status,special_requirements,time_clarity,people_clarity,destination_clarity,days_clarity,
  expected_start_date,expected_end_date
)
select
  id,
  case
    when level='S' and status='跟进中' then '2026年10月中旬'
    when level='A' and status='跟进中' then '2026年11月初'
    when status='跟进中' then '2027年春季'
    else '2026年9月下旬'
  end,
  case
    when profile='家庭' then '2位成人加1名儿童'
    when profile='情侣' then '2人'
    when profile='朋友' then '3至4人'
    else '1人'
  end,
  case
    when amount_range='10万元以上' then '12至14天'
    when amount_range='5万至10万元' then '10至12天'
    when amount_range='3万至5万元' then '8至10天'
    else '6至8天'
  end,
  case
    when level='S' then '北京、西安、成都'
    when level='A' and right(id::text,1)::int % 2 = 0 then '上海、杭州、苏州'
    when level='A' then '云南大理、丽江、香格里拉'
    when level='B' then '桂林、阳朔、龙脊'
    else '广州、深圳、珠海'
  end,
  case when level='S' then '已购买' when level='A' then '日期已定，但暂未购买' else '日期尚未确定' end,
  case when level in ('S','A') then '需要我们安排酒店' else '尚未确定' end,
  case when right(id::text,1)::int % 3 = 0 then '拼接' else '全托管' end,
  case
    when level in ('S','A') then '需要我们安排'
    when level = 'B' then '部分已安排，部分需要我们安排'
    else '尚未确定'
  end,
  case
    when profile='家庭' then '希望安排亲子友好的住宿与节奏，儿童不吃辣。'
    when profile='情侣' then '偏好浪漫体验，希望包含特色晚餐和私密空间。'
    when profile='朋友' then '希望减少购物点，偏好在地体验和户外活动。'
    else '预算有限，希望性价比高的方案。'
  end,
  case when level='S' then '明确' when level='A' then '大致明确' else '未确定' end,
  '明确',
  case when level='C' then '未确定' else '大致明确' end,
  case when level in ('S','A') then '明确' else '大致明确' end,
  case
    when status='已成交' then current_date + 30
    when level='S' then current_date + 45
    else null
  end,
  case
    when status='已成交' then current_date + 42
    when level='S' then current_date + 55
    else null
  end
from public.customers
on conflict (customer_id) do nothing;




insert into public.operation_cases (id, customer_id, owner_name, service_list_status, notes, created_at, updated_at)
select
  gen_random_uuid(),
  id,
  assignee,
  'uploaded',
  case
    when level='S' then 'VIP客户，需全程跟踪服务进度，确保高品质体验。'
    when level='A' then '重点客户，按计划推进各服务项目。'
    when level='B' then '标准客户，按常规流程操作。'
    else '经济型客户，控制成本同时保证服务质量。'
  end,
  won_at,
  won_at
from public.customers
where status = '已成交'
  and not exists (select 1 from public.operation_cases existing where existing.customer_id = customers.id)
on conflict do nothing;




do $$
declare
  op_case record;
  day_num int;
  cities text[];
  summaries text[];
begin
  for op_case in select id, customer_id from public.operation_cases loop
    cities := case
      when (select level from public.customers where id = op_case.customer_id) = 'S'
        then array['北京','西安','成都']
      else array['上海','杭州']
    end;
    summaries := case
      when array_length(cities, 1) >= 3
        then array['抵达并入住酒店，下午自由活动。','全天游览核心景点。','上午参观博物馆，下午高铁前往下一站。']
      else array['抵达并入住酒店，下午城市漫步。','全天游览核心景点，傍晚自由购物。']
    end;

    for day_num in 1..array_length(cities, 1) loop
      insert into public.operation_days (case_id, day_number, service_date, city, summary, sort_order)
      values (
        op_case.id,
        day_num,
        (select expected_start_date from public.travel_needs where customer_id = op_case.customer_id) + (day_num - 1),
        cities[day_num],
        summaries[day_num],
        day_num
      )
      on conflict do nothing;
    end loop;
  end loop;
end $$;




do $$
declare
  op_case record;
  day_record record;
  hotel_names text[] := array['锦江之星','如家精选','亚朵酒店','希尔顿花园','洲际酒店'];
  ticket_names text[] := array['故宫门票','长城门票','兵马俑门票','西湖游船','外滩观光'];
  transport_names text[] := array['上海至杭州高铁','北京至西安高铁','成都至西安高铁'];
begin
  for op_case in select id, customer_id from public.operation_cases loop
    for day_record in select id, day_number, city from public.operation_days where case_id = op_case.id order by day_number loop
      
      insert into public.operation_service_items (
        case_id, day_id, section, category, title, city, service_date, booking_status,
        supplier_name, quantity, unit, invoice_unit_cost, customer_unit_quote
      ) values (
        op_case.id, day_record.id, 'daily', 'ticket',
        ticket_names[1 + (day_record.day_number % array_length(ticket_names, 1))],
        day_record.city, current_date + 30 + day_record.day_number, 'pending',
        '待确认供应商', 2 + (day_record.day_number % 3), '张',
        60 + (day_record.day_number * 10), 100 + (day_record.day_number * 15)
      )
      on conflict do nothing;
    end loop;

    
    select id, city into day_record from public.operation_days where case_id = op_case.id order by day_number limit 1;
    insert into public.operation_service_items (
      case_id, section, category, title, city, service_date, booking_status,
      supplier_name, quantity, unit, invoice_unit_cost, customer_unit_quote,
      check_in_date, check_out_date, room_type, room_count, night_count
    ) values (
      op_case.id, 'hotel', 'hotel',
      hotel_names[1 + (random() * (array_length(hotel_names, 1) - 1))::int],
      day_record.city, current_date + 30, 'booking',
      '优选酒店供应商', 6, '间夜', 580, 880,
      current_date + 30, current_date + 34, '高级双床房', 2, 4
    )
    on conflict do nothing;

    
    insert into public.operation_service_items (
      case_id, section, category, title, city, service_date, booking_status,
      supplier_name, quantity, unit, invoice_unit_cost, customer_unit_quote,
      transport_type, origin, destination, reference_number
    ) values (
      op_case.id, 'transport', 'rail',
      transport_names[1 + (random() * (array_length(transport_names, 1) - 1))::int],
      '跨城', current_date + 34, 'pending',
      '铁路票务', 3, '张', 550, 680,
      '高铁二等座', '出发站', '到达站', 'G0000'
    )
    on conflict do nothing;
  end loop;
end $$;




do $$
declare
  op_case record;
  svc_item record;
  v_claim_id uuid;
  v_claim_no text;
  v_seq int := 0;
begin
  for op_case in select id, customer_id, owner_name from public.operation_cases limit 4 loop
    v_seq := v_seq + 1;
    v_claim_no := 'BZ' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 6, '0');

    insert into public.finance_claims (
      claim_no, operation_case_id, customer_id, applicant_name, amount, status, note
    ) values (
      v_claim_no, op_case.id, op_case.customer_id,
      coalesce(op_case.owner_name, '计调'),
      0.01, 'pending',
      '演示报账单'
    )
    returning id into v_claim_id;

    for svc_item in select id, title, category, invoice_unit_cost, quantity
      from public.operation_service_items
      where case_id = op_case.id limit 2
    loop
      insert into public.finance_claim_items (
        claim_id, operation_service_item_id, title, category,
        requested_amount
      ) values (
        v_claim_id, svc_item.id, svc_item.title, svc_item.category,
        coalesce(svc_item.invoice_unit_cost, 0) * coalesce(svc_item.quantity, 1)
      );
    end loop;

    update public.finance_claims
    set amount = (select coalesce(sum(requested_amount), 0) from public.finance_claim_items where claim_id = v_claim_id)
    where id = v_claim_id;

    insert into public.finance_claim_events (claim_id, event_type, actor_name, amount, note)
    values (v_claim_id, 'submitted', coalesce(op_case.owner_name, '计调'),
      (select amount from public.finance_claims where id = v_claim_id), '演示报账提交');

    if v_seq >= 2 then
      update public.finance_claims
      set status = case when v_seq = 2 then 'approved' when v_seq = 3 then 'paid' when v_seq = 4 then 'paid' end,
          reviewed_at = now() - interval '1 day',
          reviewed_by_name = '财务小王'
      where id = v_claim_id;
      insert into public.finance_claim_events (claim_id, event_type, actor_name, note)
      values (v_claim_id, case when v_seq = 2 then 'approved' when v_seq = 3 then 'approved' when v_seq = 4 then 'approved' end, '财务小王', '审核通过');
    end if;
  end loop;
end $$;


select setval(
  'public.finance_claim_number_seq',
  greatest(
    coalesce((
      select max((regexp_match(claim_no, '-([0-9]+)$'))[1]::bigint)
      from public.finance_claims
    ), 0),
    1
  ),
  true
);




insert into public.initial_scores (
  customer_id,total_score,suggested_level,confirmed_level,filled_item_count,total_item_count,calculable_ratio,breakdown,
  scoring_version,s_eligible,s_eligibility_reasons
)
select
  id,
  case
    when level='S' and system_suggested_level='S' then 92 + (random()*6)::int
    when level='S' then 85 + (random()*5)::int
    when level='A' then 75 + (random()*10)::int
    when level='B' then 50 + (random()*15)::int
    else 30 + (random()*15)::int
  end,
  system_suggested_level,
  level,
  9,9,100,
  jsonb_build_object(
    'travelReadiness', case when level='S' then 30 when level='A' then 25 else 11 end,
    'communication', case communication_effectiveness when '沟通积极' then 25 when '沟通一般' then 16 else 8 end,
    'demandClarity', case when level='S' then 22.75 when level='A' then 20.5 when level='B' then 18.25 else 15.75 end,
    'profile', case profile when '家庭' then 12 when '情侣' then 10 when '朋友' then 10 when '个人' then 7 else 3 end,
    'amount', case amount_range when '10万元以上' then 8 when '5万至10万元' then 7 when '3万至5万元' then 5.5 when '1万至3万元' then 4 else 2 end
  ),
  'V2',
  system_suggested_level = 'S',
  case when system_suggested_level = 'S' then '[]'::jsonb else '["未满足 S 级全部必要条件"]'::jsonb end
from public.customers
on conflict (customer_id) do nothing;




insert into public.score_versions (
  customer_id,scoring_version,total_score,suggested_level,confirmed_level,filled_item_count,total_item_count,
  calculable_ratio,breakdown,s_eligible,s_eligibility_reasons,reason,recorded_at
)
select
  s.customer_id,s.scoring_version,s.total_score,s.suggested_level,s.confirmed_level,s.filled_item_count,s.total_item_count,
  s.calculable_ratio,s.breakdown,s.s_eligible,s.s_eligibility_reasons,'本地演示数据首次评分',c.created_at
from public.initial_scores s
join public.customers c on c.id = s.customer_id
on conflict do nothing;




insert into public.follow_ups (id, customer_id, summary, communication_status, created_at, updated_at) values

('d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','客户确认暑期档期，希望优先确认亲子酒店和高铁票。','客户已回复，待我方处理',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','已发送初步服务范围，客户询问婴儿车与儿童餐安排。','客户已回复，待我方处理',now()-interval '3 hours',now()-interval '3 hours'),
('d0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','客户对行程框架满意，希望增加长城和故宫深度游。','客户已回复，待我方处理',now()-interval '8 hours',now()-interval '8 hours'),
('d0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000003','已发送调整后的行程，等待客户确认。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000004','客户已查看方案但尚未回复，拟本周五再跟进一次。','客户已读未回',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000036','a0000000-0000-4000-8000-000000000031','德国客户对行程很满意，但要确认商务会议日期。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),

('d0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000006','已根据朋友团人数补充商务车建议，等待确认出行时间。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000007','客户希望加入桂林和阳朔，已询问儿童年龄和房型偏好。','客户已读未回',now()-interval '3 days',now()-interval '3 days'),
('d0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000009','家庭客户，已发送上海迪士尼+苏杭行程方案。','客户已回复，待我方处理',now()-interval '6 hours',now()-interval '6 hours'),
('d0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000010','单人深度游方案已发送，客户对预算控制表示满意。','客户已回复，待我方处理',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000037','a0000000-0000-4000-8000-000000000032','爱尔兰客户对蜜月方案很满意，正在确认机票。','客户已回复，待我方处理',now()-interval '4 hours',now()-interval '4 hours'),
('d0000000-0000-4000-8000-000000000038','a0000000-0000-4000-8000-000000000033','韩国客户已收到报价，表示需要和同伴商量。','客户已回复，待我方处理',now()-interval '1 day',now()-interval '1 day'),

('d0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000011','蜜月旅行方案已发送，客户对大理民宿比较感兴趣。','我方已回复，等待客户',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000005','短暂首次沟通，客户表示需要和家人商量后再决定。','待首次跟进',now()-interval '3 days',now()-interval '3 days'),
('d0000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000008','客户需要先确认年假，暂缓决定，约定确认后再联系。','客户暂缓决定',now()-interval '5 days',now()-interval '5 days'),
('d0000000-0000-4000-8000-000000000039','a0000000-0000-4000-8000-000000000036','加拿大客户确认行程，正在准备签证材料。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),

('d0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000012','第二次补充询问出行月份，客户已读但暂无回复。','客户已读未回',now()-interval '6 days',now()-interval '6 days'),
('d0000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000020','客户预算有限，已发送经济型方案，暂未回复。','客户暂缓决定',now()-interval '6 days',now()-interval '6 days'),
('d0000000-0000-4000-8000-000000000040','a0000000-0000-4000-8000-000000000038','南非客户已收到行程，需要在公司内部审批预算。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),

('d0000000-0000-4000-8000-000000000015','a0000000-0000-4000-8000-000000000021','合作方确认服务范围，所有细节已敲定，进入计调阶段。','我方已回复，等待客户',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000016','a0000000-0000-4000-8000-000000000022','客户确认最终方案，已支付定金，等待出行。','我方已回复，等待客户',now()-interval '3 days',now()-interval '3 days'),
('d0000000-0000-4000-8000-000000000041','a0000000-0000-4000-8000-000000000041','美国VIP客户确认全部细节，进入出行准备阶段。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),

('d0000000-0000-4000-8000-000000000017','a0000000-0000-4000-8000-000000000027','客户确认本年度取消中国旅行计划。','客户暂缓决定',now()-interval '10 days',now()-interval '10 days'),
('d0000000-0000-4000-8000-000000000018','a0000000-0000-4000-8000-000000000028','多次跟进未回复，已连续两次已读未回。','客户已读未回',now()-interval '15 days',now()-interval '15 days'),
('d0000000-0000-4000-8000-000000000042','a0000000-0000-4000-8000-000000000043','客户明确表示不购买，关闭跟进。','客户暂缓决定',now()-interval '5 days',now()-interval '5 days'),

('d0000000-0000-4000-8000-000000000019','a0000000-0000-4000-8000-000000000003','今日跟进：客户对行程方案表示满意，需要确认出发日期。','我方已回复，等待客户',now()-interval '1 hour',now()-interval '1 hour'),
('d0000000-0000-4000-8000-000000000020','a0000000-0000-4000-8000-000000000006','今日跟进：已发送商务车报价，客户正在内部讨论。','我方已回复，等待客户',now()-interval '2 hours',now()-interval '2 hours'),
('d0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000011','今日跟进：蜜月客户对大理民宿很满意，准备确认行程。','我方已回复，等待客户',now()-interval '30 minutes',now()-interval '30 minutes'),
('d0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000005','今日跟进：首次沟通，了解客户基本需求和出行时间。','待首次跟进',now()-interval '5 hours',now()-interval '5 hours'),
('d0000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000007','今日跟进：客户新增桂林阳朔需求，已重新调整方案。','我方已回复，等待客户',now()-interval '1 hour',now()-interval '1 hour'),
('d0000000-0000-4000-8000-000000000024','a0000000-0000-4000-8000-000000000002','今日跟进：行程已出，客户确认后进入计调阶段。','我方已回复，等待客户',now()-interval '30 minutes',now()-interval '30 minutes'),
('d0000000-0000-4000-8000-000000000025','a0000000-0000-4000-8000-000000000004','今日跟进：客户已确认全部方案，等待出行。','我方已回复，等待客户',now()-interval '3 hours',now()-interval '3 hours'),
('d0000000-0000-4000-8000-000000000026','a0000000-0000-4000-8000-000000000010','今日跟进：客户收到最终报价，预计明天确认。','我方已回复，等待客户',now()-interval '1 hour',now()-interval '1 hour'),
('d0000000-0000-4000-8000-000000000043','a0000000-0000-4000-8000-000000000031','今日跟进：德国客户确认行程框架，等待商务会议时间。','我方已回复，等待客户',now()-interval '2 hours',now()-interval '2 hours'),
('d0000000-0000-4000-8000-000000000044','a0000000-0000-4000-8000-000000000032','今日跟进：爱尔兰客户已确认蜜月方案，进入报价阶段。','客户已回复，待我方处理',now()-interval '1 hour',now()-interval '1 hour'),
('d0000000-0000-4000-8000-000000000045','a0000000-0000-4000-8000-000000000036','今日跟进：加拿大客户确认行程，准备签证材料。','我方已回复，等待客户',now()-interval '30 minutes',now()-interval '30 minutes'),
('d0000000-0000-4000-8000-000000000046','a0000000-0000-4000-8000-000000000040','今日跟进：埃及客户已收到报价，正在内部讨论中。','客户已回复，待我方处理',now()-interval '4 hours',now()-interval '4 hours'),

('d0000000-0000-4000-8000-000000000027','a0000000-0000-4000-8000-000000000001','昨日跟进：发送行程框架，客户正在查看。','待首次跟进',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000028','a0000000-0000-4000-8000-000000000003','昨日跟进：客户提出修改意见，已调整行程方案。','我方已回复，等待客户',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000029','a0000000-0000-4000-8000-000000000009','昨日跟进：首次联系，了解客户出行偏好。','待首次跟进',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000030','a0000000-0000-4000-8000-000000000013','昨日跟进：客户对经济型方案表示兴趣，但预算仍在讨论。','客户已回复，待我方处理',now()-interval '1 day',now()-interval '1 day'),
('d0000000-0000-4000-8000-000000000031','a0000000-0000-4000-8000-000000000016','昨日跟进：已发送行程方案，等待客户反馈。','待首次跟进',now()-interval '1 day',now()-interval '1 day'),

('d0000000-0000-4000-8000-000000000032','a0000000-0000-4000-8000-000000000002','前天跟进：客户确认行程细节，无修改意见。','我方已回复，等待客户',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000033','a0000000-0000-4000-8000-000000000006','前天跟进：发送报价单，客户表示需要时间考虑。','我方已回复，等待客户',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000034','a0000000-0000-4000-8000-000000000014','前天跟进：客户对行程安排表示满意，等待同伴确认。','客户已回复，待我方处理',now()-interval '2 days',now()-interval '2 days'),
('d0000000-0000-4000-8000-000000000035','a0000000-0000-4000-8000-000000000018','前天跟进：客户对目的地有疑问，已解答。','待首次跟进',now()-interval '2 days',now()-interval '2 days')
on conflict (id) do nothing;




insert into public.audit_logs (customer_id,field_name,old_value,new_value,changed_at)
select id,'优先级','中',priority,updated_at from public.customers where priority <> '中';


insert into public.level_changes (customer_id,from_level,to_level,changed_at)
select id,null,level,created_at from public.customers;


insert into public.close_records (customer_id,reason,closed_at)
select id,close_reason,closed_at from public.customers where status='已关闭';


insert into public.customer_folders (customer_id,name)
select id,'客户资料' from public.customers
on conflict do nothing;









update public.customer_folders
set status = '已发送', review_status = '已审核', updated_at = now()
where customer_id in (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000004'
);



update public.customer_folders
set status = '待发送', updated_at = now()
where customer_id not in (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000004'
);


insert into public.customer_folder_status_history (folder_id, customer_id, old_status, new_status, changed_at)
select f.id, f.customer_id, '待发送', '已发送', now()
from public.customer_folders f
where f.status = '已发送'
on conflict do nothing;

commit;
