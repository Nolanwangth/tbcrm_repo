begin;
delete from public.customers where name like '[DDL测试]%';
delete from public.crm_users where username in ('ddl_planner_a','ddl_planner_b','ddl_service');
commit;
