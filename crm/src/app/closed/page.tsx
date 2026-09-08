import { Suspense } from "react";
import { CustomerTable } from "@/components/customer-table";
import { PageHeading } from "@/components/page-heading";
import { getCustomers } from "@/lib/repositories/customers";
export default async function ClosedPage() {
    const { customers } = await getCustomers({ summary: true, status: "已关闭" });
    return (<>
      <PageHeading title="无效客户" description="查看关闭原因并按需恢复；历史资料与文件均保留。"/>
      <Suspense>
        <CustomerTable initialCustomers={customers} scope="closed"/>
      </Suspense>
    </>);
}
