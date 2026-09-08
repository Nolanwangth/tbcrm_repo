"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, OPERATION_CATEGORIES, type OperationCategory, type OperationServiceItem } from "@/lib/operations";
import { saveInlineServiceAction } from "@/app/actions/inline-service-actions";
const initial = (item: OperationServiceItem, route: string) => ({ route_text: item.routeText ?? route, category: item.category, title: item.title, details: item.details ?? '', quote: item.customerUnitQuote == null ? '' : String(item.customerUnitQuote * item.quantity), cost: item.invoiceUnitCost == null ? '' : String(item.invoiceUnitCost * item.quantity), date: item.serviceDate ?? '' });
const cls = 'w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-2 text-sm hover:border-input focus:border-input focus:bg-white';
export function InlineServiceRow({ item, route, onDetails, onDelete, onSaved }: {
    item: OperationServiceItem;
    route: string;
    onDetails: () => void;
    onDelete: () => void;
    onSaved: () => void;
}) {
    const router = useRouter();
    const [draft, setDraft] = useState(() => initial(item, route)), [baseline, setBaseline] = useState(() => JSON.stringify(initial(item, route))), [revision, setRevision] = useState(item.revision ?? 0), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const dirty = JSON.stringify(draft) !== baseline;
    useEffect(() => { if (!dirty && (item.revision ?? 0) > revision) {
        const next = initial(item, route);
        setDraft(next);
        setBaseline(JSON.stringify(next));
        setRevision(item.revision ?? 0);
    } }, [item, route, dirty, revision]);
    useEffect(() => { const fn = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', fn); return () => window.removeEventListener('beforeunload', fn); }, [dirty]);
    async function save() { setBusy(true); setError(''); try {
        const result = await saveInlineServiceAction(item.caseId, item.id, revision, { route_text: draft.route_text, category: draft.category, title: draft.title, details: draft.details, customer_unit_quote: draft.quote === '' ? null : Number(draft.quote) / item.quantity, invoice_unit_cost: draft.cost === '' ? null : Number(draft.cost) / item.quantity, service_date: draft.date || null });
        if (!result.ok)
            setError(result.error);
        else {
            setRevision(result.revision);
            setBaseline(JSON.stringify(draft));
            router.refresh();
            onSaved();
        }
    }
    catch {
        setError('保存失败，本地输入已保留，请重试');
    }
    finally {
        setBusy(false);
    } }
    return <><tr data-service-dirty={dirty} className={`border-t align-top ${dirty ? 'bg-amber-50/60' : 'bg-white'}`}><td className="min-w-40 p-2"><textarea aria-label={`${item.title}旅游线路`} className={cls} rows={2} value={draft.route_text} onChange={e => setDraft({ ...draft, route_text: e.target.value })}/></td><td className="min-w-28 p-2"><select aria-label={`${item.title}服务项目`} className={cls} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as OperationCategory })}>{OPERATION_CATEGORIES.filter(c => item.section === "hotel" ? c === "hotel" : item.section === "transport" ? ["flight", "rail", "other_transport"].includes(c) : !["hotel", "flight", "rail", "other_transport"].includes(c)).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></td><td className="min-w-60 p-2"><input aria-label="服务名称" className={`${cls} font-medium`} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/><textarea aria-label={`${item.title}服务内容`} className={cls} rows={2} value={draft.details} onChange={e => setDraft({ ...draft, details: e.target.value })}/><p className="px-2 text-xs text-muted-foreground">{item.quantity} {item.unit} · 金额按整项输入</p></td><td className="min-w-28 p-2"><input aria-label={`${item.title}报价金额`} className={cls} type="number" min="0" step="0.01" value={draft.quote} onChange={e => setDraft({ ...draft, quote: e.target.value })}/></td><td className="min-w-28 p-2"><input aria-label={`${item.title}预计成本`} className={cls} type="number" min="0" step="0.01" value={draft.cost} onChange={e => setDraft({ ...draft, cost: e.target.value })}/></td><td className="min-w-40 p-2"><input aria-label={`${item.title}日期`} className={cls} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}/></td><td className="min-w-44 p-2"><div className="flex flex-wrap gap-1"><Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>保存</Button><Button size="sm" variant="outline" disabled={dirty} onClick={onDetails}>详细编辑</Button><Button size="sm" variant="ghost" disabled={busy} onClick={onDelete}>删除</Button></div>{dirty && <button className="mt-2 text-xs underline" onClick={() => { const next = initial(item, route); setDraft(next); setBaseline(JSON.stringify(next)); setRevision(item.revision ?? 0); setError(''); router.refresh(); }}>放弃本地输入并重新加载</button>}</td></tr>{error && <tr><td colSpan={7} role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</td></tr>}</>;
}
