begin;

alter table public.planning_requests
  drop constraint if exists planning_requests_status_check,
  drop constraint if exists planning_requests_check;

alter table public.planning_requests
  add constraint planning_requests_status_check
    check (
      status in (
        '暂不需要',
        '未出行程',
        '已出行程',
        '行程待修改',
        '未出报价',
        '已出报价',
        '报价待修改'
      )
    ),
  add constraint planning_requests_type_status_check
    check (
      (
        request_type = 'itinerary'
        and status in ('暂不需要', '未出行程', '已出行程', '行程待修改')
      )
      or
      (
        request_type = 'quotation'
        and status in ('暂不需要', '未出报价', '已出报价', '报价待修改')
      )
    );

commit;
