begin;
drop trigger if exists operation_service_items_sync_checklist on public.operation_service_items;
drop function if exists public.sync_operation_checklist_tasks();
drop function if exists public.import_operation_service_list_v2(uuid,uuid,text,jsonb,boolean);
drop index if exists public.operation_reminders_assignee_due_idx;
delete from public.operation_reminders where task_kind = 'checklist';
create or replace function public.sync_operation_reminders_from_travel_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case_id uuid;
begin
  if tg_op = 'INSERT'
     or new.expected_start_date is distinct from old.expected_start_date then
    select id into v_case_id
    from public.operation_cases
    where customer_id = new.customer_id;

    if v_case_id is not null then
      perform public.sync_operation_default_reminders(v_case_id);
    end if;
  end if;
  return new;
end;
$$;
alter table public.operation_reminders drop column if exists is_customized, drop column if exists assignee_user_id, drop column if exists template_version, drop column if exists template_key, drop column if exists task_kind;
alter table public.operation_reminders alter column due_date set not null;
alter table public.operation_service_items drop constraint if exists operation_service_items_section_category_check, drop constraint if exists operation_service_items_category_check;
alter table public.operation_service_items add constraint operation_service_items_category_check check (category in ('guide','driver','ticket','other','hotel','flight','rail','other_transport'));
alter table public.operation_service_items add constraint operation_service_items_section_category_check check ((section='daily' and day_id is not null and category in ('guide','driver','ticket','other')) or (section='hotel' and day_id is null and category='hotel') or (section='transport' and day_id is null and category in ('flight','rail','other_transport')));
commit;
