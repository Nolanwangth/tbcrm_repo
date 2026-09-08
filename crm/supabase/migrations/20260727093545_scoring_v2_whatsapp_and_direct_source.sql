begin;

alter table public.customers
  add column if not exists whatsapp_status text not null default '未添加',
  add column if not exists communication_effectiveness text;

alter table public.customers
  drop constraint if exists customers_whatsapp_status_check,
  add constraint customers_whatsapp_status_check
    check (whatsapp_status in ('未添加', '已添加')),
  drop constraint if exists customers_communication_effectiveness_check,
  add constraint customers_communication_effectiveness_check
    check (
      communication_effectiveness is null
      or communication_effectiveness in ('沟通积极', '沟通一般', '沟通较弱')
    ),
  drop constraint if exists customers_source_check,
  add constraint customers_source_check
    check (source in (
      'Instagram 自然','Instagram 广告','直加','Facebook 自然','Facebook 广告','转介绍','B2B',
      'TikTok','YouTube','邮箱','官网','公众号','其他'
    ));

create index if not exists customers_whatsapp_status_idx
  on public.customers (whatsapp_status);

alter table public.initial_scores
  add column if not exists scoring_version text not null default 'V1',
  add column if not exists s_eligible boolean not null default false,
  add column if not exists s_eligibility_reasons jsonb not null default '[]'::jsonb;

create table if not exists public.score_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  scoring_version text not null,
  total_score integer not null check (total_score between 0 and 100),
  suggested_level text not null check (suggested_level in ('S','A','B','C')),
  confirmed_level text not null check (confirmed_level in ('S','A','B','C')),
  filled_item_count integer not null check (filled_item_count between 0 and 9),
  total_item_count integer not null default 9 check (total_item_count = 9),
  calculable_ratio integer not null check (calculable_ratio between 0 and 100),
  breakdown jsonb not null default '{}'::jsonb,
  s_eligible boolean not null default false,
  s_eligibility_reasons jsonb not null default '[]'::jsonb,
  reason text not null,
  recorded_at timestamptz not null default now(),
  unique (customer_id, scoring_version)
);

create index if not exists score_versions_customer_recorded_idx
  on public.score_versions (customer_id, recorded_at desc);

alter table public.score_versions enable row level security;
revoke all on table public.score_versions from anon, authenticated;
grant select, insert, update, delete on table public.score_versions to service_role;

insert into public.score_versions (
  customer_id, scoring_version, total_score, suggested_level, confirmed_level,
  filled_item_count, total_item_count, calculable_ratio, breakdown,
  s_eligible, s_eligibility_reasons, reason, recorded_at
)
select
  customer_id, 'V1', total_score, suggested_level, confirmed_level,
  filled_item_count, total_item_count, calculable_ratio, breakdown,
  false, '[]'::jsonb, '评分标准升级前自动归档', created_at
from public.initial_scores
on conflict (customer_id, scoring_version) do nothing;

update public.customers c
set communication_effectiveness = case
  when (s.breakdown ->> 'communication')::numeric >= 21 then '沟通积极'
  when (s.breakdown ->> 'communication')::numeric >= 12 then '沟通一般'
  when (s.breakdown ->> 'communication')::numeric > 0 then '沟通较弱'
  else null
end
from public.initial_scores s
where s.customer_id = c.id
  and c.communication_effectiveness is null
  and jsonb_typeof(s.breakdown -> 'communication') = 'number';

create temporary table scoring_v2_results on commit drop as
with item_scores as (
  select
    c.id as customer_id,
    c.status,
    c.level as old_level,
    c.expected_amount,
    c.amount_range,
    c.communication_effectiveness,
    case t.flight_status
      when '已购买' then 12
      when '日期已定，但暂未购买' then 10
      when '日期尚未确定' then 5
      else 0
    end::numeric as flight_points,
    case t.hotel_status
      when '已自行安排' then 11
      when '需要我们安排酒店' then 18
      when '已基本选定，暂未预订' then 14
      when '尚未确定' then 6
      else 0
    end::numeric as hotel_points,
    case c.communication_effectiveness
      when '沟通积极' then 25
      when '沟通一般' then 16
      when '沟通较弱' then 8
      else 0
    end::numeric as communication_points,
    (
      case t.time_clarity when '明确' then 6.25 when '大致明确' then 4 when '未确定' then 1.5 else 0 end +
      case t.people_clarity when '明确' then 6.25 when '大致明确' then 4 when '未确定' then 1.5 else 0 end +
      case t.destination_clarity when '明确' then 6.25 when '大致明确' then 4 when '未确定' then 1.5 else 0 end +
      case t.days_clarity when '明确' then 6.25 when '大致明确' then 4 when '未确定' then 1.5 else 0 end
    )::numeric as clarity_points,
    case c.profile
      when '家庭' then 12
      when '情侣' then 10
      when '朋友' then 10
      when '个人' then 7
      when '未确定' then 3
      else 0
    end::numeric as profile_points,
    case c.amount_range
      when '1万元以下' then 2
      when '1万至3万元' then 4
      when '3万至5万元' then 5.5
      when '5万至10万元' then 7
      when '10万元以上' then 8
      else 0
    end::numeric as amount_points,
    (
      case when t.flight_status is not null and t.flight_status <> '未知' then 1 else 0 end +
      case when t.hotel_status is not null and t.hotel_status <> '未知' then 1 else 0 end +
      case when c.communication_effectiveness is not null then 1 else 0 end +
      case when t.time_clarity is not null then 1 else 0 end +
      case when t.people_clarity is not null then 1 else 0 end +
      case when t.destination_clarity is not null then 1 else 0 end +
      case when t.days_clarity is not null then 1 else 0 end +
      case when c.profile is not null then 1 else 0 end
    )::integer as non_amount_filled_count,
    (
      case when t.time_clarity in ('明确','大致明确') then 1 else 0 end +
      case when t.people_clarity in ('明确','大致明确') then 1 else 0 end +
      case when t.destination_clarity in ('明确','大致明确') then 1 else 0 end +
      case when t.days_clarity in ('明确','大致明确') then 1 else 0 end
    )::integer as strong_clarity_count,
    coalesce((
      t.flight_status in ('已购买','日期已定，但暂未购买')
      or t.hotel_status in ('已自行安排','需要我们安排酒店','已基本选定，暂未预订')
    ), false) as travel_strong
  from public.customers c
  left join public.travel_needs t on t.customer_id = c.id
),
totals as (
  select
    *,
    round(flight_points + hotel_points + communication_points + clarity_points + profile_points)::integer as non_amount_score,
    round(flight_points + hotel_points + communication_points + clarity_points + profile_points + amount_points)::integer as total_score,
    (non_amount_filled_count + case when amount_range is not null then 1 else 0 end)::integer as filled_item_count
  from item_scores
),
eligibility as (
  select
    *,
    case
      when expected_amount is not null then expected_amount >= 15000
      when amount_range in ('3万至5万元','5万至10万元','10万元以上') then true
      when amount_range = '1万元以下' then false
      else non_amount_filled_count = 8 and non_amount_score >= 80
    end as amount_eligible,
    case
      when expected_amount is not null and expected_amount < 15000 then '预计具体金额低于1.5万元'
      when expected_amount is null and amount_range = '1万元以下' then '预计金额低于1.5万元'
      when expected_amount is null
        and coalesce(amount_range not in ('3万至5万元','5万至10万元','10万元以上'), true)
        and not (non_amount_filled_count = 8 and non_amount_score >= 80)
        then '金额暂不明确，且其他8项信息或非金额得分不足'
      else null
    end as amount_reason
  from totals
),
graded as (
  select
    *,
    coalesce((
      filled_item_count >= 8
      and communication_effectiveness = '沟通积极'
      and strong_clarity_count >= 3
      and travel_strong
      and amount_eligible
    ), false) as s_eligible,
    to_jsonb(array_remove(array[
      case when filled_item_count < 8 then '有效评分信息不足8项' end,
      case when communication_effectiveness is distinct from '沟通积极' then '沟通有效性不是“沟通积极”' end,
      case when strong_clarity_count < 3 then '时间、人数、目的地和天数中少于3项达到大致明确' end,
      case when not travel_strong then '机票或酒店尚无较明确状态' end,
      amount_reason
    ], null)) as s_eligibility_reasons
  from eligibility
)
select
  customer_id,
  status,
  old_level,
  total_score,
  case
    when filled_item_count < 4 then 'C'
    when filled_item_count < 6 then case when total_score >= 45 then 'B' else 'C' end
    when filled_item_count < 8 then
      case when total_score >= 65 then 'A' when total_score >= 45 then 'B' else 'C' end
    when total_score >= 80 and s_eligible then 'S'
    when total_score >= 65 then 'A'
    when total_score >= 45 then 'B'
    else 'C'
  end as suggested_level,
  filled_item_count,
  round(filled_item_count / 9.0 * 100)::integer as calculable_ratio,
  jsonb_build_object(
    'travelReadiness', case when flight_points + hotel_points > 0 then flight_points + hotel_points else null end,
    'communication', case when communication_effectiveness is not null then communication_points else null end,
    'demandClarity', case when clarity_points > 0 then clarity_points else null end,
    'profile', profile_points,
    'amount', case when amount_range is not null then amount_points else null end
  ) as breakdown,
  s_eligible,
  s_eligibility_reasons
from graded;

insert into public.score_versions (
  customer_id, scoring_version, total_score, suggested_level, confirmed_level,
  filled_item_count, total_item_count, calculable_ratio, breakdown,
  s_eligible, s_eligibility_reasons, reason
)
select
  customer_id, 'V2', total_score, suggested_level,
  case when status = '跟进中' then suggested_level else old_level end,
  filled_item_count, 9, calculable_ratio, breakdown,
  s_eligible, s_eligibility_reasons,
  case
    when status = '跟进中' then '评分标准升级后重新计算并覆盖当前等级'
    else '仅存档 V2 结果，成交或关闭客户未覆盖当前等级'
  end
from scoring_v2_results
on conflict (customer_id, scoring_version) do update
set total_score = excluded.total_score,
    suggested_level = excluded.suggested_level,
    confirmed_level = excluded.confirmed_level,
    filled_item_count = excluded.filled_item_count,
    calculable_ratio = excluded.calculable_ratio,
    breakdown = excluded.breakdown,
    s_eligible = excluded.s_eligible,
    s_eligibility_reasons = excluded.s_eligibility_reasons,
    reason = excluded.reason,
    recorded_at = now();

insert into public.level_changes (customer_id, from_level, to_level, changed_at)
select customer_id, old_level, suggested_level, now()
from scoring_v2_results
where status = '跟进中' and old_level <> suggested_level;

insert into public.audit_logs (customer_id, field_name, old_value, new_value, changed_at)
select customer_id, '客户等级', old_level, suggested_level, now()
from scoring_v2_results
where status = '跟进中' and old_level <> suggested_level;

insert into public.audit_logs (customer_id, field_name, old_value, new_value, changed_at)
select customer_id, '评分规则', 'V1', 'V2', now()
from scoring_v2_results
where status = '跟进中';

update public.initial_scores s
set total_score = r.total_score,
    suggested_level = r.suggested_level,
    confirmed_level = r.suggested_level,
    filled_item_count = r.filled_item_count,
    total_item_count = 9,
    calculable_ratio = r.calculable_ratio,
    breakdown = r.breakdown,
    scoring_version = 'V2',
    s_eligible = r.s_eligible,
    s_eligibility_reasons = r.s_eligibility_reasons
from scoring_v2_results r
where r.customer_id = s.customer_id
  and r.status = '跟进中';

update public.customers c
set level = r.suggested_level,
    system_suggested_level = r.suggested_level,
    updated_at = now()
from scoring_v2_results r
where r.customer_id = c.id
  and r.status = '跟进中';

commit;
