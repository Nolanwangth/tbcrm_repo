import type { OperationCase, OperationServiceItem } from './operations';
export type ServiceSummary = Pick<OperationServiceItem, 'id' | 'title' | 'category' | 'bookingStatus' | 'quantity' | 'invoiceUnitCost' | 'customerUnitQuote' | 'finalSupplierSettlement' | 'finalCustomerSettlement'>;
export type OperationSummary = Pick<OperationCase, 'id' | 'tourCode' | 'tourName' | 'customerName' | 'priority' | 'arrivalDate' | 'departureDate' | 'ownerName' | 'serviceListStatus' | 'recordStatus' | 'updatedAt'> & {
    items: ServiceSummary[];
    reminders: Pick<OperationCase['reminders'][number], 'id' | 'serviceItemId' | 'title' | 'dueDate' | 'status' | 'assigneeName'>[];
};
export function operationSummary(o: OperationCase): OperationSummary {
    return { id: o.id, tourCode: o.tourCode, tourName: o.tourName, customerName: o.customerName, priority: o.priority, arrivalDate: o.arrivalDate, departureDate: o.departureDate, ownerName: o.ownerName, serviceListStatus: o.serviceListStatus, recordStatus: o.recordStatus, updatedAt: o.updatedAt,
        items: o.items.map(i => ({ id: i.id, title: i.title, category: i.category, bookingStatus: i.bookingStatus, quantity: i.quantity, invoiceUnitCost: i.invoiceUnitCost, customerUnitQuote: i.customerUnitQuote, finalSupplierSettlement: i.finalSupplierSettlement, finalCustomerSettlement: i.finalCustomerSettlement })),
        reminders: o.reminders.map(r => ({ id: r.id, serviceItemId: r.serviceItemId, title: r.title, dueDate: r.dueDate, status: r.status, assigneeName: r.assigneeName })) };
}
