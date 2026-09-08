begin;

alter table public.finance_claims
  add column claim_type text not null default 'personal_reimbursement',
  add column payee_name text;


alter table public.finance_claims disable trigger finance_claims_set_updated_at;
update public.finance_claims
set payee_name = applicant_name
where payee_name is null;
alter table public.finance_claims enable trigger finance_claims_set_updated_at;

alter table public.finance_claims
  alter column payee_name set default '未记录',
  alter column payee_name set not null,
  add constraint finance_claims_claim_type_check check (
    claim_type in ('personal_reimbursement', 'supplier_payment')
  ),
  add constraint finance_claims_payee_name_check check (
    char_length(btrim(payee_name)) > 0
  );

create index finance_claims_type_status_idx
  on public.finance_claims (claim_type, status, submitted_at desc);

create or replace function public.create_finance_claim_v2(
  p_operation_case_id uuid,
  p_applicant_name text,
  p_claim_type text,
  p_payee_name text,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim_id uuid;
  v_supplier_count integer;
  v_missing_supplier_count integer;
  v_supplier_name text;
begin
  if p_claim_type not in ('personal_reimbursement', 'supplier_payment') then
    raise exception '费用申请类型无效';
  end if;
  if p_payee_name is null or char_length(btrim(p_payee_name)) = 0 then
    raise exception '请填写收款方';
  end if;

  v_claim_id := public.create_finance_claim(
    p_operation_case_id,
    p_applicant_name,
    p_note,
    p_items
  );

  if p_claim_type = 'supplier_payment' then
    select
      count(distinct btrim(coalesce(supplier_name, ''))),
      count(*) filter (where supplier_name is null or char_length(btrim(supplier_name)) = 0),
      min(btrim(supplier_name))
    into v_supplier_count, v_missing_supplier_count, v_supplier_name
    from public.finance_claim_items
    where claim_id = v_claim_id;

    if v_missing_supplier_count > 0 then
      raise exception '供应商付款项目必须先填写供应商';
    end if;
    if v_supplier_count <> 1 then
      raise exception '一张供应商付款申请不能混合不同供应商';
    end if;
    if btrim(p_payee_name) <> v_supplier_name then
      raise exception '收款方必须与所选服务项目的供应商一致';
    end if;
  end if;

  update public.finance_claims
  set claim_type = p_claim_type,
      payee_name = btrim(p_payee_name)
  where id = v_claim_id;

  return v_claim_id;
end;
$$;

revoke all on function public.create_finance_claim_v2(uuid, text, text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.create_finance_claim_v2(uuid, text, text, text, text, jsonb)
to service_role;

commit;
