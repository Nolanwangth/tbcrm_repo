
create function public.crm_create_operation_case(p_actor uuid,p_customer uuid,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare customer customers%rowtype; result operation_cases%rowtype;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  select * into customer from customers where id=p_customer for update;
  if not found or customer.status<>'已成交' then raise exception '请先确认客户成交后再创建服务清单';end if;
  perform set_config('crm.actor_id',p_actor::text,true);
  insert into operation_cases(customer_id,tour_code,tour_name,owner_name,start_date,end_date,traveler_count,route_info,order_total,budget_cost,special_requirements,record_status,creation_source)
  values(p_customer,next_operation_tour_code(),coalesce(nullif(trim(customer.nationality),''),'未填国家')||customer.name||'团',p_values->>'owner_name',(p_values->>'start_date')::date,(p_values->>'end_date')::date,p_values->>'traveler_count',p_values->>'route_info',(p_values->>'order_total')::numeric,(p_values->>'budget_cost')::numeric,p_values->>'special_requirements','draft','manual') returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.crm_create_operation_case(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.crm_create_operation_case(uuid,uuid,jsonb) to service_role;

create function public.crm_register_proposal_pdf(p_actor uuid,p_version uuid,p_storage_path text,p_size bigint,p_sha256 text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare version customer_proposal_versions%rowtype; customer uuid; file uuid;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  select * into version from customer_proposal_versions where id=p_version for update;
  if not found then raise exception '正式版本不存在';end if;
  select file_id into file from crm_proposal_pdf_artifacts where version_id=p_version;
  if found then return file;end if;
  select customer_id into customer from customer_proposals where id=version.proposal_id;
  if p_storage_path<>customer::text||'/proposals/'||p_version::text||'.pdf' or p_sha256 !~ '^[a-f0-9]{64}$' or p_size<1 then raise exception 'PDF 文件关联无效';end if;
  insert into customer_files(customer_id,name,storage_path,size_bytes,mime_type)
    values(customer,version.snapshot->>'title'||'-正式版.pdf',p_storage_path,p_size,'application/pdf') returning id into file;
  insert into crm_proposal_pdf_artifacts(version_id,file_id,sha256,created_by) values(p_version,file,p_sha256,p_actor);
  insert into customer_proposal_documents(proposal_version_id,customer_file_id,document_type,generated_by_user_id)
    values(p_version,file,version.snapshot->>'toolType',p_actor);
  return file;
end $$;
revoke all on function public.crm_register_proposal_pdf(uuid,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.crm_register_proposal_pdf(uuid,uuid,text,bigint,text) to service_role;

create function public.crm_save_quote_v2_group(p_actor uuid,p_customer uuid,p_name text,p_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare previous jsonb; result crm_quote_v2_groups%rowtype;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  perform 1 from customers where id=p_customer and status in ('跟进中','已成交') for update;
  if not found then raise exception '该客户不能编辑方案分组';end if;
  if length(trim(p_name)) not between 1 and 100 then raise exception '分组名称无效';end if;
  if p_id is not null then
    select to_jsonb(g) into previous from crm_quote_v2_groups g where id=p_id and customer_id=p_customer for update;
    if not found then raise exception '分组不属于此客户';end if;
    update crm_quote_v2_groups set name=trim(p_name),updated_at=now() where id=p_id returning * into result;
  else
    insert into crm_quote_v2_groups(customer_id,name) values(p_customer,trim(p_name)) returning * into result;
  end if;
  insert into crm_quote_v2_events(actor_user_id,customer_id,action,details) values(p_actor,p_customer,'group_saved',jsonb_build_object('before',previous,'after',to_jsonb(result)));
  return to_jsonb(result);
end $$;
revoke all on function public.crm_save_quote_v2_group(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_save_quote_v2_group(uuid,uuid,text,uuid) to service_role;
