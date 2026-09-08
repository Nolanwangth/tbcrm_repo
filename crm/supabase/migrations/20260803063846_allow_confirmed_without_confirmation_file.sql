begin;



alter table public.operation_service_items
  drop constraint if exists operation_service_items_check1;

commit;
