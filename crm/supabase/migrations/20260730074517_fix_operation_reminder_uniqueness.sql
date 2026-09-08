begin;

alter table public.operation_reminders
  drop constraint if exists operation_reminders_case_id_auto_key_key;

create unique index operation_reminders_case_auto_key_unique
  on public.operation_reminders (case_id, auto_key)
  where auto_key is not null;

create or replace function public.sync_operation_default_reminders(p_case_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_arrival date;
begin
  select t.expected_start_date
  into v_arrival
  from public.operation_cases o
  join public.travel_needs t on t.customer_id = o.customer_id
  where o.id = p_case_id;

  if v_arrival is null then
    delete from public.operation_reminders
    where case_id = p_case_id
      and is_auto
      and status = 'pending';
    return;
  end if;

  insert into public.operation_reminders (
    case_id, title, due_date, anchor_type, offset_days, auto_key, is_auto
  )
  values
    (
      p_case_id,
      '检查酒店、大交通和重点门票预订',
      v_arrival - 15,
      'arrival',
      15,
      'arrival-15',
      true
    ),
    (
      p_case_id,
      '复核所有预订、导游、司机和服务清单',
      v_arrival - 7,
      'arrival',
      7,
      'arrival-7',
      true
    ),
    (
      p_case_id,
      '最终确认接机、车辆、导游及客户联络',
      v_arrival - 1,
      'arrival',
      1,
      'arrival-1',
      true
    )
  on conflict (case_id, auto_key) where auto_key is not null do update
  set due_date = case
        when operation_reminders.is_auto then excluded.due_date
        when operation_reminders.anchor_type = 'arrival'
          and operation_reminders.offset_days is not null
          then v_arrival - operation_reminders.offset_days
        else operation_reminders.due_date
      end,
      title = case
        when operation_reminders.is_auto then excluded.title
        else operation_reminders.title
      end,
      anchor_type = case
        when operation_reminders.is_auto then excluded.anchor_type
        else operation_reminders.anchor_type
      end,
      offset_days = case
        when operation_reminders.is_auto then excluded.offset_days
        else operation_reminders.offset_days
      end,
      updated_at = now()
  where operation_reminders.status = 'pending';
end;
$$;

revoke all on function public.sync_operation_default_reminders(uuid)
from public, anon, authenticated;

grant execute on function public.sync_operation_default_reminders(uuid)
to service_role;

commit;
