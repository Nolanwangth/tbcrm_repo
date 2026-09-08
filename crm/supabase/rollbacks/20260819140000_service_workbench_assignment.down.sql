begin;

drop trigger if exists customers_record_service_assignment_exception on public.customers;
drop trigger if exists customers_prepare_service_assignment on public.customers;
drop function if exists public.record_service_assignment_exception();
drop function if exists public.prepare_customer_service_assignment();
drop function if exists public.next_service_slot(text);
drop table if exists public.service_assignment_exceptions;
drop table if exists public.service_assignment_events;
drop table if exists public.service_assignment_state;
drop table if exists public.service_workbench_slots;

alter table public.follow_up_versions
  drop column if exists callback_skip_reason,
  drop column if exists callback_not_required,
  drop column if exists next_callback_at;
alter table public.follow_ups
  drop constraint if exists follow_ups_callback_state_check,
  drop column if exists callback_skip_reason,
  drop column if exists callback_not_required,
  drop column if exists next_callback_at;
alter table public.customers
  drop constraint if exists customers_callback_state_check,
  drop constraint if exists customers_service_assignment_mode_check,
  drop constraint if exists customers_service_workbench_check,
  drop column if exists callback_skip_reason,
  drop column if exists callback_not_required,
  drop column if exists current_callback_at,
  drop column if exists service_assigned_at,
  drop column if exists service_owner_user_id,
  drop column if exists service_assignment_mode,
  drop column if exists service_workbench;

commit;
