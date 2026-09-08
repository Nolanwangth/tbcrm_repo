"use server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { BOOKING_STATUSES, dateMinusDays, OPERATION_CATEGORIES, operationAttachmentFolderName, OPERATION_SECTIONS, REMINDER_STATUSES, SERVICE_LIST_STATUSES, type BookingStatus, type OperationCategory, type OperationSection, type ReminderStatus, type ServiceListStatus, } from "@/lib/operations";
import { PRIORITIES } from "@/lib/constants";
import type { ActionResult } from "@/app/actions/customer-actions";
import type { Priority } from "@/lib/types";
import { requiresUrgentConfirmation } from "@/lib/priority-confirmation";
import { getCurrentUser } from "@/lib/auth";
import { mutateOperation } from "@/lib/operation-mutations";
import { CostSheetParseError, parseOperationServiceList, type OperationCostSheetPreview, } from "@/lib/operation-cost-sheet";
const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "crm-files";
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_COST_SHEET_SIZE_BYTES = 10 * 1024 * 1024;
const OPERATIONS_FOLDER_NAME = "计调资料";
const CONFIRMATION_FOLDER_NAME = "确认附件";
const INVOICE_FOLDER_NAME = "发票附件";
type CaseIdentity = {
    id: string;
    customer_id: string;
    revision: number;
};
async function unavailable(): Promise<{
    ok: false;
    error: string;
} | null> {
    if (!await getCurrentUser())
        return { ok: false, error: "登录状态已失效" };
    return isSupabaseConfigured()
        ? null
        : { ok: false, error: "Supabase 尚未配置，无法保存计调数据。" };
}
function blankToNull(value: unknown) {
    const text = String(value ?? "").trim();
    return text ? text : null;
}
function numberToNull(value: unknown) {
    if (value == null || value === "")
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function isDate(value: string | null) {
    if (!value)
        return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00+08:00`).getTime());
}
async function getCaseIdentity(caseId: string): Promise<CaseIdentity | null> {
    const { data, error } = await getSupabaseAdmin()
        .from("operation_cases")
        .select("id,customer_id,revision")
        .eq("id", caseId)
        .maybeSingle();
    if (error || !data)
        return null;
    return { id: String(data.id), customer_id: String(data.customer_id), revision: Number(data.revision) };
}
async function fileBelongsToCustomer(customerId: string, fileId: string | null) {
    if (!fileId)
        return true;
    const { data, error } = await getSupabaseAdmin()
        .from("customer_files")
        .select("id")
        .eq("id", fileId)
        .eq("customer_id", customerId)
        .maybeSingle();
    return !error && Boolean(data);
}
function refresh(caseId?: string, customerId?: string) {
    revalidatePath("/operations");
    if (caseId)
        revalidatePath(`/operations/${caseId}`);
    if (customerId)
        revalidatePath(`/customers/${customerId}`);
}
export async function updateOperationCaseAction(input: {
    caseId: string;
    revision?: number;
    tourName?: string | null;
    ownerName?: string | null;
    arrivalDate?: string | null;
    departureDate?: string | null;
    priority: Priority;
    confirmUrgent?: boolean;
    notes?: string | null;
    travelerCount?: string | null;
    routeInfo?: string | null;
    orderTotal?: number | null;
    budgetCost?: number | null;
    specialRequirements?: string | null;
    hotelInformation?: string | null;
    customerNotes?: string | null;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const arrivalDate = blankToNull(input.arrivalDate);
    const departureDate = blankToNull(input.departureDate);
    if (!isDate(arrivalDate) || !isDate(departureDate))
        return { ok: false, error: "请输入有效日期" };
    if (arrivalDate && departureDate && departureDate < arrivalDate) {
        return { ok: false, error: "离开中国日期不能早于抵达日期" };
    }
    if (!PRIORITIES.includes(input.priority))
        return { ok: false, error: "优先级无效" };
    const supabase = getSupabaseAdmin();
    const [{ data: currentCustomer, error: customerReadError }] = await Promise.all([
        supabase.from("customers").select("priority").eq("id", identity.customer_id).maybeSingle(),
        supabase.from("operation_cases").select("tour_name,owner_name,notes,start_date,end_date,traveler_count,route_info,order_total,budget_cost,special_requirements,hotel_information,customer_notes").eq("id", input.caseId).maybeSingle(),
    ]);
    if (customerReadError || !currentCustomer)
        return { ok: false, error: "找不到客户资料" };
    if (requiresUrgentConfirmation(currentCustomer.priority as Priority, input.priority) && !input.confirmUrgent) {
        return { ok: false, error: "将客户优先级改为“紧急”前必须二次确认" };
    }
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录状态已失效" };
    const { data, error } = await supabase.rpc("crm_update_operation_case", {
        p_actor: actor.id, p_case: input.caseId, p_revision: input.revision ?? null, p_priority: input.priority,
        p_values: {
            tour_name: input.tourName == null ? undefined : blankToNull(input.tourName),
            owner_name: blankToNull(input.ownerName), notes: blankToNull(input.notes),
            start_date: arrivalDate, end_date: departureDate,
            traveler_count: input.travelerCount == null ? undefined : blankToNull(input.travelerCount),
            route_info: input.routeInfo == null ? undefined : blankToNull(input.routeInfo),
            order_total: input.orderTotal == null ? undefined : numberToNull(input.orderTotal),
            budget_cost: input.budgetCost == null ? undefined : numberToNull(input.budgetCost),
            special_requirements: input.specialRequirements == null ? undefined : blankToNull(input.specialRequirements),
            hotel_information: input.hotelInformation == null ? undefined : blankToNull(input.hotelInformation),
            customer_notes: input.customerNotes == null ? undefined : blankToNull(input.customerNotes),
        },
    });
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true, revision: Number(data.revision) };
}
export async function createOperationTourAction(input: {
    customerId: string;
    tourName?: string;
    ownerName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    travelerCount?: string | null;
    routeInfo?: string | null;
    orderTotal?: number | null;
    budgetCost?: number | null;
    specialRequirements?: string | null;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    if (!input.customerId)
        return { ok: false, error: "请选择客户" };
    const startDate = blankToNull(input.startDate);
    const endDate = blankToNull(input.endDate);
    if (!isDate(startDate) || !isDate(endDate) || (startDate && endDate && endDate < startDate))
        return { ok: false, error: "团组日期无效" };
    const supabase = getSupabaseAdmin();
    const { data: customer, error: customerError } = await supabase.from("customers").select("id,status,name,nationality").eq("id", input.customerId).maybeSingle();
    if (customerError || !customer)
        return { ok: false, error: customerError?.message ?? "客户不存在" };
    if (customer.status !== "已成交")
        return { ok: false, error: "请先确认客户成交后再建团" };
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已失效" };
    const { data, error } = await supabase.rpc("crm_create_operation_case", { p_actor: actor.id, p_customer: input.customerId, p_values: {
            owner_name: blankToNull(input.ownerName), start_date: startDate, end_date: endDate,
            traveler_count: blankToNull(input.travelerCount), route_info: blankToNull(input.routeInfo),
            order_total: numberToNull(input.orderTotal), budget_cost: numberToNull(input.budgetCost),
            special_requirements: blankToNull(input.specialRequirements),
        } });
    if (error || !data)
        return { ok: false, error: error?.message ?? "创建团组失败" };
    refresh(String(data.id), input.customerId);
    return { ok: true, id: String(data.id) };
}
export async function setOperationTourStatusAction(input: {
    caseId: string;
    revision?: number;
    status: "draft" | "active" | "cancelled" | "archived";
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "团组不存在" };
    const { error } = await mutateOperation("operation_cases", input.caseId, input.caseId, input.revision, { record_status: input.status, archived_at: input.status === "archived" ? new Date().toISOString() : null });
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
export async function setServiceListStatusAction(input: {
    caseId: string;
    status: ServiceListStatus;
    revision?: number;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    if (!SERVICE_LIST_STATUSES.includes(input.status))
        return { ok: false, error: "服务清单状态无效" };
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const { error } = await mutateOperation("operation_cases", input.caseId, input.caseId, input.revision, { service_list_status: input.status, service_list_manual: true });
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
export async function saveOperationDayAction(input: {
    caseId: string;
    dayId?: string | null;
    revision?: number;
    dayNumber: number;
    serviceDate?: string | null;
    city?: string | null;
    summary?: string | null;
    notes?: string | null;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    if (!Number.isInteger(input.dayNumber) || input.dayNumber < 1)
        return { ok: false, error: "Day 序号无效" };
    const serviceDate = blankToNull(input.serviceDate);
    if (!isDate(serviceDate))
        return { ok: false, error: "服务日期无效" };
    const row = {
        case_id: input.caseId,
        day_number: input.dayNumber,
        sort_order: input.dayNumber,
        service_date: serviceDate,
        city: blankToNull(input.city),
        summary: blankToNull(input.summary),
        notes: blankToNull(input.notes),
        ...(input.dayId ? { import_id: null } : {}),
    };
    const result = await mutateOperation("operation_days", input.caseId, input.dayId, input.revision, row);
    if (result.error) {
        return {
            ok: false,
            error: result.error.code === "23505" ? "该 Day 序号已经存在" : result.error.message,
        };
    }
    refresh(input.caseId, identity.customer_id);
    return { ok: true, id: String(result.data.id) };
}
export async function deleteOperationDayAction(input: {
    caseId: string;
    dayId: string;
    revision?: number;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const { error } = await mutateOperation("operation_days", input.caseId, input.dayId, input.revision, {}, true);
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
const OPERATION_CONTACT_ROLES = ["project_manager", "guide", "driver", "emergency", "other"] as const;
export async function saveOperationContactAction(input: {
    caseId: string;
    contactId?: string | null;
    revision?: number;
    serviceItemId?: string | null;
    role: (typeof OPERATION_CONTACT_ROLES)[number];
    name: string;
    phone?: string | null;
    notes?: string | null;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "团组不存在" };
    if (!OPERATION_CONTACT_ROLES.includes(input.role))
        return { ok: false, error: "联系人角色无效" };
    const name = blankToNull(input.name);
    if (!name)
        return { ok: false, error: "请填写联系人姓名" };
    const serviceItemId = blankToNull(input.serviceItemId);
    if (serviceItemId) {
        const { data } = await getSupabaseAdmin()
            .from("operation_service_items")
            .select("id")
            .eq("id", serviceItemId)
            .eq("case_id", input.caseId)
            .maybeSingle();
        if (!data)
            return { ok: false, error: "关联服务不属于当前团组" };
    }
    const row = {
        case_id: input.caseId,
        service_item_id: serviceItemId,
        role: input.role,
        name,
        phone: blankToNull(input.phone),
        notes: blankToNull(input.notes),
    };
    const contactId = blankToNull(input.contactId);
    const result = await mutateOperation("operation_contacts", input.caseId, contactId, input.revision, row);
    if (result.error)
        return { ok: false, error: result.error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true, id: String(result.data.id) };
}
export async function deleteOperationContactAction(input: {
    caseId: string;
    contactId: string;
    revision?: number;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "团组不存在" };
    const { error } = await mutateOperation("operation_contacts", input.caseId, input.contactId, input.revision, {}, true);
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
export type OperationItemInput = {
    caseId: string;
    itemId?: string | null;
    dayId?: string | null;
    revision?: number;
    section: OperationSection;
    category: OperationCategory;
    title: string;
    details?: string | null;
    city?: string | null;
    serviceDate?: string | null;
    bookingStatus: BookingStatus;
    supplierName?: string | null;
    quantity: number;
    unit: string;
    invoiceUnitCost?: number | null;
    customerUnitQuote?: number | null;
    finalSupplierSettlement?: number | null;
    finalCustomerSettlement?: number | null;
    confirmationFileId?: string | null;
    invoiceFileId?: string | null;
    checkInDate?: string | null;
    checkOutDate?: string | null;
    roomType?: string | null;
    roomCount?: number | null;
    nightCount?: number | null;
    transportType?: string | null;
    origin?: string | null;
    destination?: string | null;
    referenceNumber?: string | null;
    departureTime?: string | null;
    notes?: string | null;
};
export async function saveOperationItemAction(input: OperationItemInput): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    if (!OPERATION_SECTIONS.includes(input.section) || !OPERATION_CATEGORIES.includes(input.category)) {
        return { ok: false, error: "服务类型无效" };
    }
    if (!BOOKING_STATUSES.includes(input.bookingStatus))
        return { ok: false, error: "预订状态无效" };
    if (!input.title.trim())
        return { ok: false, error: "请输入服务名称" };
    if (!Number.isFinite(input.quantity) || input.quantity <= 0)
        return { ok: false, error: "数量必须大于 0" };
    if (input.section === "daily" && !input.dayId)
        return { ok: false, error: "每日服务必须选择 Day" };
    if (input.section === "daily") {
        const { data: operationDay, error: dayError } = await getSupabaseAdmin()
            .from("operation_days")
            .select("id")
            .eq("id", input.dayId!)
            .eq("case_id", input.caseId)
            .maybeSingle();
        if (dayError || !operationDay)
            return { ok: false, error: dayError?.message ?? "所属 Day 不存在" };
    }
    const serviceDate = blankToNull(input.serviceDate);
    const checkInDate = blankToNull(input.checkInDate);
    const checkOutDate = blankToNull(input.checkOutDate);
    if (![serviceDate, checkInDate, checkOutDate].every(isDate))
        return { ok: false, error: "日期格式无效" };
    if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
        return { ok: false, error: "酒店离店日期不能早于入住日期" };
    }
    const confirmationFileId = blankToNull(input.confirmationFileId);
    const invoiceFileId = blankToNull(input.invoiceFileId);
    if (!(await fileBelongsToCustomer(identity.customer_id, confirmationFileId)) ||
        !(await fileBelongsToCustomer(identity.customer_id, invoiceFileId))) {
        return { ok: false, error: "附件不存在或不属于当前客户" };
    }
    const row = {
        case_id: input.caseId,
        day_id: input.section === "daily" ? input.dayId : null,
        section: input.section,
        category: input.category,
        title: input.title.trim(),
        details: blankToNull(input.details),
        city: blankToNull(input.city),
        service_date: serviceDate,
        booking_status: input.bookingStatus,
        supplier_name: blankToNull(input.supplierName),
        quantity: input.quantity,
        unit: input.unit.trim() || "项",
        invoice_unit_cost: numberToNull(input.invoiceUnitCost),
        customer_unit_quote: numberToNull(input.customerUnitQuote),
        final_supplier_settlement: numberToNull(input.finalSupplierSettlement),
        final_customer_settlement: numberToNull(input.finalCustomerSettlement),
        confirmation_file_id: confirmationFileId,
        invoice_file_id: invoiceFileId,
        check_in_date: input.section === "hotel" ? checkInDate : null,
        check_out_date: input.section === "hotel" ? checkOutDate : null,
        room_type: input.section === "hotel" ? blankToNull(input.roomType) : null,
        room_count: input.section === "hotel" ? numberToNull(input.roomCount) : null,
        night_count: input.section === "hotel" ? numberToNull(input.nightCount) : null,
        transport_type: input.section === "transport" ? blankToNull(input.transportType) : null,
        origin: input.section === "transport" ? blankToNull(input.origin) : null,
        destination: input.section === "transport" ? blankToNull(input.destination) : null,
        reference_number: input.section === "transport" ? blankToNull(input.referenceNumber) : null,
        departure_time: input.section === "transport" ? blankToNull(input.departureTime) : null,
        notes: blankToNull(input.notes),
        ...(input.itemId ? { import_id: null } : {}),
    };
    const result = await mutateOperation("operation_service_items", input.caseId, input.itemId, input.revision, row);
    if (result.error)
        return { ok: false, error: result.error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true, id: String(result.data.id) };
}
export async function updateOperationBookingStatusAction(input: {
    caseId: string;
    itemId: string;
    revision?: number;
    status: BookingStatus;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    if (!BOOKING_STATUSES.includes(input.status))
        return { ok: false, error: "预订状态无效" };
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const supabase = getSupabaseAdmin();
    const { data, error: readError } = await supabase
        .from("operation_service_items")
        .select("id")
        .eq("id", input.itemId)
        .eq("case_id", input.caseId)
        .maybeSingle();
    if (readError || !data)
        return { ok: false, error: readError?.message ?? "服务项目不存在" };
    const { error } = await mutateOperation("operation_service_items", input.caseId, input.itemId, input.revision, { booking_status: input.status });
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
export async function deleteOperationItemAction(input: {
    caseId: string;
    itemId: string;
    revision?: number;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const { error } = await mutateOperation("operation_service_items", input.caseId, input.itemId, input.revision, {}, true);
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
async function ensureCustomerFolder(customerId: string, name: string, parentId: string | null) {
    const supabase = getSupabaseAdmin();
    let existingQuery = supabase
        .from("customer_folders")
        .select("id")
        .eq("customer_id", customerId)
        .eq("name", name);
    existingQuery = parentId
        ? existingQuery.eq("parent_id", parentId)
        : existingQuery.is("parent_id", null);
    const { data: existing, error } = await existingQuery.maybeSingle();
    if (error)
        throw new Error(error.message);
    if (existing)
        return String(existing.id);
    const { data, error: insertError } = await supabase
        .from("customer_folders")
        .insert({
        customer_id: customerId,
        name,
        parent_id: parentId,
        workflow_status_enabled: false,
    })
        .select("id")
        .single();
    if (insertError) {
        if (insertError.code === "23505") {
            let concurrentQuery = supabase
                .from("customer_folders")
                .select("id")
                .eq("customer_id", customerId)
                .eq("name", name);
            concurrentQuery = parentId
                ? concurrentQuery.eq("parent_id", parentId)
                : concurrentQuery.is("parent_id", null);
            const { data: concurrent, error: concurrentError } = await concurrentQuery.maybeSingle();
            if (!concurrentError && concurrent)
                return String(concurrent.id);
        }
        throw new Error(insertError.message);
    }
    return String(data.id);
}
async function ensureOperationsFolder(customerId: string) {
    return ensureCustomerFolder(customerId, OPERATIONS_FOLDER_NAME, null);
}
async function ensureOperationAttachmentFolder(customerId: string, serviceDate: unknown, title: unknown, role: "confirmation" | "invoice") {
    const operationsFolderId = await ensureOperationsFolder(customerId);
    const serviceFolderId = await ensureCustomerFolder(customerId, operationAttachmentFolderName(serviceDate, title), operationsFolderId);
    return ensureCustomerFolder(customerId, role === "confirmation" ? CONFIRMATION_FOLDER_NAME : INVOICE_FOLDER_NAME, serviceFolderId);
}
async function storeOperationFile(customerId: string, file: File, targetFolderId?: string) {
    const supabase = getSupabaseAdmin();
    let folderId: string;
    try {
        folderId = targetFolderId ?? await ensureOperationsFolder(customerId);
    }
    catch (error) {
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "无法创建计调资料文件夹",
        };
    }
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const storagePath = `${customerId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(bucket()).upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
    });
    if (uploadError)
        return { ok: false as const, error: uploadError.message };
    const { data: storedFile, error: fileError } = await supabase
        .from("customer_files")
        .insert({
        customer_id: customerId,
        folder_id: folderId,
        name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type || null,
    })
        .select("id")
        .single();
    if (fileError || !storedFile) {
        await supabase.storage.from(bucket()).remove([storagePath]);
        return { ok: false as const, error: fileError?.message ?? "保存附件记录失败" };
    }
    return {
        ok: true as const,
        fileId: String(storedFile.id),
        storagePath,
    };
}
export async function uploadOperationFileAction(formData: FormData): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const caseId = String(formData.get("caseId") ?? "");
    const itemId = blankToNull(formData.get("itemId"));
    const role = String(formData.get("role") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || !caseId)
        return { ok: false, error: "请选择文件" };
    if (!["service_list", "confirmation", "invoice"].includes(role)) {
        return { ok: false, error: "附件类型无效" };
    }
    if (role !== "service_list" && !itemId)
        return { ok: false, error: "缺少服务项目" };
    if (file.size > MAX_FILE_SIZE_BYTES)
        return { ok: false, error: "单个文件不能超过 100 MB" };
    const identity = await getCaseIdentity(caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const supabase = getSupabaseAdmin();
    let serviceItem: {
        id: unknown;
        title: unknown;
        service_date: unknown;
        revision: number;
    } | null = null;
    if (itemId) {
        const { data, error } = await supabase
            .from("operation_service_items")
            .select("id,title,service_date,revision")
            .eq("id", itemId)
            .eq("case_id", caseId)
            .maybeSingle();
        if (error || !data)
            return { ok: false, error: error?.message ?? "服务项目不存在" };
        serviceItem = data;
    }
    let targetFolderId: string | undefined;
    if (role === "confirmation" || role === "invoice") {
        try {
            targetFolderId = await ensureOperationAttachmentFolder(identity.customer_id, serviceItem?.service_date, serviceItem?.title, role);
        }
        catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : "无法创建附件归档文件夹",
            };
        }
    }
    const stored = await storeOperationFile(identity.customer_id, file, targetFolderId);
    if (!stored.ok)
        return stored;
    const { fileId, storagePath } = stored;
    const linkResult = role === "service_list"
        ? await mutateOperation("operation_cases", caseId, caseId, identity.revision, { service_list_file_id: fileId, service_list_status: "uploaded", service_list_manual: false })
        : await mutateOperation("operation_service_items", caseId, itemId, serviceItem?.revision, role === "confirmation" ? { confirmation_file_id: fileId, booking_status: "confirmed" } : { invoice_file_id: fileId });
    if (linkResult.error) {
        await supabase.from("customer_files").delete().eq("id", fileId);
        await supabase.storage.from(bucket()).remove([storagePath]);
        return { ok: false, error: linkResult.error.message };
    }
    await supabase.from("customers").update({ updated_at: new Date().toISOString() }).eq("id", identity.customer_id);
    refresh(caseId, identity.customer_id);
    return { ok: true, id: fileId };
}
export type OperationCostSheetPreviewResult = {
    ok: true;
    id: string;
    preview: OperationCostSheetPreview;
    hasPreviousImport: boolean;
} | {
    ok: false;
    error: string;
};
export async function previewOperationCostSheetAction(formData: FormData): Promise<OperationCostSheetPreviewResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const caseId = String(formData.get("caseId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || !caseId)
        return { ok: false, error: "请选择服务清单 DOCX 或 TXT 文件" };
    if (!/\.(docx|txt)$/i.test(file.name)) {
        return { ok: false, error: "服务清单导入支持 .docx 和 .txt 文件" };
    }
    if (file.size > MAX_COST_SHEET_SIZE_BYTES) {
        return { ok: false, error: "自动导入的服务清单不能超过 10 MB" };
    }
    const identity = await getCaseIdentity(caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    let preview: OperationCostSheetPreview;
    try {
        preview = await parseOperationServiceList(await file.arrayBuffer(), file.name);
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof CostSheetParseError ? error.message : "服务清单解析失败，请检查文件格式",
        };
    }
    const supabase = getSupabaseAdmin();
    const [customerResult, travelResult, importResult, manualItemResult] = await Promise.all([
        supabase.from("customers").select("name").eq("id", identity.customer_id).maybeSingle(),
        supabase
            .from("travel_needs")
            .select("expected_start_date,expected_end_date")
            .eq("customer_id", identity.customer_id)
            .maybeSingle(),
        supabase
            .from("operation_cost_sheet_imports")
            .select("id", { count: "exact", head: true })
            .eq("case_id", caseId),
        supabase
            .from("operation_service_items")
            .select("id", { count: "exact", head: true })
            .eq("case_id", caseId)
            .is("import_id", null),
    ]);
    const readError = customerResult.error ?? travelResult.error ?? importResult.error ?? manualItemResult.error;
    if (readError) {
        return { ok: false, error: `读取导入上下文失败：${readError.message}` };
    }
    const warnings = [...preview.warnings];
    const customerName = String(customerResult.data?.name ?? "").trim();
    if (preview.clientLabel &&
        customerName &&
        preview.clientLabel.localeCompare(customerName, "zh-CN", { sensitivity: "base" }) !== 0) {
        warnings.push(`文件客户“${preview.clientLabel}”与当前客户“${customerName}”不一致，请确认。`);
    }
    const currentStart = String(travelResult.data?.expected_start_date ?? "");
    const currentEnd = String(travelResult.data?.expected_end_date ?? "");
    if ((currentStart && currentStart !== preview.travelStartDate) ||
        (currentEnd && currentEnd !== preview.travelEndDate)) {
        warnings.push(`文件行程日期 ${preview.travelStartDate} 至 ${preview.travelEndDate} 与当前客户日期不一致；导入不会自动修改客户日期。`);
    }
    if ((manualItemResult.count ?? 0) > 0) {
        warnings.push(`当前已有 ${manualItemResult.count} 条人工录入或人工编辑的服务；导入会保留这些记录，请在预览中留意同名项目。`);
    }
    preview = { ...preview, warnings };
    const stored = await storeOperationFile(identity.customer_id, file);
    if (!stored.ok)
        return stored;
    const { fileId, storagePath } = stored;
    const linkResult = await mutateOperation("operation_cases", caseId, caseId, identity.revision, { service_list_file_id: fileId, service_list_status: "uploaded", service_list_manual: false });
    if (linkResult.error) {
        await supabase.from("customer_files").delete().eq("id", fileId);
        await supabase.storage.from(bucket()).remove([storagePath]);
        return { ok: false, error: linkResult.error.message };
    }
    await supabase.from("customers").update({ updated_at: new Date().toISOString() }).eq("id", identity.customer_id);
    refresh(caseId, identity.customer_id);
    return {
        ok: true,
        id: fileId,
        preview,
        hasPreviousImport: (importResult.count ?? 0) > 0,
    };
}
export type OperationCostSheetImportResult = {
    ok: true;
    id: string;
    inserted: number;
    skippedManual: number;
    duplicate: boolean;
} | {
    ok: false;
    error: string;
};
export async function importOperationCostSheetAction(input: {
    caseId: string;
    fileId: string;
    expectedRows: Record<string, number>;
    replaceExisting?: boolean;
    corrections?: Array<{
        rowKey: string;
        serviceDate?: string;
        city?: string | null;
        category?: OperationCategory;
        title?: string;
        supplierName?: string | null;
        quantity?: number;
        unit?: string;
        invoiceUnitCost?: number;
        customerUnitQuote?: number;
    }>;
}): Promise<OperationCostSheetImportResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const supabase = getSupabaseAdmin();
    const [{ data: operationCase, error: caseError }, { data: fileRow, error: fileError }] = await Promise.all([
        supabase
            .from("operation_cases")
            .select("service_list_file_id")
            .eq("id", input.caseId)
            .maybeSingle(),
        supabase
            .from("customer_files")
            .select("id,name,storage_path")
            .eq("id", input.fileId)
            .eq("customer_id", identity.customer_id)
            .maybeSingle(),
    ]);
    if (caseError || !operationCase)
        return { ok: false, error: caseError?.message ?? "计调客户不存在" };
    if (fileError || !fileRow)
        return { ok: false, error: fileError?.message ?? "服务清单文件不存在" };
    if (String(operationCase.service_list_file_id ?? "") !== input.fileId) {
        return { ok: false, error: "服务清单文件已变化，请重新上传并预览后再导入" };
    }
    const { data: storedFile, error: downloadError } = await supabase.storage
        .from(bucket())
        .download(String(fileRow.storage_path));
    if (downloadError || !storedFile) {
        return { ok: false, error: downloadError?.message ?? "无法读取服务清单文件" };
    }
    let preview: OperationCostSheetPreview;
    try {
        preview = await parseOperationServiceList(await storedFile.arrayBuffer(), String(fileRow.name));
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof CostSheetParseError ? error.message : "服务清单重新校验失败",
        };
    }
    if (input.corrections?.length) {
        const corrections = new Map(input.corrections.map((entry) => [entry.rowKey, entry]));
        preview.items = preview.items.map((item) => {
            const correction = corrections.get(item.rowKey);
            if (!correction)
                return item;
            const serviceDate = correction.serviceDate ?? item.serviceDate;
            const quantity = correction.quantity ?? item.quantity;
            const invoiceUnitCost = correction.invoiceUnitCost ?? item.invoiceUnitCost;
            const customerUnitQuote = correction.customerUnitQuote ?? item.customerUnitQuote;
            if (!isDate(serviceDate) || quantity <= 0 || invoiceUnitCost < 0 || customerUnitQuote < 0)
                throw new CostSheetParseError(`“${correction.title ?? item.title}”的修正数据无效`);
            const category = correction.category ?? item.category;
            if (!OPERATION_CATEGORIES.includes(category))
                throw new CostSheetParseError("修正后的服务分类无效");
            return { ...item, serviceDate, city: correction.city === undefined ? item.city : blankToNull(correction.city), category, title: correction.title?.trim() || item.title, supplierName: correction.supplierName === undefined ? item.supplierName : blankToNull(correction.supplierName), quantity, unit: correction.unit?.trim() || item.unit, invoiceUnitCost, customerUnitQuote };
        });
        preview.days = preview.days.map((day) => {
            const firstItem = preview.items.find((item) => item.dayNumber === day.dayNumber);
            return firstItem ? { ...day, serviceDate: firstItem.serviceDate, city: firstItem.city } : day;
        });
        preview.totals = preview.items.reduce((sum, item) => { sum.cost += item.quantity * item.invoiceUnitCost; sum.quote += item.quantity * item.customerUnitQuote; sum.grossProfit = sum.quote - sum.cost; return sum; }, { cost: 0, quote: 0, grossProfit: 0 });
    }
    const { data, error } = await supabase.rpc("crm_import_operation_service_list", {
        p_actor: (await getCurrentUser())!.id,
        p_case_id: input.caseId,
        p_file_id: input.fileId,
        p_content_hash: preview.contentHash,
        p_payload: preview,
        p_replace_existing: input.replaceExisting ?? true,
        p_expected_rows: input.expectedRows,
    });
    if (error)
        return { ok: false, error: error.message };
    const result = data as {
        importId?: string;
        inserted?: number;
        skippedManual?: number;
        duplicate?: boolean;
    } | null;
    if (!result?.importId)
        return { ok: false, error: "数据库未返回有效的导入结果" };
    refresh(input.caseId, identity.customer_id);
    return {
        ok: true,
        id: result.importId,
        inserted: Number(result.inserted ?? 0),
        skippedManual: Number(result.skippedManual ?? 0),
        duplicate: Boolean(result.duplicate),
    };
}
export async function saveOperationReminderAction(input: {
    caseId: string;
    reminderId?: string | null;
    anchorType?: "arrival" | "service" | "fixed";
    serviceItemId?: string | null;
    title: string;
    dueDate?: string | null;
    offsetDays?: number | null;
    assigneeUserId?: string | null;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    if (!input.title.trim())
        return { ok: false, error: "请输入提醒内容" };
    const supabase = getSupabaseAdmin();
    const reminderId = blankToNull(input.reminderId);
    const serviceItemId = blankToNull(input.serviceItemId);
    const anchorType = input.anchorType ?? (serviceItemId ? "service" : "fixed");
    let dueDate = blankToNull(input.dueDate);
    let dayId: string | null = null;
    let offsetDays: number | null = null;
    if (anchorType === "arrival") {
        if (input.offsetDays == null ||
            !Number.isInteger(input.offsetDays) ||
            input.offsetDays < 0) {
            return { ok: false, error: "请输入有效的提前天数" };
        }
        const { data: operationCase, error: caseError } = await supabase
            .from("operation_cases")
            .select("start_date")
            .eq("id", input.caseId)
            .maybeSingle();
        if (caseError)
            return { ok: false, error: caseError.message };
        if (!operationCase?.start_date)
            return { ok: false, error: "请先填写团组开始日期" };
        offsetDays = input.offsetDays;
        dueDate = dateMinusDays(String(operationCase.start_date), offsetDays);
    }
    else if (anchorType === "service") {
        if (!serviceItemId)
            return { ok: false, error: "请选择关联服务" };
        const { data, error } = await supabase
            .from("operation_service_items")
            .select("service_date,day_id")
            .eq("id", serviceItemId)
            .eq("case_id", input.caseId)
            .maybeSingle();
        if (error || !data)
            return { ok: false, error: error?.message ?? "关联服务不存在" };
        if (!data.service_date)
            return { ok: false, error: "关联服务没有服务日期，无法按提前天数提醒" };
        if (input.offsetDays == null ||
            !Number.isInteger(input.offsetDays) ||
            input.offsetDays < 0) {
            return { ok: false, error: "请输入有效的提前天数" };
        }
        offsetDays = input.offsetDays;
        dueDate = dateMinusDays(String(data.service_date), offsetDays);
        dayId = data.day_id ? String(data.day_id) : null;
    }
    if (!dueDate || !isDate(dueDate))
        return { ok: false, error: "请选择有效提醒日期" };
    const row = {
        case_id: input.caseId,
        day_id: dayId,
        service_item_id: anchorType === "service" ? serviceItemId : null,
        title: input.title.trim(),
        due_date: dueDate,
        anchor_type: anchorType,
        offset_days: offsetDays,
        is_auto: false,
        task_kind: reminderId ? undefined : "reminder",
        assignee_user_id: blankToNull(input.assigneeUserId),
        ...(reminderId ? { is_customized: true } : {}),
    };
    const result = reminderId
        ? await supabase
            .from("operation_reminders")
            .update(row)
            .eq("id", reminderId)
            .eq("case_id", input.caseId)
            .select("id")
            .single()
        : await supabase
            .from("operation_reminders")
            .insert(row)
            .select("id")
            .single();
    const { data, error } = result;
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true, id: String(data.id) };
}
export async function updateOperationReminderStatusAction(input: {
    caseId: string;
    reminderId: string;
    status: ReminderStatus;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    if (!REMINDER_STATUSES.includes(input.status))
        return { ok: false, error: "提醒状态无效" };
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const { error } = await getSupabaseAdmin()
        .from("operation_reminders")
        .update({
        status: input.status,
        completed_at: input.status === "completed" ? new Date().toISOString() : null,
    })
        .eq("id", input.reminderId)
        .eq("case_id", input.caseId);
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
export async function deleteOperationReminderAction(input: {
    caseId: string;
    reminderId: string;
}): Promise<ActionResult> {
    const missing = await unavailable();
    if (missing)
        return missing;
    const identity = await getCaseIdentity(input.caseId);
    if (!identity)
        return { ok: false, error: "计调客户不存在" };
    const { error } = await getSupabaseAdmin()
        .from("operation_reminders")
        .delete()
        .eq("id", input.reminderId)
        .eq("case_id", input.caseId);
    if (error)
        return { ok: false, error: error.message };
    refresh(input.caseId, identity.customer_id);
    return { ok: true };
}
