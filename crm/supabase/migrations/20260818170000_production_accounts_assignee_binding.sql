begin;

alter table public.crm_users
  add column if not exists role text not null default 'service';

alter table public.crm_users
  drop constraint if exists crm_users_role_check,
  add constraint crm_users_role_check check (role in ('planner', 'service', 'admin'));

create index if not exists crm_auth_sessions_user_idx
  on public.crm_auth_sessions(user_id);

alter table public.customers
  add column if not exists assignee_user_id uuid
    references public.crm_users(id) on delete set null;

create index if not exists customers_assignee_user_idx
  on public.customers(assignee_user_id)
  where assignee_user_id is not null;






create or replace function public.sync_customer_assignee_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  matched_user public.crm_users%rowtype;
begin
  if new.assignee_user_id is not null
     and (tg_op = 'INSERT' or new.assignee_user_id is distinct from old.assignee_user_id) then
    select * into matched_user
    from public.crm_users
    where id = new.assignee_user_id
      and active = true
      and role in ('planner', 'service');

    if not found then
      raise exception '负责人账号不存在、已停用或不可被分配';
    end if;

    new.assignee := matched_user.display_name;
    return new;
  end if;

  if tg_op = 'INSERT' or new.assignee is distinct from old.assignee then
    if nullif(btrim(new.assignee), '') is null then
      new.assignee := null;
      new.assignee_user_id := null;
      return new;
    end if;

    select * into matched_user
    from public.crm_users
    where display_name = btrim(new.assignee)
      and active = true
      and role in ('planner', 'service')
    order by id
    limit 1;

    if found then
      new.assignee := matched_user.display_name;
      new.assignee_user_id := matched_user.id;
    else
      new.assignee := btrim(new.assignee);
      new.assignee_user_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_sync_assignee_identity on public.customers;
create trigger customers_sync_assignee_identity
before insert or update of assignee, assignee_user_id on public.customers
for each row execute function public.sync_customer_assignee_identity();

commit;
