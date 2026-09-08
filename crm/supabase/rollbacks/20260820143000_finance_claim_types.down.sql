begin;

drop function if exists public.create_finance_claim_v2(uuid, text, text, text, text, jsonb);
drop index if exists public.finance_claims_type_status_idx;

alter table public.finance_claims
  drop constraint if exists finance_claims_payee_name_check,
  drop constraint if exists finance_claims_claim_type_check,
  drop column if exists payee_name,
  drop column if exists claim_type;

commit;
