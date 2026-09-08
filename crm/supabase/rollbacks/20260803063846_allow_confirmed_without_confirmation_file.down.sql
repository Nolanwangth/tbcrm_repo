begin;



alter table public.operation_service_items
  add constraint operation_service_items_confirmation_file_required_when_confirmed
  check (booking_status <> 'confirmed' or confirmation_file_id is not null)
  not valid;

commit;
