begin;

alter table public.customers
  add column if not exists assignee text;


commit;
