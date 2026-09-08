begin;




create table public.operation_service_finance_controls (
  service_item_id uuid primary key references public.operation_service_items(id) on delete cascade,
  payment_channel text not null check (payment_channel in ('public','personal')),
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','reconciled')),
  reconciled_amount numeric(14,2) check (reconciled_amount is null or reconciled_amount >= 0),
  reconciled_at timestamptz,
  reconciled_by_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((reconciliation_status = 'pending' and reconciled_at is null) or (reconciliation_status = 'reconciled' and reconciled_at is not null and reconciled_by_name is not null))
);
create trigger operation_service_finance_controls_set_updated_at before update on public.operation_service_finance_controls for each row execute function public.set_updated_at();
create index operation_service_finance_controls_channel_status_idx on public.operation_service_finance_controls(payment_channel,reconciliation_status);

alter table public.operation_service_finance_controls enable row level security;
revoke all on public.operation_service_finance_controls from anon, authenticated;
grant select, insert, update, delete on public.operation_service_finance_controls to service_role;

commit;
