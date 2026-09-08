create function public.crm_link_customer_document(p_actor uuid,p_customer uuid,p_file uuid,p_type text,p_previous uuid default null)
returns void language plpgsql security invoker set search_path=public as $$
declare actor crm_users%rowtype; previous uuid; previous_name text; file_name text;
begin
 select * into actor from crm_users where id=p_actor and active and not must_change_password;
 if not found then raise exception '未授权' using errcode='42501';end if;
 if p_type not in ('contract','proforma_invoice') then raise exception '文件类型无效';end if;
 perform 1 from customers where id=p_customer for update;
 if not found then raise exception '客户不存在';end if;
 select name into file_name from customer_files where id=p_file and customer_id=p_customer;
 if not found then raise exception '文件不属于此客户';end if;
 select l.id,f.name into previous,previous_name from customer_document_links l join customer_files f on f.id=l.customer_file_id where l.customer_id=p_customer and l.document_type=p_type and l.replaced_at is null;
 if previous is distinct from p_previous then raise exception 'CONFLICT: 此客户文件已被其他人更新，请重新加载后核对';end if;
 update customer_document_links set replaced_at=now() where id=previous;
 insert into customer_document_links(customer_id,customer_file_id,document_type,created_by_user_id) values(p_customer,p_file,p_type,p_actor);
 insert into audit_logs(customer_id,field_name,old_value,new_value,actor_user_id,actor_name_snapshot,actor_role_snapshot)
 values(p_customer,case when p_type='contract' then '合同文件' else '形式发票' end,previous_name,file_name,p_actor,actor.display_name,actor.role);
end $$;
revoke all on function public.crm_link_customer_document(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_link_customer_document(uuid,uuid,uuid,text,uuid) to service_role;
