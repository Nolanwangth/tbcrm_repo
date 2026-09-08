begin;

revoke all on public.crm_proposal_branded_artifacts from service_role;
grant select,insert on public.crm_proposal_branded_artifacts to service_role;
commit;
