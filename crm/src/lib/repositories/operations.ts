import "server-only";
import { operationSummary } from '@/lib/operation-summary';
import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingStatus, OperationCase, OperationCategory, OperationSection, ReminderStatus, OperationContactRole, ServiceListStatus, } from "@/lib/operations";
import type { CustomerFile, Priority } from "@/lib/types";
type Row = Record<string, unknown>;
const first = (value: unknown): Row => {
    if (Array.isArray(value))
        return (value[0] as Row | undefined) ?? {};
    return (value as Row | null) ?? {};
};
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value as Row[] : []);
const nullable = (value: unknown) => value == null || value === "" ? null : String(value);
const numberOrNull = (value: unknown) => value == null ? null : Number(value);
function mapFile(row: Row): CustomerFile {
    return {
        id: String(row.id),
        name: String(row.name),
        folderId: nullable(row.folder_id),
        storagePath: String(row.storage_path),
        sizeBytes: Number(row.size_bytes),
        mimeType: nullable(row.mime_type),
        createdAt: String(row.created_at),
    };
}
function mapOperation(row: Row): OperationCase {
    const customer = first(row.customers);
    return {
        id: String(row.id),
        revision: Number(row.revision ?? 0),
        tourCode: String(row.tour_code),
        tourName: String(row.tour_name),
        customerId: String(row.customer_id),
        customerName: String(customer.name),
        customerStatus: String(customer.status),
        priority: customer.priority as Priority,
        wonAmount: numberOrNull(customer.won_amount),
        wonAt: nullable(customer.won_at),
        arrivalDate: nullable(row.start_date),
        departureDate: nullable(row.end_date),
        travelerCount: nullable(row.traveler_count),
        routeInfo: nullable(row.route_info),
        orderTotal: numberOrNull(row.order_total),
        budgetCost: numberOrNull(row.budget_cost),
        specialRequirements: nullable(row.special_requirements),
        hotelInformation: nullable(row.hotel_information),
        customerNotes: nullable(row.customer_notes),
        recordStatus: row.record_status as OperationCase["recordStatus"],
        creationSource: row.creation_source as OperationCase["creationSource"],
        archivedAt: nullable(row.archived_at),
        ownerName: nullable(row.owner_name),
        serviceListStatus: row.service_list_status as ServiceListStatus,
        serviceListManual: Boolean(row.service_list_manual),
        serviceListFileId: nullable(row.service_list_file_id),
        notes: nullable(row.notes),
        days: rows(row.operation_days)
            .map((item) => ({
            id: String(item.id),
            revision: Number(item.revision ?? 0),
            dayNumber: Number(item.day_number),
            serviceDate: nullable(item.service_date),
            city: nullable(item.city),
            summary: nullable(item.summary),
            notes: nullable(item.notes),
            sortOrder: Number(item.sort_order),
        }))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.dayNumber - b.dayNumber),
        items: rows(row.operation_service_items)
            .map((item) => ({
            id: String(item.id),
            revision: Number(item.revision ?? 0),
            routeText: nullable(item.route_text),
            caseId: String(item.case_id),
            dayId: nullable(item.day_id),
            section: item.section as OperationSection,
            category: item.category as OperationCategory,
            title: String(item.title),
            details: nullable(item.details),
            city: nullable(item.city),
            serviceDate: nullable(item.service_date),
            bookingStatus: item.booking_status as BookingStatus,
            supplierName: nullable(item.supplier_name),
            quantity: Number(item.quantity),
            unit: String(item.unit),
            invoiceUnitCost: numberOrNull(item.invoice_unit_cost),
            customerUnitQuote: numberOrNull(item.customer_unit_quote),
            finalSupplierSettlement: numberOrNull(item.final_supplier_settlement),
            finalCustomerSettlement: numberOrNull(item.final_customer_settlement),
            confirmationFileId: nullable(item.confirmation_file_id),
            invoiceFileId: nullable(item.invoice_file_id),
            checkInDate: nullable(item.check_in_date),
            checkOutDate: nullable(item.check_out_date),
            roomType: nullable(item.room_type),
            roomCount: numberOrNull(item.room_count),
            nightCount: numberOrNull(item.night_count),
            transportType: nullable(item.transport_type),
            origin: nullable(item.origin),
            destination: nullable(item.destination),
            referenceNumber: nullable(item.reference_number),
            departureTime: nullable(item.departure_time),
            notes: nullable(item.notes),
            sortOrder: Number(item.sort_order),
        }))
            .sort((a, b) => (a.serviceDate ?? "").localeCompare(b.serviceDate ?? "") ||
            a.sortOrder - b.sortOrder ||
            a.title.localeCompare(b.title, "zh-CN")),
        reminders: rows(row.operation_reminders)
            .map((item) => ({
            id: String(item.id),
            caseId: String(item.case_id),
            dayId: nullable(item.day_id),
            serviceItemId: nullable(item.service_item_id),
            title: String(item.title),
            dueDate: nullable(item.due_date),
            anchorType: item.anchor_type as OperationCase["reminders"][number]["anchorType"],
            offsetDays: numberOrNull(item.offset_days),
            autoKey: nullable(item.auto_key),
            isAuto: Boolean(item.is_auto),
            status: item.status as ReminderStatus,
            completedAt: nullable(item.completed_at),
            taskKind: (item.task_kind ?? "reminder") as "reminder" | "checklist",
            templateKey: nullable(item.template_key),
            templateVersion: nullable(item.template_version),
            assigneeUserId: nullable(item.assignee_user_id),
            assigneeName: nullable(first(item.crm_users).display_name),
            isCustomized: Boolean(item.is_customized),
        }))
            .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")),
        contacts: rows(row.operation_contacts)
            .map((item) => ({
            id: String(item.id),
            revision: Number(item.revision ?? 0),
            caseId: String(item.case_id),
            serviceItemId: nullable(item.service_item_id),
            role: item.role as OperationContactRole,
            name: String(item.name),
            phone: nullable(item.phone),
            notes: nullable(item.notes),
        }))
            .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name, "zh-CN")),
        files: rows(customer.customer_files).map(mapFile),
        updatedAt: String(row.updated_at),
        createdAt: String(row.created_at),
    };
}
const operationSelect = `
  *,
  customers!inner(
    id,name,status,priority,won_amount,won_at,
    customer_files(*)
  ),
  operation_days(*),
  operation_service_items(*),
  operation_reminders(*,crm_users(display_name)),
  operation_contacts(*)
`;
export async function getOperations(financeOnly = false) {
    await connection();
    const { data, error } = await getSupabaseAdmin()
        .from("operation_cases")
        .select(financeOnly ? `id,tour_code,tour_name,owner_name,customers!inner(name,status),operation_service_items(id,title,category,supplier_name,service_date,booking_status,final_supplier_settlement,invoice_unit_cost,quantity)` : operationSelect)
        .eq("customers.status", "已成交")
        .order("updated_at", { ascending: false });
    if (error)
        throw new Error(`读取计调工作台失败：${error.message}`);
    return (data as unknown as Row[]).map(mapOperation);
}
export async function getOperationSummaries() {
    await connection();
    const { data, error } = await getSupabaseAdmin().from('operation_cases').select(`id,tour_code,tour_name,start_date,end_date,owner_name,service_list_status,record_status,updated_at,
    customers!inner(name,status,priority),
    operation_service_items(id,title,category,booking_status,quantity,invoice_unit_cost,customer_unit_quote,final_supplier_settlement,final_customer_settlement),
    operation_reminders(id,service_item_id,title,due_date,status,crm_users(display_name))`).eq('customers.status', '已成交').order('updated_at', { ascending: false });
    if (error)
        throw new Error(`读取计调列表失败：${error.message}`);
    return (data as unknown as Row[]).map(row => operationSummary(mapOperation(row)));
}
export async function getOperation(id: string) {
    await connection();
    const { data, error } = await getSupabaseAdmin()
        .from("operation_cases")
        .select(operationSelect)
        .eq("id", id)
        .maybeSingle();
    if (error)
        throw new Error(`读取计调详情失败：${error.message}`);
    return data ? mapOperation(data as unknown as Row) : null;
}
export async function getOperationByCustomerId(customerId: string) {
    await connection();
    const { data, error } = await getSupabaseAdmin()
        .from("operation_cases")
        .select(operationSelect)
        .eq("customer_id", customerId)
        .order("start_date", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error)
        throw new Error(`读取客户计调信息失败：${error.message}`);
    return data ? mapOperation(data as unknown as Row) : null;
}
