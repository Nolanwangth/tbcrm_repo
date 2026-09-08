begin;
select plan(1);

do $test$
declare
  v_customer_id uuid;
  v_case_id uuid;
  v_service_id uuid;
  v_other_service_id uuid;
  v_supplier_claim_id uuid;
  v_claim_id uuid;
  v_receipt_id uuid;
begin
  insert into public.customers (
    name,
    source,
    first_inquiry_at,
    level,
    system_suggested_level,
    status,
    won_at,
    won_amount
  )
  values (
    '报账流程事务测试',
    '官网',
    now(),
    'A',
    'A',
    '已成交',
    now(),
    2000
  )
  returning id into v_customer_id;

  select id into v_case_id
  from public.operation_cases
  where customer_id = v_customer_id;

  insert into public.operation_service_items (
    case_id,
    section,
    category,
    title,
    booking_status,
    supplier_name,
    quantity,
    unit,
    invoice_unit_cost
  )
  values (
    v_case_id,
    'hotel',
    'hotel',
    '测试酒店',
    'pending',
    '测试供应商',
    1,
    '间夜',
    1000
  )
  returning id into v_service_id;

  insert into public.operation_service_items (
    case_id,
    section,
    category,
    title,
    booking_status,
    supplier_name,
    quantity,
    unit,
    invoice_unit_cost
  )
  values (
    v_case_id,
    'hotel',
    'hotel',
    '另一测试酒店',
    'pending',
    '另一供应商',
    1,
    '间夜',
    500
  )
  returning id into v_other_service_id;

  begin
    perform public.create_finance_claim_v2(
      v_case_id,
      '测试计调',
      'supplier_payment',
      '错误供应商',
      '供应商付款校验',
      jsonb_build_array(jsonb_build_object('itemId', v_service_id, 'amount', 1000))
    );
    raise exception '测试失败：供应商收款方不一致时应拒绝申请';
  exception
    when others then
      if sqlerrm not like '%收款方必须与所选服务项目的供应商一致%' then
        raise;
      end if;
  end;

  begin
    perform public.create_finance_claim_v2(
      v_case_id,
      '测试计调',
      'supplier_payment',
      '测试供应商',
      '混合供应商校验',
      jsonb_build_array(
        jsonb_build_object('itemId', v_service_id, 'amount', 500),
        jsonb_build_object('itemId', v_other_service_id, 'amount', 500)
      )
    );
    raise exception '测试失败：同一申请混合不同供应商时应拒绝';
  exception
    when others then
      if sqlerrm not like '%不能混合不同供应商%' then
        raise;
      end if;
  end;

  v_supplier_claim_id := public.create_finance_claim_v2(
    v_case_id,
    '测试计调',
    'supplier_payment',
    '测试供应商',
    '酒店对公付款',
    jsonb_build_array(jsonb_build_object('itemId', v_service_id, 'amount', 1000))
  );

  if not exists (
    select 1
    from public.finance_claims
    where id = v_supplier_claim_id
      and claim_type = 'supplier_payment'
      and payee_name = '测试供应商'
  ) then
    raise exception '测试失败：供应商付款申请未正确创建';
  end if;

  begin
    perform public.create_finance_claim_v2(
      v_case_id,
      '测试计调',
      'personal_reimbursement',
      '测试计调',
      '超额校验',
      jsonb_build_array(jsonb_build_object('itemId', v_service_id, 'amount', 1))
    );
    raise exception '测试失败：已占满可申请金额时应拒绝重复申请';
  exception
    when others then
      if sqlerrm not like '%可报金额仅剩%' then
        raise;
      end if;
  end;

  perform public.review_finance_claim(v_supplier_claim_id, 'rejected', '测试财务', '退回重提');

  v_claim_id := public.create_finance_claim_v2(
    v_case_id,
    '测试计调',
    'personal_reimbursement',
    '测试计调',
    '完团报账',
    jsonb_build_array(jsonb_build_object('itemId', v_service_id, 'amount', 1000))
  );

  if not exists (
    select 1
    from public.finance_claims
    where id = v_claim_id
      and status = 'pending'
      and amount = 1000
      and claim_type = 'personal_reimbursement'
      and payee_name = '测试计调'
  ) then
    raise exception '测试失败：报账单未正确创建';
  end if;

  perform public.review_finance_claim(v_claim_id, 'approved', '测试财务', '审核通过');

  insert into public.customer_files (
    customer_id,
    name,
    storage_path,
    size_bytes,
    mime_type
  )
  values (
    v_customer_id,
    '测试付款回执.pdf',
    'tests/' || gen_random_uuid()::text || '-receipt.pdf',
    1,
    'application/pdf'
  )
  returning id into v_receipt_id;

  perform public.register_finance_payment(
    v_claim_id,
    400,
    now(),
    v_receipt_id,
    '测试财务',
    '首笔付款'
  );

  if (select status from public.finance_claims where id = v_claim_id) <> 'partially_paid' then
    raise exception '测试失败：首笔付款后未进入部分付款';
  end if;

  perform public.register_finance_payment(
    v_claim_id,
    600,
    now(),
    v_receipt_id,
    '测试财务',
    '尾款'
  );

  if (select status from public.finance_claims where id = v_claim_id) <> 'paid' then
    raise exception '测试失败：累计付清后未进入已付清';
  end if;
  if (select sum(amount) from public.finance_payments where claim_id = v_claim_id) <> 1000 then
    raise exception '测试失败：付款汇总不正确';
  end if;
  if (select count(*) from public.finance_claim_events where claim_id = v_claim_id) <> 4 then
    raise exception '测试失败：操作记录数量不正确';
  end if;
end;
$test$;
select pass('finance claim workflow');
select * from finish();

rollback;
