"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, BellPlus, BellRing, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, Edit3, FileCheck2, FileSpreadsheet, FileText, FolderOpen, Hotel, MapPin, Plus, ReceiptText, Route, Save, Trash2, Upload, UsersRound, WalletCards, } from "lucide-react";
import { toast } from "sonner";
import { deleteOperationDayAction, deleteOperationContactAction, deleteOperationItemAction, deleteOperationReminderAction, importOperationCostSheetAction, previewOperationCostSheetAction, saveOperationDayAction, saveOperationContactAction, saveOperationItemAction, saveOperationReminderAction, setServiceListStatusAction, updateOperationBookingStatusAction, updateOperationCaseAction, updateOperationReminderStatusAction, uploadOperationFileAction, type OperationItemInput, } from "@/app/actions/operations-actions";
import { OperationPhaseBadge, ServiceListStatusBadge } from "@/components/operations-badges";
import { PriorityBadge } from "@/components/customer-badges";
import { FileManager } from "@/components/file-manager";
import { FinanceWorkbench } from "@/components/finance-workbench";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultilineInput } from "@/components/ui/multiline-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BOOKING_STATUSES, BOOKING_STATUS_LABELS, CATEGORY_LABELS, SERVICE_LIST_STATUSES, SERVICE_LIST_STATUS_LABELS, bookingProgress, chinaToday, itemFinancials, operationFinancials, operationPhase, validateOperationReminder, reminderTiming, dateMinusDays, type BookingStatus, type OperationCase, type OperationCategory, type OperationContact, type OperationContactRole, type OperationDay, type OperationReminder, type OperationSection, type OperationServiceItem, } from "@/lib/operations";
import { PRIORITIES } from "@/lib/constants";
import type { CrmUserSummary, Customer, Priority } from "@/lib/types";
import type { OperationCostSheetPreview } from "@/lib/operation-cost-sheet";
import { ServiceEditGuard } from "@/components/service-edit-guard";
import { InlineServiceRow } from "@/components/inline-service-row";
import { groupServicesByDay } from '@/lib/service-day-groups';
import { OperationChangeHistory } from "@/components/operation-change-history";
import { requiresUrgentConfirmation } from "@/lib/priority-confirmation";
import type { FinanceClaim } from "@/lib/finance";
const money = (value: number | null) => value == null
    ? "—"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
const percent = (value: number | null) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const fileName = (operation: OperationCase, id: string | null) => id ? operation.files.find((item) => item.id === id)?.name ?? "附件" : null;
type DayDraft = {
    id: string | null;
    revision?: number;
    dayNumber: string;
    serviceDate: string;
    city: string;
    summary: string;
    notes: string;
};
type ItemDraft = {
    id: string | null;
    revision?: number;
    dayId: string;
    section: OperationSection;
    category: OperationCategory;
    title: string;
    details: string;
    city: string;
    serviceDate: string;
    bookingStatus: BookingStatus;
    supplierName: string;
    quantity: string;
    unit: string;
    invoiceUnitCost: string;
    customerUnitQuote: string;
    finalSupplierSettlement: string;
    finalCustomerSettlement: string;
    confirmationFileId: string;
    invoiceFileId: string;
    checkInDate: string;
    checkOutDate: string;
    roomType: string;
    roomCount: string;
    nightCount: string;
    transportType: string;
    origin: string;
    destination: string;
    referenceNumber: string;
    departureTime: string;
    notes: string;
};
type CostSheetPreviewState = {
    fileId: string;
    expectedRows: Record<string, number>;
    preview: OperationCostSheetPreview;
    hasPreviousImport: boolean;
};
type ContactDraft = {
    id: string | null;
    revision?: number;
    role: OperationContactRole;
    name: string;
    phone: string;
    serviceItemId: string;
    notes: string;
};
const CONTACT_ROLE_LABELS: Record<OperationContactRole, string> = {
    project_manager: "项目经理",
    guide: "导游",
    driver: "司机",
    emergency: "24小时紧急联络",
    other: "其他联系人",
};
function contactDraft(contact?: OperationContact): ContactDraft {
    return contact
        ? { id: contact.id, revision: contact.revision, role: contact.role, name: contact.name, phone: contact.phone ?? "", serviceItemId: contact.serviceItemId ?? "", notes: contact.notes ?? "" }
        : { id: null, role: "project_manager", name: "", phone: "", serviceItemId: "", notes: "" };
}
const detailTabs: Array<[
    string,
    string,
    LucideIcon
]> = [
    ["services", "在线服务清单", FileText],
    ["group", "团组资料", UsersRound],
    ["checklist", "执行清单", BellRing],
    ["finance", "报账", ReceiptText],
    ["settlement", "结算与毛利", WalletCards],
    ["files", "文件", FolderOpen],
];
function emptyDay(operation: OperationCase): DayDraft {
    const next = operation.days.length ? Math.max(...operation.days.map((item) => item.dayNumber)) + 1 : 1;
    let serviceDate = "";
    if (operation.arrivalDate) {
        const date = new Date(`${operation.arrivalDate}T12:00:00+08:00`);
        date.setDate(date.getDate() + next - 1);
        serviceDate = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date);
    }
    return { id: null, dayNumber: String(next), serviceDate, city: "", summary: "", notes: "" };
}
function dayDraft(day: OperationDay): DayDraft {
    return {
        id: day.id,
        revision: day.revision,
        dayNumber: String(day.dayNumber),
        serviceDate: day.serviceDate ?? "",
        city: day.city ?? "",
        summary: day.summary ?? "",
        notes: day.notes ?? "",
    };
}
function emptyItem(section: OperationSection, day?: OperationDay): ItemDraft {
    return {
        id: null,
        dayId: day?.id ?? "",
        section,
        category: section === "hotel" ? "hotel" : section === "transport" ? "rail" : "guide",
        title: "",
        details: "",
        city: day?.city ?? "",
        serviceDate: day?.serviceDate ?? "",
        bookingStatus: "pending",
        supplierName: "",
        quantity: "1",
        unit: section === "hotel" ? "间夜" : section === "transport" ? "张" : "项",
        invoiceUnitCost: "",
        customerUnitQuote: "",
        finalSupplierSettlement: "",
        finalCustomerSettlement: "",
        confirmationFileId: "",
        invoiceFileId: "",
        checkInDate: "",
        checkOutDate: "",
        roomType: "",
        roomCount: "",
        nightCount: "",
        transportType: "",
        origin: "",
        destination: "",
        referenceNumber: "",
        departureTime: "",
        notes: "",
    };
}
function itemDraft(item: OperationServiceItem): ItemDraft {
    return {
        id: item.id,
        revision: item.revision,
        dayId: item.dayId ?? "",
        section: item.section,
        category: item.category,
        title: item.title,
        details: item.details ?? "",
        city: item.city ?? "",
        serviceDate: item.serviceDate ?? "",
        bookingStatus: item.bookingStatus,
        supplierName: item.supplierName ?? "",
        quantity: String(item.quantity),
        unit: item.unit,
        invoiceUnitCost: item.invoiceUnitCost == null ? "" : String(item.invoiceUnitCost),
        customerUnitQuote: item.customerUnitQuote == null ? "" : String(item.customerUnitQuote),
        finalSupplierSettlement: item.finalSupplierSettlement == null ? "" : String(item.finalSupplierSettlement),
        finalCustomerSettlement: item.finalCustomerSettlement == null ? "" : String(item.finalCustomerSettlement),
        confirmationFileId: item.confirmationFileId ?? "",
        invoiceFileId: item.invoiceFileId ?? "",
        checkInDate: item.checkInDate ?? "",
        checkOutDate: item.checkOutDate ?? "",
        roomType: item.roomType ?? "",
        roomCount: item.roomCount == null ? "" : String(item.roomCount),
        nightCount: item.nightCount == null ? "" : String(item.nightCount),
        transportType: item.transportType ?? "",
        origin: item.origin ?? "",
        destination: item.destination ?? "",
        referenceNumber: item.referenceNumber ?? "",
        departureTime: item.departureTime?.slice(0, 5) ?? "",
        notes: item.notes ?? "",
    };
}
function Field({ label, children, className = "" }: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>;
}
function FinancialSummary({ operation }: {
    operation: OperationCase;
}) {
    const financial = operationFinancials(operation.items);
    const finalSettlementHint = financial.finalComplete ? "最终结算汇总" : "已录入金额汇总，结算尚未完整";
    return (<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {[
            ["预计成本", money(financial.expectedCost), "发票成本价汇总"],
            ["客户报价", money(financial.expectedRevenue), "对客报价汇总"],
            ["预计毛利", money(financial.expectedGrossProfit), `毛利率 ${percent(financial.expectedMarginRate)}`],
            ["供应商最终结算", money(financial.finalCost), finalSettlementHint],
            ["客户最终结算", money(financial.finalRevenue), finalSettlementHint],
            ["最终毛利", money(financial.finalGrossProfit), financial.finalComplete ? `毛利率 ${percent(financial.finalMarginRate)}` : "结算数据尚未完整"],
        ].map(([label, value, hint]) => (<div key={label} className="rounded-xl border border-slate-200/80 bg-white p-4">
          <p className="crm-label">{label}</p>
          <p className="crm-metric mt-2 text-[22px] font-semibold text-slate-950">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </div>))}
    </div>);
}
export function OperationCaseDetail({ operation, customer, users, claims, }: {
    operation: OperationCase;
    customer: Customer;
    users: CrmUserSummary[];
    claims: FinanceClaim[];
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [caseRevision, setCaseRevision] = useState(operation.revision);
    const [ownerName, setOwnerName] = useState(operation.ownerName ?? "");
    const [tourName, setTourName] = useState(operation.tourName);
    const [priority, setPriority] = useState<Priority>(operation.priority);
    const [arrivalDate, setArrivalDate] = useState(operation.arrivalDate ?? "");
    const [departureDate, setDepartureDate] = useState(operation.departureDate ?? "");
    const [notes, setNotes] = useState(operation.notes ?? "");
    const [travelerCount, setTravelerCount] = useState(operation.travelerCount ?? "");
    const [routeInfo, setRouteInfo] = useState(operation.routeInfo ?? "");
    const [orderTotal, setOrderTotal] = useState(operation.orderTotal == null ? "" : String(operation.orderTotal));
    const [budgetCost, setBudgetCost] = useState(operation.budgetCost == null ? "" : String(operation.budgetCost));
    const [specialRequirements, setSpecialRequirements] = useState(operation.specialRequirements ?? "");
    const [hotelInformation, setHotelInformation] = useState(operation.hotelInformation ?? "");
    const [customerNotes, setCustomerNotes] = useState(operation.customerNotes ?? "");
    const [activeTab, setActiveTab] = useState("services");
    const [day, setDay] = useState<DayDraft | null>(null);
    const [item, setItemState] = useState<ItemDraft | null>(null);
    const [itemBaseline, setItemBaseline] = useState("");
    function setItem(next: ItemDraft | null) {
        if (next && !item)
            setItemBaseline(JSON.stringify(next));
        setItemState(next);
    }
    function closeItem() {
        if (pending)
            return;
        if (item && JSON.stringify(item) !== itemBaseline && !window.confirm("服务项目有未保存修改，确定放弃？取消可继续编辑。"))
            return;
        setItem(null);
    }
    const [contact, setContact] = useState<ContactDraft | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        kind: "day" | "item" | "reminder" | "contact";
        id: string;
        name: string;
        revision?: number;
    } | null>(null);
    const [reminderOpen, setReminderOpen] = useState(false);
    const [urgentPriorityOpen, setUrgentPriorityOpen] = useState(false);
    const [reminderId, setReminderId] = useState<string | null>(null);
    const [reminderMode, setReminderMode] = useState<"fixed" | "arrival" | "service">("fixed");
    const [reminderTitle, setReminderTitle] = useState("");
    const [reminderDueDate, setReminderDueDate] = useState("");
    const [reminderServiceId, setReminderServiceId] = useState("");
    const [reminderOffset, setReminderOffset] = useState("7");
    const [reminderAssigneeId, setReminderAssigneeId] = useState("");
    const [reminderError, setReminderError] = useState("");
    const [costSheetPreview, setCostSheetPreview] = useState<CostSheetPreviewState | null>(null);
    const serviceListInput = useRef<HTMLInputElement>(null);
    const attachmentInputs = useRef(new Map<string, HTMLInputElement>());
    const today = chinaToday();
    const phase = operationPhase(operation, today);
    const progress = bookingProgress(operation.items);
    const financial = operationFinancials(operation.items);
    const serviceListFile = operation.files.find((entry) => entry.id === operation.serviceListFileId);
    const reminderOffsetNumber = Number(reminderOffset);
    const reminderOffsetValid = Number.isInteger(reminderOffsetNumber) && reminderOffsetNumber >= 0;
    const selectedReminderService = operation.items.find((entry) => entry.id === reminderServiceId);
    const calculatedReminderDate = reminderMode === "arrival" && operation.arrivalDate && reminderOffsetValid
        ? dateMinusDays(operation.arrivalDate, reminderOffsetNumber)
        : reminderMode === "service" && selectedReminderService?.serviceDate && reminderOffsetValid
            ? dateMinusDays(selectedReminderService.serviceDate, reminderOffsetNumber)
            : null;
    const dailyItems = useMemo(() => groupServicesByDay(operation.days, operation.items), [operation.days, operation.items]);
    const groupedItemIds = new Set([...dailyItems.values()].flat().map(item => item.id));
    const ungroupedItems = operation.items.filter(item => !groupedItemIds.has(item.id));
    function run(task: () => Promise<{
        ok: true;
        id?: string;
    } | {
        ok: false;
        error: string;
    }>, success: string, done?: () => void) {
        startTransition(async () => {
            try {
                const result = await task();
                if (result.ok) {
                    toast.success(success);
                    done?.();
                    router.refresh();
                }
                else
                    toast.error(result.error);
            }
            catch {
                toast.error("保存未确认成功，当前输入已保留，请检查连接后重试。");
            }
        });
    }
    function saveCaseConfirmed(confirmUrgent = false) {
        run(async () => {
            const result = await updateOperationCaseAction({
                caseId: operation.id,
                revision: caseRevision,
                tourName,
                ownerName,
                priority,
                confirmUrgent,
                arrivalDate,
                departureDate,
                notes,
                travelerCount,
                routeInfo,
                orderTotal: orderTotal === "" ? null : Number(orderTotal),
                budgetCost: budgetCost === "" ? null : Number(budgetCost),
                specialRequirements,
                hotelInformation,
                customerNotes,
            });
            if (result.ok)
                setCaseRevision(result.revision);
            return result;
        }, "计调基本信息已保存");
    }
    function saveCase() {
        if (requiresUrgentConfirmation(operation.priority, priority)) {
            setUrgentPriorityOpen(true);
            return;
        }
        saveCaseConfirmed();
    }
    function saveDay() {
        if (!day)
            return;
        run(() => saveOperationDayAction({
            caseId: operation.id,
            dayId: day.id,
            revision: day.revision,
            dayNumber: Number(day.dayNumber),
            serviceDate: day.serviceDate,
            city: day.city,
            summary: day.summary,
            notes: day.notes,
        }), "每日行程已保存", () => setDay(null));
    }
    function saveItem() {
        if (!item)
            return;
        const input: OperationItemInput = {
            caseId: operation.id,
            itemId: item.id,
            revision: item.revision,
            dayId: item.dayId || null,
            section: item.section,
            category: item.category,
            title: item.title,
            details: item.details,
            city: item.city,
            serviceDate: item.serviceDate,
            bookingStatus: item.bookingStatus,
            supplierName: item.supplierName,
            quantity: Number(item.quantity),
            unit: item.unit,
            invoiceUnitCost: item.invoiceUnitCost === "" ? null : Number(item.invoiceUnitCost),
            customerUnitQuote: item.customerUnitQuote === "" ? null : Number(item.customerUnitQuote),
            finalSupplierSettlement: item.finalSupplierSettlement === "" ? null : Number(item.finalSupplierSettlement),
            finalCustomerSettlement: item.finalCustomerSettlement === "" ? null : Number(item.finalCustomerSettlement),
            confirmationFileId: item.confirmationFileId || null,
            invoiceFileId: item.invoiceFileId || null,
            checkInDate: item.checkInDate,
            checkOutDate: item.checkOutDate,
            roomType: item.roomType,
            roomCount: item.roomCount === "" ? null : Number(item.roomCount),
            nightCount: item.nightCount === "" ? null : Number(item.nightCount),
            transportType: item.transportType,
            origin: item.origin,
            destination: item.destination,
            referenceNumber: item.referenceNumber,
            departureTime: item.departureTime,
            notes: item.notes,
        };
        run(() => saveOperationItemAction(input), "服务项目已保存", () => setItem(null));
    }
    function createService(category: OperationCategory) {
        const section: OperationSection = category === "hotel"
            ? "hotel"
            : ["flight", "rail", "other_transport"].includes(category)
                ? "transport"
                : "daily";
        setItem({ ...emptyItem(section), category });
    }
    function upload(file: File | undefined, role: "service_list" | "confirmation" | "invoice", itemId?: string) {
        if (!file)
            return;
        const form = new FormData();
        form.set("caseId", operation.id);
        form.set("itemId", itemId ?? "");
        form.set("role", role);
        form.set("file", file);
        run(() => uploadOperationFileAction(form), role === "service_list" ? "服务清单已上传" : role === "confirmation" ? "确认附件已上传，预订状态已确认" : "发票附件已上传");
    }
    function attachmentInputKey(role: "confirmation" | "invoice", itemId: string) {
        return `${role}:${itemId}`;
    }
    function openAttachmentInput(role: "confirmation" | "invoice", itemId: string) {
        attachmentInputs.current.get(attachmentInputKey(role, itemId))?.click();
    }
    function previewCostSheet(file: File | undefined) {
        if (!file)
            return;
        const form = new FormData();
        form.set("caseId", operation.id);
        form.set("file", file);
        startTransition(async () => {
            const result = await previewOperationCostSheetAction(form);
            if (serviceListInput.current)
                serviceListInput.current.value = "";
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            setCostSheetPreview({
                fileId: result.id,
                expectedRows: Object.fromEntries([...operation.days, ...operation.items].map(row => [row.id, row.revision ?? 0])),
                preview: result.preview,
                hasPreviousImport: result.hasPreviousImport,
            });
            toast.success(`已解析 ${result.preview.items.length} 条成本明细，请确认后导入`);
            router.refresh();
        });
    }
    function confirmCostSheetImport() {
        if (!costSheetPreview)
            return;
        startTransition(async () => {
            const result = await importOperationCostSheetAction({
                caseId: operation.id,
                fileId: costSheetPreview.fileId,
                expectedRows: costSheetPreview.expectedRows,
                replaceExisting: true,
                corrections: costSheetPreview.preview.items.map((entry) => ({ rowKey: entry.rowKey, serviceDate: entry.serviceDate, city: entry.city, category: entry.category, title: entry.title, supplierName: entry.supplierName, quantity: entry.quantity, unit: entry.unit, invoiceUnitCost: entry.invoiceUnitCost, customerUnitQuote: entry.customerUnitQuote })),
            });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            const skipped = result.skippedManual
                ? `，保留 ${result.skippedManual} 条人工编辑记录`
                : "";
            toast.success(result.duplicate
                ? "该服务清单已经导入，无需重复写入"
                : `已导入 ${result.inserted} 条服务明细${skipped}`);
            setCostSheetPreview(null);
            setActiveTab("services");
            router.refresh();
        });
    }
    function updatePreviewItem(rowKey: string, patch: Partial<OperationCostSheetPreview["items"][number]>) {
        setCostSheetPreview((current) => current ? { ...current, preview: { ...current.preview, items: current.preview.items.map((entry) => entry.rowKey === rowKey ? { ...entry, ...patch } : entry) } } : current);
    }
    function saveReminder() {
        const validationError = validateOperationReminder({
            title: reminderTitle,
            anchorType: reminderMode,
            dueDate: reminderDueDate,
            arrivalDate: operation.arrivalDate,
            serviceItemId: reminderServiceId,
            serviceDate: selectedReminderService?.serviceDate,
            offsetDays: reminderOffsetValid ? reminderOffsetNumber : null,
        });
        if (validationError) {
            setReminderError(validationError);
            toast.error(validationError);
            return;
        }
        setReminderError("");
        run(() => saveOperationReminderAction({
            caseId: operation.id,
            reminderId,
            anchorType: reminderMode,
            serviceItemId: reminderMode === "service" ? reminderServiceId || null : null,
            title: reminderTitle,
            dueDate: reminderMode === "fixed" ? reminderDueDate : null,
            offsetDays: reminderMode === "fixed" ? null : reminderOffsetNumber,
            assigneeUserId: reminderAssigneeId || null,
        }), reminderId ? "提醒已更新" : "提醒已创建", () => {
            setReminderOpen(false);
            setReminderId(null);
            setReminderMode("fixed");
            setReminderTitle("");
            setReminderDueDate("");
            setReminderServiceId("");
            setReminderOffset("7");
            setReminderAssigneeId("");
            setReminderError("");
        });
    }
    function openCreateReminder(mode: "fixed" | "arrival" | "service" = "fixed", service?: OperationServiceItem) {
        const offset = mode === "arrival" ? "30" : "7";
        setReminderId(null);
        setReminderMode(mode);
        setReminderTitle(mode === "arrival"
            ? `来华前 ${offset} 天准备提醒`
            : service
                ? `${service.title}预订提醒`
                : "");
        setReminderDueDate("");
        setReminderServiceId(service?.id ?? "");
        setReminderOffset(offset);
        setReminderAssigneeId("");
        setReminderError("");
        setReminderOpen(true);
    }
    function openEditReminder(entry: OperationReminder) {
        setReminderId(entry.id);
        setReminderMode(entry.anchorType);
        setReminderTitle(entry.title);
        setReminderDueDate(entry.anchorType === "fixed" ? entry.dueDate ?? "" : "");
        setReminderServiceId(entry.serviceItemId ?? "");
        setReminderOffset(entry.offsetDays == null ? "7" : String(entry.offsetDays));
        setReminderAssigneeId(entry.assigneeUserId ?? "");
        setReminderError("");
        setReminderOpen(true);
    }
    function setReminderDays(value: string) {
        setReminderOffset(value);
        setReminderError("");
        if (reminderMode === "arrival") {
            setReminderTitle((current) => !current.trim() || /^来华前 \d+ 天准备提醒$/.test(current)
                ? `来华前 ${value} 天准备提醒`
                : current);
        }
    }
    function changeReminderMode(mode: "fixed" | "arrival" | "service") {
        setReminderMode(mode);
        setReminderDueDate("");
        setReminderServiceId("");
        setReminderError("");
        if (mode === "arrival") {
            const offset = reminderOffsetValid ? reminderOffset : "30";
            setReminderOffset(offset);
            if (!reminderTitle.trim())
                setReminderTitle(`来华前 ${offset} 天准备提醒`);
        }
    }
    function remove() {
        if (!deleteTarget)
            return;
        const action = deleteTarget.kind === "day"
            ? deleteOperationDayAction({ caseId: operation.id, dayId: deleteTarget.id, revision: deleteTarget.revision })
            : deleteTarget.kind === "item"
                ? deleteOperationItemAction({ caseId: operation.id, itemId: deleteTarget.id, revision: deleteTarget.revision })
                : deleteTarget.kind === "reminder"
                    ? deleteOperationReminderAction({ caseId: operation.id, reminderId: deleteTarget.id })
                    : deleteOperationContactAction({ caseId: operation.id, contactId: deleteTarget.id, revision: deleteTarget.revision });
        run(() => action, `${deleteTarget.name}已删除`, () => setDeleteTarget(null));
    }
    function saveContact() {
        if (!contact)
            return;
        run(() => saveOperationContactAction({
            caseId: operation.id,
            contactId: contact.id,
            revision: contact.revision,
            serviceItemId: contact.serviceItemId || null,
            role: contact.role,
            name: contact.name,
            phone: contact.phone,
            notes: contact.notes,
        }), contact.id ? "联系人已更新" : "联系人已添加", () => setContact(null));
    }
    const renderServiceRow = (entry: OperationServiceItem) => {
        const line = itemFinancials(entry);
        return (<div key={entry.id} className="grid gap-3 rounded-lg border border-slate-200/70 bg-white p-3 lg:grid-cols-[minmax(180px,1.35fr)_130px_140px_110px_110px_auto] lg:items-center">
        <input ref={(node) => {
                const key = attachmentInputKey("confirmation", entry.id);
                if (node)
                    attachmentInputs.current.set(key, node);
                else
                    attachmentInputs.current.delete(key);
            }} type="file" className="hidden" onChange={(event) => {
                upload(event.currentTarget.files?.[0], "confirmation", entry.id);
                event.currentTarget.value = "";
            }}/>
        <input ref={(node) => {
                const key = attachmentInputKey("invoice", entry.id);
                if (node)
                    attachmentInputs.current.set(key, node);
                else
                    attachmentInputs.current.delete(key);
            }} type="file" className="hidden" onChange={(event) => {
                upload(event.currentTarget.files?.[0], "invoice", entry.id);
                event.currentTarget.value = "";
            }}/>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{CATEGORY_LABELS[entry.category]}</Badge>
            <p className="whitespace-pre-wrap break-words font-semibold text-slate-950">{entry.title}</p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[entry.city, entry.serviceDate, entry.supplierName].filter(Boolean).join(" · ") || "尚未补充服务信息"}
          </p>
          {entry.details && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{entry.details}</p>}
        </div>
        <Select value={entry.bookingStatus} onValueChange={(value) => run(() => updateOperationBookingStatusAction({ caseId: operation.id, itemId: entry.id, revision: entry.revision, status: value as BookingStatus }), "预订状态已更新")} disabled={pending}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{BOOKING_STATUSES.map((status) => <SelectItem key={status} value={status}>{BOOKING_STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-xs">
          <p className="text-muted-foreground">成本 / 报价</p>
          <p className="mt-1 font-mono">{money(line.cost)} / {money(line.quote)}</p>
        </div>
        <div className="text-xs">
          <p className="text-muted-foreground">确认附件</p>
          {entry.confirmationFileId ? (<a href={`/api/files/${entry.confirmationFileId}/download`} className="mt-1 inline-flex max-w-28 items-center gap-1 truncate text-primary hover:underline">
              <FileCheck2 className="size-3"/>{fileName(operation, entry.confirmationFileId)}
            </a>) : <p className="mt-1 text-amber-700">未上传</p>}
        </div>
        <div className="text-xs">
          <p className="text-muted-foreground">发票附件</p>
          {entry.invoiceFileId ? (<a href={`/api/files/${entry.invoiceFileId}/download`} className="mt-1 inline-flex max-w-28 items-center gap-1 truncate text-primary hover:underline">
              <ReceiptText className="size-3"/>{fileName(operation, entry.invoiceFileId)}
            </a>) : <p className="mt-1 text-muted-foreground">—</p>}
        </div>
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => openAttachmentInput("confirmation", entry.id)}>
            <Upload className="size-3.5"/>确认单
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><ChevronDown className="size-4"/></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setItem(itemDraft(entry))}><Edit3 className="size-4"/>编辑完整信息</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openAttachmentInput("invoice", entry.id)}>
                <ReceiptText className="size-4"/>上传发票
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openCreateReminder("service", entry)}><BellPlus className="size-4"/>设置提醒</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ kind: "item", id: entry.id, revision: entry.revision, name: entry.title })}><Trash2 className="size-4"/>删除</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>);
    };
    const renderOnlineServiceRow = (entry: OperationServiceItem, routeLabel: string) => <InlineServiceRow key={entry.id} item={entry} route={routeLabel} onDetails={() => setItem(itemDraft(entry))} onDelete={() => setDeleteTarget({ kind: "item", id: entry.id, revision: entry.revision, name: entry.title })} onSaved={() => toast.success("服务清单已保存，操作日志同步记录")}/>;
    const reminderGroups = {
        datePending: operation.reminders.filter((entry) => reminderTiming(entry, today) === "date_pending"),
        overdue: operation.reminders.filter((entry) => reminderTiming(entry, today) === "overdue"),
        today: operation.reminders.filter((entry) => reminderTiming(entry, today) === "today"),
        upcoming: operation.reminders.filter((entry) => reminderTiming(entry, today) === "upcoming"),
        completed: operation.reminders.filter((entry) => ["completed", "ignored"].includes(String(reminderTiming(entry, today)))),
    };
    const reminderContext = (entry: OperationReminder) => {
        if (entry.anchorType === "service") {
            const service = operation.items.find((item) => item.id === entry.serviceItemId);
            return service ? `关联服务：${service.title}` : "关联服务";
        }
        if (entry.anchorType === "arrival")
            return "关联来华日期";
        return "固定日期";
    };
    return (<div className="space-y-5">
      <ServiceEditGuard />
      <section className="crm-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon-sm" asChild><Link href="/operations" aria-label="返回计调工作台"><ArrowLeft className="size-4"/></Link></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[23px] font-semibold tracking-[-0.035em] text-slate-950">{operation.tourName}</h1>
              <OperationPhaseBadge phase={phase}/>
              <PriorityBadge priority={operation.priority}/>
              <ServiceListStatusBadge status={operation.serviceListStatus} manual={operation.serviceListManual}/>
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {operation.tourCode} · 客户：{operation.customerName} · {operation.arrivalDate ?? "抵达日期待补充"} → {operation.departureDate ?? "离境日期待补充"} · 预订进度 {progress.finished}/{progress.total}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/customers/${operation.customerId}`}>打开客户档案</Link></Button>
          <Button size="sm" onClick={saveCase} disabled={pending}><Save className="size-4"/>保存基本信息</Button>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="crm-panel gap-0 overflow-hidden">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-slate-200/70 bg-white px-4 py-0">
          {detailTabs.map(([value, label, Icon]) => (<TabsTrigger key={String(value)} value={String(value)} className="h-12 flex-none rounded-none px-4 py-3">
              <Icon className="size-4"/>{label}
            </TabsTrigger>))}
        </TabsList>

        <TabsContent value="group" className="m-0 space-y-5 p-5">
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="crm-section-title">团组资料</h2><p className="crm-section-description">维护团组基本资料；逐日服务项目请在“在线服务清单”中编辑。</p></div>
              <Button onClick={saveCase} disabled={pending}><Save className="size-4"/>保存团组资料</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="团组名称"><Input value={tourName} onChange={(event) => setTourName(event.target.value)}/></Field>
              <Field label="团组编号"><Input value={operation.tourCode} disabled/></Field>
              <Field label="客户名称"><Input value={operation.customerName} disabled/></Field>
              <Field label="服务开始日期"><Input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)}/></Field>
              <Field label="服务结束日期"><Input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)}/></Field>
              <Field label="团队人数"><Input value={travelerCount} onChange={(event) => setTravelerCount(event.target.value)} placeholder="如 8 人"/></Field>
              <Field label="服务路线"><Input value={routeInfo} onChange={(event) => setRouteInfo(event.target.value)} placeholder="城市或线路"/></Field>
              <Field label="订单总额"><Input type="number" min="0" value={orderTotal} onChange={(event) => setOrderTotal(event.target.value)} placeholder="CNY"/></Field>
              <Field label="成本总额"><Input type="number" min="0" value={budgetCost} onChange={(event) => setBudgetCost(event.target.value)} placeholder="CNY"/></Field>
              <Field label="负责计调"><MultilineInput value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="填写一名负责人"/></Field>
              <Field label="优先级">
                <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="特殊需求 / 备注" className="md:col-span-2 xl:col-span-4"><Textarea value={specialRequirements} onChange={(event) => setSpecialRequirements(event.target.value)} placeholder="饮食、无障碍、房型等"/></Field>
              <Field label="酒店信息" className="md:col-span-2"><Textarea value={hotelInformation} onChange={(event) => setHotelInformation(event.target.value)} placeholder="酒店名称、房型、入住偏好与确认信息"/></Field>
              <Field label="客户注意事项" className="md:col-span-2"><Textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} placeholder="仅供服务团队查看的客户注意事项"/></Field>
            </div>
            <Field label="内部计调备注" className="mt-4"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录交接说明、特殊注意事项或内部备注"/></Field>
          </section>
          <FinancialSummary operation={operation}/>
        </TabsContent>

        <TabsContent value="services" className="m-0 p-5">
          <section className="mb-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="crm-section-title">在线服务清单</h2><p className="crm-section-description">按日期分组在线维护旅游线路、服务项目、服务内容、报价金额和预计成本；所有增删改均记录日志，行程中修改会触发双确认强提醒。</p></div>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline"><ServiceListStatusBadge status={operation.serviceListStatus}/><ChevronDown className="size-4"/></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">{SERVICE_LIST_STATUSES.map((status) => <DropdownMenuItem key={status} onClick={() => run(() => setServiceListStatusAction({ caseId: operation.id, revision: operation.revision, status }), `服务清单已人工标记为${SERVICE_LIST_STATUS_LABELS[status]}`)}>{operation.serviceListStatus === status && <Check className="size-4"/>}{SERVICE_LIST_STATUS_LABELS[status]}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" asChild><a href="/api/operations/service-list-template"><FileSpreadsheet className="size-4"/>下载模板</a></Button>
                <Button onClick={() => serviceListInput.current?.click()}><Upload className="size-4"/>上传服务清单</Button>
                <input ref={serviceListInput} type="file" accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={(event) => previewCostSheet(event.target.files?.[0])}/>
              </div>
            </div>
            {serviceListFile && <a href={`/api/files/${serviceListFile.id}/download`} className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline"><FileText className="size-3"/>当前清单：{serviceListFile.name}</a>}
          </section>

          <section>
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="crm-section-title">逐日清单</h2><p className="crm-section-description">先新增 Day，再在对应日期下增加服务行。</p></div>
            <Button onClick={() => setDay(emptyDay(operation))}><Plus className="size-4"/>新增 Day</Button>
          </div>
          <div className="mt-4 space-y-3">
            {operation.days.map((entry) => (<article key={entry.id} className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/45">
                <header className="flex flex-col gap-3 border-b border-slate-200/70 bg-white px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><Badge>Day {entry.dayNumber}</Badge><h3 className="font-semibold">{entry.city ?? "城市待补充"}</h3><span className="font-mono text-xs text-muted-foreground">{entry.serviceDate ?? "日期待补充"}</span></div>
                    {entry.summary && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{entry.summary}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setItem(emptyItem("daily", entry))}><Plus className="size-3.5"/>添加服务</Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDay(dayDraft(entry))}><Edit3 className="size-4"/></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ kind: "day", id: entry.id, revision: entry.revision, name: `Day ${entry.dayNumber}` })}><Trash2 className="size-4 text-destructive"/></Button>
                  </div>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left">
                    <thead className="bg-slate-100/80 text-xs font-semibold tracking-wide text-slate-500"><tr><th className="px-3 py-2">旅游线路</th><th className="px-3 py-2">服务项目</th><th className="px-3 py-2">服务内容</th><th className="px-3 py-2 text-right">报价金额</th><th className="px-3 py-2 text-right">预计成本</th><th className="px-3 py-2">日期</th><th className="px-3 py-2 text-right">操作</th></tr></thead>
                    <tbody>
                      {(dailyItems.get(entry.id) ?? []).map((service) => renderOnlineServiceRow(service, entry.summary || entry.city || ""))}
                      {!dailyItems.get(entry.id)?.length && <tr><td colSpan={7} className="border-t border-slate-200 bg-white px-4 py-8 text-center text-xs text-muted-foreground">当前 Day 尚无服务项目，点击右上角“添加服务”开始录入</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>))}
            {ungroupedItems.length > 0 && (<article className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/35">
                <header className="border-b border-amber-200 bg-white px-4 py-3"><h3 className="font-semibold text-amber-900">待归入日期的服务</h3><p className="mt-1 text-xs text-amber-700">先新增对应日期的 Day，或修改服务日期。下列项目仍完整保留，可直接在线编辑。</p></header>
                <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-muted text-xs"><tr>{["旅游线路", "服务项目", "服务内容", "报价金额", "预计成本", "日期", "操作"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{ungroupedItems.map(entry => renderOnlineServiceRow(entry, ""))}</tbody></table></div>
              </article>)}
            {!operation.days.length && <div className="crm-empty"><div><MapPin className="mx-auto mb-3 size-8 text-muted-foreground/40"/><p className="font-medium">尚未建立每日服务</p><p className="mt-1 text-xs text-muted-foreground">从 Day 1 开始录入城市、日期和服务细则。</p></div></div>}
          </div>
          </section>

          <section className="mt-7 border-t border-slate-200 pt-6">
            <div className="mb-3"><h3 className="font-semibold text-slate-950">快捷新增服务</h3><p className="mt-1 text-xs text-muted-foreground">酒店与大交通也在同一在线清单维护；每日服务请优先从对应 Day 内新增。</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {(["hotel", "rail", "flight", "driver", "guide", "ticket", "insurance", "meal", "other"] as OperationCategory[]).map((category) => (<Button key={category} variant="outline" className="h-11 justify-start" onClick={() => createService(category)}><Plus className="size-3.5"/>{CATEGORY_LABELS[category]}</Button>))}
            </div>
          </section>

          <section className="mt-7 border-t border-slate-200 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="crm-section-title">酒店预订</h2><p className="crm-section-description">每家酒店或每个供应商建立一条记录，支持分别核算。</p></div>
            <Button onClick={() => setItem(emptyItem("hotel"))}><Plus className="size-4"/>新增酒店</Button>
          </div>
          <div className="space-y-2">{operation.items.filter((entry) => entry.section === "hotel").map(renderServiceRow)}</div>
          {!operation.items.some((entry) => entry.section === "hotel") && <div className="crm-empty"><div><Building2 className="mx-auto mb-3 size-8 text-muted-foreground/40"/><p className="font-medium">尚未录入酒店</p></div></div>}
          </section>

          <section className="mt-7 border-t border-slate-200 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="crm-section-title">大交通</h2><p className="crm-section-description">单独记录国内航班、高铁、火车及其他城际交通。</p></div>
            <Button onClick={() => setItem(emptyItem("transport"))}><Plus className="size-4"/>新增大交通</Button>
          </div>
          <div className="space-y-2">{operation.items.filter((entry) => entry.section === "transport").map(renderServiceRow)}</div>
          {!operation.items.some((entry) => entry.section === "transport") && <div className="crm-empty"><div><Route className="mx-auto mb-3 size-8 text-muted-foreground/40"/><p className="font-medium">尚未录入大交通</p></div></div>}
          </section>
          <div className="mt-7"><OperationChangeHistory key={operation.items.map(i => i.revision).join("-") + operation.days.map(d => d.revision).join("-")} caseId={operation.id} customerId={customer.id}/></div>
        </TabsContent>

        <TabsContent value="checklist" className="m-0 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="crm-section-title">执行清单</h2><p className="crm-section-description">集中处理服务预订状态、倒排检查项和团组联系人；添加服务后会自动生成相应任务。</p></div>
            <Button onClick={() => openCreateReminder()}><BellPlus className="size-4"/>新增提醒</Button>
          </div>

          <section className="mb-6 overflow-hidden rounded-xl border border-slate-200/80">
            <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="font-semibold text-slate-950">服务执行状态</h3><p className="mt-1 text-xs text-muted-foreground">共 {operation.items.length} 项，已确认或无需预订 {progress.finished} 项。</p></div>
              <Badge variant="secondary">完成 {progress.finished}/{progress.total}</Badge>
            </header>
            <div className="space-y-2 bg-slate-50/30 p-3">
              {operation.items.map(renderServiceRow)}
              {!operation.items.length && <div className="bg-white px-4 py-10 text-center text-xs text-muted-foreground">尚未添加服务。可切换到“添加服务”上传清单或手动录入。</div>}
            </div>
          </section>

          <div className="mb-3"><h3 className="font-semibold text-slate-950">倒排检查与提醒</h3><p className="mt-1 text-xs text-muted-foreground">按服务日期或来华日期自动计算，也可人工补充。</p></div>
          <div className="grid gap-3 xl:grid-cols-2">
            {([
            ["datePending", "日期待确认", reminderGroups.datePending, "text-violet-700"],
            ["overdue", "已逾期", reminderGroups.overdue, "text-rose-700"],
            ["today", "今日到期", reminderGroups.today, "text-amber-700"],
            ["upcoming", "即将到期", reminderGroups.upcoming, "text-blue-700"],
            ["completed", "已处理", reminderGroups.completed, "text-slate-600"],
        ] as const).map(([key, label, entries, tone]) => (<section key={key} className="rounded-xl border border-slate-200/80 bg-slate-50/50">
                <header className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3"><h3 className={`font-semibold ${tone}`}>{label}</h3><Badge variant="secondary">{entries.length}</Badge></header>
                <div className="divide-y divide-slate-100">
                  {entries.map((entry) => (<div key={entry.id} className="flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground">{entry.taskKind === "checklist" ? "执行任务" : "提醒内容"}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <p className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-950">{entry.title}</p>
                          {entry.isAuto && <Badge variant="outline">自动</Badge>}
                          {entry.taskKind === "checklist" && <Badge variant="secondary">清单任务</Badge>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{entry.dueDate ?? "日期待确认"}</span>
                          <span>{reminderContext(entry)}</span>
                          {entry.offsetDays != null && <span>提前 {entry.offsetDays} 天</span>}
                          {entry.assigneeName && <span>负责人：{entry.assigneeName}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditReminder(entry)} aria-label={`编辑提醒：${entry.title}`}>
                          <Edit3 className="size-4"/>
                        </Button>
                        {entry.status === "pending" ? (<>
                          <Button variant="outline" size="sm" onClick={() => run(() => updateOperationReminderStatusAction({ caseId: operation.id, reminderId: entry.id, status: "completed" }), "提醒已完成")}><CheckCircle2 className="size-3.5"/>完成</Button>
                          <Button variant="ghost" size="sm" onClick={() => run(() => updateOperationReminderStatusAction({ caseId: operation.id, reminderId: entry.id, status: "ignored" }), "提醒已忽略")}>忽略</Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ kind: "reminder", id: entry.id, name: "提醒" })}><Trash2 className="size-4 text-destructive"/></Button>
                          </>) : <Badge variant="outline">{entry.status === "completed" ? "已完成" : "已忽略"}</Badge>}
                      </div>
                    </div>))}
                  {!entries.length && <div className="bg-white px-4 py-8 text-center text-xs text-muted-foreground">暂无提醒</div>}
                </div>
              </section>))}
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200/80">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3">
              <div><h3 className="font-semibold text-slate-950">团组联系人</h3><p className="mt-1 text-xs text-muted-foreground">记录项目经理、导游、司机和24小时紧急联络方式。</p></div>
              <Button variant="outline" size="sm" onClick={() => setContact(contactDraft())}><Plus className="size-3.5"/>添加联系人</Button>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-white text-muted-foreground"><tr>{["角色", "姓名", "电话 / 联系方式", "关联服务", "备注", "操作"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(operation.contacts ?? []).map((entry) => (<tr key={entry.id}>
                      <td className="px-4 py-3"><Badge variant="secondary">{CONTACT_ROLE_LABELS[entry.role]}</Badge></td>
                      <td className="px-4 py-3 font-semibold">{entry.name}</td>
                      <td className="px-4 py-3">{entry.phone ?? "—"}</td>
                      <td className="px-4 py-3">{operation.items.find((item) => item.id === entry.serviceItemId)?.title ?? "通用"}</td>
                      <td className="max-w-64 whitespace-pre-wrap break-words px-4 py-3 text-muted-foreground">{entry.notes ?? "—"}</td>
                      <td className="px-4 py-3"><div className="flex gap-1"><Button variant="ghost" size="icon-sm" onClick={() => setContact(contactDraft(entry))}><Edit3 className="size-4"/></Button><Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ kind: "contact", id: entry.id, revision: entry.revision, name: `联系人“${entry.name}”` })}><Trash2 className="size-4 text-destructive"/></Button></div></td>
                    </tr>))}
                  {!(operation.contacts ?? []).length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">暂无联系人</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="settlement" className="m-0 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="crm-section-title">结算与毛利</h2>
              <p className="crm-section-description">顶部金额由服务项目自动汇总；可在下表直接打开每项服务填写成本、报价和最终结算。</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button><Plus className="size-4"/>新增费用项目<ChevronDown className="size-4"/></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!operation.days.length} onClick={() => operation.days[0] && setItem(emptyItem("daily", operation.days[0]))}>
                  <CalendarDays className="size-4"/>
                  {operation.days.length ? "新增每日服务费用" : "请先建立 Day"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setItem(emptyItem("hotel"))}>
                  <Hotel className="size-4"/>新增酒店费用
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setItem(emptyItem("transport"))}>
                  <Route className="size-4"/>新增大交通费用
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <FinancialSummary operation={operation}/>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 crm-scrollbar">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-50 text-muted-foreground">
                <tr>
                  {["服务项目", "供应商", "数量", "预计成本", "客户报价", "预计毛利", "供应商最终结算", "客户最终结算", "最终毛利", "操作"].map((entry) => <th key={entry} className="px-3 py-3">{entry}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operation.items.filter((entry) => entry.bookingStatus !== "cancelled").map((entry) => {
            const line = itemFinancials(entry);
            const finalGross = entry.finalSupplierSettlement != null && entry.finalCustomerSettlement != null
                ? entry.finalCustomerSettlement - entry.finalSupplierSettlement
                : null;
            return (<tr key={entry.id}>
                      <td className="whitespace-pre-wrap break-words px-3 py-3 font-medium">{entry.title}</td>
                      <td className="whitespace-pre-wrap break-words px-3 py-3">{entry.supplierName ?? "—"}</td>
                      <td className="px-3 py-3 font-mono">{entry.quantity} {entry.unit}</td>
                      <td className="px-3 py-3 font-mono">{money(line.cost)}</td>
                      <td className="px-3 py-3 font-mono">{money(line.quote)}</td>
                      <td className="px-3 py-3 font-mono">{money(line.grossProfit)}</td>
                      <td className="px-3 py-3 font-mono">{money(entry.finalSupplierSettlement)}</td>
                      <td className="px-3 py-3 font-mono">{money(entry.finalCustomerSettlement)}</td>
                      <td className="px-3 py-3 font-mono">{money(finalGross)}</td>
                      <td className="px-3 py-3">
                        <Button variant="outline" size="sm" onClick={() => setItem(itemDraft(entry))}>
                          <Edit3 className="size-3.5"/>填写 / 编辑
                        </Button>
                      </td>
                    </tr>);
        })}
                {!operation.items.some((entry) => entry.bookingStatus !== "cancelled") && (<tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                      尚无费用项目。点击右上角“新增费用项目”，即可录入成本、客户报价和最终结算。
                    </td>
                  </tr>)}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/70 font-semibold">
                <tr>
                  <td className="px-3 py-3" colSpan={3}>合计</td>
                  <td className="px-3 py-3 font-mono">{money(financial.expectedCost)}</td>
                  <td className="px-3 py-3 font-mono">{money(financial.expectedRevenue)}</td>
                  <td className="px-3 py-3 font-mono">{money(financial.expectedGrossProfit)}</td>
                  <td className="px-3 py-3 font-mono">{money(financial.finalCost)}</td>
                  <td className="px-3 py-3 font-mono">{money(financial.finalRevenue)}</td>
                  <td className="px-3 py-3 font-mono">{money(financial.finalGrossProfit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="m-0 p-5">
          <FinanceWorkbench claims={claims} operations={[{ id: operation.id, customerName: operation.customerName, ownerName: operation.ownerName, items: operation.items.map((entry) => ({ id: entry.id, title: entry.title, category: entry.category, supplierName: entry.supplierName, serviceDate: entry.serviceDate, bookingStatus: entry.bookingStatus, finalSupplierSettlement: entry.finalSupplierSettlement, invoiceUnitCost: entry.invoiceUnitCost, quantity: entry.quantity })) }]}/>
        </TabsContent>

        <TabsContent value="files" className="m-0 p-5">
          <FileManager customer={customer}/>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(costSheetPreview)} onOpenChange={(open) => !open && setCostSheetPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl crm-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary"/>
              确认导入服务清单
            </DialogTitle>
            <DialogDescription>
              原文件已安全上传。系统将在确认后写入每日服务、酒店和大交通；最终结算、酒店离店及班次信息保持空白。
            </DialogDescription>
          </DialogHeader>
          {costSheetPreview && (<div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                ["文件客户", costSheetPreview.preview.clientLabel ?? "未识别"],
                ["行程日期", `${costSheetPreview.preview.travelStartDate} 至 ${costSheetPreview.preview.travelEndDate}`],
                ["Day / 项目", `${costSheetPreview.preview.days.length} Day · ${costSheetPreview.preview.items.length} 项`],
                ["分类结果", `${costSheetPreview.preview.counts.daily} 每日 · ${costSheetPreview.preview.counts.hotel} 酒店 · ${costSheetPreview.preview.counts.transport} 大交通`],
            ].map(([label, value]) => (<div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <p className="crm-label">{label}</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">{value}</p>
                  </div>))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                ["预计成本", money(costSheetPreview.preview.totals.cost)],
                ["客户报价", money(costSheetPreview.preview.totals.quote)],
                ["预计毛利", money(costSheetPreview.preview.totals.grossProfit)],
            ].map(([label, value]) => (<div key={label} className="rounded-xl border border-blue-100 bg-blue-50/35 p-3">
                    <p className="crm-label">{label}</p>
                    <p className="mt-1.5 font-mono text-lg font-semibold text-slate-950">{value}</p>
                  </div>))}
              </div>

              {(costSheetPreview.hasPreviousImport || costSheetPreview.preview.warnings.length > 0) && (<div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
                  {costSheetPreview.hasPreviousImport && (<p className="flex items-start gap-2 font-medium">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0"/>
                      确认后会替换上一次自动导入的明细；已经人工编辑并保存过的项目会保留。
                    </p>)}
                  {costSheetPreview.preview.warnings.map((warning) => (<p key={warning} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0"/>
                      {warning}
                    </p>))}
                </div>)}
              {costSheetPreview.preview.unmatchedLines?.length ? (<div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-xs text-rose-900">
                  <p className="font-semibold">待处理内容（系统未静默丢弃）</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">{costSheetPreview.preview.unmatchedLines.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>
                </div>) : null}

              <div className="overflow-x-auto rounded-xl border border-slate-200 crm-scrollbar">
                <table className="w-full min-w-[1120px] text-left text-xs">
                  <thead className="bg-slate-50 text-muted-foreground">
                    <tr>
                      {["日期", "城市", "归入", "类型", "项目", "供应商", "数量", "成本单价", "报价单价", "成本小计", "报价小计"].map((label) => (<th key={label} className="px-3 py-2.5">{label}</th>))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {costSheetPreview.preview.items.map((entry) => (<tr key={entry.rowKey}>
                        <td className="px-3 py-2.5"><Input type="date" value={entry.serviceDate} onChange={(event) => updatePreviewItem(entry.rowKey, { serviceDate: event.target.value })} className="h-8 w-32 text-xs"/></td>
                        <td className="px-3 py-2.5"><Input value={entry.city ?? ""} onChange={(event) => updatePreviewItem(entry.rowKey, { city: event.target.value })} className="h-8 w-24 text-xs"/></td>
                        <td className="px-3 py-2.5">
                          {entry.section === "daily" ? `Day ${entry.dayNumber}` : entry.section === "hotel" ? "酒店" : "大交通"}
                        </td>
                        <td className="px-3 py-2.5"><Select value={entry.category} onValueChange={(value) => updatePreviewItem(entry.rowKey, { category: value as OperationCategory })}><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></td>
                        <td className="px-3 py-2.5"><Input value={entry.title} onChange={(event) => updatePreviewItem(entry.rowKey, { title: event.target.value })} className="h-8 min-w-40 text-xs"/></td>
                        <td className="px-3 py-2.5"><Input value={entry.supplierName ?? ""} onChange={(event) => updatePreviewItem(entry.rowKey, { supplierName: event.target.value })} className="h-8 min-w-32 text-xs"/></td>
                        <td className="px-3 py-2.5"><div className="flex gap-1"><Input type="number" min={0.01} value={entry.quantity} onChange={(event) => updatePreviewItem(entry.rowKey, { quantity: Number(event.target.value) })} className="h-8 w-20 text-xs"/><Input value={entry.unit} onChange={(event) => updatePreviewItem(entry.rowKey, { unit: event.target.value })} className="h-8 w-20 text-xs"/></div></td>
                        <td className="px-3 py-2.5"><Input type="number" min={0} step="0.01" value={entry.invoiceUnitCost} onChange={(event) => updatePreviewItem(entry.rowKey, { invoiceUnitCost: Number(event.target.value) })} className="h-8 w-24 text-xs"/></td>
                        <td className="px-3 py-2.5"><Input type="number" min={0} step="0.01" value={entry.customerUnitQuote} onChange={(event) => updatePreviewItem(entry.rowKey, { customerUnitQuote: Number(event.target.value) })} className="h-8 w-24 text-xs"/></td>
                        <td className="px-3 py-2.5 font-mono">{money(entry.quantity * entry.invoiceUnitCost)}</td>
                        <td className="px-3 py-2.5 font-mono">{money(entry.quantity * entry.customerUnitQuote)}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </div>)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostSheetPreview(null)} disabled={pending}>
              暂不导入
            </Button>
            <Button onClick={confirmCostSheetImport} disabled={pending}>
              {pending ? "正在导入…" : "确认导入明细"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(day)} onOpenChange={(open) => !open && setDay(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{day?.id ? "编辑每日服务" : "新增每日服务"}</DialogTitle><DialogDescription>设置 Day、日期、城市和当天整体服务说明。</DialogDescription></DialogHeader>
          {day && <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Day 序号"><Input type="number" min={1} value={day.dayNumber} onChange={(event) => setDay({ ...day, dayNumber: event.target.value })}/></Field>
            <Field label="服务日期"><Input type="date" value={day.serviceDate} onChange={(event) => setDay({ ...day, serviceDate: event.target.value })}/></Field>
            <Field label="城市"><MultilineInput value={day.city} onChange={(event) => setDay({ ...day, city: event.target.value })}/></Field>
            <Field label="当天行程说明" className="sm:col-span-3"><Textarea value={day.summary} onChange={(event) => setDay({ ...day, summary: event.target.value })} placeholder="例如：天安门、故宫、景山公园"/></Field>
            <Field label="内部备注" className="sm:col-span-3"><Textarea value={day.notes} onChange={(event) => setDay({ ...day, notes: event.target.value })}/></Field>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setDay(null)}>取消</Button><Button onClick={saveDay} disabled={pending}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(item)} onOpenChange={(open) => !open && closeItem()}>
        <SheetContent data-service-dirty={Boolean(item && JSON.stringify(item) !== itemBaseline)} className="w-full overflow-y-auto p-6 sm:max-w-3xl crm-scrollbar">
          <SheetHeader><SheetTitle>{item?.id ? "编辑服务项目" : "新增服务项目"}</SheetTitle><SheetDescription>每条记录对应一个供应商；同类服务有多个供应商时分别新增。</SheetDescription></SheetHeader>
          {item && <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {item.section === "daily" && <Field label="所属 Day"><Select value={item.dayId} onValueChange={(value) => { const selected = operation.days.find((entry) => entry.id === value); setItem({ ...item, dayId: value, city: item.city || selected?.city || "", serviceDate: item.serviceDate || selected?.serviceDate || "" }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operation.days.map((entry) => <SelectItem key={entry.id} value={entry.id}>Day {entry.dayNumber} · {entry.city ?? "未填城市"}</SelectItem>)}</SelectContent></Select></Field>}
              <Field label="服务类型">
                <Select value={item.category} onValueChange={(value) => setItem({ ...item, category: value as OperationCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(item.section === "daily" ? ["guide", "driver", "ticket", "meal", "insurance", "other"] : item.section === "hotel" ? ["hotel"] : ["flight", "rail", "other_transport"]).map((value) => <SelectItem key={value} value={value}>{CATEGORY_LABELS[value as OperationCategory]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="服务名称" className={item.section === "daily" ? "lg:col-span-2" : "lg:col-span-3"}><MultilineInput value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} placeholder={item.section === "hotel" ? "酒店名称" : item.section === "transport" ? "车次或航段名称" : "例如：故宫门票"}/></Field>
              <Field label="城市"><MultilineInput value={item.city} onChange={(event) => setItem({ ...item, city: event.target.value })}/></Field>
              <Field label="服务日期"><Input type="date" value={item.serviceDate} onChange={(event) => setItem({ ...item, serviceDate: event.target.value })}/></Field>
              <Field label="预订状态"><Select value={item.bookingStatus} onValueChange={(value) => setItem({ ...item, bookingStatus: value as BookingStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BOOKING_STATUSES.map((value) => <SelectItem key={value} value={value}>{BOOKING_STATUS_LABELS[value]}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="供应商"><MultilineInput value={item.supplierName} onChange={(event) => setItem({ ...item, supplierName: event.target.value })}/></Field>
            </div>

            {item.section === "hotel" && <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="入住日期"><Input type="date" value={item.checkInDate} onChange={(event) => setItem({ ...item, checkInDate: event.target.value, serviceDate: event.target.value })}/></Field>
              <Field label="离店日期"><Input type="date" value={item.checkOutDate} onChange={(event) => setItem({ ...item, checkOutDate: event.target.value })}/></Field>
              <Field label="房型"><MultilineInput value={item.roomType} onChange={(event) => setItem({ ...item, roomType: event.target.value })}/></Field>
              <Field label="间数"><Input type="number" min={1} value={item.roomCount} onChange={(event) => setItem({ ...item, roomCount: event.target.value })}/></Field>
              <Field label="晚数"><Input type="number" min={1} value={item.nightCount} onChange={(event) => setItem({ ...item, nightCount: event.target.value })}/></Field>
            </div>}

            {item.section === "transport" && <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="交通类型"><MultilineInput value={item.transportType} onChange={(event) => setItem({ ...item, transportType: event.target.value })} placeholder="如：高铁一等座"/></Field>
              <Field label="出发地"><MultilineInput value={item.origin} onChange={(event) => setItem({ ...item, origin: event.target.value })}/></Field>
              <Field label="到达地"><MultilineInput value={item.destination} onChange={(event) => setItem({ ...item, destination: event.target.value })}/></Field>
              <Field label="航班号 / 车次"><MultilineInput value={item.referenceNumber} onChange={(event) => setItem({ ...item, referenceNumber: event.target.value })}/></Field>
              <Field label="出发时间"><Input type="time" value={item.departureTime} onChange={(event) => setItem({ ...item, departureTime: event.target.value })}/></Field>
            </div>}

            <Field label="服务细则"><Textarea value={item.details} onChange={(event) => setItem({ ...item, details: event.target.value })} placeholder="填写具体服务范围、人数、使用时间或预订要求"/></Field>

            <div className="grid gap-4 rounded-xl border border-blue-100 bg-blue-50/35 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="数量"><Input type="number" min={0.01} step="0.01" value={item.quantity} onChange={(event) => setItem({ ...item, quantity: event.target.value })}/></Field>
              <Field label="单位"><MultilineInput value={item.unit} onChange={(event) => setItem({ ...item, unit: event.target.value })}/></Field>
              <Field label="成本单价"><Input type="number" min={0} step="0.01" value={item.invoiceUnitCost} onChange={(event) => setItem({ ...item, invoiceUnitCost: event.target.value })}/></Field>
              <Field label="客户报价单价"><Input type="number" min={0} step="0.01" value={item.customerUnitQuote} onChange={(event) => setItem({ ...item, customerUnitQuote: event.target.value })}/></Field>
              <Field label="供应商最终结算价"><Input type="number" min={0} step="0.01" value={item.finalSupplierSettlement} onChange={(event) => setItem({ ...item, finalSupplierSettlement: event.target.value })}/></Field>
              <Field label="客户最终结算价"><Input type="number" min={0} step="0.01" value={item.finalCustomerSettlement} onChange={(event) => setItem({ ...item, finalCustomerSettlement: event.target.value })}/></Field>
              <Field label="确认附件（可选）"><Select value={item.confirmationFileId || "none"} onValueChange={(value) => setItem({ ...item, confirmationFileId: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择</SelectItem>{operation.files.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="发票附件"><Select value={item.invoiceFileId || "none"} onValueChange={(value) => setItem({ ...item, invoiceFileId: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择</SelectItem>{operation.files.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}</SelectContent></Select></Field>
            </div>
            <Field label="备注"><Textarea value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })}/></Field>
          </div>}
          <SheetFooter><Button variant="outline" onClick={closeItem} disabled={pending}>取消</Button><Button onClick={saveItem} disabled={pending || !item?.title.trim()}>保存</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(contact)} onOpenChange={(open) => !open && setContact(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{contact?.id ? "编辑联系人" : "添加联系人"}</DialogTitle><DialogDescription>联系人会显示在本团执行清单中，可关联到具体服务。</DialogDescription></DialogHeader>
          {contact && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="联系人角色">
              <Select value={contact.role} onValueChange={(value) => setContact({ ...contact, role: value as OperationContactRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="姓名 *"><Input value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })}/></Field>
            <Field label="电话 / 联系方式"><Input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} placeholder="手机号、WhatsApp 或微信"/></Field>
            <Field label="关联服务">
              <Select value={contact.serviceItemId || "none"} onValueChange={(value) => setContact({ ...contact, serviceItemId: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">通用联系人</SelectItem>{operation.items.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.title}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="备注" className="sm:col-span-2"><Textarea value={contact.notes} onChange={(event) => setContact({ ...contact, notes: event.target.value })} placeholder="语种、值班时间、集合地点等"/></Field>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setContact(null)}>取消</Button><Button onClick={saveContact} disabled={pending || !contact?.name.trim()}>保存联系人</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reminderId ? "编辑提醒" : "新增提醒"}</DialogTitle>
            <DialogDescription>支持固定日期、来华日期前提醒，以及按具体服务日期提前提醒。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="提醒内容">
              <MultilineInput value={reminderTitle} onChange={(event) => {
            setReminderTitle(event.target.value);
            setReminderError("");
        }} placeholder="填写需要提醒处理的事项"/>
            </Field>
            <Field label="提醒类型">
              <Select value={reminderMode} onValueChange={(value) => changeReminderMode(value as typeof reminderMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">通用固定日期提醒</SelectItem>
                  <SelectItem value="arrival">来华日期前提醒</SelectItem>
                  <SelectItem value="service">关联具体服务提醒</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="负责人">
              <Select value={reminderAssigneeId || "none"} onValueChange={(value) => setReminderAssigneeId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不指派</SelectItem>
                  {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.displayName} · 规划师</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {reminderMode === "service" && (<Field label="关联服务">
                <Select value={reminderServiceId || "none"} onValueChange={(value) => {
                setReminderServiceId(value === "none" ? "" : value);
                setReminderError("");
            }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择服务项目</SelectItem>
                    {operation.items.filter((entry) => entry.serviceDate).map((entry) => (<SelectItem key={entry.id} value={entry.id}>{entry.serviceDate} · {entry.title}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>)}
            {reminderMode === "fixed" ? (<Field label="提醒日期">
                <Input type="date" value={reminderDueDate} onChange={(event) => {
                setReminderDueDate(event.target.value);
                setReminderError("");
            }}/>
              </Field>) : (<Field label="提前天数">
                <div className="relative">
                  <Input type="number" min={0} value={reminderOffset} onChange={(event) => setReminderDays(event.target.value)} className="pr-12" placeholder="可填写任意提前天数"/>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">天前</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(reminderMode === "arrival" ? ["7", "15", "30"] : ["1", "3", "7", "15"]).map((value) => (<Button key={value} type="button" variant="outline" size="xs" onClick={() => setReminderDays(value)}>
                      提前 {value} 天
                    </Button>))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {calculatedReminderDate
                ? `提醒日期：${calculatedReminderDate}`
                : reminderMode === "arrival"
                    ? "请先在计调基本信息中保存来华日期。"
                    : "请选择带有服务日期的服务项目。"}
                </p>
              </Field>)}
          </div>
          {reminderError && <p className="text-xs font-medium text-destructive">{reminderError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderOpen(false)}>取消</Button>
            <Button onClick={saveReminder} disabled={pending}>
              {reminderId ? "保存修改" : "创建提醒"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除{deleteTarget?.name}？</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.kind === "day" ? "删除 Day 会同时删除其服务项目和关联提醒，此操作不可撤销。" : "删除后无法恢复，请确认不再需要这条记录。"}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={pending}>确认删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={urgentPriorityOpen} onOpenChange={setUrgentPriorityOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认将客户优先级改为“紧急”？</AlertDialogTitle>
            <AlertDialogDescription>该修改会同步到客户资料，并影响规划师工作台排序。请确认确实需要紧急处理。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setUrgentPriorityOpen(false); saveCaseConfirmed(true); }} disabled={pending}>确认改为紧急</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
