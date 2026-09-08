create function public.crm_reject_immutable_change()
returns trigger language plpgsql set search_path=public as $$
begin raise exception '正式版本、原始文件关联及确认记录不可修改或删除';end $$;
create trigger crm_immutable_version before update or delete on public.customer_proposal_versions for each row execute function public.crm_reject_immutable_change();
create trigger crm_immutable_pdf before update or delete on public.crm_proposal_pdf_artifacts for each row execute function public.crm_reject_immutable_change();
create trigger crm_immutable_ack before update or delete on public.operation_change_acknowledgements for each row execute function public.crm_reject_immutable_change();
revoke update,delete on public.customer_proposal_versions,public.crm_proposal_pdf_artifacts,public.operation_change_acknowledgements from service_role;
