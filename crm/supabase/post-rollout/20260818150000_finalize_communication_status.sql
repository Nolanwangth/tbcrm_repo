begin;




alter table public.customers
  drop constraint if exists customers_whatsapp_status_check;

update public.customers
set whatsapp_status = '已添加whatsapp'
where whatsapp_status = '已添加';

alter table public.customers
  add constraint customers_whatsapp_status_check
    check (whatsapp_status in ('未添加','已添加邮箱','已添加微信','已添加whatsapp'));

commit;
