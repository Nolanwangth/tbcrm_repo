begin;

alter table public.travel_needs
  add column if not exists domestic_transport_status text;

alter table public.travel_needs
  drop constraint if exists travel_needs_domestic_transport_status_check;

alter table public.travel_needs
  add constraint travel_needs_domestic_transport_status_check
  check (
    domestic_transport_status is null
    or domestic_transport_status in (
      '已自行安排',
      '需要我们安排',
      '部分已安排，部分需要我们安排',
      '尚未确定',
      '未知'
    )
  );

commit;
