create or replace function public.crm_register_proposal_pdf(p_actor uuid,p_version uuid,p_storage_path text,p_size bigint,p_sha256 text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare version customer_proposal_versions%rowtype; customer uuid; file uuid;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('crm-pdf:'||p_version::text,0));
  select * into version from customer_proposal_versions where id=p_version;
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
