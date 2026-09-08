begin;



create or replace function public.sync_won_case_from_travel_need()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.operation_cases
  set start_date = new.expected_start_date,
      end_date = new.expected_end_date,
      traveler_count = new.traveler_count,
      route_info = new.destinations,
      special_requirements = new.special_requirements,
      updated_at = now()
  where customer_id = new.customer_id
    and creation_source = 'won_auto';
  return new;
end;
$$;

drop trigger if exists travel_needs_sync_won_case on public.travel_needs;
create trigger travel_needs_sync_won_case
after insert or update of expected_start_date, expected_end_date, traveler_count, destinations, special_requirements
on public.travel_needs
for each row execute function public.sync_won_case_from_travel_need();

grant execute on function public.sync_won_case_from_travel_need() to service_role;

commit;
