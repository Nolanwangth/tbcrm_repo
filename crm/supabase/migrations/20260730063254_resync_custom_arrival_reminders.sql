begin;

create or replace function public.sync_custom_arrival_reminders()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.expected_start_date is not null then
    update public.operation_reminders reminder
    set due_date = new.expected_start_date - reminder.offset_days,
        updated_at = now()
    from public.operation_cases operation_case
    where operation_case.customer_id = new.customer_id
      and reminder.case_id = operation_case.id
      and reminder.anchor_type = 'arrival'
      and not reminder.is_auto
      and reminder.status = 'pending'
      and reminder.offset_days is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists travel_needs_sync_custom_arrival_reminders
on public.travel_needs;

create trigger travel_needs_sync_custom_arrival_reminders
after insert or update of expected_start_date on public.travel_needs
for each row execute function public.sync_custom_arrival_reminders();

update public.operation_reminders reminder
set due_date = travel.expected_start_date - reminder.offset_days,
    updated_at = now()
from public.operation_cases operation_case
join public.travel_needs travel
  on travel.customer_id = operation_case.customer_id
where reminder.case_id = operation_case.id
  and reminder.anchor_type = 'arrival'
  and not reminder.is_auto
  and reminder.status = 'pending'
  and reminder.offset_days is not null
  and travel.expected_start_date is not null;

revoke all on function public.sync_custom_arrival_reminders()
from public, anon, authenticated;

grant execute on function public.sync_custom_arrival_reminders()
to service_role;

commit;
