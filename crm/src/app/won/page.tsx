import { Suspense } from "react";
import { CustomerTable } from "@/components/customer-table";
import { PageHeading } from "@/components/page-heading";
import { getCustomers } from "@/lib/repositories/customers";
export default async function WonPage() {
    const { customers } = await getCustomers({ summary: true, status: "已成交" });
    return (<>
      <PageHeading title="已成交客户" description="集中查看规划师归属、行程日期、成交金额与客户档案文件状态。"/>
      <Suspense>
        <CustomerTable initialCustomers={customers} scope="won"/>
      </Suspense>
    </>);
}
