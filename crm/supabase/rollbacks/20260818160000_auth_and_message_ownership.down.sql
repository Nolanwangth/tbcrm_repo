begin;


alter table if exists public.customer_collaboration_messages
  drop column if exists author_id;

drop table if exists public.crm_auth_sessions;
drop table if exists public.crm_users;

commit;
