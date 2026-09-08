import { PageHeading } from "@/components/page-heading";
import { OperationsWorkbench } from "@/components/operations-workbench";
import { getOperationSummaries } from "@/lib/repositories/operations";
import { getFinanceClaims } from "@/lib/repositories/finance";
import { getCustomers } from "@/lib/repositories/customers";
export default async function OperationsPage() {
    const [operations, claims, customerResult] = await Promise.all([getOperationSummaries(), getFinanceClaims(true), getCustomers({ summary: true, status: "已成交" })]);
    const customers = customerResult.customers.map((customer) => ({ id: customer.id, name: customer.name, wonAmount: customer.wonAmount ?? null }));
    return (<>
      <PageHeading title="计调工作台" description="成交客户自动进入；集中管理每日服务、酒店、大交通、预订确认、结算毛利和行前提醒。"/>
      <OperationsWorkbench operations={operations} claims={claims} customers={customers}/>
    </>);
}
