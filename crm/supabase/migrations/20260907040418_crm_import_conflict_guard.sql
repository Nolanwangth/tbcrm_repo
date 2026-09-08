begin;
drop function public.crm_import_operation_service_list(uuid,uuid,uuid,text,jsonb,boolean);
create function public.crm_import_operation_service_list(p_actor uuid,p_case_id uuid,p_file_id uuid,p_content_hash text,p_payload jsonb,p_replace_existing boolean,p_expected_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_rows jsonb;
begin
 if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
 perform 1 from operation_cases where id=p_case_id for update;
 if not found then raise exception '服务清单不存在';end if;
 select coalesce(jsonb_object_agg(id::text,revision),'{}'::jsonb) into current_rows from (
  select id,revision from operation_days where case_id=p_case_id
  union all select id,revision from operation_service_items where case_id=p_case_id
 ) rows;
 if p_expected_rows is null or current_rows<>p_expected_rows then raise exception 'CONFLICT: 服务清单在预览后已被修改，请重新预览；当前修正输入未被清除';end if;
 perform set_config('crm.actor_id',p_actor::text,true);
 return import_operation_service_list_v2(p_case_id,p_file_id,p_content_hash,p_payload,p_replace_existing);
end $$;
revoke all on function public.crm_import_operation_service_list(uuid,uuid,uuid,text,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.crm_import_operation_service_list(uuid,uuid,uuid,text,jsonb,boolean,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
