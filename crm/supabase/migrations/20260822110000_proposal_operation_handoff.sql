begin;

alter table public.operation_cases add column if not exists source_proposal_version_id uuid references public.customer_proposal_versions(id) on delete set null;
create unique index if not exists operation_cases_source_proposal_version_unique on public.operation_cases(source_proposal_version_id) where source_proposal_version_id is not null;

commit;
