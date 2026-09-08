begin;

drop function if exists public.import_operation_cost_sheet(
  uuid,
  uuid,
  text,
  jsonb,
  boolean
);

drop index if exists public.operation_service_items_import_row_key_idx;
drop index if exists public.operation_cost_sheet_imports_case_created_idx;

alter table public.operation_service_items
  drop column if exists import_row_key,
  drop column if exists import_id;

alter table public.operation_days
  drop column if exists import_id;

drop table if exists public.operation_cost_sheet_imports;

commit;
