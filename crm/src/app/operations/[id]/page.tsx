import { notFound } from "next/navigation";
import { OperationCaseDetail } from "@/components/operation-case-detail";
import { getCustomer } from "@/lib/repositories/customers";
import { getOperation } from "@/lib/repositories/operations";
import { getAssignableUsers } from "@/lib/repositories/users";
import { getFinanceClaims } from "@/lib/repositories/finance";
export default async function OperationDetailPage({ params, }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const [operation, users, claims] = await Promise.all([getOperation(id), getAssignableUsers(), getFinanceClaims(false, id)]);
    if (!operation)
        notFound();
    const { customer } = await getCustomer(operation.customerId);
    if (!customer)
        notFound();
    return <OperationCaseDetail operation={operation} customer={customer} users={users} claims={claims}/>;
}
