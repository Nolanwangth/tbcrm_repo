begin;
alter table public.crm_users drop constraint crm_users_role_check;
update public.crm_users set role='planner' where role='service';
alter table public.crm_users add constraint crm_users_role_check check(role in ('planner','operations','admin'));
alter table public.crm_users add column must_change_password boolean not null default false;
create table public.crm_account_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.crm_users(id),
  target_user_id uuid references public.crm_users(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.crm_account_events enable row level security;
revoke all on public.crm_account_events from anon, authenticated;
grant all on public.crm_account_events to service_role;

create function public.crm_manage_account(p_actor uuid, p_action text, p_target uuid, p_values jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare old_user public.crm_users%rowtype; new_user public.crm_users%rowtype; result_id uuid;
begin
  
  perform pg_advisory_xact_lock(70820260907);
  if not exists(select 1 from crm_users where id=p_actor and active and role='admin' and not must_change_password) then
    raise exception '只有有效管理员可以管理账号' using errcode='42501';
  end if;
  if p_action='create' then
    if coalesce(p_values->>'username','') !~ '^[a-zA-Z0-9_.-]{3,64}$' then raise exception '账号格式无效'; end if;
    if length(trim(coalesce(p_values->>'display_name',''))) not between 1 and 80 then raise exception '显示名称无效'; end if;
    if length(coalesce(p_values->>'password_hash','')) <> 128 or length(coalesce(p_values->>'password_salt','')) < 32 then raise exception '临时密码摘要无效'; end if;
    insert into crm_users(username,display_name,role,password_salt,password_hash,must_change_password)
    values(p_values->>'username',trim(p_values->>'display_name'),p_values->>'role',p_values->>'password_salt',p_values->>'password_hash',true) returning * into new_user;
  elsif p_action in ('update','reset_password') then
    select * into strict old_user from crm_users where id=p_target for update;
    if p_action='update' then
      if length(trim(coalesce(p_values->>'display_name',''))) not between 1 and 80 then raise exception '显示名称无效'; end if;
      if old_user.role='admin' and old_user.active and (p_values->>'role'<>'admin' or not (p_values->>'active')::boolean)
        and not exists(select 1 from crm_users where id<>p_target and role='admin' and active) then raise exception '必须保留至少一个有效管理员'; end if;
      update crm_users set display_name=trim(p_values->>'display_name'),role=p_values->>'role',active=(p_values->>'active')::boolean where id=p_target returning * into new_user;
    else
      if length(coalesce(p_values->>'password_hash','')) <> 128 or length(coalesce(p_values->>'password_salt','')) < 32 then raise exception '临时密码摘要无效'; end if;
      update crm_users set password_hash=p_values->>'password_hash',password_salt=p_values->>'password_salt',must_change_password=true where id=p_target returning * into new_user;
    end if;
    if p_action='reset_password' or new_user.role is distinct from old_user.role or new_user.active is distinct from old_user.active then
      delete from crm_auth_sessions where user_id=p_target;
    end if;
  elsif p_action='seat' then
    if p_target is not null and not exists(select 1 from crm_users where id=p_target and role='planner' and active) then raise exception '席位只能绑定有效规划师'; end if;
    if p_values->>'slot' not in ('A','B','C','D','E') then raise exception '席位无效'; end if;
    insert into crm_account_events(actor_user_id,target_user_id,action,before_data,after_data)
    select p_actor,p_target,p_action,to_jsonb(s),p_values || jsonb_build_object('user_id',p_target) from service_workbench_slots s where slot=p_values->>'slot';
    update service_workbench_slots set user_id=p_target,enabled=(p_values->>'enabled')::boolean,updated_at=now() where slot=p_values->>'slot';
    return p_target;
  else raise exception '未知账号操作'; end if;
  insert into crm_account_events(actor_user_id,target_user_id,action,before_data,after_data)
  values(p_actor,new_user.id,p_action,
    case when old_user.id is null then null else to_jsonb(old_user)-'password_hash'-'password_salt' end,
    to_jsonb(new_user)-'password_hash'-'password_salt');
  return new_user.id;
end $$;
revoke all on function public.crm_manage_account(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.crm_manage_account(uuid,text,uuid,jsonb) to service_role;

create function public.crm_change_own_password(p_actor uuid,p_old_hash text,p_salt text,p_hash text)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if length(p_hash)<>128 or length(p_salt)<32 or p_old_hash=p_hash then raise exception '密码摘要无效'; end if;
  update crm_users set password_salt=p_salt,password_hash=p_hash,must_change_password=false where id=p_actor and active and password_hash=p_old_hash;
  if not found then raise exception '账号状态或密码已改变，请重新登录'; end if;
  delete from crm_auth_sessions where user_id=p_actor;
  insert into crm_account_events(actor_user_id,target_user_id,action) values(p_actor,p_actor,'change_own_password');
end $$;
revoke all on function public.crm_change_own_password(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_change_own_password(uuid,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
