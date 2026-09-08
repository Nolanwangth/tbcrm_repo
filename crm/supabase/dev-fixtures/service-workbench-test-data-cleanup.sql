begin;

delete from public.customers where id::text like 'ee100000-0000-4000-8000-%';
update public.service_assignment_state set next_slot = 'A', updated_at = now() where singleton = true;
update public.service_workbench_slots set enabled = true, updated_at = now() where slot in ('A','B','C');

commit;
