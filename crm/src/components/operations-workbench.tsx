"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, BellRing, CalendarDays, ChevronRight, CircleAlert, Clock3, Columns3, List, PlaneTakeoff, Search, UsersRound, WalletCards, ClipboardCheck, Plus, } from "lucide-react";
import { OperationPhaseBadge, ServiceListStatusBadge } from "@/components/operations-badges";
import { PriorityBadge } from "@/components/customer-badges";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPERATION_PHASES, OPERATION_PHASE_LABELS, SERVICE_LIST_STATUS_LABELS, bookingProgress, chinaToday, operationFinancials, operationPhase, reminderMatchesTimingFilter, reminderTiming, type OperationPhase, } from "@/lib/operations";
import type { OperationSummary as OperationCase } from '@/lib/operation-summary';
import { PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { FINANCE_CLAIM_STATUS_LABELS, FINANCE_CLAIM_TYPE_LABELS, financeClaimPaymentSummary, type FinanceClaim } from "@/lib/finance";
import { createOperationTourAction, updateOperationReminderStatusAction } from "@/app/actions/operations-actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
const money = (value: number | null) => value == null
    ? "—"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        maximumFractionDigits: 0,
    }).format(value);
const date = (value: string | null) => value ? value.replaceAll("-", ".") : "待补充";
type SortKey = "customerName" | "phase" | "arrivalDate" | "ownerName" | "priority" | "serviceList" | "booking" | "reminders" | "finalRevenue" | "finalMargin";
type KpiFilter = "all" | "in_service" | "today" | "overdue" | "next_week";
const priorityRank = (value: OperationCase["priority"]) => ({ "需立即处理": 5, 紧急: 4, 高: 3, 中: 2, 低: 1 } as Record<OperationCase["priority"], number>)[value];
const phaseRank: Record<OperationPhase, number> = {
    processing: 1,
    date_incomplete: 2,
    waiting: 3,
    in_service: 4,
    completed: 5,
};
function addChinaDays(date: string, days: number) {
    const parsed = new Date(`${date}T12:00:00+08:00`);
    parsed.setDate(parsed.getDate() + days);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(parsed);
}
function customerReminderCounts(operation: OperationCase, today: string, nextWeekEnd: string) {
    return operation.reminders.reduce((counts, reminder) => {
        const timing = reminderTiming(reminder, today);
        if (timing === "overdue")
            counts.overdue += 1;
        if (timing === "today")
            counts.today += 1;
        if (timing === "upcoming" && reminder.dueDate && reminder.dueDate <= nextWeekEnd)
            counts.nextWeek += 1;
        return counts;
    }, { overdue: 0, today: 0, nextWeek: 0 });
}
function ReminderBadges({ overdue, today, nextWeek }: {
    overdue: number;
    today: number;
    nextWeek: number;
}) {
    if (!overdue && !today && !nextWeek) {
        return <span className="text-[11px] text-muted-foreground">暂无近期提醒</span>;
    }
    return (<div className="flex flex-wrap gap-1">
      {overdue > 0 && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">逾期 {overdue}</Badge>}
      {today > 0 && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">今日 {today}</Badge>}
      {nextWeek > 0 && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">7 天内 {nextWeek}</Badge>}
    </div>);
}
function KpiCardButton({ active, label, onClick, children, }: {
    active: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (<button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35">
      {children}
    </button>);
}
type TourCustomerOption = {
    id: string;
    name: string;
    wonAmount: number | null;
};
function TaskQuickActions({ caseId, reminderId, pending: isPending }: {
    caseId: string;
    reminderId: string;
    pending: boolean;
}) {
    const router = useRouter();
    const [busy, startTransition] = useTransition();
    const setStatus = (status: "completed" | "ignored") => startTransition(async () => {
        const result = await updateOperationReminderStatusAction({ caseId, reminderId, status });
        if (result.ok)
            router.refresh();
    });
    if (!isPending)
        return null;
    return <div className="flex justify-end gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("ignored")}>忽略</Button><Button size="sm" disabled={busy} onClick={() => setStatus("completed")}>完成</Button></div>;
}
function NewTourDialog({ customers }: {
    customers: TourCustomerOption[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [customerId, setCustomerId] = useState("");
    const [tourName, setTourName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [travelerCount, setTravelerCount] = useState("");
    const [routeInfo, setRouteInfo] = useState("");
    const [orderTotal, setOrderTotal] = useState("");
    function createTour() {
        setError(null);
        startTransition(async () => {
            const result = await createOperationTourAction({
                customerId, tourName, startDate, endDate, travelerCount, routeInfo,
                orderTotal: orderTotal === "" ? null : Number(orderTotal),
            });
            if (!result.ok || !result.id) {
                setError(result.ok ? "未能取得新团组编号" : result.error);
                return;
            }
            const id = result.id;
            setOpen(false);
            reset();
            router.push(`/operations/${id}?tab=group`);
            router.refresh();
        });
    }
    function reset() { setError(null); setCustomerId(""); setTourName(""); setStartDate(""); setEndDate(""); setTravelerCount(""); setRouteInfo(""); setOrderTotal(""); }
    return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next)
        reset(); }}>
    <DialogTrigger asChild><Button><Plus className="size-4"/>新建团</Button></DialogTrigger>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>新建团</DialogTitle><DialogDescription>选择成交客户后自动生成“国家＋客户姓名＋团”和年度安全递增编号，创建后进入服务清单。</DialogDescription></DialogHeader>
      <div className="grid gap-3 py-2 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>成交客户 *</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="选择已成交客户"/></SelectTrigger><SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>团组名称</Label><Input value={tourName} onChange={(event) => setTourName(event.target.value)} placeholder="自动使用“国家＋客户姓名＋团”" disabled/></div>
        <div className="space-y-1.5"><Label>开始日期</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)}/></div>
        <div className="space-y-1.5"><Label>结束日期</Label><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)}/></div>
        <div className="space-y-1.5"><Label>人数</Label><Input value={travelerCount} onChange={(event) => setTravelerCount(event.target.value)} placeholder="如 8 人"/></div>
        <div className="space-y-1.5"><Label>订单总额</Label><Input type="number" min="0" value={orderTotal} onChange={(event) => setOrderTotal(event.target.value)} placeholder="CNY"/></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>路线</Label><Input value={routeInfo} onChange={(event) => setRouteInfo(event.target.value)} placeholder="例如：北京 - 西安 - 上海"/></div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={createTour} disabled={pending || !customerId}>{pending ? "创建中…" : "新建并进入服务清单"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
export function OperationsWorkbench({ operations, claims, customers }: {
    operations: OperationCase[];
    claims: FinanceClaim[];
    customers: TourCustomerOption[];
}) {
    const today = chinaToday();
    const nextWeekEnd = addChinaDays(today, 7);
    const [view, setView] = useState<"list" | "board">("list");
    const [query, setQuery] = useState("");
    const [phase, setPhase] = useState<"all" | OperationPhase>("all");
    const [owner, setOwner] = useState("all");
    const [priority, setPriority] = useState("all");
    const [serviceList, setServiceList] = useState("all");
    const [booking, setBooking] = useState("all");
    const [arrivalFrom, setArrivalFrom] = useState("");
    const [arrivalTo, setArrivalTo] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("arrivalDate");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [kpiFilter, setKpiFilter] = useState<KpiFilter>("all");
    const [workspaceView, setWorkspaceView] = useState<"cases" | "tasks" | "claims">("cases");
    const [taskTiming, setTaskTiming] = useState("all");
    const [taskOwner, setTaskOwner] = useState("all");
    const [taskCategory, setTaskCategory] = useState("all");
    const owners = useMemo(() => Array.from(new Set(operations.map((item) => item.ownerName).filter(Boolean) as string[])).sort(), [operations]);
    const filtered = useMemo(() => {
        const result = operations.filter((item) => {
            const itemPhase = operationPhase(item, today);
            const progress = bookingProgress(item.items);
            const reminderCounts = customerReminderCounts(item, today, nextWeekEnd);
            return ((!query || `${item.customerName}${item.tourName}${item.tourCode}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
                (phase === "all" || itemPhase === phase) &&
                (owner === "all" || item.ownerName === owner) &&
                (priority === "all" || item.priority === priority) &&
                (serviceList === "all" || item.serviceListStatus === serviceList) &&
                (booking === "all" ||
                    (booking === "not_started" && progress.total === 0) ||
                    (booking === "pending" && progress.total > 0 && progress.finished < progress.total) ||
                    (booking === "complete" && progress.total > 0 && progress.finished === progress.total)) &&
                (kpiFilter === "all" ||
                    (kpiFilter === "in_service" && itemPhase === "in_service") ||
                    (kpiFilter === "today" && reminderCounts.today > 0) ||
                    (kpiFilter === "overdue" && reminderCounts.overdue > 0) ||
                    (kpiFilter === "next_week" && reminderCounts.nextWeek > 0)) &&
                (!arrivalFrom || Boolean(item.arrivalDate && item.arrivalDate >= arrivalFrom)) &&
                (!arrivalTo || Boolean(item.arrivalDate && item.arrivalDate <= arrivalTo)));
        });
        const comparable = (item: OperationCase): string | number => {
            const progress = bookingProgress(item.items);
            const financial = operationFinancials(item.items);
            const reminderCounts = customerReminderCounts(item, today, nextWeekEnd);
            switch (sortKey) {
                case "customerName": return item.customerName;
                case "phase": return phaseRank[operationPhase(item, today)];
                case "arrivalDate": return item.arrivalDate ?? "9999-12-31";
                case "ownerName": return item.ownerName ?? "未分配";
                case "priority": return priorityRank(item.priority);
                case "serviceList": return item.serviceListStatus === "uploaded" ? 1 : 0;
                case "booking": return progress.total ? progress.percent : -1;
                case "reminders":
                    return reminderCounts.overdue * 10000 + reminderCounts.today * 100 + reminderCounts.nextWeek;
                case "finalRevenue": return financial.finalComplete ? financial.finalRevenue : -1;
                case "finalMargin": return financial.finalMarginRate ?? -1;
            }
        };
        return result.sort((a, b) => {
            const left = comparable(a);
            const right = comparable(b);
            const compared = typeof left === "number" && typeof right === "number"
                ? left - right
                : String(left).localeCompare(String(right), "zh-CN");
            return (sortDirection === "asc" ? compared : -compared) ||
                a.customerName.localeCompare(b.customerName, "zh-CN");
        });
    }, [
        arrivalFrom,
        arrivalTo,
        booking,
        kpiFilter,
        nextWeekEnd,
        operations,
        owner,
        phase,
        priority,
        query,
        serviceList,
        sortDirection,
        sortKey,
        today,
    ]);
    function toggleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDirection((current) => current === "asc" ? "desc" : "asc");
            return;
        }
        setSortKey(key);
        setSortDirection("asc");
    }
    function SortHeading({ label, value }: {
        label: string;
        value: SortKey;
    }) {
        const active = sortKey === value;
        return (<button type="button" onClick={() => toggleSort(value)} className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-slate-950" aria-label={`${label}，当前${active ? (sortDirection === "asc" ? "正序" : "倒序") : "未排序"}，点击切换排序`}>
        {label}
        <ArrowUpDown className={cn("size-3", active ? "text-primary" : "text-muted-foreground/50")}/>
      </button>);
    }
    const inService = operations.filter((item) => operationPhase(item, today) === "in_service").length;
    const overdue = operations.filter((item) => customerReminderCounts(item, today, nextWeekEnd).overdue > 0).length;
    const dueToday = operations.filter((item) => customerReminderCounts(item, today, nextWeekEnd).today > 0).length;
    const nextWeek = operations.filter((item) => customerReminderCounts(item, today, nextWeekEnd).nextWeek > 0).length;
    function selectKpi(value: KpiFilter) {
        setKpiFilter((current) => current === value && value !== "all" ? "all" : value);
    }
    const workspaceTabs = (<div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
      <Button variant={workspaceView === "cases" ? "default" : "ghost"} onClick={() => setWorkspaceView("cases")}><UsersRound className="size-4"/>团组执行</Button>
      <Button variant={workspaceView === "tasks" ? "default" : "ghost"} onClick={() => setWorkspaceView("tasks")}><ClipboardCheck className="size-4"/>执行待办</Button>
      <Button variant={workspaceView === "claims" ? "default" : "ghost"} onClick={() => setWorkspaceView("claims")}><WalletCards className="size-4"/>我的报账</Button>
      <div className="ml-auto"><NewTourDialog customers={customers}/></div>
    </div>);
    if (workspaceView === "tasks") {
        const allTasks = operations.flatMap((operation) => operation.reminders.map((task) => ({ operation, task, service: operation.items.find((item) => item.id === task.serviceItemId) })))
            .sort((a, b) => (a.task.dueDate ?? "9999-12-31").localeCompare(b.task.dueDate ?? "9999-12-31"));
        const taskOwners = Array.from(new Set(allTasks.map(({ task }) => task.assigneeName).filter(Boolean) as string[])).sort();
        const taskCategories = Array.from(new Set(allTasks.map(({ service }) => service?.category).filter(Boolean) as string[])).sort();
        const tasks = allTasks.filter(({ operation, task, service }) => {
            const timingMatches = reminderMatchesTimingFilter(task, taskTiming as Parameters<typeof reminderMatchesTimingFilter>[1], today, nextWeekEnd);
            return (!query || `${operation.customerName}${task.title}${service?.title ?? ""}${task.assigneeName ?? ""}`.toLowerCase().includes(query.toLowerCase())) && timingMatches && (taskOwner === "all" || task.assigneeName === taskOwner || (taskOwner === "unassigned" && !task.assigneeName)) && (taskCategory === "all" || service?.category === taskCategory);
        });
        return <div className="space-y-4">{workspaceTabs}<section className="crm-panel overflow-hidden"><header className="border-b border-slate-200 p-4"><h2 className="crm-section-title">跨团执行待办</h2><p className="crm-section-description">自动清单任务与人工提醒统一展示；可直接完成或忽略，进入团详情可继续编辑、指派和查看服务附件。</p><div className="mt-3 grid gap-2 md:grid-cols-4"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索团组、任务或服务"/><Select value={taskTiming} onValueChange={setTaskTiming}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="overdue">已逾期</SelectItem><SelectItem value="today">今日到期</SelectItem><SelectItem value="next7">未来七天</SelectItem><SelectItem value="upcoming">全部未来</SelectItem><SelectItem value="date_pending">日期待确认</SelectItem><SelectItem value="completed">已完成</SelectItem></SelectContent></Select><Select value={taskOwner} onValueChange={setTaskOwner}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部负责人</SelectItem><SelectItem value="unassigned">未指派</SelectItem>{taskOwners.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><Select value={taskCategory} onValueChange={setTaskCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部服务类型</SelectItem>{taskCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div></header><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-50 text-muted-foreground"><tr>{["到期日", "状态", "团组", "任务", "服务", "负责人", "操作"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{tasks.map(({ operation, task, service }) => { const timing = reminderTiming(task, today); return <tr key={task.id}><td className="px-4 py-3 font-mono">{task.dueDate ?? "日期待确认"}</td><td className="px-4 py-3"><Badge variant="outline">{timing === "overdue" ? "逾期" : timing === "today" ? "今日" : timing === "date_pending" ? "待定日期" : task.status === "pending" ? "待处理" : task.status === "completed" ? "已完成" : "已忽略"}</Badge></td><td className="px-4 py-3 font-medium">{operation.tourName}<p className="font-mono text-[10px] text-muted-foreground">{operation.tourCode} · {operation.customerName}</p></td><td className="px-4 py-3">{task.title}</td><td className="px-4 py-3 text-muted-foreground">{service?.title ?? "通用提醒"}</td><td className="px-4 py-3">{task.assigneeName ?? "未指派"}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><TaskQuickActions caseId={operation.id} reminderId={task.id} pending={task.status === "pending"}/><Button size="sm" variant="outline" asChild><Link href={`/operations/${operation.id}`}>打开</Link></Button></div></td></tr>; })}</tbody></table></div></section></div>;
    }
    if (workspaceView === "claims") {
        return <div className="space-y-4">{workspaceTabs}<section className="crm-panel overflow-hidden"><header className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="crm-section-title">计调费用申请进度</h2><p className="crm-section-description">查看本团申请、审核与付款进度；跨团审核和付款仍在独立报账中心完成。</p></div><Button asChild><Link href="/finance">进入报账中心</Link></Button></header><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-muted-foreground"><tr>{["申请单", "团组", "类型 / 收款方", "申请金额", "已支付", "剩余", "状态", "提交时间"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{claims.map((claim) => { const payment = financeClaimPaymentSummary(claim); return <tr key={claim.id}><td className="px-4 py-3 font-mono">{claim.claimNo}</td><td className="px-4 py-3">{claim.tourName ?? claim.customerName}<p className="font-mono text-[10px] text-muted-foreground">{claim.tourCode ?? "—"} · {claim.customerName}</p></td><td className="px-4 py-3">{FINANCE_CLAIM_TYPE_LABELS[claim.claimType]} · {claim.payeeName}</td><td className="px-4 py-3 font-mono">{money(claim.amount)}</td><td className="px-4 py-3 font-mono">{money(payment.paid)}</td><td className="px-4 py-3 font-mono">{money(payment.remaining)}</td><td className="px-4 py-3"><Badge variant="outline">{FINANCE_CLAIM_STATUS_LABELS[claim.status]}</Badge></td><td className="px-4 py-3 font-mono">{claim.submittedAt.slice(0, 10)}</td></tr>; })}</tbody></table></div></section></div>;
    }
    return (<div className="space-y-5">
      {workspaceTabs}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCardButton active={kpiFilter === "all"} label="查看全部成交计调客户" onClick={() => selectKpi("all")}>
          <StatCard label="成交计调客户" value={operations.length} hint="点击查看全部成交客户" icon={UsersRound} tone="blue" className={cn("h-full", kpiFilter === "all" && "border-blue-300 bg-blue-50/45 ring-2 ring-blue-500/15")}/>
        </KpiCardButton>
        <KpiCardButton active={kpiFilter === "in_service"} label="筛选出团中的客户" onClick={() => selectKpi("in_service")}>
          <StatCard label="出团中" value={inService} hint="当前正在中国出行的客户" icon={PlaneTakeoff} tone="blue" className={cn("h-full", kpiFilter === "in_service" && "border-blue-300 bg-blue-50/45 ring-2 ring-blue-500/15")}/>
        </KpiCardButton>
        <KpiCardButton active={kpiFilter === "today"} label="筛选今天有提醒的客户" onClick={() => selectKpi("today")}>
          <StatCard label="今日提醒" value={dueToday} hint="今天有待处理提醒的客户" icon={BellRing} tone="violet" className={cn("h-full", kpiFilter === "today" && "border-blue-300 bg-blue-50/45 ring-2 ring-blue-500/15")}/>
        </KpiCardButton>
        <KpiCardButton active={kpiFilter === "overdue"} label="筛选存在逾期提醒的客户" onClick={() => selectKpi("overdue")}>
          <StatCard label="已逾期提醒" value={overdue} hint="存在逾期事项的客户" icon={CircleAlert} tone="amber" emphasis={overdue > 0} className={cn("h-full", kpiFilter === "overdue" && "border-blue-300 bg-blue-50/45 ring-2 ring-blue-500/15")}/>
        </KpiCardButton>
        <KpiCardButton active={kpiFilter === "next_week"} label="筛选未来七天有提醒的客户" onClick={() => selectKpi("next_week")}>
          <StatCard label="未来 7 天" value={nextWeek} hint="7 天内有提醒的客户" icon={Clock3} tone="emerald" className={cn("h-full", kpiFilter === "next_week" && "border-blue-300 bg-blue-50/45 ring-2 ring-blue-500/15")}/>
        </KpiCardButton>
      </div>

      <section className="crm-panel overflow-hidden">
        <div className="border-b border-slate-200/70 p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(180px,1.3fr)_repeat(5,minmax(130px,0.8fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索团号、团组或客户" className="pl-9"/>
            </div>
            <Select value={phase} onValueChange={(value) => setPhase(value as typeof phase)}>
              <SelectTrigger><SelectValue placeholder="计调状态"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部计调状态</SelectItem>
                {OPERATION_PHASES.map((item) => <SelectItem key={item} value={item}>{OPERATION_PHASE_LABELS[item]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue placeholder="负责人"/></SelectTrigger>
              <SelectContent><SelectItem value="all">全部负责人</SelectItem>{owners.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue placeholder="优先级"/></SelectTrigger>
              <SelectContent><SelectItem value="all">全部优先级</SelectItem>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={serviceList} onValueChange={setServiceList}>
              <SelectTrigger><SelectValue placeholder="服务清单"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部服务清单</SelectItem>
                {Object.entries(SERVICE_LIST_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={booking} onValueChange={setBooking}>
              <SelectTrigger><SelectValue placeholder="预订进度"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部预订进度</SelectItem>
                <SelectItem value="not_started">尚未录入</SelectItem>
                <SelectItem value="pending">存在未确认</SelectItem>
                <SelectItem value="complete">预订已完成</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">抵达日期</span>
              <Input type="date" value={arrivalFrom} onChange={(event) => setArrivalFrom(event.target.value)} className="w-36"/>
              <span className="text-[11px] text-muted-foreground">至</span>
              <Input type="date" value={arrivalTo} onChange={(event) => setArrivalTo(event.target.value)} className="w-36"/>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">共 {filtered.length} 个团组</span>
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}><List className="size-4"/>列表</Button>
                <Button size="sm" variant={view === "board" ? "secondary" : "ghost"} onClick={() => setView("board")}><Columns3 className="size-4"/>看板</Button>
              </div>
            </div>
          </div>
        </div>

        {view === "list" ? (<div className="overflow-x-auto crm-scrollbar">
            <table className="w-full min-w-[1380px] text-left text-[12px]">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold tracking-[0.04em] text-muted-foreground">
                <tr>
                  {([
                ["团号 / 团组", "customerName"],
                ["计调状态", "phase"],
                ["来华日期", "arrivalDate"],
                ["负责人", "ownerName"],
                ["优先级", "priority"],
                ["服务清单", "serviceList"],
                ["预订进度", "booking"],
                ["提醒", "reminders"],
                ["最终结算", "finalRevenue"],
                ["最终毛利率", "finalMargin"],
            ] as Array<[
                string,
                SortKey
            ]>).map(([label, value]) => (<th key={value} className="px-4 py-3">
                      <SortHeading label={label} value={value}/>
                    </th>))}
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                const itemPhase = operationPhase(item, today);
                const progress = bookingProgress(item.items);
                const financial = operationFinancials(item.items);
                const reminderCounts = customerReminderCounts(item, today, nextWeekEnd);
                return (<tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3.5"><Link href={`/operations/${item.id}`} className="font-semibold text-slate-950 hover:text-primary">{item.tourName}</Link><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.tourCode} · {item.customerName}</p></td>
                      <td className="px-4 py-3.5"><OperationPhaseBadge phase={itemPhase}/></td>
                      <td className="px-4 py-3.5 font-mono text-[11px]">{date(item.arrivalDate)} → {date(item.departureDate)}</td>
                      <td className="px-4 py-3.5">{item.ownerName ?? "未分配"}</td>
                      <td className="px-4 py-3.5"><PriorityBadge priority={item.priority}/></td>
                      <td className="px-4 py-3.5"><ServiceListStatusBadge status={item.serviceListStatus}/></td>
                      <td className="px-4 py-3.5">
                        {progress.total ? (<div className="flex items-center gap-2">
                            <span className="font-mono">{progress.finished}/{progress.total}</span>
                            <div className="h-1.5 w-16 rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress.percent}%` }}/>
                            </div>
                          </div>) : (<span className="text-[11px] text-muted-foreground">尚未录入预订</span>)}
                      </td>
                      <td className="px-4 py-3.5">
                        <ReminderBadges {...reminderCounts}/>
                      </td>
                      <td className="px-4 py-3.5 font-mono">{money(financial.finalComplete ? financial.finalRevenue : null)}</td>
                      <td className="px-4 py-3.5 font-mono">{financial.finalMarginRate == null ? "—" : `${(financial.finalMarginRate * 100).toFixed(1)}%`}</td>
                      <td className="px-4 py-3.5"><Button variant="ghost" size="icon-sm" asChild><Link href={`/operations/${item.id}`} aria-label={`打开 ${item.customerName}`}><ChevronRight className="size-4"/></Link></Button></td>
                    </tr>);
            })}
              </tbody>
            </table>
            {!filtered.length && <div className="crm-empty m-4"><div><CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground/40"/><p className="font-medium">没有符合条件的计调客户</p><p className="mt-1 text-[11px] text-muted-foreground">调整筛选条件后再试。</p></div></div>}
          </div>) : (<div className="overflow-x-auto p-4 crm-scrollbar">
            <div className="grid min-w-[1320px] grid-cols-5 gap-3">
              {OPERATION_PHASES.map((column) => {
                const cards = filtered.filter((item) => operationPhase(item, today) === column);
                return (<section key={column} className="rounded-xl border border-slate-200 bg-slate-50/55">
                    <header className="flex items-center justify-between border-b border-slate-200/70 px-3 py-3">
                      <OperationPhaseBadge phase={column}/>
                      <Badge variant="secondary">{cards.length}</Badge>
                    </header>
                    <div className="space-y-2 p-2">
                      {cards.map((item) => {
                        const progress = bookingProgress(item.items);
                        const reminderCounts = customerReminderCounts(item, today, nextWeekEnd);
                        return (<Link key={item.id} href={`/operations/${item.id}`} className="block rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                            <div className="flex items-start justify-between gap-2"><p className="font-semibold text-slate-950">{item.tourName}</p><PriorityBadge priority={item.priority}/></div><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.tourCode} · {item.customerName}</p>
                            <p className="mt-2 font-mono text-[10px] text-muted-foreground">{date(item.arrivalDate)} → {date(item.departureDate)}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <ServiceListStatusBadge status={item.serviceListStatus}/>
                              <ReminderBadges {...reminderCounts}/>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-muted-foreground">
                              <span>{item.ownerName ?? "未分配负责人"}</span>
                              <span>{progress.total ? `预订 ${progress.finished}/${progress.total}` : "预订尚未录入"}</span>
                            </div>
                          </Link>);
                    })}
                      {!cards.length && <div className={cn("grid h-24 place-items-center rounded-lg border border-dashed border-slate-200 text-[11px] text-muted-foreground")}>暂无客户</div>}
                    </div>
                  </section>);
            })}
            </div>
          </div>)}
      </section>
    </div>);
}
