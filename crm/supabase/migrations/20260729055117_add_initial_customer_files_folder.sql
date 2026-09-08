begin;

alter table public.customer_folders
  add column if not exists workflow_status_enabled boolean not null default true;


commit;
