alter table public.customer_folders
add column if not exists review_status text not null default '待审核';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_folders_review_status_check'
      and conrelid = 'public.customer_folders'::regclass
  ) then
    alter table public.customer_folders
    add constraint customer_folders_review_status_check
    check (review_status in ('待审核', '已审核'));
  end if;
end;
$$;

drop function if exists public.update_customer_folder_status(uuid, uuid, text);

create function public.update_customer_folder_status(
  p_customer_id uuid,
  p_folder_id uuid,
  p_new_status text,
  p_confirm_pending_review boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_status text;
  v_review_status text;
  v_changed_at timestamptz := clock_timestamp();
begin
  if p_new_status not in ('待发送', '已发送', '需修改', '最终版') then
    raise exception '不支持的文件夹状态';
  end if;

  select status, review_status
  into v_old_status, v_review_status
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

  if p_new_status = '已发送'
    and v_review_status = '待审核'
    and not p_confirm_pending_review then
    raise exception '该文件夹尚未审核，请二次确认后再标记为已发送';
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

revoke all on function public.update_customer_folder_status(uuid, uuid, text, boolean)
from public, anon, authenticated;
grant execute on function public.update_customer_folder_status(uuid, uuid, text, boolean)
to service_role;

create or replace function public.update_customer_folder_review_status(
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
  v_changed_at timestamptz := clock_timestamp();
begin
  if p_new_status not in ('待审核', '已审核') then
    raise exception '不支持的文件夹审核状态';
  end if;

  update public.customer_folders
  set review_status = p_new_status
  where id = p_folder_id
    and customer_id = p_customer_id
    and review_status is distinct from p_new_status;

  if not found then
    if not exists (
      select 1
      from public.customer_folders
      where id = p_folder_id
        and customer_id = p_customer_id
    ) then
      raise exception '文件夹不存在或不属于当前客户';
    end if;
    return;
  end if;

  update public.customers
  set updated_at = v_changed_at
  where id = p_customer_id;
end;
$$;

revoke all on function public.update_customer_folder_review_status(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.update_customer_folder_review_status(uuid, uuid, text)
to service_role;
