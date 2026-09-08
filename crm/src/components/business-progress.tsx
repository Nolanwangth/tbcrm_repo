"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ClipboardPenLine, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { updateBusinessStageAction, updatePlanningProgressAction, updateWonInfoAction, } from "@/app/actions/customer-actions";
import { StatusBadge } from "@/components/customer-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_STAGES, ITINERARY_STATUSES, QUOTATION_STATUSES, } from "@/lib/constants";
import { latestPlanningRequest, planningRequestRequired } from "@/lib/planning";
import { PlanningCollaboration } from "@/components/planning-collaboration";
import type { BusinessStage, Customer, ItineraryStatus, PlanningRequestType, QuotationStatus, } from "@/lib/types";
function dateTime(value: string) {
    return format(new Date(value), "yyyy-MM-dd HH:mm");
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
function requestTypeForLabel(label: string): PlanningRequestType {
    return label.includes("报价") ? "quotation" : "itinerary";
}
export function BusinessProgress({ customer, currentUserId }: {
    customer: Customer;
    currentUserId: string | null;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [requestType, setRequestType] = useState<PlanningRequestType | null>(null);
    const [nextStatus, setNextStatus] = useState<ItineraryStatus | QuotationStatus>("暂不需要");
    const [content, setContent] = useState("");
    const [wonInfoOpen, setWonInfoOpen] = useState(false);
    const [amount, setAmount] = useState(String(customer.wonAmount ?? ""));
    const [wonDate, setWonDate] = useState(dateOnly(customer.wonAt));
    const latestItinerary = latestPlanningRequest(customer, "itinerary");
    const latestQuotation = latestPlanningRequest(customer, "quotation");
    function openStatus(type: PlanningRequestType, status: ItineraryStatus | QuotationStatus) {
        setRequestType(type);
        setNextStatus(status);
        setContent("");
    }
    function saveProgress() {
        if (!requestType)
            return;
        startTransition(async () => {
            const result = await updatePlanningProgressAction({
                customerIds: [customer.id],
                requestType,
                status: nextStatus,
                content,
            });
            if (result.ok) {
                toast.success("业务制作进度已更新");
                setRequestType(null);
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    function saveBusinessStage(value: BusinessStage) {
        startTransition(async () => {
            const result = await updateBusinessStageAction({ customerId: customer.id, value });
            if (result.ok) {
                toast.success("业务阶段已更新");
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    function openWonInfo() {
        setAmount(String(customer.wonAmount ?? ""));
        setWonDate(dateOnly(customer.wonAt));
        setWonInfoOpen(true);
    }
    function saveWonInfo() {
        const value = Number(amount);
        startTransition(async () => {
            const result = await updateWonInfoAction({
                customerId: customer.id,
                wonAmount: value,
                wonDate,
            });
            if (result.ok) {
                toast.success("成交信息已更新并写入历史");
                setWonInfoOpen(false);
                router.refresh();
            }
            else
                toast.error(result.error);
        });
    }
    return (<>
      <Card>
        <CardContent className="space-y-5 py-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <ClipboardPenLine className="size-4"/>
              </span>
              <div>
                <h2 className="crm-section-title">业务制作进度</h2>
                <p className="crm-section-description">
                  行程与报价独立保存；待制作或待修改时必须填写对应要求。
                </p>
              </div>
            </div>
            {customer.status === "已成交" && (<Button variant="outline" size="sm" onClick={openWonInfo}>
                修改成交信息
              </Button>)}
          </div>
          <div className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 lg:grid-cols-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2"><Label>业务阶段</Label><StatusBadge status={customer.businessStage}/></div>
              <Select value={customer.businessStage} onValueChange={(value) => saveBusinessStage(value as BusinessStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_STAGES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2"><Label>行程状态</Label><StatusBadge status={customer.itineraryStatus}/></div>
              <Select value={customer.itineraryStatus} onValueChange={(value) => openStatus("itinerary", value as ItineraryStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITINERARY_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="size-3"/> {dateTime(customer.itineraryStatusUpdatedAt)}
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2"><Label>报价状态</Label><StatusBadge status={customer.quotationStatus}/></div>
              <Select value={customer.quotationStatus} onValueChange={(value) => openStatus("quotation", value as QuotationStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUOTATION_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="size-3"/> {dateTime(customer.quotationStatusUpdatedAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {[
            ["最新行程要求", latestItinerary],
            ["最新报价要求", latestQuotation],
        ].map(([label, request]) => (<div key={String(label)} className="rounded-lg border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                <p className="crm-label">{String(label)}</p>
                <p className="mt-2.5 whitespace-pre-wrap leading-6 text-slate-800">{typeof request === "object" ? request?.content : "—"}</p>
                {typeof request === "object" && request && (<div className="mt-2 flex items-center gap-2"><p className="font-mono text-[10px] text-muted-foreground">{request.status} · {dateTime(request.createdAt)}</p><Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-[11px]" onClick={() => openStatus(requestTypeForLabel(String(label)), request.status as ItineraryStatus | QuotationStatus)}>修改要求</Button></div>)}
                <PlanningCollaboration customer={customer} topic={String(label).includes("报价") ? "quotation" : "itinerary"} currentUserId={currentUserId}/>
              </div>))}
          </div>

          <details className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50">查看全部规划要求历史</summary>
            <div className="divide-y divide-slate-100 border-t border-slate-200/70">
              {customer.planningRequests.length ? customer.planningRequests.map((request) => (<div key={request.id} className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{request.requestType === "itinerary" ? "行程" : "报价"} · {request.status}</span>
                    <time className="font-mono text-[10px] text-muted-foreground">{dateTime(request.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5">{request.content}</p>
                </div>)) : <p className="p-3 text-muted-foreground">暂无规划要求</p>}
            </div>
          </details>
        </CardContent>
      </Card>

      <Dialog open={Boolean(requestType)} onOpenChange={(open) => !open && setRequestType(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>修改{requestType === "itinerary" ? "行程" : "报价"}状态</DialogTitle>
            <DialogDescription>记录本次状态变化和规划要求，提交后会永久保留在历史中。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{planningRequestRequired(requestType ?? "itinerary", nextStatus) ? "规划或修改要求（必填）" : "补充要求（选填）"}</Label>
            <Textarea rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录本次规划要求；提交后会永久保留在历史中"/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestType(null)}>取消</Button>
            <Button onClick={saveProgress} disabled={pending || (planningRequestRequired(requestType ?? "itinerary", nextStatus) && !content.trim())}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wonInfoOpen} onOpenChange={setWonInfoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>修改成交信息</DialogTitle>
            <DialogDescription>成交金额和日期更新后会同步写入客户资料修改历史与 Dashboard。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="won-info-amount">成交总金额（人民币）</Label>
              <Input id="won-info-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="won-info-date">成交日期</Label>
              <Input id="won-info-date" type="date" value={wonDate} onChange={(event) => setWonDate(event.target.value)}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWonInfoOpen(false)}>取消</Button>
            <Button onClick={saveWonInfo} disabled={pending || amount === "" || Number(amount) < 0 || !wonDate}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);
}
