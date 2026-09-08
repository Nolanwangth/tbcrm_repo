"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createOperationRevenueItemAction, recordOperationRevenueReceiptAction } from "@/app/actions/operation-revenue-actions";
import type { OperationRevenueItem } from "@/lib/repositories/operation-revenue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
type Tour = {
    id: string;
    customerName: string;
    tourCode: string;
    tourName: string;
};
const money = (amount: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 }).format(amount);
const kinds = { group_fee: "团款", deposit: "定金", balance: "尾款", addon: "增项", other: "其他" } as const;
export function OperationRevenueLedger({ items, tours }: {
    items: OperationRevenueItem[];
    tours: Tour[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [receiptTarget, setReceiptTarget] = useState<OperationRevenueItem | null>(null);
    const [pending, startTransition] = useTransition();
    const [caseId, setCaseId] = useState("");
    const [kind, setKind] = useState<keyof typeof kinds>("group_fee");
    const [title, setTitle] = useState("");
    const [plannedAmount, setPlannedAmount] = useState("");
    const [note, setNote] = useState("");
    const [receiptAmount, setReceiptAmount] = useState("");
    const [receiptAt, setReceiptAt] = useState(new Date().toISOString().slice(0, 16));
    const [method, setMethod] = useState("bank_transfer");
    const totalPlanned = items.filter((item) => !item.voidedAt).reduce((sum, item) => sum + item.plannedAmount, 0);
    const totalReceived = items.filter((item) => !item.voidedAt).reduce((sum, item) => sum + item.receivedAmount, 0);
    function create() { startTransition(async () => { const result = await createOperationRevenueItemAction({ caseId, kind, title, plannedAmount: Number(plannedAmount), note }); if (!result.ok) {
        toast.error(result.error);
        return;
    } toast.success("团款计划已新增"); setCreateOpen(false); setCaseId(""); setTitle(""); setPlannedAmount(""); setNote(""); }); }
    function receipt() { if (!receiptTarget)
        return; startTransition(async () => { const result = await recordOperationRevenueReceiptAction({ revenueItemId: receiptTarget.id, amount: Number(receiptAmount), receivedAt: new Date(receiptAt).toISOString(), method: method as "bank_transfer", }); if (!result.ok) {
        toast.error(result.error);
        return;
    } toast.success("收款已登记"); setReceiptTarget(null); setReceiptAmount(""); }); }
    return <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="text-sm font-semibold text-slate-900">团款收入台账</h2><p className="mt-1 text-xs text-muted-foreground">按具体团组记录应收、实收及收款方式；费用申请与付款仍以报账单为唯一事实来源。</p></div><Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4"/>新增团款计划</Button></header><div className="grid grid-cols-3 border-b border-slate-100 text-sm"><div className="p-3">计划收款 <strong className="ml-2 font-mono">{money(totalPlanned)}</strong></div><div className="border-x border-slate-100 p-3">实际收款 <strong className="ml-2 font-mono text-emerald-700">{money(totalReceived)}</strong></div><div className="p-3">待收 <strong className="ml-2 font-mono text-amber-700">{money(Math.max(totalPlanned - totalReceived, 0))}</strong></div></div><Table><TableHeader><TableRow><TableHead>团组</TableHead><TableHead>款项</TableHead><TableHead className="text-right">计划 / 实收 / 待收</TableHead><TableHead>最新收款</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{items.filter((item) => !item.voidedAt).map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.tourName}</p><p className="font-mono text-[10px] text-muted-foreground">{item.tourCode} · {item.customerName}</p></TableCell><TableCell>{kinds[item.kind]} · {item.title}</TableCell><TableCell className="text-right font-mono text-xs">{money(item.plannedAmount)} / <span className="text-emerald-700">{money(item.receivedAmount)}</span> / <span className="text-amber-700">{money(item.outstandingAmount)}</span></TableCell><TableCell className="text-xs">{item.receipts[0] ? `${item.receipts[0].method} · ${item.receipts[0].receivedAt.slice(0, 10)}` : "未收款"}</TableCell><TableCell className="text-right">{item.outstandingAmount > 0 && <Button size="sm" variant="outline" onClick={() => { setReceiptTarget(item); setReceiptAmount(item.outstandingAmount.toFixed(2)); }}>登记收款</Button>}</TableCell></TableRow>)}{!items.filter((item) => !item.voidedAt).length && <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">暂无团款计划</TableCell></TableRow>}</TableBody></Table>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>新增团款计划</DialogTitle></DialogHeader><div className="grid gap-3"><div><Label>团组</Label><Select value={caseId} onValueChange={setCaseId}><SelectTrigger><SelectValue placeholder="选择团组"/></SelectTrigger><SelectContent>{tours.map((tour) => <SelectItem value={tour.id} key={tour.id}>{tour.tourCode} · {tour.tourName}</SelectItem>)}</SelectContent></Select></div><div><Label>款项类型</Label><Select value={kind} onValueChange={(value) => setKind(value as keyof typeof kinds)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(kinds).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>款项名称</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：第一期定金"/></div><div><Label>计划金额</Label><Input type="number" min="0.01" value={plannedAmount} onChange={(event) => setPlannedAmount(event.target.value)}/></div><div><Label>备注</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)}/></div></div><DialogFooter><Button onClick={create} disabled={pending || !caseId || !title || Number(plannedAmount) <= 0}>保存</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(receiptTarget)} onOpenChange={(open) => !open && setReceiptTarget(null)}><DialogContent><DialogHeader><DialogTitle>登记团款收款</DialogTitle></DialogHeader><div className="grid gap-3"><div><Label>本次金额</Label><Input type="number" min="0.01" value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)}/></div><div><Label>收款时间</Label><Input type="datetime-local" value={receiptAt} onChange={(event) => setReceiptAt(event.target.value)}/></div><div><Label>收款方式</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">银行转账</SelectItem><SelectItem value="alipay">支付宝</SelectItem><SelectItem value="wechat">微信</SelectItem><SelectItem value="cash">现金</SelectItem><SelectItem value="other">其他</SelectItem></SelectContent></Select></div></div><DialogFooter><Button onClick={receipt} disabled={pending || Number(receiptAmount) <= 0}>保存收款</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
