
begin;
set local role service_role;
do $$
declare op uuid; customer uuid; actor uuid; item uuid; rev int; e record; latest_event uuid;
begin
 select c.id,c.customer_id into op,customer from operation_cases c join customers u on u.id=c.customer_id
 where u.name='[试验验收0907] 三角色协同与行程提醒';
 if op is null then raise exception 'Named acceptance sample missing';end if;
 select id into actor from crm_users where username='admin' and active;
 select id,revision into item,rev from operation_service_items where case_id=op and title='[试验验收0907] 双确认导游服务';
 if item is null then raise exception 'Named service missing';end if;
 if (select count(*) from operation_change_events where case_id=op)<120 then
  for n in 1..121 loop
   perform crm_mutate_operation(actor,op,'operation_service_items',item,rev,jsonb_build_object('details','[试验验收0907] 历史分页测试 '||n||'；2 成人 1 儿童，10 小时英语导游'),false);
   rev:=rev+1;
  end loop;
 end if;
 select id into latest_event from operation_change_events where case_id=op order by created_at desc,id desc limit 1;
 
 
 for e in select id from operation_change_events where case_id=op and strong_alert and id<>latest_event loop
  perform crm_acknowledge_operation_change(actor,customer,e.id,'planner','[试验验收0907] 管理员代规划师核对自动生成的分页测试数据');
  perform crm_acknowledge_operation_change(actor,customer,e.id,'operations','[试验验收0907] 管理员代计调核对自动生成的分页测试数据');
 end loop;
end $$;
commit;
