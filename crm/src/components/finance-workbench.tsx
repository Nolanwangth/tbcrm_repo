"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDollarSign, Clock3, Eye, FileCheck2, FileText, Landmark, PiggyBank, Plus, ReceiptText, Upload, WalletCards, X, } from "lucide-react";
import { createFinanceClaimAction, registerFinancePaymentAction, reviewFinanceClaimAction, } from "@/app/actions/finance-actions";
import { PageHeading } from "@/components/page-heading";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_CLAIM_STATUS_LABELS, FINANCE_CLAIM_TYPE_LABELS, financeClaimedAmounts, financeClaimPaymentSummary, operationItemClaimBaseAmount, validateFinancePayment, validateFinanceClaimInput, type FinanceClaim, type FinanceClaimStatus, type FinanceClaimType, type FinanceOperationItem, type FinanceOperationOption, } from "@/lib/finance";
import { CATEGORY_LABELS } from "@/lib/operations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OperationRevenueLedger } from "@/components/operation-revenue-ledger";
import type { OperationRevenueItem } from "@/lib/repositories/operation-revenue";
import type { ServiceFinanceControl } from "@/lib/repositories/operation-service-finance";
import { ServiceCostReconciliation } from "@/components/service-cost-reconciliation";
type FinanceFilter = "all" | "pending" | "payable" | "paid";
const money = (value: number) => new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
}).format(value);
const dateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(value))
    : "—";
function nowForDateTimeInput() {
    const value = new Date();
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 16);
}
function statusClass(status: FinanceClaimStatus) {
    return {
        pending: "border-amber-200 bg-amber-50 text-amber-700",
        approved: "border-blue-200 bg-blue-50 text-blue-700",
        rejected: "border-rose-200 bg-rose-50 text-rose-700",
        partially_paid: "border-violet-200 bg-violet-50 text-violet-700",
        paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }[status];
}
function StatusBadge({ status }: {
    status: FinanceClaimStatus;
}) {
    return (<Badge variant="outline" className={statusClass(status)}>
      {FINANCE_CLAIM_STATUS_LABELS[status]}
    </Badge>);
}
function itemAmount(item: FinanceOperationItem) {
    return operationItemClaimBaseAmount(item);
}
export function FinanceWorkbench({ canManageFinance = false, claims, operations, revenueItems, serviceFinanceControls, }: {
    canManageFinance?: boolean;
    claims: FinanceClaim[];
    operations: FinanceOperationOption[];
    revenueItems?: OperationRevenueItem[];
    serviceFinanceControls?: ServiceFinanceControl[];
}) {
    const router = useRouter();
    const [workspace, setWorkspace] = useState<"overview" | "claims">("overview");
    const [filter, setFilter] = useState<FinanceFilter>("all");
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedOperationId, setSelectedOperationId] = useState("");
    const [claimType, setClaimType] = useState<FinanceClaimType>("personal_reimbursement");
    const [payeeName, setPayeeName] = useState("");
    const [claimNote, setClaimNote] = useState("");
    const [selectedAmounts, setSelectedAmounts] = useState<Record<string, string>>({});
    const [reviewClaim, setReviewClaim] = useState<FinanceClaim | null>(null);
    const [financeName] = useState("当前登录用户");
    const [reviewNote, setReviewNote] = useState("");
    const [paymentClaim, setPaymentClaim] = useState<FinanceClaim | null>(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentAt, setPaymentAt] = useState(nowForDateTimeInput);
    const [paymentNote, setPaymentNote] = useState("");
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [detailClaim, setDetailClaim] = useState<FinanceClaim | null>(null);
    const [busy, setBusy] = useState(false);
    const claimedAmounts = useMemo(() => financeClaimedAmounts(claims), [claims]);
    const selectedOperation = operations.find((operation) => operation.id === selectedOperationId) ?? null;
    const selectedItems = selectedOperation?.items.filter((item) => {
        const available = itemAmount(item) - (claimedAmounts.get(item.id) ?? 0);
        return item.bookingStatus !== "cancelled" && itemAmount(item) > 0 && available > 0;
    }) ?? [];
    const filteredClaims = claims.filter((claim) => {
        if (filter === "pending")
            return claim.status === "pending";
        if (filter === "payable")
            return claim.status === "approved" || claim.status === "partially_paid";
        if (filter === "paid")
            return claim.status === "paid";
        return true;
    });
    const pendingClaims = claims.filter((claim) => claim.status === "pending");
    const payableClaims = claims.filter((claim) => claim.status === "approved" || claim.status === "partially_paid");
    const pendingAmount = pendingClaims.reduce((sum, claim) => sum + claim.amount, 0);
    const payableAmount = payableClaims.reduce((sum, claim) => sum + financeClaimPaymentSummary(claim).remaining, 0);
    const paidAmount = claims.reduce((sum, claim) => sum + financeClaimPaymentSummary(claim).paid, 0);
    const activeRevenueItems = (revenueItems ?? []).filter((item) => !item.voidedAt);
    const plannedRevenue = activeRevenueItems.reduce((sum, item) => sum + item.plannedAmount, 0);
    const receivedRevenue = activeRevenueItems.reduce((sum, item) => sum + item.receivedAmount, 0);
    const serviceCostRows = operations.flatMap((operation) => operation.items.map((item) => ({ operation, item })))
        .filter(({ item }) => (item.finalSupplierSettlement ?? (item.invoiceUnitCost ?? 0) * item.quantity) > 0);
    const totalServiceCost = serviceCostRows.reduce((sum, { item }) => sum + operationItemClaimBaseAmount(item), 0);
    const unreconciledPublicCost = serviceCostRows.reduce((sum, { item }) => {
        const control = serviceFinanceControls?.find((entry) => entry.serviceItemId === item.id);
        const channel = control?.paymentChannel ?? (["guide", "driver"].includes(item.category) ? "personal" : "public");
        return channel === "public" && control?.reconciliationStatus !== "reconciled"
            ? sum + operationItemClaimBaseAmount(item)
            : sum;
    }, 0);
    const forecastProfit = plannedRevenue - totalServiceCost;
    const forecastMargin = plannedRevenue > 0 ? (forecastProfit / plannedRevenue) * 100 : 0;
    function chooseOperation(operationId: string) {
        setSelectedOperationId(operationId);
        const operation = operations.find((item) => item.id === operationId);
        const next: Record<string, string> = {};
        operation?.items.forEach((item) => {
            const available = itemAmount(item) - (claimedAmounts.get(item.id) ?? 0);
            if (claimType === "personal_reimbursement" && item.bookingStatus !== "cancelled" && available > 0) {
                next[item.id] = available.toFixed(2);
            }
        });
        setSelectedAmounts(next);
    }
    function chooseClaimType(value: FinanceClaimType) {
        setClaimType(value);
        setPayeeName("");
        setSelectedAmounts({});
    }
    function resetCreate() {
        setSelectedOperationId("");
        setClaimType("personal_reimbursement");
        setPayeeName("");
        setClaimNote("");
        setSelectedAmounts({});
    }
    async function submitClaim() {
        const items = Object.entries(selectedAmounts)
            .map(([itemId, amount]) => ({ itemId, amount: Number(amount) }))
            .filter((item) => Number.isFinite(item.amount) && item.amount > 0);
        const chosenItems = selectedItems.filter((item) => items.some((entry) => entry.itemId === item.id));
        const claimValidation = validateFinanceClaimInput({ claimType, payeeName, selectedItems: chosenItems });
        if (claimValidation)
            return toast.error(claimValidation);
        setBusy(true);
        const result = await createFinanceClaimAction({
            operationCaseId: selectedOperationId,
            claimType,
            payeeName,
            note: claimNote,
            items,
        });
        setBusy(false);
        if (!result.ok)
            return toast.error(result.error);
        toast.success("费用申请已提交财务审核");
        setCreateOpen(false);
        resetCreate();
        router.refresh();
    }
    async function review(decision: "approved" | "rejected") {
        if (!reviewClaim)
            return;
        setBusy(true);
        const result = await reviewFinanceClaimAction({
            claimId: reviewClaim.id,
            decision,
            financeName,
            note: reviewNote,
        });
        setBusy(false);
        if (!result.ok)
            return toast.error(result.error);
        toast.success(decision === "approved" ? "报账单已审核通过" : "报账单已驳回");
        setReviewClaim(null);
        setReviewNote("");
        router.refresh();
    }
    function openPayment(claim: FinanceClaim) {
        const summary = financeClaimPaymentSummary(claim);
        setPaymentClaim(claim);
        setPaymentAmount(summary.remaining.toFixed(2));
        setPaymentAt(nowForDateTimeInput());
        setPaymentNote("");
        setReceiptFile(null);
    }
    async function submitPayment() {
        if (!paymentClaim)
            return;
        const summary = financeClaimPaymentSummary(paymentClaim);
        const validationError = validateFinancePayment({
            amount: Number(paymentAmount),
            remaining: summary.remaining,
            paidAt: paymentAt,
            paidByName: financeName,
            hasReceipt: Boolean(receiptFile),
        });
        if (validationError)
            return toast.error(validationError);
        const form = new FormData();
        form.set("claimId", paymentClaim.id);
        form.set("amount", paymentAmount);
        form.set("paidAt", new Date(paymentAt).toISOString());
        form.set("financeName", financeName);
        form.set("note", paymentNote);
        form.set("receipt", receiptFile!);
        setBusy(true);
        const result = await registerFinancePaymentAction(form);
        setBusy(false);
        if (!result.ok)
            return toast.error(result.error);
        toast.success(Number(paymentAmount) === summary.remaining ? "付款已登记，报账单已付清" : "本次付款已登记");
        setPaymentClaim(null);
        router.refresh();
    }
    return (<>
      <PageHeading eyebrow="FINANCE COLLABORATION" title="报账中心" description={workspace === "claims" ? "处理个人报销、供应商付款、审核与分批付款回执。" : "统一查看团款收入、服务成本、对公对账与预计毛利。"} actions={workspace === "claims" ? (<Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4"/>提交费用申请
          </Button>) : undefined}/>

      <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <Button size="sm" variant={workspace === "overview" ? "default" : "ghost"} onClick={() => setWorkspace("overview")}>收入与成本概览</Button>
            <Button size="sm" variant={workspace === "claims" ? "default" : "ghost"} onClick={() => setWorkspace("claims")}>报销审批</Button>
          </div>
          <p className="text-xs text-muted-foreground">团款、成本和报销统一关联计调团组，避免重复记账。</p>
        </div>
        {workspace === "overview" && <div className="grid grid-cols-2 gap-px bg-slate-100 xl:grid-cols-4">
          <div className="bg-white p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CircleDollarSign className="size-4 text-emerald-600"/>团款计划</div><p className="mt-2 font-mono text-xl font-semibold tracking-tight text-slate-950">{money(plannedRevenue)}</p><p className="mt-1 text-xs text-emerald-700">已到账 {money(receivedRevenue)}</p></div>
          <div className="bg-white p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="size-4 text-amber-600"/>服务成本</div><p className="mt-2 font-mono text-xl font-semibold tracking-tight text-slate-950">{money(totalServiceCost)}</p><p className="mt-1 text-xs text-muted-foreground">{serviceCostRows.length} 项已录入成本</p></div>
          <div className="bg-white p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><PiggyBank className="size-4 text-blue-600"/>预计毛利</div><p className={cn("mt-2 font-mono text-xl font-semibold tracking-tight", forecastProfit >= 0 ? "text-emerald-700" : "text-rose-700")}>{activeRevenueItems.length ? money(forecastProfit) : "暂无法计算"}</p><p className="mt-1 text-xs text-muted-foreground">{activeRevenueItems.length ? `预计毛利率 ${forecastMargin.toFixed(1)}%` : "收入未录入，请先补充团款"}</p></div>
          <div className="bg-white p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4 text-rose-600"/>待对账供应商</div><p className="mt-2 font-mono text-xl font-semibold tracking-tight text-slate-950">{money(unreconciledPublicCost)}</p><p className="mt-1 text-xs text-rose-700">对公渠道，等待财务确认</p></div>
        </div>}
      </section>

      {workspace === "claims" && <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="待财务审核" value={pendingClaims.length} hint={`${money(pendingAmount)} 待审核`} icon={Clock3} tone="amber"/>
        <StatCard label="待付款" value={payableClaims.length} hint={`${money(payableAmount)} 尚未支付`} icon={WalletCards} tone="blue"/>
        <StatCard label="累计已付款" value={money(paidAmount)} hint="根据付款明细实时汇总" icon={CircleDollarSign} tone="emerald"/>
        <StatCard label="费用申请总数" value={claims.length} hint="包括报销和供应商付款" icon={ReceiptText} tone="violet"/>
      </div>

      <SectionCard title="费用申请记录" description="个人垫付报销与供应商付款使用同一审核、分批付款和回执流程。" actions={(<Tabs value={filter} onValueChange={(value) => setFilter(value as FinanceFilter)}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="pending">待审核</TabsTrigger>
              <TabsTrigger value="payable">待付款</TabsTrigger>
              <TabsTrigger value="paid">已付清</TabsTrigger>
            </TabsList>
          </Tabs>)} contentClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
              <TableHead>报账单号</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>类型 / 收款方</TableHead>
              <TableHead>申请人</TableHead>
              <TableHead>申请时间</TableHead>
              <TableHead className="text-right">报账金额</TableHead>
              <TableHead className="text-right">已付 / 待付</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClaims.map((claim) => {
                const payment = financeClaimPaymentSummary(claim);
                return (<TableRow key={claim.id}>
                  <TableCell className="font-mono text-[12px] font-medium text-slate-800">{claim.claimNo}</TableCell>
                  <TableCell className="font-medium text-slate-900">{claim.customerName}</TableCell>
                  <TableCell><p>{FINANCE_CLAIM_TYPE_LABELS[claim.claimType]}</p><p className="text-xs text-muted-foreground">{claim.payeeName}</p></TableCell>
                  <TableCell>{claim.applicantName}</TableCell>
                  <TableCell>{dateTime(claim.submittedAt)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{money(claim.amount)}</TableCell>
                  <TableCell className="text-right font-mono text-[12px]">
                    <span className="text-emerald-700">{money(payment.paid)}</span>
                    <span className="px-1 text-slate-300">/</span>
                    <span className="text-slate-600">{money(payment.remaining)}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={claim.status}/></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setDetailClaim(claim)}>
                        <Eye className="size-3.5"/>查看
                      </Button>
                      {canManageFinance && claim.status === "pending" && (<Button size="sm" onClick={() => {
                            setReviewClaim(claim);
                            setReviewNote("");
                        }}>
                          <FileCheck2 className="size-3.5"/>审核
                        </Button>)}
                      {canManageFinance && (claim.status === "approved" || claim.status === "partially_paid") && (<Button size="sm" onClick={() => openPayment(claim)}>
                          <WalletCards className="size-3.5"/>登记付款
                        </Button>)}
                    </div>
                  </TableCell>
                </TableRow>);
            })}
            {!filteredClaims.length && (<TableRow>
                <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                  当前筛选下暂无费用申请
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </SectionCard>
      </>}

      {workspace === "overview" && <>
        <section className="mb-5 rounded-xl border border-blue-100 bg-blue-50/45 p-4">
          <h2 className="text-sm font-semibold text-slate-900">收入、成本与报销分流</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">对公费用在成本明细完成对账；导游、车辆等个人垫付进入报销审批。所有金额继续以团组服务项与报账单为准。</p>
        </section>
        {revenueItems && <OperationRevenueLedger items={revenueItems} tours={operations.map((operation) => ({ id: operation.id, customerName: operation.customerName, tourCode: operation.tourCode ?? "—", tourName: operation.tourName ?? operation.customerName }))}/>}
        {serviceFinanceControls && <ServiceCostReconciliation operations={operations} controls={serviceFinanceControls}/>}
      </>}

      <Dialog open={createOpen} onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open)
                resetCreate();
        }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>提交费用申请</DialogTitle>
            <DialogDescription>选择个人垫付报销或供应商付款，再关联尚有可申请余额的计调费用。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>申请类型</Label>
                <Select value={claimType} onValueChange={(value) => chooseClaimType(value as FinanceClaimType)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal_reimbursement">个人垫付报销</SelectItem>
                    <SelectItem value="supplier_payment">供应商付款</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>计调客户</Label>
                <Select value={selectedOperationId} onValueChange={chooseOperation}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="请选择成交客户"/></SelectTrigger>
                  <SelectContent>
                    {operations.map((operation) => (<SelectItem key={operation.id} value={operation.id}>
                        {operation.customerName}{operation.ownerName ? ` · ${operation.ownerName}` : ""}
                      </SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="finance-payee">收款方</Label>
                <Input id="finance-payee" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} placeholder={claimType === "supplier_payment" ? "必须与所选服务的供应商一致" : "例如张导、李师傅"}/>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-800">申请人自动记录为当前登录账号；供应商付款一张申请只能选择同一供应商。</div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-medium text-slate-700">
                选择申请费用
              </div>
              <ScrollArea className="h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>服务项目</TableHead>
                      <TableHead>供应商</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">可报金额</TableHead>
                      <TableHead className="w-36 text-right">本次报账</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item) => {
            const available = itemAmount(item) - (claimedAmounts.get(item.id) ?? 0);
            const checked = Object.hasOwn(selectedAmounts, item.id);
            const selectedSupplier = selectedItems.find((entry) => Object.hasOwn(selectedAmounts, entry.id))?.supplierName?.trim() ?? "";
            const supplierBlocked = claimType === "supplier_payment" && Boolean(!item.supplierName?.trim() || (selectedSupplier && item.supplierName.trim() !== selectedSupplier));
            return (<TableRow key={item.id} data-state={checked ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox checked={checked} disabled={supplierBlocked} onCheckedChange={(value) => setSelectedAmounts((current) => {
                    if (value) {
                        if (claimType === "supplier_payment" && item.supplierName)
                            setPayeeName(item.supplierName.trim());
                        return { ...current, [item.id]: available.toFixed(2) };
                    }
                    const next = { ...current };
                    delete next[item.id];
                    return next;
                })}/>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-slate-900">{item.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{CATEGORY_LABELS[item.category]}</p>
                          </TableCell>
                          <TableCell>{item.supplierName ?? "未填写"}</TableCell>
                          <TableCell>{item.serviceDate ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono">{money(available)}</TableCell>
                          <TableCell>
                            <Input type="number" min="0.01" max={available} step="0.01" disabled={!checked || supplierBlocked} value={selectedAmounts[item.id] ?? ""} onChange={(event) => setSelectedAmounts((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                }))} className="text-right font-mono"/>
                          </TableCell>
                        </TableRow>);
        })}
                    {selectedOperation && !selectedItems.length && (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">该客户暂无可报账费用</TableCell></TableRow>)}
                    {!selectedOperation && (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">请先选择计调客户</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="finance-claim-note">申请说明</Label>
              <Textarea id="finance-claim-note" value={claimNote} onChange={(event) => setClaimNote(event.target.value)} placeholder="选填，例如完团成本、需优先支付的供应商等"/>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-[13px]">
              <span className="text-blue-700">本次申请合计</span>
              <strong className="font-mono text-[16px] text-blue-800">
                {money(Object.values(selectedAmounts).reduce((sum, value) => sum + (Number(value) || 0), 0))}
              </strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={busy} onClick={submitClaim}>{busy ? "提交中…" : "提交财务审核"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewClaim)} onOpenChange={(open) => !open && setReviewClaim(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>财务审核</DialogTitle>
            <DialogDescription>
              {reviewClaim ? `${reviewClaim.claimNo} · ${reviewClaim.customerName} · ${money(reviewClaim.amount)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-800">审核人将自动记录为当前登录账号。</div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-review-note">审核意见</Label>
              <Textarea id="finance-review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="驳回时必须填写原因"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" disabled={busy} onClick={() => review("rejected")}>
              <X className="size-4"/>驳回
            </Button>
            <Button disabled={busy} onClick={() => review("approved")}>
              <Check className="size-4"/>审核通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentClaim)} onOpenChange={(open) => !open && setPaymentClaim(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>登记付款</DialogTitle>
            <DialogDescription>
              {paymentClaim ? `${paymentClaim.claimNo} · 剩余 ${money(financeClaimPaymentSummary(paymentClaim).remaining)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="finance-payment-amount">实付金额</Label>
              <Input id="finance-payment-amount" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-payment-at">付款时间</Label>
              <Input id="finance-payment-at" type="datetime-local" value={paymentAt} onChange={(event) => setPaymentAt(event.target.value)}/>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-800 sm:col-span-2">付款经办人将自动记录为当前登录账号。</div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="finance-receipt">付款回执</Label>
              <label className={cn("flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed px-4 text-[13px] transition-colors", receiptFile ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50")}>
                <Upload className="size-4"/>
                <span>{receiptFile ? receiptFile.name : "选择图片或 PDF 回执（最大 20 MB）"}</span>
                <input id="finance-receipt" type="file" className="sr-only" accept="image/*,.pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}/>
              </label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="finance-payment-note">付款备注</Label>
              <Textarea id="finance-payment-note" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="选填"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentClaim(null)}>取消</Button>
            <Button disabled={busy} onClick={submitPayment}>{busy ? "保存中…" : "保存付款记录"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailClaim)} onOpenChange={(open) => !open && setDetailClaim(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>费用申请详情</DialogTitle>
            <DialogDescription>
              {detailClaim ? `${detailClaim.claimNo} · ${detailClaim.customerName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailClaim && (<ScrollArea className="max-h-[65vh] pr-3">
              <div className="grid gap-5">
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[13px] sm:grid-cols-4">
                  <div><p className="text-muted-foreground">状态</p><div className="mt-1"><StatusBadge status={detailClaim.status}/></div></div>
                  <div><p className="text-muted-foreground">类型 / 收款方</p><p className="mt-1 font-medium">{FINANCE_CLAIM_TYPE_LABELS[detailClaim.claimType]} · {detailClaim.payeeName}</p></div>
                  <div><p className="text-muted-foreground">申请人</p><p className="mt-1 font-medium">{detailClaim.applicantName}</p></div>
                  <div><p className="text-muted-foreground">申请金额</p><p className="mt-1 font-mono font-semibold">{money(detailClaim.amount)}</p></div>
                </div>
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-slate-900">费用明细</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader><TableRow><TableHead>项目</TableHead><TableHead>供应商</TableHead><TableHead>日期</TableHead><TableHead className="text-right">金额</TableHead><TableHead>凭证</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {detailClaim.items.map((item) => (<TableRow key={item.id}>
                            <TableCell>{item.title}</TableCell>
                            <TableCell>{item.supplierName ?? "—"}</TableCell>
                            <TableCell>{item.serviceDate ?? "—"}</TableCell>
                            <TableCell className="text-right font-mono">{money(item.requestedAmount)}</TableCell>
                            <TableCell>{item.invoiceFileId ? <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href={`/api/files/${item.invoiceFileId}/download`}><FileText className="size-3.5"/>发票</a> : "—"}</TableCell>
                          </TableRow>))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-slate-900">付款记录</h3>
                  {detailClaim.payments.length ? (<div className="space-y-2">
                      {detailClaim.payments.map((payment) => (<div key={payment.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 text-[12px] sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{money(payment.amount)} · {payment.paidByName}</p>
                            <p className="mt-1 text-muted-foreground">付款时间：{dateTime(payment.paidAt)}</p>
                          </div>
                          <a className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline" href={`/api/files/${payment.receiptFileId}/download`}>
                            <ReceiptText className="size-4"/>{payment.receiptFileName}
                          </a>
                        </div>))}
                    </div>) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-[12px] text-muted-foreground">尚未登记付款</p>}
                </div>
              </div>
            </ScrollArea>)}
        </DialogContent>
      </Dialog>
    </>);
}
