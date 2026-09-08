"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleX, ClipboardList, Download, Edit3, FileClock, History, MessageSquarePlus, Plane, RotateCcw, UserRound, } from "lucide-react";
import { toast } from "sonner";
import { saveCollaborationMessageAction } from "@/app/actions/collaboration-actions";
import { changeServiceAssignmentAction, unlockExclusiveServiceAssignmentAction } from "@/app/actions/service-assignment-actions";
import { changeCustomerStatusAction, saveFollowUpAction, updateCustomerControlAction, updateCustomerProfileAction, } from "@/app/actions/customer-actions";
import { CommunicationBadge, PriorityBadge, StatusBadge } from "@/components/customer-badges";
import { BusinessProgress } from "@/components/business-progress";
import { FileManager } from "@/components/file-manager";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultilineInput } from "@/components/ui/multiline-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CLOSE_REASONS, COMMUNICATION_STATUSES, DOMESTIC_TRANSPORT_STATUSES, PRIORITIES, PROFILES, SOURCES, WHATSAPP_STATUSES, } from "@/lib/constants";
import { businessDateTimeInputValue } from "@/lib/business-time";
import { downloadCustomerExport } from "@/lib/download-customer-export";
import { requiresUrgentConfirmation } from "@/lib/priority-confirmation";
import type { CommunicationStatus, Customer, Level, Priority, ServiceWorkbench, WhatsappStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
function show(value: unknown) {
    if (value == null || value === "")
        return "—";
    return String(value);
}
function dateTime(value?: string | null) {
    return value ? format(new Date(value), "yyyy-MM-dd HH:mm") : "—";
}
function dateOnly(value?: string | null) {
    return value
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date(value))
        : "";
}
const assignmentActionLabels: Record<Customer["serviceAssignmentEvents"][number]["action"], string> = {
    auto_assigned: "公共轮转分配",
    exclusive_assigned: "专属规划师分配",
    manually_assigned: "手工加入工作台",
    reassigned: "手工改派",
    exclusive_unlocked: "解除专属归属",
    assignment_failed: "自动分配失败",
};
function InfoItem({ label, value, wide }: {
    label: string;
    value: unknown;
    wide?: boolean;
}) {
    return (<div className={cn("rounded-lg border border-slate-200/70 bg-slate-50/45 px-3.5 py-3", wide && "sm:col-span-2")}>
      <dt className="crm-label">{label}</dt>
      <dd className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-900">{show(value)}</dd>
    </div>);
}
export function CustomerDetail({ initialCustomer: customer, initialTab = "profile", operationId, returnHref = "/customers", currentUserId, archive, }: {
    initialCustomer: Customer;
    initialTab?: "profile" | "files" | "archive" | "workflow";
    archive?: React.ReactNode;
    operationId?: string;
    returnHref?: string;
    currentUserId: string | null;
}) {
    const router = useRouter();
    const [followOpen, setFollowOpen] = useState(false);
    const [editFollowId, setEditFollowId] = useState<string | undefined>();
    const [summary, setSummary] = useState("");
    const [collaborationBody, setCollaborationBody] = useState("");
    const [editingCollaborationId, setEditingCollaborationId] = useState<string | undefined>();
    const [replyToCollaborationId, setReplyToCollaborationId] = useState<string | undefined>();
    const [collaborationTopic, setCollaborationTopic] = useState<"itinerary" | "quotation" | "general">("itinerary");
    const [collaborationView, setCollaborationView] = useState<"thread" | "chat">("thread");
    const [communication, setCommunication] = useState<CommunicationStatus>(customer.communicationStatus);
    const [nextCallbackAt, setNextCallbackAt] = useState("");
    const [callbackNotRequired, setCallbackNotRequired] = useState(false);
    const [callbackSkipReason, setCallbackSkipReason] = useState("");
    const [serviceTarget, setServiceTarget] = useState<ServiceWorkbench>(customer.serviceWorkbench ?? "A");
    const [serviceReason, setServiceReason] = useState("");
    const [unlockExclusiveOpen, setUnlockExclusiveOpen] = useState(false);
    const [editRevision, setEditRevision] = useState(customer.updatedAt);
    const [editBasicOpen, setEditBasicOpen] = useState(false);
    const [editTravelOpen, setEditTravelOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"won" | "close" | "recover" | null>(null);
    const [urgentPriorityOpen, setUrgentPriorityOpen] = useState(false);
    const [closeReason, setCloseReason] = useState<string>(CLOSE_REASONS[0]);
    const [wonAmount, setWonAmount] = useState(customer.wonAmount == null ? "" : String(customer.wonAmount));
    const [wonDate, setWonDate] = useState(dateOnly(new Date().toISOString()));
    const [isExporting, setIsExporting] = useState(false);
    const [isPending, startTransition] = useTransition();
    function updateControl(field: "level" | "priority" | "communication_status" | "whatsapp_status", value: Level | Priority | CommunicationStatus | WhatsappStatus) {
        if (field === "priority" && requiresUrgentConfirmation(customer.priority, value as Priority)) {
            setUrgentPriorityOpen(true);
            return;
        }
        updateControlConfirmed(field, value);
    }
    function updateControlConfirmed(field: "level" | "priority" | "communication_status" | "whatsapp_status", value: Level | Priority | CommunicationStatus | WhatsappStatus) {
        startTransition(async () => {
            const result = await updateCustomerControlAction({ customerId: customer.id, field, value, confirmUrgent: field === "priority" && value === "紧急" });
            if (result.ok) {
                toast.success("已更新");
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    async function exportCustomer() {
        setIsExporting(true);
        try {
            await downloadCustomerExport([customer.id]);
            toast.success("客户完整信息已导出");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试");
        }
        finally {
            setIsExporting(false);
        }
    }
    function openFollowUp(followUpId?: string) {
        const followUp = customer.followUps.find((item) => item.id === followUpId);
        setEditFollowId(followUpId);
        setSummary(followUp?.summary ?? "");
        setCommunication(followUp?.communicationStatus ?? customer.communicationStatus);
        setNextCallbackAt(followUp?.nextCallbackAt ? businessDateTimeInputValue(followUp.nextCallbackAt) : "");
        setCallbackNotRequired(followUp?.callbackNotRequired ?? false);
        setCallbackSkipReason(followUp?.callbackSkipReason ?? "");
        setFollowOpen(true);
    }
    function saveFollowUp() {
        if (!summary.trim())
            return;
        if (!callbackNotRequired && !nextCallbackAt) {
            toast.error("请选择下次回访时间");
            return;
        }
        if (callbackNotRequired && !callbackSkipReason.trim()) {
            toast.error("请填写无需安排回访的原因");
            return;
        }
        startTransition(async () => {
            const result = await saveFollowUpAction({
                customerId: customer.id,
                followUpId: editFollowId,
                summary,
                communicationStatus: communication,
                nextCallbackAt: callbackNotRequired ? undefined : nextCallbackAt,
                callbackNotRequired,
                callbackSkipReason: callbackNotRequired ? callbackSkipReason : undefined,
            });
            if (result.ok) {
                toast.success(editFollowId ? "跟进记录已修改并保留原版本" : "跟进记录已新增");
                setFollowOpen(false);
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    function changeServiceAssignment() {
        startTransition(async () => {
            const result = await changeServiceAssignmentAction({
                customerId: customer.id,
                targetWorkbench: serviceTarget,
                reason: serviceReason || undefined,
            });
            if (result.ok) {
                toast.success(customer.serviceWorkbench ? "规划师归属已改派" : "客户已加入规划师工作台");
                setServiceReason("");
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    function unlockExclusiveAssignment() {
        if (!serviceReason.trim()) {
            toast.error("请填写解除专属归属的原因");
            return;
        }
        startTransition(async () => {
            const result = await unlockExclusiveServiceAssignmentAction({ customerId: customer.id, reason: serviceReason });
            if (result.ok) {
                toast.success("专属归属已解除，现在可以改派");
                setUnlockExclusiveOpen(false);
                setServiceReason("");
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    function runStatusAction() {
        if (!confirmAction)
            return;
        startTransition(async () => {
            const result = await changeCustomerStatusAction({
                customerIds: [customer.id],
                action: confirmAction,
                closeReason: confirmAction === "close" ? closeReason : undefined,
                priority: "中",
                communicationStatus: "待首次跟进",
                wonAmount: confirmAction === "won" ? Number(wonAmount) : undefined,
                wonDate: confirmAction === "won" ? wonDate : undefined,
            });
            if (result.ok) {
                toast.success("客户状态已更新");
                setConfirmAction(null);
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    async function saveBasic(form: HTMLFormElement) {
        const data = new FormData(form);
        const basic = {
            name: String(data.get("name") ?? ""),
            source: String(data.get("source") ?? customer.source),
            sourceDetail: String(data.get("sourceDetail") ?? "") || null,
            firstInquiryAt: String(data.get("firstInquiryAt") ?? customer.firstInquiryAt),
            nationality: String(data.get("nationality") ?? "") || null,
            contact: String(data.get("contact") ?? "") || null,
            whatsappStatus: String(data.get("whatsappStatus") ?? customer.whatsappStatus) as Customer["whatsappStatus"],
            profile: String(data.get("profile") ?? customer.profile),
            expectedAmount: data.get("expectedAmount") ? Number(data.get("expectedAmount")) : null,
        };
        startTransition(async () => {
            const result = await updateCustomerProfileAction({ customerId: customer.id, expectedUpdatedAt: editRevision, basic });
            if (result.ok) {
                toast.success("客户基本信息已更新");
                setEditBasicOpen(false);
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    async function saveTravel(form: HTMLFormElement) {
        const data = new FormData(form);
        const travel = Object.fromEntries([
            "expectedStartDate",
            "expectedEndDate",
            "fuzzyTravelTime",
            "travelerCount",
            "travelDays",
            "destinations",
            "flightStatus",
            "hotelStatus",
            "serviceType",
            "domesticTransportStatus",
            "specialRequirements",
        ].map((key) => [key, String(data.get(key) ?? "") || null]));
        startTransition(async () => {
            const result = await updateCustomerProfileAction({ customerId: customer.id, expectedUpdatedAt: editRevision, travel });
            if (result.ok) {
                toast.success("旅行需求已更新");
                setEditTravelOpen(false);
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    const visibleCollaborationMessages = customer.collaborationMessages.filter((message) => (message.topic ?? "general") === collaborationTopic);
    return (<div className="space-y-5">
      <section className="crm-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href={returnHref} aria-label="返回客户总池">
              <ArrowLeft className="size-4"/>
            </Link>
          </Button>
          <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80 sm:grid">
            <UserRound className="size-5" strokeWidth={1.7}/>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="mr-1 text-[23px] font-semibold tracking-[-0.035em] text-slate-950">{customer.name}</h1>
              <PriorityBadge priority={customer.priority}/>
              <CommunicationBadge status={customer.communicationStatus}/>
              <StatusBadge status={customer.status}/>
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              首次询单 {dateTime(customer.firstInquiryAt)} · 最近更新 {dateTime(customer.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {operationId && (<Button variant="outline" size="sm" asChild>
              <Link href={`/operations/${operationId}`}>
                <ClipboardList className="size-4"/>
                打开在线服务清单
              </Link>
            </Button>)}
          <Button variant="outline" size="sm" onClick={exportCustomer} disabled={isExporting}>
            <Download className="size-4"/>
            {isExporting ? "正在生成…" : "导出客户"}
          </Button>
          <Button size="sm" onClick={() => openFollowUp()}>
            <MessageSquarePlus className="size-4"/>
            新增跟进总结
          </Button>
          {customer.status === "跟进中" ? (<>
              <Button variant="outline" size="sm" onClick={() => {
                setWonDate(dateOnly(new Date().toISOString()));
                setConfirmAction("won");
            }}>
                <CheckCircle2 className="size-4 text-emerald-600"/>
                确认成交
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmAction("close")}>
                <CircleX className="size-4 text-orange-600"/>
                关闭客户
              </Button>
            </>) : customer.status === "已关闭" ? (<Button variant="outline" size="sm" onClick={() => setConfirmAction("recover")}>
              <RotateCcw className="size-4 text-blue-600"/>
              恢复客户
            </Button>) : null}
        </div>
      </section>

      <div className="grid gap-4">
        <Card>
          <CardContent className="grid grid-cols-3 gap-3 py-1 [&>div]:min-w-0 [&_[data-slot=select-trigger]]:w-full">
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select value={customer.priority} onValueChange={(value) => updateControl("priority", value as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>沟通状态</Label>
              <Select value={customer.communicationStatus} onValueChange={(value) => updateControl("communication_status", value as CommunicationStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMUNICATION_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>沟通方式</Label>
              <Select value={customer.whatsappStatus} onValueChange={(value) => updateControl("whatsapp_status", value as WhatsappStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WHATSAPP_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs key={initialTab} defaultValue={initialTab} className="crm-panel gap-0 overflow-hidden">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-slate-200/70 bg-white px-4 py-0">
          {[
            ["profile", "客户资料", UserRound],
            ["travel", "旅行需求", Plane],
            ["archive", "成交文件与旅客护照", FileClock],
            ["workflow", "行程报价协作", ClipboardList],
            ["followups", "跟进记录", ClipboardList],
            ["history", "历史记录", History],
            ["files", "文件", FileClock],
        ].map(([value, label, Icon]) => (<TabsTrigger key={String(value)} value={String(value)} className="h-12 flex-none rounded-none px-4 py-3 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <Icon className="size-4"/>
              {String(label)}
            </TabsTrigger>))}
        </TabsList>
        <TabsContent value="archive" className="m-0 p-4 sm:p-6">{archive}</TabsContent>
        <TabsContent value="workflow" className="m-0 p-4 sm:p-6"><BusinessProgress customer={customer} currentUserId={currentUserId}/></TabsContent>

        <TabsContent value="profile" className="m-0 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="crm-section-title">客户基本信息</h2>
              <p className="crm-section-description">客户来源、画像、金额与当前业务状态。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditRevision(customer.updatedAt); setEditBasicOpen(true); }}>
                <Edit3 className="size-4"/>
                编辑
              </Button>
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="客户名称" value={customer.name}/>
            <InfoItem label="来源渠道" value={customer.source}/>
            <InfoItem label="具体来源" value={customer.sourceDetail}/>
            <InfoItem label="国籍" value={customer.nationality}/>
            <InfoItem label="客户联系方式" value={customer.contact}/>
            <InfoItem label="沟通方式" value={customer.whatsappStatus}/>
            <InfoItem label="客户画像" value={customer.profile}/>
            <InfoItem label="预计金额区间" value={customer.amountRange}/>
            <InfoItem label="预计具体金额" value={customer.expectedAmount ? `¥${customer.expectedAmount.toLocaleString()}` : null}/>
    <InfoItem label="客户整体状态" value={customer.status}/>
            <InfoItem label="成交总金额" value={customer.wonAmount == null ? null : `¥${customer.wonAmount.toLocaleString("zh-CN")}`}/>
            <InfoItem label="成交日期" value={dateOnly(customer.wonAt)}/>
            {customer.closeReason && <InfoItem label="关闭原因" value={customer.closeReason} wide/>}
          </dl>
          <section className="mt-6 rounded-xl border border-blue-200/70 bg-blue-50/35 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">规划师归属</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">客户统一归属规划师 A-E 工作台。</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-blue-200">{customer.serviceWorkbench ? `规划师${customer.serviceWorkbench}工作台` : "待人工分配"}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-blue-200">{customer.serviceAssignmentMode === "exclusive" ? "专属规划师" : customer.serviceAssignmentMode === "round_robin" ? "公共轮转" : "历史客户未加入"}</span>
                  {customer.serviceAssignedAt && <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-blue-200">分配于 {dateTime(customer.serviceAssignedAt)}</span>}
                </div>
              </div>
              <div className="w-full space-y-2 lg:w-[360px]">
                <div className="flex gap-2">
                  <Select value={serviceTarget} onValueChange={(value) => setServiceTarget(value as ServiceWorkbench)} disabled={customer.serviceAssignmentMode === "exclusive"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(["A", "B", "C", "D", "E"] as const).map((slot) => <SelectItem key={slot} value={slot}>规划师{slot}工作台</SelectItem>)}</SelectContent>
                  </Select>
                  {customer.serviceAssignmentMode === "exclusive" ? (<Button variant="outline" onClick={() => { setServiceReason(""); setUnlockExclusiveOpen(true); }}>解除专属</Button>) : (<Button onClick={changeServiceAssignment} disabled={isPending || customer.serviceWorkbench === serviceTarget}>{customer.serviceWorkbench ? "改派" : "加入"}</Button>)}
                </div>
                {customer.serviceAssignmentMode !== "exclusive" && <Input value={serviceReason} onChange={(event) => setServiceReason(event.target.value)} placeholder="改派原因（选填）"/>}
              </div>
            </div>
            <div className="mt-4 border-t border-blue-100 pt-3">
              <p className="text-[11px] font-medium text-slate-700">归属历史</p>
              {customer.serviceAssignmentEvents.length ? (<div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                  {customer.serviceAssignmentEvents.map((event) => (<div key={event.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-[11px] ring-1 ring-slate-200/70">
                      <span className="font-medium">{assignmentActionLabels[event.action]}</span>
                      <span>{event.fromWorkbench ? `规划师${event.fromWorkbench}` : "未分配"} → {event.toWorkbench ? `规划师${event.toWorkbench}` : "未分配"}</span>
                      {event.reason && <span className="text-muted-foreground">原因：{event.reason}</span>}
                      <span className="ml-auto text-muted-foreground">{event.actorName ?? "系统"} · {dateTime(event.createdAt)}</span>
                    </div>))}
                </div>) : <p className="mt-2 text-[11px] text-muted-foreground">暂无规划师归属记录；既有客户不会自动回填。</p>}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="travel" className="m-0 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="crm-section-title">本次旅行需求</h2>
              <p className="crm-section-description">本次咨询的时间、人数、目的地与服务安排。</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setEditRevision(customer.updatedAt); setEditTravelOpen(true); }}>
              <Edit3 className="size-4"/>
              编辑
            </Button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="具体出行日期" value={customer.travelNeed.expectedStartDate && `${customer.travelNeed.expectedStartDate} 至 ${customer.travelNeed.expectedEndDate || "未定"}`}/>
            <InfoItem label="模糊出行时间" value={customer.travelNeed.fuzzyTravelTime}/>
            <InfoItem label="出行人数" value={customer.travelNeed.travelerCount}/>
            <InfoItem label="旅行天数" value={customer.travelNeed.travelDays}/>
            <InfoItem label="目的地" value={customer.travelNeed.destinations}/>
            <InfoItem label="国际机票情况" value={customer.travelNeed.flightStatus}/>
            <InfoItem label="酒店安排情况" value={customer.travelNeed.hotelStatus}/>
            <InfoItem label="服务类型" value={customer.travelNeed.serviceType}/>
            <InfoItem label="国内交通预订情况" value={customer.travelNeed.domesticTransportStatus}/>
            <InfoItem label="特殊需求或补充说明" value={customer.travelNeed.specialRequirements} wide/>
          </dl>
        </TabsContent>

        <TabsContent value="followups" className="m-0 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="crm-section-title">跟进记录</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">记录不能删除；修改会保留原版本，并视为一次新的跟进。</p>
            </div>
            <Button size="sm" onClick={() => openFollowUp()}>
              <MessageSquarePlus className="size-4"/>
              新增
            </Button>
          </div>
          {customer.followUps.length ? (<div className="relative ml-2 space-y-4 border-l border-slate-200 pl-6">
              {[...customer.followUps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => (<article key={item.id} className="relative rounded-lg border border-slate-200/70 bg-slate-50/40 p-4">
                  <span className="absolute -left-[29px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-white"/>
                  <div className="flex flex-wrap items-center gap-2">
                    <time className="font-mono text-[11px] text-muted-foreground">{dateTime(item.updatedAt)}</time>
                    <CommunicationBadge status={item.communicationStatus}/>
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => openFollowUp(item.id)}>
                      <Edit3 className="size-3.5"/>
                      修改
                    </Button>
                  </div>
                  <p className="mt-2 max-w-4xl leading-6">{item.summary}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {item.callbackNotRequired
                    ? `无需安排回访：${item.callbackSkipReason ?? "已确认"}`
                    : item.nextCallbackAt
                        ? `下次回访：${dateTime(item.nextCallbackAt)}`
                        : "历史记录未设置回访安排"}
                  </p>
                  {item.previousInterval && <p className="mt-1 text-[10px] text-muted-foreground">距离上一条：{item.previousInterval}</p>}
                </article>))}
            </div>) : (<div className="crm-empty">
              <div><CalendarClock className="mx-auto mb-2 size-7 text-muted-foreground/40"/><p>尚无跟进记录</p></div>
            </div>)}
        </TabsContent>
        <TabsContent value="collaboration-legacy" className="hidden">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="crm-section-title">规划师与计调协作交流</h2><p className="mt-1 text-[11px] text-muted-foreground">在客户上下文中同步处理意见；输入框支持回车换行，使用按钮提交。</p></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Label>交流版块</Label><Select value={collaborationTopic} onValueChange={(value) => setCollaborationTopic(value as typeof collaborationTopic)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="itinerary">最新行程</SelectItem><SelectItem value="quotation">最新报价</SelectItem><SelectItem value="general">综合交流</SelectItem></SelectContent></Select><div className="ml-auto flex gap-1"><Button type="button" size="sm" variant={collaborationView === "thread" ? "default" : "outline"} onClick={() => setCollaborationView("thread")}>留言回复式</Button><Button type="button" size="sm" variant={collaborationView === "chat" ? "default" : "outline"} onClick={() => setCollaborationView("chat")}>微信对话式</Button></div></div><Label>{editingCollaborationId ? "修改交流" : replyToCollaborationId ? "回复留言" : "新增交流"}</Label>{replyToCollaborationId && !editingCollaborationId && <p className="text-xs text-muted-foreground">正在回复：{customer.collaborationMessages.find((message) => message.id === replyToCollaborationId)?.authorName ?? "该留言"}<Button variant="link" size="sm" className="ml-1 h-auto p-0" onClick={() => setReplyToCollaborationId(undefined)}>取消回复</Button></p>}<Textarea rows={4} value={collaborationBody} onChange={(event) => setCollaborationBody(event.target.value)} placeholder="记录给规划师或计调的处理意见、问题和下一步动作"/><div className="flex justify-end gap-2">{(editingCollaborationId || replyToCollaborationId) && <Button variant="outline" onClick={() => { setEditingCollaborationId(undefined); setReplyToCollaborationId(undefined); setCollaborationBody(""); }}>取消</Button>}<Button disabled={!collaborationBody.trim() || isPending} onClick={() => { startTransition(async () => { const result = await saveCollaborationMessageAction({ customerId: customer.id, messageId: editingCollaborationId, parentMessageId: editingCollaborationId ? undefined : replyToCollaborationId, topic: collaborationTopic, body: collaborationBody }); if (result.ok) {
        toast.success(editingCollaborationId ? "交流内容已修改" : replyToCollaborationId ? "回复已发布" : "交流内容已发布");
        setCollaborationBody("");
        setEditingCollaborationId(undefined);
        setReplyToCollaborationId(undefined);
        router.refresh();
    }
    else
        toast.error(result.error); }); }}>发布交流</Button></div></div>
            {visibleCollaborationMessages.length ? <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-2">{visibleCollaborationMessages.map((message) => <article key={message.id} className={`rounded-lg border border-slate-200/70 bg-slate-50/40 p-4 ${collaborationView === "chat" ? "rounded-2xl" : ""} ${message.parentMessageId ? "ml-8 border-l-4 border-l-slate-300" : ""}`}><div className="flex items-center gap-2"><span className="font-medium">{message.authorName}</span><time className="font-mono text-[10px] text-muted-foreground">{dateTime(message.updatedAt)}</time><Button variant="ghost" size="sm" onClick={() => { setReplyToCollaborationId(message.id); setEditingCollaborationId(undefined); setCollaborationBody(""); }}>回复</Button><Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setEditingCollaborationId(message.id); setReplyToCollaborationId(undefined); setCollaborationBody(message.body); setCollaborationTopic(message.topic === "quotation" ? "quotation" : message.topic === "general" ? "general" : "itinerary"); }}>编辑</Button></div><p className="mt-2 whitespace-pre-wrap leading-6">{message.body}</p></article>)}</div> : <div className="crm-empty"><p>暂无{collaborationTopic === "quotation" ? "报价" : collaborationTopic === "itinerary" ? "行程" : "综合"}交流</p></div>}
          </div>
        </TabsContent>

        <TabsContent value="history" className="m-0 p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 crm-section-title">资料修改记录</h2>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/70">
                {customer.auditLogs.length ? customer.auditLogs.map((item) => (<div key={item.id} className="p-3">
                    <div className="flex justify-between gap-3"><span className="font-medium">{item.fieldName}</span><time className="font-mono text-[10px] text-muted-foreground">{dateTime(item.changedAt)}</time></div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{item.actorName ? `${item.actorName}${item.actorRole ? ` · ${item.actorRole === "planner" || item.actorRole === "service" ? "规划师" : item.actorRole === "operations" ? "计调" : "管理员"}` : ""}` : "历史记录（未记录操作者）"}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground"><span className="line-through">{show(item.oldValue)}</span> → <span className="text-slate-900">{show(item.newValue)}</span></p>
                  </div>)) : <p className="p-5 text-center text-muted-foreground">暂无修改记录</p>}
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="files" className="m-0 p-6"><FileManager customer={customer}/></TabsContent>
      </Tabs>

      <Dialog open={followOpen} onOpenChange={setFollowOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editFollowId ? "修改跟进总结" : "新增跟进总结"}</DialogTitle>
            <DialogDescription>记录本次沟通结论，并同步客户当前沟通状态。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>跟进总结</Label><Textarea rows={6} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="简要记录客户反馈、我方处理和下一步情况"/></div>
            <div className="space-y-1.5"><Label>沟通状态</Label><Select value={communication} onValueChange={(value) => setCommunication(value as CommunicationStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMMUNICATION_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
              <input type="checkbox" checked={callbackNotRequired} onChange={(event) => { setCallbackNotRequired(event.target.checked); if (event.target.checked)
        setNextCallbackAt(""); }}/>
              本次跟进后无需安排回访
            </label>
            {callbackNotRequired ? (<div className="space-y-1.5"><Label>无需回访原因</Label><Textarea rows={3} value={callbackSkipReason} onChange={(event) => setCallbackSkipReason(event.target.value)} placeholder="必填，例如：客户明确要求暂缓，等待客户主动联系"/></div>) : (<div className="space-y-1.5"><Label>下次回访时间</Label><Input type="datetime-local" value={nextCallbackAt} onChange={(event) => setNextCallbackAt(event.target.value)} required/></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFollowOpen(false)}>取消</Button><Button onClick={saveFollowUp} disabled={!summary.trim() || isPending || (!callbackNotRequired && !nextCallbackAt) || (callbackNotRequired && !callbackSkipReason.trim())}>保存跟进</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editBasicOpen} onOpenChange={setEditBasicOpen}>
        <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑客户基本信息</DialogTitle>
            <DialogDescription>更新客户来源、画像与预计金额；保存后会写入资料修改历史。</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveBasic(event.currentTarget); }} className="min-h-0">
            <div className="crm-scrollbar grid max-h-[calc(86vh-190px)] gap-4 overflow-y-auto px-0.5 pb-1 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>客户名称</Label><MultilineInput name="name" defaultValue={customer.name} required/></div>
              <div className="space-y-1.5"><Label>来源渠道</Label><select name="source" defaultValue={customer.source} className="crm-native-select">{SOURCES.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="space-y-1.5"><Label>具体来源</Label><MultilineInput name="sourceDetail" defaultValue={customer.sourceDetail ?? ""}/></div>
              <div className="space-y-1.5"><Label htmlFor="edit-first-inquiry">首次询单时间</Label><Input id="edit-first-inquiry" name="firstInquiryAt" type="datetime-local" defaultValue={businessDateTimeInputValue(customer.firstInquiryAt)} required/></div>
              <div className="space-y-1.5"><Label>国籍</Label><MultilineInput name="nationality" defaultValue={customer.nationality ?? ""}/></div>
              <div className="space-y-1.5"><Label>客户联系方式</Label><MultilineInput name="contact" autoComplete="tel" placeholder="手机号、微信、邮箱或其他联系方式" defaultValue={customer.contact ?? ""}/></div>
              <div className="space-y-1.5"><Label>沟通方式</Label><select name="whatsappStatus" defaultValue={customer.whatsappStatus} className="crm-native-select">{WHATSAPP_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="space-y-1.5"><Label>客户画像</Label><select name="profile" defaultValue={customer.profile} className="crm-native-select">{PROFILES.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="space-y-1.5"><Label>金额区间</Label><div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-muted-foreground">{customer.amountRange ?? "填写具体金额后自动匹配"}</div></div>
              <div className="space-y-1.5"><Label htmlFor="edit-expected-amount">预计具体金额</Label><Input id="edit-expected-amount" name="expectedAmount" type="number" min={1} max={999999999999} step={1} inputMode="numeric" defaultValue={customer.expectedAmount ?? ""} required={customer.expectedAmount != null}/></div>
            </div>
            <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setEditBasicOpen(false)}>取消</Button><Button type="submit" disabled={isPending}>保存修改</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTravelOpen} onOpenChange={setEditTravelOpen}>
        <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑旅行需求</DialogTitle>
            <DialogDescription>更新本次出行时间、人员、服务与交通安排；所有变化会保留在修改历史中。</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveTravel(event.currentTarget); }} className="min-h-0">
            <div className="crm-scrollbar grid max-h-[calc(86vh-190px)] gap-4 overflow-y-auto px-0.5 pb-1 sm:grid-cols-2">
              {[
            ["expectedStartDate", "预计开始日期", "date", customer.travelNeed.expectedStartDate],
            ["expectedEndDate", "预计结束日期", "date", customer.travelNeed.expectedEndDate],
            ["fuzzyTravelTime", "模糊出行时间", "text", customer.travelNeed.fuzzyTravelTime],
            ["travelerCount", "出行人数", "text", customer.travelNeed.travelerCount],
            ["travelDays", "旅行天数", "text", customer.travelNeed.travelDays],
            ["destinations", "目的地", "text", customer.travelNeed.destinations],
        ].map(([name, label, type, value]) => (<div key={String(name)} className="space-y-1.5">
                  <Label>{label}</Label>
                  {type === "text" ? (<MultilineInput name={String(name)} defaultValue={String(value ?? "")}/>) : (<Input name={String(name)} type={String(type)} defaultValue={String(value ?? "")}/>)}
                </div>))}
              {[
            ["flightStatus", "国际机票情况", ["已购买", "日期已定，但暂未购买", "日期尚未确定", "未知"], customer.travelNeed.flightStatus],
            ["hotelStatus", "酒店安排情况", ["已自行安排", "需要我们安排酒店", "已基本选定，暂未预订", "尚未确定", "未知"], customer.travelNeed.hotelStatus],
            ["serviceType", "服务类型", ["全托管", "拼接", "单项"], customer.travelNeed.serviceType],
            [
                "domesticTransportStatus",
                "国内交通预订情况",
                DOMESTIC_TRANSPORT_STATUSES,
                customer.travelNeed.domesticTransportStatus,
            ],
        ].map(([name, label, options, value]) => <div key={String(name)} className="space-y-1.5"><Label>{String(label)}</Label><select name={String(name)} defaultValue={String(value ?? "")} className="crm-native-select"><option value="">未填写</option>{(options as string[]).map((item) => <option key={item}>{item}</option>)}</select></div>)}
              <div className="space-y-1.5 sm:col-span-2"><Label>特殊需求或补充说明</Label><Textarea name="specialRequirements" rows={5} defaultValue={customer.travelNeed.specialRequirements ?? ""}/></div>
            </div>
            <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setEditTravelOpen(false)}>取消</Button><Button type="submit" disabled={isPending}>保存修改</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirmAction === "won" ? "确认成交" : confirmAction === "close" ? "关闭客户" : "恢复客户"}</AlertDialogTitle><AlertDialogDescription>状态流转会保留全部资料、跟进、历史记录和文件。</AlertDialogDescription></AlertDialogHeader>
          {confirmAction === "close" && <Select value={closeReason} onValueChange={setCloseReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLOSE_REASONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>}
          {confirmAction === "won" && (<div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-won-amount">成交总金额（人民币）</Label>
                <Input id="confirm-won-amount" type="number" min="0" step="0.01" value={wonAmount} onChange={(event) => setWonAmount(event.target.value)} placeholder="请输入成交金额"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-won-date">成交日期</Label>
                <Input id="confirm-won-date" type="date" value={wonDate} onChange={(event) => setWonDate(event.target.value)}/>
              </div>
            </div>)}
          {confirmAction === "recover" && <p className="text-sm text-muted-foreground">客户将恢复为跟进中；历史等级仅保留在后台，不再作为日常业务入口。</p>}
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={runStatusAction} disabled={isPending || (confirmAction === "won" && (wonAmount === "" || Number(wonAmount) < 0 || !wonDate))}>确认</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unlockExclusiveOpen} onOpenChange={setUnlockExclusiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解除专属规划师归属？</AlertDialogTitle>
            <AlertDialogDescription>解除后该客户将变为公共客户，并允许改派至其他规划师工作台；本操作会写入归属历史。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2"><Label>解除原因</Label><Textarea rows={4} value={serviceReason} onChange={(event) => setServiceReason(event.target.value)} placeholder="必填，请说明客户来源或归属发生变化的原因"/></div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={unlockExclusiveAssignment} disabled={isPending || serviceReason.trim().length < 2}>确认解除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={urgentPriorityOpen} onOpenChange={setUrgentPriorityOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认将客户优先级改为“紧急”？</AlertDialogTitle>
            <AlertDialogDescription>该客户会在规划师工作台按紧急优先级排序。请确认确实需要紧急处理。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setUrgentPriorityOpen(false); updateControlConfirmed("priority", "紧急"); }}>确认改为紧急</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
