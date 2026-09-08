"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getServiceHistoryAction } from "@/app/actions/service-history-actions";
import { acknowledgeOperationChangeAction } from "@/app/actions/customer-archive-actions";
type Row = Record<string, unknown>;
const time = (value: unknown) => new Date(String(value)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
const labels: Record<string, string> = { title: '服务名称', details: '服务内容', city: '城市', service_date: '服务日期', summary: '旅游线路', route_text: '旅游线路', customer_unit_quote: '客户单价', invoice_unit_cost: '预计成本单价', quantity: '数量', full_name: '旅客姓名', traveler_type: '旅客类型', age: '年龄', height_cm: '身高', passport_number: '护照号码', start_date: '开始日期', end_date: '结束日期', hotel_information: '酒店信息', customer_notes: '注意事项', special_requirements: '特殊需求' };
const value = (v: unknown) => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
export function OperationChangeHistory({ caseId, customerId }: {
    caseId: string;
    customerId: string;
}) {
    const [openOnly, setOpenOnly] = useState(true), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
    const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0), [role, setRole] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(true);
    const [confirmation, setConfirmation] = useState<{
        id: string;
        identity: 'planner' | 'operations';
    } | null>(null), [reason, setReason] = useState('');
    useEffect(() => { let live = true; void getServiceHistoryAction(caseId, page, openOnly).then(result => { if (!live)
        return; if (result.ok) {
        setRows(result.rows);
        setTotal(result.total);
        setRole(result.role);
        setError('');
    }
    else
        setError(result.error); }).catch(() => { if (live)
        setError('读取失败，请重试'); }).finally(() => { if (live)
        setBusy(false); }); return () => { live = false; }; }, [caseId, page, openOnly, refresh]);
    async function ack(id: string, identity: 'planner' | 'operations', explanation?: string) {
        if (role === 'admin' && explanation === undefined) {
            setReason('');
            setError('');
            setConfirmation({ id, identity });
            return;
        }
        if (role === 'admin' && (explanation?.trim().length ?? 0) < 2) {
            setError('请填写至少 2 个字的代确认原因');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await acknowledgeOperationChangeAction({ customerId, eventId: id, role: identity, reason: explanation });
            if (!result.ok)
                setError(result.error);
            else {
                setConfirmation(null);
                setRefresh(n => n + 1);
            }
        }
        catch {
            setError('确认失败，请重试');
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="space-y-4 rounded-xl border bg-card p-5" id="service-change-history"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">服务清单变更与确认</h2><p className="mt-1 text-sm text-muted-foreground">北京时间行程期间的变更，须规划师和计调分别确认；管理员代确认须说明原因。</p></div><div className="flex gap-2"><Button variant={openOnly ? 'default' : 'outline'} onClick={() => { setBusy(true); setOpenOnly(true); setPage(1); setRefresh(n => n + 1); }}>待确认提醒</Button><Button variant={!openOnly ? 'default' : 'outline'} onClick={() => { setBusy(true); setOpenOnly(false); setPage(1); setRefresh(n => n + 1); }}>全部历史</Button></div></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => setRefresh(n => n + 1)}>重试</button></p>}
    <p role="status" className="text-sm font-medium">{busy ? '正在读取 / 保存…' : `${openOnly ? '待确认' : '历史'}共 ${total} 条`}</p>
    {!busy && !rows.length && <p className="rounded-lg bg-muted p-4 text-sm">{openOnly ? '当前没有待确认的强提醒。' : '暂无服务清单变更。'}</p>}
    {rows.map(row => { const before = (row.old_value ?? {}) as Row, after = (row.new_value ?? {}) as Row; const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => !['updated_at', 'revision'].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])); const pending = Boolean(row.strong_alert) && (!row.planner_ack_at || !row.operations_ack_at); return <article key={String(row.id)} className={`rounded-lg border p-4 ${pending ? 'border-amber-400 bg-amber-50' : ''}`}><div className="flex flex-wrap gap-2 text-sm"><strong>{({ day: 'Day', case: '客户资料', traveler: '旅客资料', contact: '联系人', service_item: '服务项目' } as Record<string, string>)[String(row.entity_type)]} · {({ created: '新增', updated: '修改', deleted: '删除' } as Record<string, string>)[String(row.action)]}</strong><span>{time(row.created_at)} · {String(row.actor_name_snapshot ?? '历史系统记录')}</span>{pending && <strong className="text-amber-900">强提醒 · 尚未双确认</strong>}</div><details className="mt-3 text-sm"><summary className="cursor-pointer">查看修改前后差异（{keys.length} 项）</summary><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[440px] text-left"><thead><tr><th className="py-2">字段</th><th>修改前</th><th>修改后</th></tr></thead><tbody>{keys.map(k => <tr key={k} className="border-t"><td className="py-2 pr-3">{labels[k] ?? k}</td><td className="max-w-sm whitespace-pre-wrap break-words p-2 text-muted-foreground">{value(before[k])}</td><td className="max-w-sm whitespace-pre-wrap break-words p-2">{value(after[k])}</td></tr>)}</tbody></table></div></details>{Boolean(row.strong_alert) && <div className="mt-3 flex flex-wrap gap-2">{(['planner', 'operations'] as const).map(identity => <Button key={identity} size="sm" variant={row[`${identity}_ack_at`] ? 'outline' : 'default'} disabled={busy || Boolean(row[`${identity}_ack_at`]) || (role !== 'admin' && role !== identity)} onClick={() => void ack(String(row.id), identity)}>{identity === 'planner' ? '规划师' : '计调'}{row[`${identity}_ack_at`] ? `已确认 · ${time(row[`${identity}_ack_at`])}` : role === 'admin' ? '代确认' : '确认'}</Button>)}</div>}{((row.operation_change_acknowledgements ?? []) as Row[]).map(a => <p key={String(a.id)} className="mt-2 text-xs text-muted-foreground">{String(a.actor_name_snapshot)} · {a.confirmation_role === 'planner' ? '规划师' : '计调'}身份 · {time(a.created_at)}{a.reason ? ` · 代确认原因：${String(a.reason)}` : ''}</p>)}</article>; })}
    <div className="flex items-center justify-between gap-3 text-sm"><Button variant="outline" disabled={busy || page === 1} onClick={() => setPage(p => p - 1)}>上一页</Button><span>第 {page} / {Math.max(1, Math.ceil(total / 20))} 页</span><Button variant="outline" disabled={busy || page * 20 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button></div>
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy)
        setConfirmation(null); }}><DialogContent><DialogTitle>管理员代确认</DialogTitle><DialogDescription>以{confirmation?.identity === 'planner' ? '规划师' : '计调'}身份确认本条变更。身份、原因、操作者和时间将永久保留。</DialogDescription><label className="grid gap-2 text-sm">代确认原因<Textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} placeholder="说明为什么由管理员代为确认"/></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>取消</Button><Button disabled={busy || reason.trim().length < 2} onClick={() => confirmation && void ack(confirmation.id, confirmation.identity, reason)}>确认并永久记录</Button></div></DialogContent></Dialog>
  </section>;
}
