"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveOperationServiceFinanceControlAction } from "@/app/actions/operation-service-finance-actions";
import type { FinanceOperationOption } from "@/lib/finance";
import type { ServiceFinanceControl } from "@/lib/repositories/operation-service-finance";
import { CATEGORY_LABELS } from "@/lib/operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const money = (amount: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 }).format(amount);
const defaultChannel = (category: string) => ["guide", "driver"].includes(category) ? "personal" : "public";
export function ServiceCostReconciliation({ operations, controls }: {
    operations: FinanceOperationOption[];
    controls: ServiceFinanceControl[];
}) {
    const [pending, startTransition] = useTransition();
    const [channelFilter, setChannelFilter] = useState("all");
    const controlByItem = useMemo(() => new Map(controls.map((control) => [control.serviceItemId, control])), [controls]);
    const rows = operations.flatMap((operation) => operation.items.map((item) => ({ operation, item, control: controlByItem.get(item.id) }))).filter(({ item }) => (item.finalSupplierSettlement ?? (item.invoiceUnitCost ?? 0) * item.quantity) > 0).filter(({ item, control }) => channelFilter === "all" || (control?.paymentChannel ?? defaultChannel(item.category)) === channelFilter);
    function setControl(itemId: string, category: string, channel: "public" | "personal", reconciled: boolean, amount: number) { startTransition(async () => { const result = await saveOperationServiceFinanceControlAction({ serviceItemId: itemId, paymentChannel: channel, reconciliationStatus: reconciled ? "reconciled" : "pending", reconciledAmount: amount }); if (!result.ok) {
        toast.error(result.error);
        return;
    } toast.success(reconciled ? "对公费用已对账" : "费用渠道已更新"); }); }
    return <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="text-sm font-semibold text-slate-900">服务成本对账</h2><p className="mt-1 text-xs text-muted-foreground">沿用入境游逻辑：酒店、票务及大交通默认对公对账；导游、车辆默认走个人报销。可按项目调整。</p></div><Select value={channelFilter} onValueChange={setChannelFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部渠道</SelectItem><SelectItem value="public">对公对账</SelectItem><SelectItem value="personal">个人报销</SelectItem></SelectContent></Select></header><Table><TableHeader><TableRow><TableHead>团组 / 服务</TableHead><TableHead>类别与日期</TableHead><TableHead className="text-right">成本</TableHead><TableHead>资金渠道</TableHead><TableHead>处理状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{rows.map(({ operation, item, control }) => { const channel = control?.paymentChannel ?? defaultChannel(item.category); const amount = item.finalSupplierSettlement ?? (item.invoiceUnitCost ?? 0) * item.quantity; const reconciled = control?.reconciliationStatus === "reconciled"; return <TableRow key={item.id}><TableCell><p className="font-medium">{operation.tourName ?? operation.customerName}</p><p className="text-xs text-muted-foreground">{item.title}</p></TableCell><TableCell><p>{CATEGORY_LABELS[item.category]}</p><p className="text-xs text-muted-foreground">{item.serviceDate ?? "日期待补充"}</p></TableCell><TableCell className="text-right font-mono">{money(amount)}</TableCell><TableCell><Select value={channel} onValueChange={(value) => setControl(item.id, item.category, value as "public" | "personal", reconciled, amount)} disabled={pending}><SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">对公</SelectItem><SelectItem value="personal">个人</SelectItem></SelectContent></Select></TableCell><TableCell>{channel === "personal" ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">走报销申请</Badge> : reconciled ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">已对账</Badge> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">待对账</Badge>}</TableCell><TableCell className="text-right">{channel === "public" && <Button size="sm" variant={reconciled ? "outline" : "default"} disabled={pending} onClick={() => setControl(item.id, item.category, channel, !reconciled, amount)}>{reconciled ? "撤销对账" : "确认对账"}</Button>}</TableCell></TableRow>; })}{!rows.length && <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">暂无已填写成本的服务项目</TableCell></TableRow>}</TableBody></Table></section>;
}
