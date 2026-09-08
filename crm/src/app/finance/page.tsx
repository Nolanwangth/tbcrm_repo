import { FinanceWorkbench } from "@/components/finance-workbench";
import { getFinanceClaims } from "@/lib/repositories/finance";
import { getOperations } from "@/lib/repositories/operations";
import { getOperationRevenueItems } from "@/lib/repositories/operation-revenue";
import { getServiceFinanceControls } from "@/lib/repositories/operation-service-finance";
import { getCurrentUser } from "@/lib/auth";
export default async function FinancePage() {
    const user = await getCurrentUser();
    const [claims, operations, revenueItems, serviceFinanceControls] = await Promise.all([
        getFinanceClaims(),
        getOperations(true),
        getOperationRevenueItems(),
        getServiceFinanceControls(),
    ]);
    const financeOperations = operations.map((operation) => ({
        id: operation.id,
        customerName: operation.customerName,
        tourCode: operation.tourCode,
        tourName: operation.tourName,
        ownerName: operation.ownerName,
        items: operation.items.map((item) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            supplierName: item.supplierName,
            serviceDate: item.serviceDate,
            bookingStatus: item.bookingStatus,
            finalSupplierSettlement: item.finalSupplierSettlement,
            invoiceUnitCost: item.invoiceUnitCost,
            quantity: item.quantity,
        })),
    }));
    return <FinanceWorkbench canManageFinance={user?.role === "admin"} claims={claims} operations={financeOperations} revenueItems={revenueItems} serviceFinanceControls={serviceFinanceControls}/>;
}
