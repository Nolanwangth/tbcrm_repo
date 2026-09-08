begin;
create table public.crm_proposal_pdf_artifacts (
  version_id uuid primary key references public.customer_proposal_versions(id),
  file_id uuid not null references public.customer_files(id), sha256 text not null,
  created_by uuid not null references public.crm_users(id),created_at timestamptz not null default now()
);
alter table public.crm_proposal_pdf_artifacts enable row level security;
revoke all on public.crm_proposal_pdf_artifacts from anon,authenticated;
grant select,insert on public.crm_proposal_pdf_artifacts to service_role;
create function public.crm_create_auth_session(p_user uuid,p_password_hash text,p_token_hash text,p_expires timestamptz)
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform 1 from crm_users where id=p_user and active and password_hash=p_password_hash for update;
  if not found then raise exception '账号状态已改变，请重新登录' using errcode='42501';end if;
  insert into crm_auth_sessions(token_hash,user_id,expires_at) values(p_token_hash,p_user,p_expires);
end $$;
revoke all on function public.crm_create_auth_session(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.crm_create_auth_session(uuid,text,text,timestamptz) to service_role;
notify pgrst,'reload schema';
commit;
