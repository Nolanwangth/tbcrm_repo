begin;
drop trigger if exists customers_sync_service_handoffs on public.customers;
drop function if exists public.sync_customer_service_handoffs();
drop table if exists public.customer_service_handoffs;
alter table public.audit_logs
  drop column if exists actor_role_snapshot,
  drop column if exists actor_name_snapshot,
  drop column if exists actor_user_id;
commit;
