import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customer-detail";
import { getCustomer } from "@/lib/repositories/customers";
import { getOperationByCustomerId } from "@/lib/repositories/operations";
import { getCurrentUser } from "@/lib/auth";
import { CustomerArchive } from "@/components/customer-archive";
import { getCustomerArchive } from "@/lib/repositories/customer-archive";
function getCustomerReturnHref(returnTo?: string) {
    if (!returnTo || returnTo.startsWith("//"))
        return "/customers";
    const isAllowedReturnPath = returnTo === "/customers" ||
        returnTo.startsWith("/customers?") ||
        returnTo === "/won" ||
        returnTo.startsWith("/won?") ||
        returnTo === "/closed" ||
        returnTo.startsWith("/closed?") ||
        returnTo === "/dashboard" ||
        returnTo.startsWith("/dashboard?") ||
        returnTo.startsWith("/dashboard#") ||
        returnTo.startsWith("/service-workbench/") ||
        returnTo.startsWith("/planner/") ||
        returnTo.startsWith("/workbench/");
    return isAllowedReturnPath ? returnTo : "/customers";
}
export default async function CustomerDetailPage({ params, searchParams, }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        tab?: string;
        returnTo?: string;
    }>;
}) {
    const { id } = await params;
    const { tab, returnTo } = await searchParams;
    const returnHref = getCustomerReturnHref(returnTo);
    const [{ customer }, operation, user] = await Promise.all([
        getCustomer(id),
        getOperationByCustomerId(id),
        getCurrentUser(),
    ]);
    if (!customer)
        notFound();
    const archive = await getCustomerArchive(id, operation?.id);
    return (<><CustomerDetail initialCustomer={customer} initialTab={tab === "files" || tab === "archive" || tab === "workflow" ? tab : "profile"} operationId={operation?.id} returnHref={returnHref} currentUserId={user?.id ?? null} archive={<CustomerArchive customerId={id} caseId={operation?.id} {...archive}/>}/></>);
}
