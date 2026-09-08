begin;

drop function if exists public.fill_customer_expected_amount(uuid, numeric);

create or replace function public.fill_customer_expected_amount(
  p_customer_id uuid,
  p_expected_amount numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_customer public.customers%rowtype;
  current_score public.initial_scores%rowtype;
  next_range text;
  next_amount_points numeric;
  next_total_score integer;
  next_filled_item_count integer;
  next_calculable_ratio integer;
  next_breakdown jsonb;
  next_s_eligibility_reasons jsonb;
  next_s_eligible boolean;
  next_suggested_level text;
begin
  if p_expected_amount is null
    or p_expected_amount <= 0
    or p_expected_amount > 999999999999
    or p_expected_amount <> trunc(p_expected_amount)
  then
    raise exception '预计金额必须是大于0的整数人民币元，且不超过999999999999';
  end if;

  select *
  into current_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception '找不到客户';
  end if;
  if current_customer.status <> '跟进中' then
    raise exception '只能为当前跟进客户补充预计金额';
  end if;
  if coalesce(current_customer.expected_amount, 0) > 0 then
    raise exception '该客户已经填写预计金额，请刷新页面';
  end if;

  next_range := case
    when p_expected_amount < 10000 then '1万元以下'
    when p_expected_amount < 30000 then '1万至3万元'
    when p_expected_amount < 50000 then '3万至5万元'
    when p_expected_amount < 100000 then '5万至10万元'
    else '10万元以上'
  end;

  update public.customers
  set expected_amount = p_expected_amount,
      amount_range = next_range,
      updated_at = now()
  where id = p_customer_id;

  insert into public.audit_logs (customer_id, field_name, old_value, new_value)
  values (p_customer_id, '预计具体金额', current_customer.expected_amount::text, p_expected_amount::text);

  if current_customer.amount_range is distinct from next_range then
    insert into public.audit_logs (customer_id, field_name, old_value, new_value)
    values (p_customer_id, '预计金额区间', current_customer.amount_range, next_range);
  end if;

  select * into current_score
  from public.initial_scores
  where customer_id = p_customer_id
  for update;

  if found then
    next_amount_points := case next_range
      when '1万元以下' then 2
      when '1万至3万元' then 4
      when '3万至5万元' then 5.5
      when '5万至10万元' then 7
      when '10万元以上' then 8
      else 0
    end;
    next_total_score := round(
      current_score.total_score
      - coalesce((current_score.breakdown ->> 'amount')::numeric, 0)
      + next_amount_points
    );
    next_filled_item_count := least(
      current_score.total_item_count,
      current_score.filled_item_count + case when current_customer.amount_range is null then 1 else 0 end
    );
    next_calculable_ratio := round(next_filled_item_count / current_score.total_item_count::numeric * 100);
    next_breakdown := jsonb_set(current_score.breakdown, '{amount}', to_jsonb(next_amount_points), true);
    next_s_eligibility_reasons := coalesce(current_score.s_eligibility_reasons, '[]'::jsonb)
      - '有效评分信息不足8项'
      - '预计具体金额低于1.5万元'
      - '预计金额低于1.5万元'
      - '金额暂不明确，且其他8项信息或非金额得分不足';
    if next_filled_item_count < 8 then
      next_s_eligibility_reasons := next_s_eligibility_reasons || jsonb_build_array('有效评分信息不足8项');
    end if;
    if p_expected_amount < 15000 then
      next_s_eligibility_reasons := next_s_eligibility_reasons || jsonb_build_array('预计具体金额低于1.5万元');
    end if;
    next_s_eligible := jsonb_array_length(next_s_eligibility_reasons) = 0;
    next_suggested_level := case
      when next_filled_item_count < 4 then 'C'
      when next_filled_item_count < 6 then case when next_total_score >= 45 then 'B' else 'C' end
      when next_filled_item_count < 8 then
        case when next_total_score >= 65 then 'A' when next_total_score >= 45 then 'B' else 'C' end
      when next_total_score >= 80 and next_s_eligible then 'S'
      when next_total_score >= 65 then 'A'
      when next_total_score >= 45 then 'B'
      else 'C'
    end;

    update public.initial_scores
    set total_score = next_total_score,
        suggested_level = next_suggested_level,
        filled_item_count = next_filled_item_count,
        calculable_ratio = next_calculable_ratio,
        breakdown = next_breakdown,
        scoring_version = 'V2',
        s_eligible = next_s_eligible,
        s_eligibility_reasons = next_s_eligibility_reasons
    where customer_id = p_customer_id;

    update public.customers
    set system_suggested_level = next_suggested_level
    where id = p_customer_id;

    insert into public.score_versions (
      customer_id, scoring_version, total_score, suggested_level, confirmed_level,
      filled_item_count, total_item_count, calculable_ratio, breakdown,
      s_eligible, s_eligibility_reasons, reason
    ) values (
      p_customer_id, 'V2', next_total_score, next_suggested_level, current_customer.level,
      next_filled_item_count, current_score.total_item_count, next_calculable_ratio, next_breakdown,
      next_s_eligible, next_s_eligibility_reasons, '补充预计金额后重新计算首次评分'
    )
    on conflict (customer_id, scoring_version) do update
    set total_score = excluded.total_score,
        suggested_level = excluded.suggested_level,
        confirmed_level = excluded.confirmed_level,
        filled_item_count = excluded.filled_item_count,
        total_item_count = excluded.total_item_count,
        calculable_ratio = excluded.calculable_ratio,
        breakdown = excluded.breakdown,
        s_eligible = excluded.s_eligible,
        s_eligibility_reasons = excluded.s_eligibility_reasons,
        reason = excluded.reason,
        recorded_at = now();

    if current_customer.system_suggested_level is distinct from next_suggested_level then
      insert into public.audit_logs (customer_id, field_name, old_value, new_value)
      values (p_customer_id, '系统建议等级', current_customer.system_suggested_level, next_suggested_level);
    end if;
  end if;

  return;
end;
$$;

revoke all on function public.fill_customer_expected_amount(uuid, numeric) from public, anon, authenticated;
grant execute on function public.fill_customer_expected_amount(uuid, numeric) to service_role;

drop function if exists public.get_expected_amount_metrics(timestamptz, timestamptz);

create or replace function public.get_expected_amount_metrics(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_amount', coalesce(sum(c.expected_amount) filter (where coalesce(c.expected_amount, 0) > 0), 0),
    'filled_customers', count(*) filter (where coalesce(c.expected_amount, 0) > 0),
    'missing_customers', count(*) filter (where coalesce(c.expected_amount, 0) <= 0)
  )
  from public.customers c
  where c.status = '跟进中'
    and c.first_inquiry_at >= p_start
    and c.first_inquiry_at <= p_end;
$$;

revoke all on function public.get_expected_amount_metrics(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_expected_amount_metrics(timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';

commit;
