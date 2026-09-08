import { Suspense } from "react";
import { CustomerTable } from "@/components/customer-table";
import { PageHeading } from "@/components/page-heading";
import { getCustomers } from "@/lib/repositories/customers";
export default async function CustomersPage() {
    const { customers } = await getCustomers({ summary: true, status: "跟进中" });
    return (<>
      <PageHeading title="客户总池" description="查看当前跟进中的客户，按最近更新时间跟踪业务变化。"/>
      <Suspense>
        <CustomerTable initialCustomers={customers} scope="all"/>
      </Suspense>
    </>);
}
