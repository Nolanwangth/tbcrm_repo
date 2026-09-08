begin;

create extension if not exists pgcrypto;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  source text not null check (source in (
    'Instagram 自然','Instagram 广告','Facebook 自然','Facebook 广告','转介绍','B2B',
    'TikTok','YouTube','邮箱','官网','公众号','其他'
  )),
  source_detail text,
  referrer_name text,
  partner_name text,
  first_inquiry_at timestamptz not null,
  nationality text,
  profile text not null default '未确定' check (profile in ('家庭','情侣','朋友','个人','未确定')),
  amount_range text check (amount_range is null or amount_range in ('1万元以下','1万至3万元','3万至5万元','5万至10万元','10万元以上')),
  expected_amount numeric(14,2) check (expected_amount is null or expected_amount >= 0),
  level text not null check (level in ('S','A','B','C')),
  system_suggested_level text not null check (system_suggested_level in ('S','A','B','C')),
  priority text not null default '中' check (priority in ('紧急','高','中','低')),
  communication_status text not null default '待首次跟进' check (communication_status in (
    '待首次跟进','客户已回复，待我方处理','我方已回复，等待客户','客户未读','客户已读未回','客户暂缓决定'
  )),
  status text not null default '跟进中' check (status in ('跟进中','已成交','已关闭')),
  latest_follow_up_at timestamptz,
  won_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source <> '其他') or (source_detail is not null and char_length(btrim(source_detail)) > 0)
  ),
  check (
    (status <> '已关闭') or (closed_at is not null and close_reason is not null)
  ),
  check (
    (status <> '已成交') or won_at is not null
  )
);

create table public.travel_needs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  expected_start_date date,
  expected_end_date date,
  fuzzy_travel_time text,
  traveler_count text,
  travel_days text,
  destinations text,
  flight_status text check (flight_status is null or flight_status in ('已购买','日期已定，但暂未购买','日期尚未确定','未知')),
  hotel_status text check (hotel_status is null or hotel_status in ('已自行安排','需要我们安排酒店','已基本选定，暂未预订','尚未确定','未知')),
  service_type text check (service_type is null or service_type in ('全托管','拼接','单项')),
  special_requirements text,
  time_clarity text check (time_clarity is null or time_clarity in ('明确','大致明确','未确定')),
  people_clarity text check (people_clarity is null or people_clarity in ('明确','大致明确','未确定')),
  destination_clarity text check (destination_clarity is null or destination_clarity in ('明确','大致明确','未确定')),
  days_clarity text check (days_clarity is null or days_clarity in ('明确','大致明确','未确定')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_end_date is null or expected_start_date is null or expected_end_date >= expected_start_date)
);

create table public.initial_scores (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  total_score integer not null check (total_score between 0 and 100),
  suggested_level text not null check (suggested_level in ('S','A','B','C')),
  confirmed_level text not null check (confirmed_level in ('S','A','B','C')),
  filled_item_count integer not null check (filled_item_count >= 0),
  total_item_count integer not null default 9 check (total_item_count > 0),
  calculable_ratio integer not null check (calculable_ratio between 0 and 100),
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  summary text not null check (char_length(btrim(summary)) > 0),
  communication_status text not null check (communication_status in (
    '待首次跟进','客户已回复，待我方处理','我方已回复，等待客户','客户未读','客户已读未回','客户暂缓决定'
  )),
  previous_interval interval,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follow_up_versions (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.follow_ups(id) on delete cascade,
  summary text not null,
  communication_status text not null,
  archived_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create table public.level_changes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  from_level text check (from_level is null or from_level in ('S','A','B','C')),
  to_level text not null check (to_level in ('S','A','B','C')),
  changed_at timestamptz not null default now()
);

create table public.close_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  reason text not null check (reason in (
    '连续两次已读未回','客户明确表示不购买','客户已选择其他公司','客户取消出行计划',
    '联系方式无效','重复客户','无效或虚假询单','其他'
  )),
  closed_at timestamptz not null default now()
);

create table public.restore_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  restored_level text not null check (restored_level in ('S','A','B','C')),
  priority text not null check (priority in ('紧急','高','中','低')),
  communication_status text not null check (communication_status in (
    '待首次跟进','客户已回复，待我方处理','我方已回复，等待客户','客户未读','客户已读未回','客户暂缓决定'
  )),
  restored_at timestamptz not null default now()
);

create table public.customer_folders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  parent_id uuid references public.customer_folders(id) on delete restrict,
  name text not null check (char_length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (customer_id, parent_id, name),
  check (id <> parent_id)
);

create table public.customer_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  folder_id uuid references public.customer_folders(id) on delete restrict,
  name text not null check (char_length(btrim(name)) > 0),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes >= 0),
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_updated_at_idx on public.customers (updated_at desc);
create index customers_pool_idx on public.customers (status, level, priority, latest_follow_up_at desc);
create index customers_first_inquiry_idx on public.customers (first_inquiry_at desc);
create index customers_source_idx on public.customers (source);
create index customers_profile_idx on public.customers (profile);
create index customers_amount_range_idx on public.customers (amount_range);
create index follow_ups_customer_updated_idx on public.follow_ups (customer_id, updated_at desc);
create index follow_up_versions_follow_up_idx on public.follow_up_versions (follow_up_id, archived_at desc);
create index audit_logs_customer_changed_idx on public.audit_logs (customer_id, changed_at desc);
create index level_changes_customer_changed_idx on public.level_changes (customer_id, changed_at desc);
create index close_records_customer_idx on public.close_records (customer_id, closed_at desc);
create index restore_records_customer_idx on public.restore_records (customer_id, restored_at desc);
create index customer_folders_parent_idx on public.customer_folders (customer_id, parent_id);
create index customer_files_folder_idx on public.customer_files (customer_id, folder_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger travel_needs_set_updated_at before update on public.travel_needs
for each row execute function public.set_updated_at();
create trigger follow_ups_set_updated_at before update on public.follow_ups
for each row execute function public.set_updated_at();
create trigger customer_folders_set_updated_at before update on public.customer_folders
for each row execute function public.set_updated_at();
create trigger customer_files_set_updated_at before update on public.customer_files
for each row execute function public.set_updated_at();

create or replace function public.sync_follow_up_to_customer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.customers
  set latest_follow_up_at = new.updated_at,
      communication_status = new.communication_status,
      updated_at = new.updated_at
  where id = new.customer_id;
  return new;
end;
$$;

create trigger follow_ups_sync_customer
after insert or update on public.follow_ups
for each row execute function public.sync_follow_up_to_customer();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers','travel_needs','initial_scores','follow_ups','follow_up_versions',
    'audit_logs','level_changes','close_records','restore_records','customer_folders','customer_files'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.sync_follow_up_to_customer() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.sync_follow_up_to_customer() to service_role;

commit;
