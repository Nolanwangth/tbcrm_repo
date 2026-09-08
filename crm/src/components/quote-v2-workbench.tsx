"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { shouldGuardQuoteLink } from "@/lib/quote-navigation";
import { saveQuoteV2Action, saveQuoteV2CatalogAction, saveQuoteV2GroupAction } from "@/app/actions/quote-v2-actions";
import type { QuoteV2Bootstrap, QuoteV2Customer, QuoteV2Record, QuoteV2Snapshot } from "@/lib/quote-v2";
const DirectQuotePage = dynamic(() => import("@/quote-v2/pages/DirectQuotePage").then(m => m.DirectQuotePage), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const QuickPlanPage = dynamic(() => import("@/quote-v2/pages/QuickPlanPage").then(m => m.QuickPlanPage), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const AutoDocumentPage = dynamic(() => import("@/quote-v2/pages/AutoDocumentPage").then(m => m.AutoDocumentPage), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const PriceLibraryPage = dynamic(() => import("@/quote-v2/pages/PriceLibraryPage").then(m => m.PriceLibraryPage), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const TemplateLibraryPage = dynamic(() => import("@/quote-v2/pages/TemplateLibraryPage").then(m => m.TemplateLibraryPage), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const BulkDailyFeeModal = dynamic(() => import("@/quote-v2/components/BulkDailyFeeModal").then(m => m.BulkDailyFeeModal), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const PrintPreview = dynamic(() => import("@/quote-v2/components/PrintPreview").then(m => m.PrintPreview), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
const ProformaInvoiceModal = dynamic(() => import("@/quote-v2/components/ProformaInvoiceModal").then(m => m.ProformaInvoiceModal), { loading: () => <p role="status" className="p-6 text-sm">正在加载制作工具…</p> });
import { createEmptyPlan } from "@/quote-v2/data/seed";
import { generateCustomerText, generateDirectQuoteText, quantityForUnit, synchronizeAutoQuote, synchronizeDirectQuoteDailyFees } from "@/quote-v2/lib/logic";
import { synchronizeLibraryDescriptions } from "@/quote-v2/lib/quoteLibrary";
import { GUIDE_LANGUAGES } from "@/quote-v2/types";
import type { GuideLanguage, AppSettings, DirectQuote, PriceProduct, QuoteItem, RouteTemplate } from "@/quote-v2/types";
const fingerprint = (s: QuoteV2Snapshot) => JSON.stringify(s);
function fresh(data: QuoteV2Bootstrap, kind: "quotation" | "itinerary"): QuoteV2Snapshot {
    const party = data.customer.party;
    const people = Math.max(1, (party?.adults ?? 0) + (party?.children ?? 0) + (party?.seniors ?? 0));
    const start = data.customer.startDate;
    const count = start && data.customer.endDate ? Math.max(1, Math.min(365, Math.round((Date.parse(data.customer.endDate) - Date.parse(start)) / 86400000) + 1)) : 1;
    const days = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), date: start ? new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10) : "", title: `Day ${String(i + 1).padStart(2, "0")}`, city: "" }));
    return { schemaVersion: 2, sourceVersion: "2.0.0", customerId: data.customer.id, toolType: kind, title: `${data.customer.name} · ${kind === "quotation" ? "报价" : "行程"}`, travelerCount: people, partyConfirmed: Boolean(party), groupId: data.groups[0]?.id ?? null, mode: "direct", costsHidden: false, directQuote: { people, city: "", days, items: [], updatedAt: new Date().toISOString() }, plan: { ...createEmptyPlan(), people }, itinerary: { clientName: data.customer.name, adults: party?.adults ?? 0, children: party?.children ?? 0, seniors: party?.seniors ?? 0, itineraryText: "" }, ...data.catalog };
}
export function QuoteV2Workbench({ customers, data, kind, initialVersionId, userId }: {
    customers: QuoteV2Customer[];
    data?: QuoteV2Bootstrap;
    kind: "quotation" | "itinerary";
    initialVersionId?: string;
    userId: string;
}) {
    const router = useRouter();
    const params = useSearchParams();
    const rawReturn = params.get("returnTo") ?? "";
    const sourceHref = /^\/(customers|planner|won|closed|operations|dashboard)([/?#]|$)/.test(rawReturn) && !rawReturn.includes("\\") ? rawReturn : "";
    const contextQuery = sourceHref ? `&returnTo=${encodeURIComponent(sourceHref)}` : "";
    const navigate = (href: string) => { const e = new CustomEvent("crm-quote-navigation", { cancelable: true, detail: href }); if (window.dispatchEvent(e))
        router.push(href); };
    return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3 text-sm"><Link href="/planner" className="underline underline-offset-4">← 返回行程报价制作</Link>{data && <Link href={sourceHref.startsWith(`/customers/${data.customer.id}`) ? sourceHref : `/customers/${data.customer.id}`} className="underline underline-offset-4">返回客户档案</Link>}<span className="ml-auto rounded-full border bg-card px-3 py-1 text-xs">Quick Tour Proposal 2.0 · CRM 独立运行</span></div>
    <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4"><label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">关联 CRM 客户<select className="crm-native-select" value={data?.customer.id ?? ""} onChange={e => navigate(`/planner/tools/${kind}?customerId=${e.target.value}${contextQuery}`)}><option value="">请选择客户</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}</select></label><div className="flex gap-2"><Link className={`rounded-md border px-4 py-2 text-sm ${kind === 'itinerary' ? 'bg-primary text-white' : ''}`} href={`/planner/tools/itinerary${data ? `?customerId=${data.customer.id}${contextQuery}` : ''}`}>行程制作</Link><Link className={`rounded-md border px-4 py-2 text-sm ${kind === 'quotation' ? 'bg-primary text-white' : ''}`} href={`/planner/tools/quotation${data ? `?customerId=${data.customer.id}${contextQuery}` : ''}`}>报价制作</Link></div></div>
    {data ? <QuoteV2Editor key={`${data.customer.id}:${kind}:${initialVersionId ?? params.get("draftId") ?? ""}`} initialDraftId={params.get("draftId") ?? undefined} data={data} kind={kind} initialVersionId={initialVersionId} userId={userId}/> : <section className="crm-empty"><div><h2 className="text-lg font-semibold">先选择客户，再开始制作</h2><p className="mt-2 text-sm text-muted-foreground">跟进中、已成交客户均可编辑；已关闭客户仅查看和导出历史版本。</p></div></section>}
  </div>;
}
function QuoteV2Editor({ data, kind, userId }: {
    data: QuoteV2Bootstrap;
    kind: "quotation" | "itinerary";
    initialVersionId?: string;
    initialDraftId?: string;
    userId: string;
}) {
    const router = useRouter();
    const initial = [...data.versions, ...data.drafts].find(record => record.snapshot);
    const [snapshot, setSnapshot] = useState<QuoteV2Snapshot>(() => initial?.snapshot ?? fresh(data, kind));
    const [proposalId, setProposalId] = useState(() => initial?.proposalId ?? crypto.randomUUID());
    const [revision, setRevision] = useState(initial?.revision ?? 0);
    const [versionId, setVersionId] = useState<string | null>(initial?.versionNumber ? initial.id : null);
    const [versions, setVersions] = useState(data.versions);
    const [drafts, setDrafts] = useState(data.drafts);
    const [groups, setGroups] = useState(data.groups);
    const [historyQuery, setHistoryQuery] = useState("");
    const [historyGroup, setHistoryGroup] = useState("");
    const [baseline, setBaseline] = useState(() => fingerprint(snapshot));
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [message, setMessage] = useState("");
    const [note, setNote] = useState("");
    const [panel, setPanel] = useState<"editor" | "quick" | "prices" | "templates" | "settings">(initial?.snapshot?.mode === "quick" && kind === "quotation" ? "quick" : "editor");
    const [modal, setModal] = useState<"pi" | "print" | "bulk" | null>(null);
    const [pendingNavigation, setPendingNavigation] = useState<{
        run: () => void;
    } | null>(null);
    const [recovery, setRecovery] = useState<{
        snapshot: QuoteV2Snapshot;
        proposalId: string;
        revision: number;
        note?: string;
    } | null>(null);
    const catalogRevisions = useRef({ ...data.catalogRevisions });
    const liveCatalog = useRef(data.catalog);
    const [openedCatalogs, setOpenedCatalogs] = useState<string[]>([]);
    useEffect(() => { liveCatalog.current = data.catalog; catalogRevisions.current = { ...data.catalogRevisions }; }, [data.catalog, data.catalogRevisions]);
    const publishRequest = useRef<string | null>(null);
    const historyGuard = useRef({ armed: false, approved: false });
    const host = useRef<HTMLDivElement>(null);
    const [shadow, setShadow] = useState<ShadowRoot | null>(null);
    const readOnly = Boolean(versionId) || data.customer.status === "已关闭";
    const snapshotSignature = useMemo(() => fingerprint(snapshot), [snapshot]);
    const dirty = !readOnly && (snapshotSignature !== baseline || note !== "");
    const storageKey = `crm-quote-v2:${userId}:${data.customer.id}:${kind}`;
    useEffect(() => { if (host.current)
        setShadow(host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" })); }, []);
    useEffect(() => { try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const saved = JSON.parse(raw);
            if (saved.snapshot?.customerId === data.customer.id && saved.snapshot.schemaVersion === 2 && fingerprint(saved.snapshot) !== baseline)
                setRecovery(saved);
        }
    }
    catch {
        setMessage("浏览器恢复缓存不可用，请及时保存到服务器");
    } }, [storageKey]);
    useEffect(() => { if (!dirty)
        return; try {
        localStorage.setItem(storageKey, JSON.stringify({ snapshot, proposalId, revision, note }));
    }
    catch {
        setMessage("本地恢复空间不足，请立即保存服务器草稿");
    } }, [snapshot, proposalId, revision, note, dirty, storageKey]);
    useEffect(() => { const leave = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = "";
    } }; window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave); }, [dirty]);
    useEffect(() => {
        const navigate = (href: string) => setPendingNavigation({ run: () => router.push(href) });
        const custom = (e: Event) => { if (dirty) {
            e.preventDefault();
            navigate((e as CustomEvent<string>).detail);
        } };
        const click = (e: MouseEvent) => { if (!dirty || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)
            return; const a = e.composedPath().find(n => n instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined; if (a && shouldGuardQuoteLink(a, location)) {
            e.preventDefault();
            e.stopPropagation();
            navigate(a.pathname + a.search);
        } };
        window.addEventListener("crm-quote-navigation", custom);
        document.addEventListener("click", click, true);
        return () => { window.removeEventListener("crm-quote-navigation", custom); document.removeEventListener("click", click, true); };
    }, [dirty, router]);
    const queue = (run: () => void) => dirty ? setPendingNavigation({ run }) : run();
    useEffect(() => {
        const guard = historyGuard.current;
        const url = location.href, state = history.state;
        if (dirty && !guard.armed) {
            history.pushState({ ...state, crmQuoteGuard: true }, "", url);
            guard.armed = true;
        }
        const handler = (event: PopStateEvent) => {
            if (!guard.armed || guard.approved)
                return;
            event.stopImmediatePropagation();
            if (!dirty) {
                guard.approved = true;
                history.back();
                return;
            }
            history.pushState({ ...state, crmQuoteGuard: true }, "", url);
            setPendingNavigation({ run: () => { guard.approved = true; history.go(-2); } });
        };
        window.addEventListener("popstate", handler, true);
        return () => window.removeEventListener("popstate", handler, true);
    }, [dirty]);
    const update = <K extends keyof QuoteV2Snapshot>(key: K, value: QuoteV2Snapshot[K]) => { if (!readOnly)
        setSnapshot(s => ({ ...s, [key]: value })); };
    const setQuote: Dispatch<SetStateAction<DirectQuote>> = useCallback(action => { if (readOnly)
        return; setSnapshot(s => { const next = typeof action === 'function' ? action(s.directQuote) : action; return { ...s, directQuote: { ...next, items: synchronizeLibraryDescriptions(next.items) } }; }); }, [readOnly]);
    const changePeople = (adults: number, children: number, seniors: number) => {
        const total = adults + children + seniors;
        if (total < 1 || total > 99) {
            setMessage("团队总人数须为 1–99；请核对三类人数");
            return;
        }
        setSnapshot(s => ({ ...s, travelerCount: total, partyConfirmed: true, itinerary: { ...s.itinerary, adults, children, seniors }, plan: s.plan.autoMatch ? synchronizeAutoQuote({ ...s.plan, people: total }, s.products) : { ...s.plan, people: total, items: s.plan.items.map(item => item.unit === "每人" || item.unit === "每人每天" ? { ...item, quantity: quantityForUnit(item.unit, total, item.dayId ? 1 : s.plan.days.length || 1) } : item) }, directQuote: synchronizeDirectQuoteDailyFees({ ...s.directQuote, people: total, items: s.directQuote.items.map(item => { const product = s.products.find(p => p.id === item.productId); return !item.libraryQuote && product && (product.unit === '每人' || product.unit === '每人每天') ? { ...item, quantity: quantityForUnit(product.unit, total) } : item; }) }, s.products) }));
    };
    async function save(publish = false) {
        if (busyRef.current || readOnly)
            return false;
        busyRef.current = true;
        setBusy(true);
        setMessage("");
        try {
            if (publish && !publishRequest.current)
                publishRequest.current = crypto.randomUUID();
            const result = await saveQuoteV2Action({ proposalId, revision, snapshot, publishRequest: publish ? publishRequest.current! : undefined, note });
            if (!result.ok) {
                setMessage(result.error);
                return false;
            }
            setRevision(result.revision);
            setBaseline(fingerprint(snapshot));
            setNote("");
            try {
                localStorage.removeItem(storageKey);
            }
            catch { }
            const record: QuoteV2Record = { id: result.versionId ?? proposalId, proposalId, revision: result.revision, title: snapshot.title, schemaVersion: 2, groupId: snapshot.groupId, snapshot, createdAt: new Date().toISOString(), versionNumber: result.versionNumber ?? undefined, note };
            if (result.versionId) {
                setVersionId(result.versionId);
                setVersions(v => [record, ...v.filter(x => x.id !== record.id)]);
                setDrafts(v => v.filter(x => x.proposalId !== proposalId));
                publishRequest.current = null;
                setMessage(`正式 V${result.versionNumber} 已锁定，正在归档原始 PDF…`);
                try {
                    const pdf = await fetch(`/api/proposal-versions/${result.versionId}/pdf${kind === "itinerary" ? "?format=branded" : ""}`);
                    if (!pdf.ok)
                        throw new Error("PDF 生成失败");
                    await pdf.blob();
                    setMessage(`正式 V${result.versionNumber} 与原始 PDF 已归档。可基于此版本新建草稿。`);
                }
                catch {
                    setMessage(`正式 V${result.versionNumber} 已保存，但 PDF 归档未完成。请点击页面下方“下载 PDF”入口重试，不会重复发布版本。`);
                }
            }
            else {
                setDrafts(v => [record, ...v.filter(x => x.proposalId !== proposalId)]);
                setMessage("服务器草稿已保存，可跨设备重新打开");
            }
            router.refresh();
            return true;
        }
        catch {
            setMessage("保存未确认成功，本地输入已保留。请重试；重复发布不会增加版本。");
            return false;
        }
        finally {
            busyRef.current = false;
            setBusy(false);
        }
    }
    function open(record?: QuoteV2Record, fork = false) {
        if (record && !record.snapshot) {
            const query = new URLSearchParams(window.location.search);
            query.delete("versionId");
            query.delete("draftId");
            query.set(record.versionNumber ? "versionId" : "draftId", record.id);
            setMessage("正在加载所选方案…");
            router.push(`/planner/tools/${kind}?${query}`);
            return;
        }
        if (record && record.schemaVersion !== 2) {
            setMessage("这是旧版快照，请使用下方旧版历史入口查看与导出。");
            return;
        }
        const next = record?.snapshot ? structuredClone(record.snapshot) : fresh({ ...data, catalog: liveCatalog.current }, kind);
        setOpenedCatalogs([]);
        setSnapshot(next);
        setProposalId(fork || !record ? crypto.randomUUID() : record.proposalId);
        setRevision(fork || !record ? 0 : record.revision);
        setVersionId(!fork && record?.versionNumber ? record.id : null);
        setBaseline(fork ? "" : fingerprint(next));
        setNote("");
        publishRequest.current = null;
        setPanel(next.mode === "quick" && kind === "quotation" ? "quick" : "editor");
        setMessage(fork ? "已基于完整版本快照创建新草稿，旧版未改变" : "");
    }
    async function persistCatalog(key: "products" | "templates" | "settings", value: PriceProduct[] | RouteTemplate[] | AppSettings) {
        const result = await saveQuoteV2CatalogAction(key, catalogRevisions.current[key], value);
        if (!result.ok)
            throw new Error(result.error);
        catalogRevisions.current[key] = result.revision;
        liveCatalog.current = { ...liveCatalog.current, [key]: value };
        setSnapshot(s => ({ ...s, [key]: value }));
        setMessage("共享资料已保存，已发布版本不受影响");
    }
    async function libraryItem(item: QuoteItem, city: string) {
        const normalizedCity = city.trim() || "通用", nameZh = item.nameZh.trim() || "未命名服务";
        const existing = liveCatalog.current.products.find(p => !p.library && p.userAdded && p.city === normalizedCity && p.nameZh.trim() === nameZh);
        const product: PriceProduct = { ...(existing ?? { id: crypto.randomUUID(), enabled: true, userAdded: true }), city: normalizedCity, category: item.category, nameZh, nameEn: item.invoiceDescriptionEn?.trim() || item.nameEn.trim() || existing?.nameEn || item.nameZh.trim() || "Custom service", costPrice: item.costPrice, quotePrice: item.quotePrice, unit: item.unit };
        await persistCatalog("products", existing ? liveCatalog.current.products.map(p => p.id === existing.id ? product : p) : [...liveCatalog.current.products, product]);
        return product;
    }
    async function group(name: string, id?: string) { const result = await saveQuoteV2GroupAction(data.customer.id, name, id); if (!result.ok) {
        setMessage(result.error);
        return null;
    } setGroups(g => [...g.filter(x => x.id !== result.group.id), result.group]); update("groupId", result.group.id); return result.group; }
    const currentRecord = versions.find(v => v.id === versionId);
    const content = <div className="crm-v2-editor">
    {panel === 'editor' && kind === 'itinerary' && <AutoDocumentPage embedded notify={setMessage} value={snapshot.itinerary} readOnly={readOnly} onChange={value => { update("itinerary", value); changePeople(value.adults, value.children, value.seniors); }}/>}
    {panel === 'editor' && kind === 'quotation' && <fieldset disabled={readOnly} className="crm-v2-fields"><DirectQuotePage quote={snapshot.directQuote} setQuote={setQuote} products={snapshot.products} costsHidden={snapshot.costsHidden} onToggleCosts={() => update("costsHidden", !snapshot.costsHidden)} notify={setMessage} onSaveItemToLibrary={libraryItem} onUpdateLibraryProduct={p => persistCatalog("products", liveCatalog.current.products.map(x => x.id === p.id ? p : x))} onDeleteLibraryProduct={id => persistCatalog("products", liveCatalog.current.products.filter(p => p.id !== id))} groups={groups} selectedGroupId={snapshot.groupId ?? ""} onSelectGroup={id => update("groupId", id)} onCreateGroup={name => group(name)} onRenameGroup={(id, name) => group(name, id)}/></fieldset>}
    {panel === 'quick' && <fieldset disabled={readOnly} className="crm-v2-fields"><QuickPlanPage initialDate={data.customer.startDate} plan={snapshot.plan} setPlan={action => setSnapshot(s => ({ ...s, mode: 'quick', plan: typeof action === 'function' ? action(s.plan) : action }))} templates={snapshot.templates} products={snapshot.products} costsHidden={snapshot.costsHidden} onToggleCosts={() => update('costsHidden', !snapshot.costsHidden)} notify={setMessage} onSaveItemToLibrary={libraryItem}/></fieldset>}
    {panel === 'prices' && <PriceLibraryPage products={snapshot.products} setProducts={action => update('products', typeof action === 'function' ? action(snapshot.products) : action)} persistProducts={value => persistCatalog('products', value)} notify={setMessage}/>}
    {panel === 'templates' && <><TemplateLibraryPage templates={snapshot.templates} setTemplates={action => update('templates', typeof action === 'function' ? action(snapshot.templates) : action)} products={snapshot.products} notify={setMessage}/><button className="primary-button" onClick={() => void persistCatalog('templates', snapshot.templates).catch(e => setMessage(e.message))}>保存共享模板</button></>}
    {panel === 'settings' && <div className="settings-page"><h2>导出设置</h2>{(['companyName', 'currency', 'priceIncludes', 'priceExcludes', 'proposalNotice'] as const).map(key => <label key={key} style={{ display: 'block', marginBottom: 16 }}>{({ companyName: '公司名称', currency: '币种', priceIncludes: '价格包含', priceExcludes: '价格不含', proposalNotice: '方案说明' })[key]}<textarea style={{ display: 'block', width: '100%', minHeight: 70 }} value={snapshot.settings[key]} onChange={e => update('settings', { ...snapshot.settings, [key]: e.target.value })}/></label>)}<button className="primary-button" onClick={() => void persistCatalog('settings', snapshot.settings).catch(e => setMessage(e.message))}>保存共享设置</button></div>}
    {modal === 'bulk' && <BulkDailyFeeModal quote={snapshot.directQuote} onClose={() => setModal(null)} onApply={(items, text) => { setQuote(q => ({ ...q, items })); setModal(null); setMessage(text); }}/>}
    {modal === 'pi' && <ProformaInvoiceModal mode={snapshot.mode} plan={{ ...snapshot.plan, title: snapshot.itinerary.clientName }} directQuote={snapshot.directQuote} onApplyItems={items => { if (!readOnly) {
        if (snapshot.mode === 'direct')
            setQuote(q => ({ ...q, items }));
        else
            update('plan', { ...snapshot.plan, items });
    } }} onClose={() => setModal(null)} notify={setMessage}/>}
    {modal === 'print' && <PrintPreview mode={snapshot.mode} plan={snapshot.plan} directQuote={snapshot.directQuote} settings={snapshot.settings} onClose={() => setModal(null)}/>}
  </div>;
    return <div className="space-y-4">
    <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">客户方案历史 · 分组与搜索（{drafts.length + versions.length}）</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input aria-label="搜索方案历史" placeholder="搜索名称或版本备注" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)}/><select aria-label="历史方案分组" className="crm-native-select" value={historyGroup} onChange={e => setHistoryGroup(e.target.value)}><option value="">全部分组</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div><div className="mt-3 max-h-72 space-y-2 overflow-auto">{[...drafts, ...versions].filter(record => (!historyGroup || record.groupId === historyGroup) && `${record.title} ${record.note ?? ''}`.toLowerCase().includes(historyQuery.toLowerCase())).map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-medium">{record.versionNumber ? `正式 V${record.versionNumber}` : '草稿'} · {record.title}</p><p className="text-xs text-muted-foreground">{groups.find(g => g.id === record.groupId)?.name ?? '未分组'} · {new Date(record.createdAt).toLocaleString('zh-CN')} · {record.note || '无版本备注'}</p></div>{record.schemaVersion === 2 ? <Button variant="outline" size="sm" onClick={() => queue(() => open(record))}>{record.versionNumber ? '查看只读版本' : '继续草稿'}</Button> : <Link href={`/planner/legacy/${record.id}`} target="_blank" className="underline">查看旧版</Link>}</div>)}</div></details>
    {recovery && data.customer.status !== '已关闭' && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm"><span>发现此账号、此客户的未保存本地内容。恢复不会覆盖服务器，保存时仍校验版本。</span><Button variant="outline" onClick={() => { setVersionId(null); setBaseline(''); setOpenedCatalogs([]); setSnapshot(recovery.snapshot); setProposalId(recovery.proposalId); setRevision(recovery.revision); setNote(recovery.note ?? ""); setRecovery(null); }}>恢复本地输入</Button><Button variant="ghost" onClick={() => { setRecovery(null); try {
        localStorage.removeItem(storageKey);
    }
    catch { } }}>忽略缓存</Button></div>}
    <div className="rounded-xl border bg-card p-4"><div className="flex flex-wrap gap-3"><label className="min-w-[180px] flex-1 text-sm">方案名称<Input disabled={readOnly} value={snapshot.title} onChange={e => update('title', e.target.value)}/></label><label className="min-w-[180px] flex-1 text-sm">草稿与历史<select value={versionId ?? (revision ? proposalId : '')} className="crm-native-select" onChange={e => queue(() => open([...versions, ...drafts].find(v => v.id === e.target.value)))}><option value="">新建草稿</option>{drafts.map(d => <option value={d.id} key={d.id}>草稿 · {d.title}</option>)}{versions.filter(v => v.schemaVersion === 2).map(v => <option key={v.id} value={v.id}>正式 V{v.versionNumber} · {v.title}</option>)}</select></label>{!readOnly && <label className="min-w-[180px] flex-1 text-sm">版本备注<Input value={note} onChange={e => setNote(e.target.value)} placeholder="本次修改说明"/></label>}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">{(['adults', 'children', 'seniors'] as const).map((key, i) => <label className="flex items-center gap-2" key={key}>{['成人', '儿童', '老人'][i]}<input aria-label={['成人人数', '儿童人数', '老人人数'][i]} type="number" min={0} max={99} disabled={readOnly} value={snapshot.itinerary[key]} className="w-16 rounded border px-2 py-1" onChange={e => { const party = { ...snapshot.itinerary, [key]: Number(e.target.value) }; changePeople(party.adults, party.children, party.seniors); }}/></label>)}<span>合计 {snapshot.travelerCount} 人 · {data.customer.startDate ?? '日期待定'} 至 {data.customer.endDate ?? '待定'}</span>{!snapshot.partyConfirmed && <span className="text-amber-800">旧人数资料：{data.customer.travelerCount ?? '未填写'}。请核对后填写，不能自动推断总人数。</span>}</div>
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button disabled={readOnly && kind === 'quotation' && snapshot.mode !== 'direct'} variant={panel === 'editor' ? 'default' : 'outline'} onClick={() => { setPanel('editor'); if (kind === 'quotation' && !readOnly)
        update('mode', 'direct'); }}>{kind === 'quotation' ? '直接报价' : '行程 Word'}</Button>{kind === 'quotation' && <Button disabled={readOnly && snapshot.mode !== 'quick'} variant={panel === 'quick' ? 'default' : 'outline'} onClick={() => { setPanel('quick'); if (!readOnly)
        update('mode', 'quick'); }}>快速方案</Button>}{!readOnly && (['prices', 'templates', 'settings'] as const).map((p, i) => <Button variant={panel === p ? 'default' : 'outline'} key={p} onClick={() => { const key = p === 'prices' ? 'products' : p; if (!openedCatalogs.includes(key)) {
        setSnapshot(s => ({ ...s, [key]: liveCatalog.current[key] }));
        setOpenedCatalogs(current => [...current, key]);
    } setPanel(p); }}>{['报价库', '行程模板', '导出设置'][i]}</Button>)}{readOnly ? <><span className="text-sm font-medium text-emerald-800">{versionId ? '正式版本只读' : '客户已关闭，仅供查看'}</span>{data.customer.status !== '已关闭' && <Button onClick={() => open(currentRecord, true)}>基于此版本新建草稿</Button>}</> : <Button variant="outline" onClick={() => queue(() => open())}>新建空白草稿</Button>}</div>
    {panel === 'quick' && <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 text-sm"><label className="flex items-center gap-3">导游语言<select className="crm-native-select" disabled={readOnly} value={snapshot.plan.guideLanguage} onChange={e => update('plan', synchronizeAutoQuote({ ...snapshot.plan, guideLanguage: e.target.value as GuideLanguage }, snapshot.products))}>{GUIDE_LANGUAGES.map(language => <option key={language}>{language}</option>)}</select></label><label className="flex items-center gap-2"><input type="checkbox" disabled={readOnly} checked={snapshot.plan.autoMatch} onChange={e => { const next = { ...snapshot.plan, autoMatch: e.target.checked }; update('plan', next.autoMatch ? synchronizeAutoQuote(next, snapshot.products) : next); }}/>自动匹配价格库</label></div>}
    {message && <p role="status" className="rounded-lg border bg-card p-3 text-sm">{message}</p>}
    <div ref={host} data-quote-print={modal === "print" ? "true" : undefined} className="min-w-0 rounded-xl border bg-card">{shadow && createPortal(<><link rel="stylesheet" href="/quote-v2/styles.css"/><link rel="stylesheet" href="/quote-v2/quoteLibrary.css"/><style>{`:host{display:block;--blue:#d65f3a;--blue-strong:#b94728;--blue-soft:#fff0e9;--navy:#17211d;--muted:#596a63;--border:#cbd6d1;--soft-border:#e2e9e6;--panel:#fff;--canvas:#f2f6f4;--green:#23774d;font-family:Inter,"PingFang SC",sans-serif}.crm-v2-editor{min-width:0;min-height:640px}@media print{.crm-v2-editor>:not(.print-preview-layer){display:none!important}.print-preview-layer,.print-preview-layer *{visibility:visible!important}.print-preview-layer{position:absolute!important;inset:0!important}}.crm-v2-fields{border:0;margin:0;padding:0;min-width:0;overflow:auto}.crm-v2-fields>.workspace{min-height:680px;height:75vh;min-width:0}.modal-layer,.print-preview-layer{z-index:130}.modal-body{max-height:75vh}.modal{max-height:94vh}.primary-button{background:var(--blue)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--blue);outline-offset:2px}@media(max-width:767px){.crm-v2-fields>.workspace{height:auto;min-height:800px}.modal-layer{padding:8px}.modal{width:100%;max-height:95vh}}`}</style><link rel="stylesheet" href="/quote-v2/crm-responsive.css"/>{content}</>, shadow)}</div>
    <footer className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4"><span className="mr-auto text-sm text-muted-foreground">{busy ? '正在保存…' : readOnly ? '历史快照 · 不受价格库更新影响' : dirty ? '有未保存内容' : revision ? '服务器草稿已保存' : '新草稿 · 尚未保存到服务器'}</span>{!readOnly && <><Button disabled={busy} variant="outline" onClick={() => void save()}>保存草稿</Button><Button disabled={busy} onClick={() => void save(true)}>保存正式版本</Button></>}{kind === 'quotation' && <><Button variant="outline" onClick={() => void navigator.clipboard.writeText(snapshot.mode === 'quick' ? generateCustomerText(snapshot.plan) : generateDirectQuoteText(snapshot.directQuote)).then(() => setMessage('客户文字已复制')).catch(() => setMessage('复制失败，请检查浏览器剪贴板权限'))}>复制文字</Button>{!readOnly && <Button variant="outline" onClick={() => setModal('bulk')}>批量费用</Button>}<Button variant="outline" onClick={() => setModal('pi')}>PI Word / 成本表</Button><Button variant="outline" onClick={() => setModal('print')}>报价预览 / PDF</Button></>}{versionId && <a className="rounded-md border px-4 py-2 text-sm" href={`/api/proposal-versions/${versionId}/pdf${kind === "itinerary" ? "?format=branded" : ""}`} target="_blank" rel="noreferrer">{kind === "itinerary" ? "下载品牌行程 PDF" : "下载正式 PDF"}</a>}{versionId && kind === "itinerary" && currentRecord?.originalPdf && <a className="rounded-md border px-4 py-2 text-sm" href={`/api/proposal-versions/${versionId}/pdf`} target="_blank" rel="noreferrer">下载旧版原始归档 PDF</a>}</footer>
    {versions.some(v => v.schemaVersion !== 2) && <details className="rounded-lg border bg-card p-4"><summary>旧版方案历史（保持原快照）</summary>{versions.filter(v => v.schemaVersion !== 2).map(v => <p className="mt-2 text-sm" key={v.id}><Link href={`/planner/legacy/${v.id}`} target="_blank" className="underline">{v.title} V{v.versionNumber} · 查看 / 导出</Link></p>)}</details>}
    {pendingNavigation && <Dialog open onOpenChange={open => { if (!open && !busy)
        setPendingNavigation(null); }}><DialogContent className="z-[150]"><DialogTitle>当前方案有未保存内容</DialogTitle><DialogDescription>保存失败时会留在当前页，并保留本地输入。</DialogDescription><div className="mt-6 flex flex-wrap gap-3"><Button disabled={busy} onClick={async () => { if (await save()) {
        const action = pendingNavigation;
        setPendingNavigation(null);
        action.run();
    } }}>保存后离开</Button><Button variant="outline" onClick={() => { try {
        localStorage.removeItem(storageKey);
    }
    catch { } const action = pendingNavigation; setPendingNavigation(null); action.run(); }}>放弃并离开</Button><Button variant="outline" onClick={() => setPendingNavigation(null)}>继续编辑</Button></div></DialogContent></Dialog>}
  </div>;
}
