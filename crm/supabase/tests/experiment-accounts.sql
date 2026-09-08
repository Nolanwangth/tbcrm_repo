begin;
set local role service_role;
do $$
declare administrator uuid; planner uuid; operator uuid; denied boolean;
begin
  select id into administrator from public.crm_users where active and role='admin' limit 1;
  if administrator is null then raise exception 'Test requires seeded admin'; end if;
  planner := public.crm_manage_account(administrator,'create',null,jsonb_build_object('username','experiment_test_planner','display_name','试验测试规划师','role','planner','password_salt',repeat('a',64),'password_hash',repeat('b',128)));
  operator := public.crm_manage_account(administrator,'create',null,jsonb_build_object('username','experiment_test_operations','display_name','试验测试计调','role','operations','password_salt',repeat('a',64),'password_hash',repeat('b',128)));
  if not (select must_change_password from crm_users where id=planner) then raise exception 'Missing forced password change'; end if;
  denied:=false;
  begin perform public.crm_manage_account(planner,'update',operator,'{"display_name":"Unauthorized","role":"admin","active":true}'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Nonadmin authorized'; end if;
  perform public.crm_change_own_password(planner,repeat('b',128),repeat('c',64),repeat('d',128));
  if (select must_change_password from crm_users where id=planner) then raise exception 'Password change did not unlock account'; end if;
  insert into crm_auth_sessions(token_hash,user_id,expires_at) values('experiment-test-session',planner,now()+interval '1 day');
  perform public.crm_manage_account(administrator,'update',planner,'{"display_name":"测试改角色","role":"operations","active":true}');
  if exists(select 1 from crm_auth_sessions where user_id=planner) then raise exception 'Role change retained sessions'; end if;
  insert into crm_auth_sessions(token_hash,user_id,expires_at) values('experiment-test-session',planner,now()+interval '1 day');
  perform public.crm_manage_account(administrator,'reset_password',planner,jsonb_build_object('password_salt',repeat('e',64),'password_hash',repeat('f',128)));
  if exists(select 1 from crm_auth_sessions where user_id=planner) then raise exception 'Reset retained sessions'; end if;
  if (select count(*) from crm_users where active and role='admin')=1 then
    denied:=false;
    begin perform public.crm_manage_account(administrator,'update',administrator,'{"display_name":"Admin","role":"planner","active":true}'); exception when others then denied:=true; end;
    if not denied then raise exception 'Last admin could be removed'; end if;
  end if;
  if exists(select 1 from crm_account_events where after_data ? 'password_hash' or after_data ? 'password_salt' or before_data ? 'password_hash' or before_data ? 'password_salt') then raise exception 'Audit leaked password hash'; end if;
  if has_function_privilege('anon','public.crm_manage_account(uuid,text,uuid,jsonb)','EXECUTE') or has_table_privilege('authenticated','public.crm_account_events','SELECT') then raise exception 'Anonymous/direct access allowed'; end if;
  raise notice 'PASS: three roles, forced password, authorization, session revocation, last admin, audit redaction, direct-access isolation';
end $$;
rollback;
