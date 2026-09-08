begin;

create sequence public.finance_claim_number_seq;

create table public.finance_claims (
  id uuid primary key default gen_random_uuid(),
  claim_no text not null unique,
  operation_case_id uuid not null references public.operation_cases(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  applicant_name text not null check (char_length(btrim(applicant_name)) > 0),
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'partially_paid', 'paid')),
  note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by_name is null)
    or (status <> 'pending' and reviewed_at is not null and char_length(btrim(reviewed_by_name)) > 0)
  )
);

create table public.finance_claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.finance_claims(id) on delete restrict,
  operation_service_item_id uuid not null references public.operation_service_items(id) on delete restrict,
  title text not null check (char_length(btrim(title)) > 0),
  category text not null,
  supplier_name text,
  service_date date,
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  invoice_file_id uuid references public.customer_files(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (claim_id, operation_service_item_id)
);

create table public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.finance_claims(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null,
  receipt_file_id uuid not null references public.customer_files(id) on delete restrict,
  paid_by_name text not null check (char_length(btrim(paid_by_name)) > 0),
  note text,
  created_at timestamptz not null default now()
);

create table public.finance_claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.finance_claims(id) on delete restrict,
  event_type text not null check (event_type in ('submitted', 'approved', 'rejected', 'payment_recorded')),
  actor_name text not null check (char_length(btrim(actor_name)) > 0),
  note text,
  amount numeric(14,2) check (amount is null or amount > 0),
  created_at timestamptz not null default now()
);

create index finance_claims_status_submitted_idx
  on public.finance_claims (status, submitted_at desc);
create index finance_claims_case_submitted_idx
  on public.finance_claims (operation_case_id, submitted_at desc);
create index finance_claim_items_service_idx
  on public.finance_claim_items (operation_service_item_id);
create index finance_payments_claim_paid_idx
  on public.finance_payments (claim_id, paid_at desc);
create index finance_claim_events_claim_created_idx
  on public.finance_claim_events (claim_id, created_at desc);

create trigger finance_claims_set_updated_at
before update on public.finance_claims
for each row execute function public.set_updated_at();

create or replace function public.create_finance_claim(
  p_operation_case_id uuid,
  p_applicant_name text,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_claim_id uuid;
  v_claim_no text;
  v_item jsonb;
  v_item_id uuid;
  v_title text;
  v_category text;
  v_supplier_name text;
  v_service_date date;
  v_invoice_file_id uuid;
  v_base_amount numeric(14,2);
  v_claimed_amount numeric(14,2);
  v_requested_amount numeric(14,2);
  v_total numeric(14,2) := 0;
begin
  if p_applicant_name is null or char_length(btrim(p_applicant_name)) = 0 then
    raise exception '请填写计调申请人';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '请至少选择一项计调费用';
  end if;

  select customer_id
  into v_customer_id
  from public.operation_cases
  where id = p_operation_case_id;
  if v_customer_id is null then
    raise exception '计调客户不存在';
  end if;

  v_claim_no := 'BZ' || to_char(timezone('Asia/Shanghai', now()), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.finance_claim_number_seq')::text, 6, '0');

  insert into public.finance_claims (
    claim_no,
    operation_case_id,
    customer_id,
    applicant_name,
    amount,
    note
  )
  values (
    v_claim_no,
    p_operation_case_id,
    v_customer_id,
    btrim(p_applicant_name),
    0.01,
    nullif(btrim(p_note), '')
  )
  returning id into v_claim_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_item_id := (v_item->>'itemId')::uuid;
      v_requested_amount := (v_item->>'amount')::numeric(14,2);
    exception when others then
      raise exception '报账费用数据无效';
    end;

    if v_requested_amount is null or v_requested_amount <= 0 then
      raise exception '报账金额必须大于 0';
    end if;

    select
      title,
      category,
      supplier_name,
      service_date,
      invoice_file_id,
      coalesce(final_supplier_settlement, invoice_unit_cost * quantity, 0)
    into
      v_title,
      v_category,
      v_supplier_name,
      v_service_date,
      v_invoice_file_id,
      v_base_amount
    from public.operation_service_items
    where id = v_item_id
      and case_id = p_operation_case_id
      and booking_status <> 'cancelled'
    for update;

    if not found or v_base_amount <= 0 then
      raise exception '所选计调费用不存在或尚未填写有效成本';
    end if;

    select coalesce(sum(item.requested_amount), 0)
    into v_claimed_amount
    from public.finance_claim_items as item
    join public.finance_claims as claim on claim.id = item.claim_id
    where item.operation_service_item_id = v_item_id
      and claim.status <> 'rejected';

    if v_requested_amount > v_base_amount - v_claimed_amount then
      raise exception '“%”可报金额仅剩 % 元', v_title, greatest(v_base_amount - v_claimed_amount, 0);
    end if;

    insert into public.finance_claim_items (
      claim_id,
      operation_service_item_id,
      title,
      category,
      supplier_name,
      service_date,
      requested_amount,
      invoice_file_id
    )
    values (
      v_claim_id,
      v_item_id,
      v_title,
      v_category,
      v_supplier_name,
      v_service_date,
      v_requested_amount,
      v_invoice_file_id
    );

    v_total := v_total + v_requested_amount;
  end loop;

  update public.finance_claims
  set amount = v_total
  where id = v_claim_id;

  insert into public.finance_claim_events (claim_id, event_type, actor_name, amount, note)
  values (v_claim_id, 'submitted', btrim(p_applicant_name), v_total, nullif(btrim(p_note), ''));

  return v_claim_id;
end;
$$;

create or replace function public.review_finance_claim(
  p_claim_id uuid,
  p_decision text,
  p_finance_name text,
  p_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception '财务处理结果无效';
  end if;
  if p_finance_name is null or char_length(btrim(p_finance_name)) = 0 then
    raise exception '请填写财务经办人';
  end if;
  if p_decision = 'rejected' and (p_note is null or char_length(btrim(p_note)) = 0) then
    raise exception '驳回时请填写原因';
  end if;

  select status
  into v_status
  from public.finance_claims
  where id = p_claim_id
  for update;

  if v_status is null then
    raise exception '报账单不存在';
  end if;
  if v_status <> 'pending' then
    raise exception '该报账单已处理，不能重复审核';
  end if;

  update public.finance_claims
  set status = p_decision,
      reviewed_at = now(),
      reviewed_by_name = btrim(p_finance_name),
      review_note = nullif(btrim(p_note), '')
  where id = p_claim_id;

  insert into public.finance_claim_events (claim_id, event_type, actor_name, note)
  values (p_claim_id, p_decision, btrim(p_finance_name), nullif(btrim(p_note), ''));
end;
$$;

create or replace function public.register_finance_payment(
  p_claim_id uuid,
  p_amount numeric,
  p_paid_at timestamptz,
  p_receipt_file_id uuid,
  p_paid_by_name text,
  p_note text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.finance_claims%rowtype;
  v_paid_total numeric(14,2);
  v_payment_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception '付款金额必须大于 0';
  end if;
  if p_paid_at is null then
    raise exception '请选择付款时间';
  end if;
  if p_paid_by_name is null or char_length(btrim(p_paid_by_name)) = 0 then
    raise exception '请填写财务经办人';
  end if;

  select *
  into v_claim
  from public.finance_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception '报账单不存在';
  end if;
  if v_claim.status not in ('approved', 'partially_paid') then
    raise exception '只有审核通过的报账单可以登记付款';
  end if;

  perform 1
  from public.customer_files
  where id = p_receipt_file_id
    and customer_id = v_claim.customer_id;
  if not found then
    raise exception '付款回执不存在或不属于当前客户';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid_total
  from public.finance_payments
  where claim_id = p_claim_id;

  if p_amount > v_claim.amount - v_paid_total then
    raise exception '付款金额超过剩余待付金额';
  end if;

  insert into public.finance_payments (
    claim_id,
    amount,
    paid_at,
    receipt_file_id,
    paid_by_name,
    note
  )
  values (
    p_claim_id,
    p_amount,
    p_paid_at,
    p_receipt_file_id,
    btrim(p_paid_by_name),
    nullif(btrim(p_note), '')
  )
  returning id into v_payment_id;

  update public.finance_claims
  set status = case
    when v_paid_total + p_amount = amount then 'paid'
    else 'partially_paid'
  end
  where id = p_claim_id;

  insert into public.finance_claim_events (claim_id, event_type, actor_name, amount, note)
  values (
    p_claim_id,
    'payment_recorded',
    btrim(p_paid_by_name),
    p_amount,
    nullif(btrim(p_note), '')
  );

  return v_payment_id;
end;
$$;

alter table public.finance_claims enable row level security;
alter table public.finance_claim_items enable row level security;
alter table public.finance_payments enable row level security;
alter table public.finance_claim_events enable row level security;

revoke all on table
  public.finance_claims,
  public.finance_claim_items,
  public.finance_payments,
  public.finance_claim_events
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.finance_claims,
  public.finance_claim_items,
  public.finance_payments,
  public.finance_claim_events
to service_role;

grant usage, select on sequence public.finance_claim_number_seq to service_role;

revoke all on function public.create_finance_claim(uuid, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.review_finance_claim(uuid, text, text, text)
from public, anon, authenticated;
revoke all on function public.register_finance_payment(uuid, numeric, timestamptz, uuid, text, text)
from public, anon, authenticated;

grant execute on function public.create_finance_claim(uuid, text, text, jsonb) to service_role;
grant execute on function public.review_finance_claim(uuid, text, text, text) to service_role;
grant execute on function public.register_finance_payment(uuid, numeric, timestamptz, uuid, text, text) to service_role;

commit;
