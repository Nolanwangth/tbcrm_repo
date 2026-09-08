begin;

alter table public.operation_travelers add constraint traveler_required_child_details
  check(traveler_type<>'child' or (age is not null and height_cm is not null)) not valid;
alter table public.operation_travelers add constraint traveler_required_senior_age
  check(traveler_type<>'senior' or age is not null) not valid;

create index customers_status_updated_id_idx on public.customers(status,updated_at desc,id);
create index operation_change_events_history_idx on public.operation_change_events(case_id,created_at desc,id);
create index operation_reminders_case_idx on public.operation_reminders(case_id);


create table public.crm_proposal_branded_artifacts(
  version_id uuid primary key references public.customer_proposal_versions(id),
  file_id uuid not null references public.customer_files(id),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  renderer_version text not null default 'word-template-v1',
  created_by uuid not null references public.crm_users(id),
  created_at timestamptz not null default now()
);
alter table public.crm_proposal_branded_artifacts enable row level security;
revoke all on public.crm_proposal_branded_artifacts from public,anon,authenticated;
grant select,insert on public.crm_proposal_branded_artifacts to service_role;
create function public.crm_register_branded_pdf(p_actor uuid,p_version uuid,p_storage_path text,p_size bigint,p_sha256 text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare version customer_proposal_versions%rowtype; customer uuid; file uuid;
begin
  if not exists(select 1 from crm_users where id=p_actor and active and not must_change_password) then raise exception '未授权' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('crm-branded-pdf:'||p_version::text,0));
  select * into version from customer_proposal_versions where id=p_version;
  if not found or version.snapshot->>'toolType'<>'itinerary' or version.snapshot->>'schemaVersion'<>'2' then raise exception '行程正式版本不存在';end if;
  select file_id into file from crm_proposal_branded_artifacts where version_id=p_version;
  if found then return file;end if;
  select customer_id into customer from customer_proposals where id=version.proposal_id;
  if p_storage_path<>customer::text||'/proposals/'||p_version::text||'-branded-v1.pdf' or p_sha256 !~ '^[a-f0-9]{64}$' or p_size<1 then raise exception 'PDF 文件关联无效';end if;
  insert into customer_files(customer_id,name,storage_path,size_bytes,mime_type)
    values(customer,(version.snapshot->>'title')||'-品牌行程书.pdf',p_storage_path,p_size,'application/pdf') returning id into file;
  insert into crm_proposal_branded_artifacts(version_id,file_id,sha256,created_by) values(p_version,file,p_sha256,p_actor);
  insert into customer_proposal_documents(proposal_version_id,customer_file_id,document_type,generated_by_user_id)
    values(p_version,file,'itinerary',p_actor);
  return file;
end $$;
revoke all on function public.crm_register_branded_pdf(uuid,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.crm_register_branded_pdf(uuid,uuid,text,bigint,text) to service_role;
commit;
