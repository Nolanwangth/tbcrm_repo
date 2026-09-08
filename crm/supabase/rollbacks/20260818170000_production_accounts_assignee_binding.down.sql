begin;


drop trigger if exists customers_sync_assignee_identity on public.customers;
drop function if exists public.sync_customer_assignee_identity();
drop index if exists public.customers_assignee_user_idx;
alter table public.customers drop column if exists assignee_user_id;
drop index if exists public.crm_auth_sessions_user_idx;

alter table public.crm_users drop constraint if exists crm_users_role_check;
alter table public.crm_users drop column if exists role;

commit;
