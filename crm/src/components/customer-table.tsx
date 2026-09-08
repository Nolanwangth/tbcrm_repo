"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ColumnDef, type ColumnFiltersState, type PaginationState, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, } from "@tanstack/react-table";
import { format, formatDistanceToNowStrict, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowDownAZ, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Download, Plus, RotateCcw, Search, Siren, SlidersHorizontal, Sparkles, Trash2, UsersRound, X, } from "lucide-react";
import { toast } from "sonner";
import { changeCustomerStatusAction, updateCustomerExpectedAmountAction, updateCustomerControlAction, updatePlanningProgressAction, } from "@/app/actions/customer-actions";
import { CommunicationBadge, PriorityBadge, StatusBadge } from "@/components/customer-badges";
import { StatCard } from "@/components/stat-card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AMOUNT_RANGES, BUSINESS_STAGES, CLOSE_REASONS, COMMUNICATION_STATUSES, ITINERARY_STATUSES, PRIORITIES, PROFILES, QUOTATION_STATUSES, SOURCES, WHATSAPP_STATUSES, } from "@/lib/constants";
import { planningRequestRequired } from "@/lib/planning";
import { businessDateKey } from "@/lib/business-time";
import { downloadCustomerExport } from "@/lib/download-customer-export";
import type { Customer } from "@/lib/types";
import { expectedAmountSchema } from "@/lib/validators";
type Scope = "all" | "won" | "closed";
function dateTime(value?: string | null) {
    if (!value)
        return "—";
    return format(new Date(value), "yyyy-MM-dd HH:mm");
}
function todayChinaDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}
function timeAgo(value?: string | null) {
    if (!value)
        return "尚未跟进";
    return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: zhCN });
}
function priorityRank(value: Customer["priority"]) {
    return { "需立即处理": 5, 紧急: 4, 高: 3, 中: 2, 低: 1 }[value];
}
function customerDetailHref(customerId: string, returnHref: string) {
    return `/customers/${customerId}?${new URLSearchParams({ returnTo: returnHref })}`;
}
type PendingBulk = {
    action: "won" | "close" | "recover" | "delete" | "priority" | "communication" | "whatsapp" | "itinerary" | "quotation";
    value?: string;
    title: string;
    description: string;
} | null;
function ExpectedAmountCell({ customer }: {
    customer: Customer;
}) {
    const router = useRouter();
    const [value, setValue] = useState("");
    const [isSaving, startSaving] = useTransition();
    const [error, setError] = useState("");
    const currentAmount = customer.expectedAmount ?? 0;
    if (currentAmount > 0) {
        return <span className="font-mono tabular-nums">¥{currentAmount.toLocaleString("zh-CN")}</span>;
    }
    return (<form className="flex min-w-[260px] items-start gap-1.5" onSubmit={(event) => {
            event.preventDefault();
            const parsed = expectedAmountSchema.safeParse(Number(value));
            if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "预计金额格式不正确");
                return;
            }
            setError("");
            startSaving(async () => {
                const result = await updateCustomerExpectedAmountAction({
                    customerId: customer.id,
                    expectedAmount: parsed.data,
                });
                if (result.ok) {
                    toast.success(`已补充 ${customer.name} 的预计金额`);
                    router.refresh();
                }
                else {
                    setError(result.error);
                    toast.error(result.error);
                }
            });
        }}>
      <div>
      <Input type="number" min={1} max={999999999999} step={1} inputMode="numeric" value={value} onChange={(event) => {
            setValue(event.target.value);
            if (error)
                setError("");
        }} placeholder="补充金额" aria-label={`补充 ${customer.name} 的预计金额`} aria-invalid={Boolean(error)} aria-describedby={error ? `expected-amount-error-${customer.id}` : undefined} className="h-8 w-28 font-mono text-[12px]"/>
      {error && <p id={`expected-amount-error-${customer.id}`} className="mt-1 max-w-36 whitespace-normal text-[10px] leading-4 text-destructive">{error}</p>}
      </div>
      <Button type="submit" size="sm" className="h-8 px-2.5" disabled={isSaving || !value || Number(value) <= 0} aria-label={`保存 ${customer.name} 的预计金额`}>
        {isSaving ? "保存中" : "保存"}
      </Button>
    </form>);
}
export function CustomerTable({ initialCustomers, scope, }: {
    initialCustomers: Customer[];
    scope: Scope;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [inquiryFrom, setInquiryFrom] = useState(searchParams.get("inquiryFrom") ?? "");
    const [inquiryTo, setInquiryTo] = useState(searchParams.get("inquiryTo") ?? "");
    const [wonFrom, setWonFrom] = useState("");
    const [wonTo, setWonTo] = useState("");
    const data = useMemo(() => initialCustomers.filter((customer) => {
        const rangeDate = scope === "won" ? customer.travelNeed.expectedStartDate ?? "" : businessDateKey(customer.firstInquiryAt);
        const wonDate = customer.wonAt ? businessDateKey(customer.wonAt) : "";
        return (!inquiryFrom || rangeDate >= inquiryFrom) && (!inquiryTo || rangeDate <= inquiryTo) && (!wonFrom || wonDate >= wonFrom) && (!wonTo || wonDate <= wonTo);
    }), [initialCustomers, inquiryFrom, inquiryTo, scope, wonFrom, wonTo]);
    const [sorting, setSorting] = useState<SortingState>(() => {
        return [{ id: "updatedAt", desc: true }];
    });
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => ["source", "priority", "serviceWorkbench", "fileStatus", "communicationStatus", "whatsappStatus", "profile", "amountRange", "expectedAmount", "status", "businessStage", "itineraryStatus", "quotationStatus"]
        .map((id) => ({ id, value: searchParams.get(id) ?? "" }))
        .filter((filter) => filter.value));
    const [globalFilter, setGlobalFilter] = useState(searchParams.get("q") ?? "");
    const [pagination, setPagination] = useState<PaginationState>(() => {
        const requestedPageSize = Number(searchParams.get("pageSize"));
        const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 10;
        const requestedPage = Number(searchParams.get("page"));
        return {
            pageIndex: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0,
            pageSize,
        };
    });
    const [rowSelection, setRowSelection] = useState({});
    const [pendingBulk, setPendingBulk] = useState<PendingBulk>(null);
    const [bulkRequirement, setBulkRequirement] = useState("");
    const [bulkWonAmount, setBulkWonAmount] = useState("");
    const [bulkWonDate, setBulkWonDate] = useState(todayChinaDate());
    const [isExporting, setIsExporting] = useState(false);
    const [isPending, startTransition] = useTransition();
    function customerListHref(nextSearch = globalFilter, nextFilters = columnFilters, nextInquiryFrom = inquiryFrom, nextInquiryTo = inquiryTo, nextPagination = pagination) {
        const params = new URLSearchParams();
        if (nextSearch)
            params.set("q", nextSearch);
        if (nextInquiryFrom)
            params.set("inquiryFrom", nextInquiryFrom);
        if (nextInquiryTo)
            params.set("inquiryTo", nextInquiryTo);
        nextFilters.forEach((filter) => {
            if (filter.value)
                params.set(filter.id, String(filter.value));
        });
        if (nextPagination.pageIndex > 0)
            params.set("page", String(nextPagination.pageIndex + 1));
        if (nextPagination.pageSize !== 10)
            params.set("pageSize", String(nextPagination.pageSize));
        return `${pathname}${params.size ? `?${params}` : ""}`;
    }
    function syncUrl(nextSearch = globalFilter, nextFilters = columnFilters, nextInquiryFrom = inquiryFrom, nextInquiryTo = inquiryTo, nextPagination = pagination) {
        window.history.replaceState(null, "", customerListHref(nextSearch, nextFilters, nextInquiryFrom, nextInquiryTo, nextPagination));
    }
    function resetPage() {
        const next = { ...pagination, pageIndex: 0 };
        setPagination(next);
        return next;
    }
    function setFilter(id: string, value: string) {
        const next = [...columnFilters.filter((item) => item.id !== id), ...(value && value !== "all" ? [{ id, value }] : [])];
        setColumnFilters(next);
        syncUrl(globalFilter, next, inquiryFrom, inquiryTo, resetPage());
    }
    const returnHref = customerListHref();
    const expectedAmountSupplementMode = scope === "all" && columnFilters.some((filter) => filter.id === "expectedAmount" && filter.value === "待补充");
    const columns = useMemo<ColumnDef<Customer>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (<Checkbox checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")} onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))} aria-label="选择当前页"/>),
            cell: ({ row }) => (<Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(Boolean(value))} aria-label={`选择 ${row.original.name}`}/>),
            enableSorting: false,
        },
        {
            accessorKey: "name",
            header: "客户名称",
            cell: ({ row }) => (<Link href={customerDetailHref(row.original.id, returnHref)} className="font-medium text-slate-900 hover:text-primary hover:underline">
            {row.original.name}
          </Link>),
        },
        {
            accessorKey: "priority",
            header: "优先级",
            sortingFn: (a, b) => priorityRank(a.original.priority) - priorityRank(b.original.priority),
            cell: ({ row }) => <PriorityBadge priority={row.original.priority}/>,
        },
        {
            accessorKey: "serviceWorkbench",
            header: "规划师归属",
            cell: ({ row }) => row.original.serviceWorkbench ? `规划师 ${row.original.serviceWorkbench}` : "待分配",
        },
        {
            id: "travelStart",
            accessorFn: (row) => row.travelNeed.expectedStartDate ?? "",
            header: "行程开始日期",
            cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.travelNeed.expectedStartDate ?? "—"}</span>,
        },
        {
            accessorKey: "communicationStatus",
            header: "沟通状态",
            cell: ({ row }) => <CommunicationBadge status={row.original.communicationStatus}/>,
        },
        {
            accessorKey: "businessStage",
            header: "业务阶段",
            cell: ({ row }) => <StatusBadge status={row.original.businessStage}/>,
        },
        {
            accessorKey: "itineraryStatus",
            header: "行程状态",
            cell: ({ row }) => <StatusBadge status={row.original.itineraryStatus}/>,
        },
        {
            accessorKey: "quotationStatus",
            header: "报价状态",
            cell: ({ row }) => <StatusBadge status={row.original.quotationStatus}/>,
        },
        { accessorKey: "source", header: "来源渠道" },
        {
            accessorKey: "whatsappStatus",
            header: "沟通方式",
            cell: ({ row }) => <StatusBadge status={row.original.whatsappStatus}/>,
        },
        { accessorKey: "profile", header: "客户画像" },
        {
            accessorKey: "amountRange",
            header: "金额区间",
            cell: ({ row }) => row.original.amountRange ?? "—",
        },
        {
            accessorKey: "expectedAmount",
            header: "预计金额",
            filterFn: (row, _columnId, value) => value === "待补充" ? (row.original.expectedAmount ?? 0) <= 0 : (row.original.expectedAmount ?? 0) > 0,
            cell: ({ row }) => <ExpectedAmountCell customer={row.original}/>,
        },
        {
            accessorKey: "wonAmount",
            header: "成交金额",
            cell: ({ row }) => (<span className="font-mono font-medium tabular-nums text-slate-800">
            {row.original.wonAmount == null ? "—" : `¥${row.original.wonAmount.toLocaleString("zh-CN")}`}
          </span>),
        },
        {
            accessorKey: "wonAt",
            header: "成交日期",
            cell: ({ row }) => (<span className="font-mono text-[11px]">
            {row.original.wonAt
                    ? new Intl.DateTimeFormat("en-CA", {
                        timeZone: "Asia/Shanghai",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    }).format(new Date(row.original.wonAt))
                    : "—"}
          </span>),
        },
        {
            id: "fileStatus",
            accessorFn: (row) => row.documentStatus?.contract && row.documentStatus?.proformaInvoice ? "已上传" : "未上传",
            header: "文件状态",
            cell: ({ row }) => <span className={row.original.documentStatus?.contract && row.original.documentStatus?.proformaInvoice ? "text-emerald-700" : "text-amber-700"}>合同{row.original.documentStatus?.contract ? "✓" : "○"} · PI{row.original.documentStatus?.proformaInvoice ? "✓" : "○"}</span>,
        },
        {
            accessorKey: "firstInquiryAt",
            header: "首次询单时间",
            cell: ({ row }) => <span className="font-mono text-[11px]">{dateTime(row.original.firstInquiryAt)}</span>,
        },
        {
            accessorKey: "latestFollowUpAt",
            header: "最近跟进时间",
            cell: ({ row }) => <span className="font-mono text-[11px]">{dateTime(row.original.latestFollowUpAt)}</span>,
        },
        {
            id: "sinceLastFollowUp",
            header: "距离上次跟进",
            accessorFn: (row) => row.latestFollowUpAt,
            cell: ({ row }) => timeAgo(row.original.latestFollowUpAt),
        },
        {
            accessorKey: "latestFollowUpSummary",
            header: "最新跟进总结",
            cell: ({ row }) => (<span className="block max-w-[240px] truncate text-muted-foreground 2xl:max-w-[320px]" title={row.original.latestFollowUpSummary ?? ""}>
            {row.original.latestFollowUpSummary ?? "尚无跟进记录"}
          </span>),
        },
        {
            accessorKey: "status",
            header: "客户状态",
            cell: ({ row }) => <StatusBadge status={row.original.status}/>,
        },
        {
            accessorKey: "updatedAt",
            header: "最近更新时间",
            cell: ({ row }) => <span className="font-mono text-[11px]">{dateTime(row.original.updatedAt)}</span>,
        },
        {
            id: "actions",
            header: "操作",
            cell: ({ row }) => (<Button variant="link" size="sm" asChild className="h-auto px-0 text-[12px]">
            <Link href={customerDetailHref(row.original.id, returnHref)}>{scope === "won" ? "打开客户档案" : "查看"}</Link>
          </Button>),
        },
    ], [returnHref, scope]);
    const visibleColumns = useMemo(() => {
        const hidden: Record<string, boolean> = { wonAmount: false, wonAt: false };
        if (expectedAmountSupplementMode) {
            const visible = new Set(["name", "expectedAmount", "firstInquiryAt", "actions"]);
            for (const column of columns) {
                const id = column.id ?? ("accessorKey" in column ? String(column.accessorKey) : "");
                if (id && !visible.has(id))
                    hidden[id] = false;
            }
            return hidden;
        }
        hidden.sinceLastFollowUp = false;
        if (scope !== "all")
            hidden.status = false;
        if (scope === "won") {
            const visible = new Set(["name", "serviceWorkbench", "priority", "travelStart", "wonAmount", "wonAt", "fileStatus", "actions"]);
            for (const column of columns) {
                const id = column.id ?? ("accessorKey" in column ? String(column.accessorKey) : "");
                if (id)
                    hidden[id] = visible.has(id);
            }
        }
        return hidden;
    }, [columns, expectedAmountSupplementMode, scope]);
    const table = useReactTable({
        data,
        columns,
        state: { sorting, columnFilters, globalFilter, rowSelection, columnVisibility: visibleColumns, pagination, columnOrder: scope === "won" ? ["select", "name", "serviceWorkbench", "priority", "travelStart", "wonAmount", "wonAt", "fileStatus", "actions"] : [] },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: (updater) => {
            const next = typeof updater === "function" ? updater(pagination) : updater;
            setPagination(next);
            syncUrl(globalFilter, columnFilters, inquiryFrom, inquiryTo, next);
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getRowId: (row) => row.id,
        globalFilterFn: (row, _columnId, filterValue) => {
            const query = String(filterValue).trim().toLowerCase();
            return [row.original.name, row.original.contact ?? "", row.original.sourceDetail ?? ""]
                .some((value) => value.toLowerCase().includes(query));
        },
    });
    const filteredRows = table.getFilteredRowModel().rows;
    const urgentCount = filteredRows.filter((row) => row.original.priority === "紧急" || row.original.priority === "需立即处理").length;
    const todayCount = filteredRows.filter((row) => isToday(new Date(row.original.createdAt))).length;
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
    async function exportCustomers() {
        const exportIds = selectedIds.length
            ? selectedIds
            : filteredRows.map((row) => row.original.id);
        if (!exportIds.length) {
            toast.error("当前没有可导出的客户");
            return;
        }
        setIsExporting(true);
        try {
            await downloadCustomerExport(exportIds);
            toast.success(selectedIds.length
                ? `已导出选中的 ${exportIds.length} 位客户`
                : `已导出当前筛选的 ${exportIds.length} 位客户`);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试");
        }
        finally {
            setIsExporting(false);
        }
    }
    function queueBulk(action: NonNullable<PendingBulk>["action"], value?: string) {
        if (!selectedIds.length) {
            toast.error("请先选择客户");
            return;
        }
        const labels = {
            won: "批量确认成交",
            close: "批量移入无效池",
            recover: "批量恢复客户",
            delete: "批量彻底删除",
            priority: "批量修改优先级",
            communication: "批量修改沟通状态",
            whatsapp: "批量修改沟通方式",
            itinerary: "批量修改行程状态",
            quotation: "批量修改报价状态",
        };
        setPendingBulk({
            action,
            value,
            title: action === "priority" && value === "紧急" ? "确认批量改为紧急？" : labels[action],
            description: action === "priority" && value === "紧急"
                ? `将把已选择的 ${selectedIds.length} 位客户优先级改为紧急，并影响规划师工作台排序。此操作会写入修改历史，请再次确认。`
                : `将对已选择的 ${selectedIds.length} 位客户执行此操作。此操作会写入修改历史，请确认。`,
        });
        setBulkRequirement("");
        setBulkWonAmount("");
        if (action === "won")
            setBulkWonDate(todayChinaDate());
    }
    function runBulk() {
        if (!pendingBulk)
            return;
        const selected = [...selectedIds];
        startTransition(async () => {
            let result;
            if (pendingBulk.action === "itinerary" || pendingBulk.action === "quotation") {
                result = await updatePlanningProgressAction({
                    customerIds: selected,
                    requestType: pendingBulk.action,
                    status: pendingBulk.value as Customer["itineraryStatus"] & Customer["quotationStatus"],
                    content: bulkRequirement,
                });
            }
            else if (["priority", "communication", "whatsapp"].includes(pendingBulk.action)) {
                const field = pendingBulk.action === "priority"
                    ? "priority"
                    : pendingBulk.action === "communication"
                        ? "communication_status"
                        : "whatsapp_status";
                const results = await Promise.all(selected.map((customerId) => updateCustomerControlAction({
                    customerId,
                    field,
                    value: pendingBulk.value as Customer["priority"] & Customer["communicationStatus"] & Customer["whatsappStatus"],
                    confirmUrgent: field === "priority" && pendingBulk.value === "紧急",
                })));
                result = results.find((item) => !item.ok) ?? { ok: true as const };
            }
            else {
                const statusAction = pendingBulk.action as "won" | "close" | "recover" | "delete";
                result = await changeCustomerStatusAction({
                    customerIds: selected,
                    action: statusAction,
                    closeReason: statusAction === "close" ? pendingBulk.value : undefined,
                    deleteReason: statusAction === "delete" ? pendingBulk.value : undefined,
                    priority: "中",
                    communicationStatus: "待首次跟进",
                    wonAmount: statusAction === "won" ? Number(bulkWonAmount) : undefined,
                    wonDate: statusAction === "won" ? bulkWonDate : undefined,
                });
            }
            if (result.ok) {
                toast.success("批量操作已完成");
                setRowSelection({});
                router.refresh();
            }
            else
                toast.error(result.error);
            setPendingBulk(null);
        });
    }
    const filters = [
        { id: "status", label: "客户状态", values: ["跟进中", "已成交", "已关闭"] },
        { id: "serviceWorkbench", label: "规划师", values: ["A", "B", "C", "D", "E"] },
        { id: "source", label: "来源渠道", values: SOURCES },
        { id: "whatsappStatus", label: "沟通方式", values: WHATSAPP_STATUSES },
        { id: "priority", label: "优先级", values: PRIORITIES },
        { id: "communicationStatus", label: "沟通状态", values: COMMUNICATION_STATUSES },
        { id: "businessStage", label: "业务阶段", values: BUSINESS_STAGES },
        { id: "itineraryStatus", label: "行程状态", values: ITINERARY_STATUSES },
        { id: "quotationStatus", label: "报价状态", values: QUOTATION_STATUSES },
        { id: "profile", label: "客户画像", values: PROFILES },
        { id: "amountRange", label: "金额区间", values: AMOUNT_RANGES },
        { id: "expectedAmount", label: "预计金额", values: ["待补充", "已填写"] },
        { id: "fileStatus", label: "文件状态", values: ["已上传", "未上传"] },
    ].filter((filter) => {
        if (scope === "won" && !["serviceWorkbench", "priority", "fileStatus"].includes(filter.id))
            return false;
        if (scope !== "all" && filter.id === "status")
            return false;
        return true;
    });
    return (<div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
            {
                label: "当前客户总数",
                value: filteredRows.length,
                hint: "按当前筛选结果统计",
                icon: UsersRound,
                tone: "blue" as const,
            },
            { label: "紧急客户", value: urgentCount, hint: "需要优先处理", icon: Siren, tone: "amber" as const },
            { label: "今天新增", value: todayCount, hint: "首次录入时间为今天", icon: Sparkles, tone: "violet" as const },
        ].map((stat) => <StatCard key={stat.label} {...stat} className="crm-compact-stat p-3 sm:p-4 2xl:p-5"/>)}
      </div>

      <div className="crm-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 bg-white p-4">
          <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-start">
            <div className="relative w-full shrink-0 2xl:w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input value={globalFilter} onChange={(event) => {
            setGlobalFilter(event.target.value);
            syncUrl(event.target.value, columnFilters, inquiryFrom, inquiryTo, resetPage());
        }} placeholder="搜索客户名称、联系方式（支持模糊搜索）" className="pl-9 shadow-none"/>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 sm:flex-nowrap">
                <span className="text-[11px] text-muted-foreground">{scope === "won" ? "行程开始" : "首次询单"}</span>
                <Input type="date" aria-label={scope === "won" ? "行程开始日期从" : "首次询单开始日期"} value={inquiryFrom} onChange={(event) => {
            setInquiryFrom(event.target.value);
            syncUrl(globalFilter, columnFilters, event.target.value, inquiryTo, resetPage());
        }} className="h-8 w-[138px] border-0 bg-transparent px-1 shadow-none"/>
                <span className="text-muted-foreground">至</span>
                <Input type="date" aria-label={scope === "won" ? "行程开始日期至" : "首次询单结束日期"} value={inquiryTo} onChange={(event) => {
            setInquiryTo(event.target.value);
            syncUrl(globalFilter, columnFilters, inquiryFrom, event.target.value, resetPage());
        }} className="h-8 w-[138px] border-0 bg-transparent px-1 shadow-none"/>
              </div>
              {scope === "won" && <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 sm:flex-nowrap"><span className="text-[11px] text-muted-foreground">成交日期</span><Input type="date" aria-label="成交日期从" value={wonFrom} onChange={(event) => { setWonFrom(event.target.value); resetPage(); }} className="h-8 w-[138px] border-0 bg-transparent px-1 shadow-none"/><span className="text-muted-foreground">至</span><Input type="date" aria-label="成交日期至" value={wonTo} onChange={(event) => { setWonTo(event.target.value); resetPage(); }} className="h-8 w-[138px] border-0 bg-transparent px-1 shadow-none"/></div>}
              {filters.map((filter) => (<Select key={filter.id} value={String(columnFilters.find((item) => item.id === filter.id)?.value ?? "all")} onValueChange={(value) => setFilter(filter.id, value)}>
                  <SelectTrigger className="w-[145px] text-[12px] shadow-none 2xl:w-[154px] 2xl:text-[13px]">
                    <SelectValue placeholder={filter.label}/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部{filter.label}</SelectItem>
                    {filter.values.map((value) => (<SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>))}
                  </SelectContent>
                </Select>))}
              {(columnFilters.length > 0 || globalFilter || inquiryFrom || inquiryTo || wonFrom || wonTo) && (<Button variant="ghost" size="sm" onClick={() => {
                setColumnFilters([]);
                setGlobalFilter("");
                setInquiryFrom("");
                setInquiryTo("");
                setWonFrom("");
                setWonTo("");
                const nextPagination = { ...pagination, pageIndex: 0 };
                setPagination(nextPagination);
                window.history.replaceState(null, "", customerListHref("", [], "", "", nextPagination));
            }}>
                  <X className="size-4"/>
                  清除筛选
                </Button>)}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <SlidersHorizontal className="size-4"/>
              已选择 {selectedIds.length} 位客户
            </div>
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!selectedIds.length || isPending}>
                    批量操作
                    <ArrowDownAZ className="size-4"/>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>修改优先级</DropdownMenuLabel>
                  {PRIORITIES.map((item) => (<DropdownMenuItem key={item} onClick={() => queueBulk("priority", item)}>
                      设为{item}
                    </DropdownMenuItem>))}
                  <DropdownMenuSeparator />
                  {COMMUNICATION_STATUSES.map((item) => (<DropdownMenuItem key={item} onClick={() => queueBulk("communication", item)}>
                      {item}
                    </DropdownMenuItem>))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>沟通方式</DropdownMenuLabel>
                  {WHATSAPP_STATUSES.map((item) => (<DropdownMenuItem key={item} onClick={() => queueBulk("whatsapp", item)}>
                      设为{item}
                    </DropdownMenuItem>))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>修改行程状态</DropdownMenuLabel>
                  {ITINERARY_STATUSES.map((item) => (<DropdownMenuItem key={item} onClick={() => queueBulk("itinerary", item)}>
                      {item}
                    </DropdownMenuItem>))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>修改报价状态</DropdownMenuLabel>
                  {QUOTATION_STATUSES.map((item) => (<DropdownMenuItem key={item} onClick={() => queueBulk("quotation", item)}>
                      {item}
                    </DropdownMenuItem>))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!selectedIds.length}>
                    状态流转
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => queueBulk("won")}>
                    <CheckCircle2 className="size-4 text-emerald-600"/>
                    确认成交
                  </DropdownMenuItem>
                  {CLOSE_REASONS.map((reason) => (<DropdownMenuItem key={reason} onClick={() => queueBulk("close", reason)}>
                      <CircleX className="size-4 text-orange-600"/>
                      关闭：{reason}
                    </DropdownMenuItem>))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => queueBulk("recover")}>
                    <RotateCcw className="size-4 text-blue-600"/>恢复客户
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {["录入错误", "测试数据", "重复客户"].map((reason) => (<DropdownMenuItem key={reason} onClick={() => queueBulk("delete", reason)} className="text-destructive">
                      <Trash2 className="size-4"/>
                      彻底删除：{reason}
                    </DropdownMenuItem>))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={exportCustomers} disabled={isExporting || !filteredRows.length}>
                <Download className="size-4"/>
                {isExporting
            ? "正在生成…"
            : selectedIds.length
                ? `导出选中（${selectedIds.length}）`
                : `导出筛选（${filteredRows.length}）`}
              </Button>
              <Button size="sm" asChild>
                <Link href="/customers/new">
                  <Plus className="size-4"/>
                  新增客户
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="crm-scrollbar max-h-[calc(100vh-350px)] min-h-[420px] overflow-auto">
          <Table className={expectedAmountSupplementMode ? "min-w-[720px]" : "min-w-[1650px] 2xl:min-w-[2050px]"}>
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_rgba(226,232,240,0.9)] backdrop-blur">
              {table.getHeaderGroups().map((headerGroup) => (<TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (<TableHead key={header.id} className="h-11 whitespace-nowrap text-[11px] 2xl:h-12 2xl:px-3.5 2xl:text-[12px]">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (<button type="button" className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="size-3"/>
                        </button>) : (flexRender(header.column.columnDef.header, header.getContext()))}
                    </TableHead>))}
                </TableRow>))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (table.getRowModel().rows.map((row) => (<TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="h-[54px] 2xl:h-[58px]">
                    {row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap py-2.5 text-[12px] 2xl:px-3.5 2xl:text-[13px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>))}
                  </TableRow>))) : (<TableRow>
                  <TableCell colSpan={columns.length} className="h-64 text-center">
                    <EmptyState icon={Search} title="没有符合条件的客户" description="尝试清除筛选，或新增第一位客户。" className="min-h-56 border-0 bg-transparent"/>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/45 px-4 py-3 text-[12px]">
          <span className="text-muted-foreground">共 {table.getFilteredRowModel().rows.length} 条</span>
          <div className="flex items-center gap-2">
            <Select value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
              <SelectTrigger className="h-8 w-[90px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (<SelectItem key={size} value={String(size)}>
                    {size} 条/页
                  </SelectItem>))}
              </SelectContent>
            </Select>
            <span>
              第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 页
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="size-4"/>
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="size-4"/>
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(pendingBulk)} onOpenChange={(open) => !open && setPendingBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingBulk?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingBulk?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingBulk?.action === "won" && (<div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-won-amount">成交总金额（人民币）</Label>
                <Input id="bulk-won-amount" type="number" min="0" step="0.01" value={bulkWonAmount} onChange={(event) => setBulkWonAmount(event.target.value)}/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-won-date">成交日期</Label>
                <Input id="bulk-won-date" type="date" value={bulkWonDate} onChange={(event) => setBulkWonDate(event.target.value)}/>
              </div>
              <p className="text-[11px] text-muted-foreground">批量成交会将同一金额写入所选客户。</p>
            </div>)}
          {(pendingBulk?.action === "itinerary" || pendingBulk?.action === "quotation") && (<div className="space-y-2">
              <Label>
                {planningRequestRequired(pendingBulk.action, pendingBulk.value as Customer["itineraryStatus"] & Customer["quotationStatus"])
                ? "统一规划或修改要求（必填）"
                : "统一补充要求（选填）"}
              </Label>
              <Textarea rows={5} value={bulkRequirement} onChange={(event) => setBulkRequirement(event.target.value)}/>
            </div>)}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={runBulk} disabled={isPending ||
            (pendingBulk?.action === "won" &&
                (bulkWonAmount === "" || Number(bulkWonAmount) < 0 || !bulkWonDate)) ||
            ((pendingBulk?.action === "itinerary" || pendingBulk?.action === "quotation") &&
                planningRequestRequired(pendingBulk.action, pendingBulk.value as Customer["itineraryStatus"] & Customer["quotationStatus"]) &&
                !bulkRequirement.trim())}>
              确认执行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
