begin;
delete from public.customers where id::text like 'ef100000-0000-4000-8000-%';
commit;
