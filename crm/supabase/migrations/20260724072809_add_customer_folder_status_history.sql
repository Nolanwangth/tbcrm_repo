alter table public.customer_folders
add column if not exists status text not null default '待发送'
check (status in ('待发送', '已发送', '需修改', '最终版'));

create table if not exists public.customer_folder_status_history (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.customer_folders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  old_status text not null check (old_status in ('待发送', '已发送', '需修改', '最终版')),
  new_status text not null check (new_status in ('待发送', '已发送', '需修改', '最终版')),
  changed_at timestamptz not null default now(),
  check (old_status <> new_status)
);

create index if not exists customer_folder_status_history_folder_changed_idx
on public.customer_folder_status_history (folder_id, changed_at desc);

create index if not exists customer_folder_status_history_customer_changed_idx
on public.customer_folder_status_history (customer_id, changed_at desc);

alter table public.customer_folder_status_history enable row level security;
revoke all on table public.customer_folder_status_history from anon, authenticated;
grant select, insert, update, delete on table public.customer_folder_status_history to service_role;

create or replace function public.update_customer_folder_status(
  p_customer_id uuid,
  p_folder_id uuid,
  p_new_status text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_status text;
  v_changed_at timestamptz := clock_timestamp();
begin
  if p_new_status not in ('待发送', '已发送', '需修改', '最终版') then
    raise exception '不支持的文件夹状态';
  end if;

  select status
  into v_old_status
  from public.customer_folders
  where id = p_folder_id
    and customer_id = p_customer_id
  for update;

  if not found then
    raise exception '文件夹不存在或不属于当前客户';
  end if;

  if v_old_status = p_new_status then
    return;
  end if;

  update public.customer_folders
  set status = p_new_status
  where id = p_folder_id
    and customer_id = p_customer_id;

  insert into public.customer_folder_status_history (
    folder_id,
    customer_id,
    old_status,
    new_status,
    changed_at
  )
  values (
    p_folder_id,
    p_customer_id,
    v_old_status,
    p_new_status,
    v_changed_at
  );

  update public.customers
  set updated_at = v_changed_at
  where id = p_customer_id;
end;
$$;

revoke all on function public.update_customer_folder_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_customer_folder_status(uuid, uuid, text) to service_role;
