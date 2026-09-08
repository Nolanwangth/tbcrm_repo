begin;
create table public.crm_quote_v2_catalog (
  key text primary key check(key in ('products','templates','settings')),
  payload jsonb not null, revision integer not null default 1,
  updated_by uuid references public.crm_users(id), updated_at timestamptz not null default now()
);
create table public.crm_quote_v2_groups (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  name text not null check(length(trim(name)) between 1 and 100), sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(customer_id,name)
);
alter table public.customer_proposals add column editor_schema integer not null default 1,
  add column editor_snapshot jsonb, add column edit_revision integer not null default 0;
alter table public.customer_proposal_versions add column publish_request_id uuid unique;
create table public.crm_quote_v2_events (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.customers(id),
  proposal_id uuid references public.customer_proposals(id), actor_user_id uuid not null references public.crm_users(id),
  action text not null, details jsonb, created_at timestamptz not null default now()
);
alter table public.crm_quote_v2_catalog enable row level security;
alter table public.crm_quote_v2_groups enable row level security;
alter table public.crm_quote_v2_events enable row level security;
revoke all on public.crm_quote_v2_catalog,public.crm_quote_v2_groups,public.crm_quote_v2_events from anon,authenticated;
grant all on public.crm_quote_v2_catalog,public.crm_quote_v2_groups,public.crm_quote_v2_events to service_role;

create function public.crm_save_quote_v2(p_actor uuid,p_customer uuid,p_proposal uuid,p_revision integer,p_snapshot jsonb,p_publish_request uuid default null,p_note text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_proposal customer_proposals%rowtype; saved_version customer_proposal_versions%rowtype; revision integer; number integer; customer_status text;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '登录状态已失效' using errcode='42501'; end if;
  select status into customer_status from customers where id=p_customer for update;
  if not found then raise exception '客户不存在'; end if;
  if customer_status not in ('跟进中','已成交') then raise exception '已关闭客户仅可查看和导出历史版本' using errcode='42501'; end if;
  if p_publish_request is not null then
    select * into saved_version from customer_proposal_versions where publish_request_id=p_publish_request;
    if found then
      if saved_version.proposal_id<>p_proposal then raise exception '重复请求的方案不一致'; end if;
      return jsonb_build_object('versionId',saved_version.id,'versionNumber',saved_version.version_number,'revision',(select edit_revision from customer_proposals where id=p_proposal));
    end if;
  end if;
  if p_snapshot->>'schemaVersion'<>'2' or p_snapshot->>'customerId'<>p_customer::text or p_snapshot->>'toolType' not in ('itinerary','quotation') then raise exception '2.0 快照与客户不一致'; end if;
  if p_snapshot->>'groupId' is not null and not exists(select 1 from crm_quote_v2_groups where id=(p_snapshot->>'groupId')::uuid and customer_id=p_customer) then raise exception '分组不属于当前客户'; end if;
  select * into current_proposal from customer_proposals where id=p_proposal for update;
  if found then
    if current_proposal.customer_id<>p_customer or current_proposal.tool_type<>p_snapshot->>'toolType' or current_proposal.editor_schema<>2 then raise exception '方案关联不一致'; end if;
    if current_proposal.edit_revision<>p_revision then raise exception 'CONFLICT: 草稿已被其他人更新，本地输入仍保留，请重新加载后核对'; end if;
    if current_proposal.status='published' then raise exception '正式版本只读，请基于此版本新建草稿'; end if;
    update customer_proposals set editor_snapshot=p_snapshot,title=p_snapshot->>'title',traveler_count=(p_snapshot->>'travelerCount')::integer,edit_revision=edit_revision+1 where id=p_proposal returning edit_revision into revision;
  else
    if p_revision<>0 then raise exception 'CONFLICT: 草稿已不存在'; end if;
    insert into customer_proposals(id,customer_id,title,traveler_count,tool_type,auto_match,created_by_user_id,editor_schema,editor_snapshot,edit_revision)
    values(p_proposal,p_customer,p_snapshot->>'title',(p_snapshot->>'travelerCount')::integer,p_snapshot->>'toolType',false,p_actor,2,p_snapshot,1) returning edit_revision into revision;
  end if;
  if p_publish_request is not null then
    select coalesce(max(version_number),0)+1 into number from customer_proposal_versions v join customer_proposals p on p.id=v.proposal_id where p.customer_id=p_customer and p.tool_type=p_snapshot->>'toolType';
    insert into customer_proposal_versions(proposal_id,version_number,version_note,snapshot,published_at,published_by_user_id,created_by_user_id,publish_request_id)
    values(p_proposal,number,p_note,p_snapshot,now(),p_actor,p_actor,p_publish_request) returning * into saved_version;
    update customer_proposals set status='published',published_version_id=saved_version.id where id=p_proposal;
  end if;
  insert into crm_quote_v2_events(customer_id,proposal_id,actor_user_id,action,details)
  values(p_customer,p_proposal,p_actor,case when p_publish_request is null then 'save_draft' else 'publish' end,jsonb_build_object('revision',revision,'version_id',saved_version.id));
  return jsonb_build_object('proposalId',p_proposal,'revision',revision,'versionId',saved_version.id,'versionNumber',saved_version.version_number);
end $$;
revoke all on function public.crm_save_quote_v2(uuid,uuid,uuid,integer,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.crm_save_quote_v2(uuid,uuid,uuid,integer,jsonb,uuid,text) to service_role;

create function public.crm_update_quote_v2_catalog(p_actor uuid,p_key text,p_revision integer,p_payload jsonb)
returns integer language plpgsql security invoker set search_path=public as $$
declare revision integer;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501'; end if;
  update crm_quote_v2_catalog set payload=p_payload,revision=crm_quote_v2_catalog.revision+1,updated_at=now(),updated_by=p_actor where key=p_key and crm_quote_v2_catalog.revision=p_revision returning crm_quote_v2_catalog.revision into revision;
  if not found then raise exception 'CONFLICT: 共享资料已更新，请重新加载；本地输入仍保留'; end if;
  insert into crm_quote_v2_events(actor_user_id,action,details) values(p_actor,'catalog_update',jsonb_build_object('key',p_key,'revision',revision));
  return revision;
end $$;
revoke all on function public.crm_update_quote_v2_catalog(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.crm_update_quote_v2_catalog(uuid,text,integer,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
