begin;

drop function if exists public.register_finance_payment(uuid, numeric, timestamptz, uuid, text, text);
drop function if exists public.review_finance_claim(uuid, text, text, text);
drop function if exists public.create_finance_claim(uuid, text, text, jsonb);

drop table if exists public.finance_claim_events;
drop table if exists public.finance_payments;
drop table if exists public.finance_claim_items;
drop table if exists public.finance_claims;
drop sequence if exists public.finance_claim_number_seq;

commit;
