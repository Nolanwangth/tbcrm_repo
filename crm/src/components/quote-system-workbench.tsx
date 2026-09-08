"use client";
import { useEffect, useMemo, useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { ClipboardCopy, FileDown, FileText, Minus, Plus, Save, SlidersHorizontal, Users } from "lucide-react";
import { deleteQuoteProductAction, publishProposalAction, saveProposalAction, saveQuoteProductAction } from "@/app/actions/proposal-actions";
import { BulkDailyFeeModal } from "@/quote-system/components/BulkDailyFeeModal";
import { PrintPreview } from "@/quote-system/components/PrintPreview";
import { ProformaInvoiceModal } from "@/quote-system/components/ProformaInvoiceModal";
import { DirectQuotePage } from "@/quote-system/pages/DirectQuotePage";
import { AutoDocumentPage } from "@/quote-system/pages/AutoDocumentPage";
import { createId } from "@/quote-system/lib/id";
import { categoryInvoiceGroup } from "@/quote-system/lib/invoiceDescription";
import { generateDirectQuoteText } from "@/quote-system/lib/logic";
import { parseItineraryDocument, type ItineraryDocumentDraft } from "@/quote-system/lib/itineraryDocument";
import type { AppSettings, DirectQuote, DirectQuoteGroup, PriceProduct, ProductCategory, ProposalPlan, QuoteItem } from "@/quote-system/types";
import type { ProposalDayInput, ProposalDraftInput, ProposalItemInput, ProposalPricingUnit, ProposalToolType } from "@/lib/proposals";
import type { QuoteProduct } from "@/lib/repositories/proposal-catalog";
type CustomerChoice = {
    id: string;
    name: string;
    travelerCount: string | null;
    startDate: string | null;
    endDate: string | null;
};
type VersionSnapshot = {
    customerId: string;
    toolType: ProposalToolType;
    title: string;
    travelerCount: number;
    days: ProposalDayInput[];
    items: ProposalItemInput[];
};
type VersionSummary = {
    id: string;
    customerId: string;
    title: string;
    toolType: string;
    versionNumber: number;
    note: string | null;
    publishedAt: string;
    snapshot: unknown;
};
const PRODUCT_CATEGORIES = new Set<ProductCategory>(["市区用车", "郊区用车", "接机", "送机", "接站", "送站", "多语言导游", "景点门票", "景区交通", "缆车", "游船", "保险", "服务费", "酒店", "机票", "高铁", "矿泉水或其他小项", "自定义项目"]);
const unitToCurrent: Record<ProposalPricingUnit, QuoteItem["unit"]> = { per_occurrence: "每次", per_day: "每天", per_person: "每人", per_person_day: "每人每天", fixed_total: "固定总价" };
const unitToStored: Record<QuoteItem["unit"], ProposalPricingUnit> = { "每次": "per_occurrence", "每天": "per_day", "每人": "per_person", "每人每天": "per_person_day", "固定总价": "fixed_total" };
const categoryFor = (value: string): ProductCategory => {
    const mapped = value === "用车" ? "市区用车" : value === "导游" ? "多语言导游" : value === "自定义" ? "自定义项目" : value;
    return PRODUCT_CATEGORIES.has(mapped as ProductCategory) ? mapped as ProductCategory : "自定义项目";
};
const englishClientName = (value: string) => value.replace(/\[[^\]]*\]/g, "").replace(/[\u3400-\u9fff]/g, "").replace(/\s+/g, " ").trim();
const readMeta = (details?: string | null) => { try {
    return JSON.parse(details || "")?.quoteSystem || {};
}
catch {
    return {};
} };
const writeMeta = (item: QuoteItem) => JSON.stringify({ quoteSystem: { note: item.note, invoiceGroup: item.invoiceGroup, invoiceDescriptionEn: item.invoiceDescriptionEn, invoiceDescriptionAuto: item.invoiceDescriptionAuto, cityEn: item.cityEn, vehicleSeats: item.vehicleSeats, customVehicle: item.customVehicle, vehicleServiceType: item.vehicleServiceType, serviceHours: item.serviceHours, baseQuotePrice: item.baseQuotePrice, travelFeeApplied: item.travelFeeApplied, nameEdited: item.nameEdited, costEdited: item.costEdited, quoteEdited: item.quoteEdited, quantityEdited: item.quantityEdited, sourceKey: item.sourceKey, libraryQuote: item.libraryQuote } });
function productFromRow(row: QuoteProduct): PriceProduct {
    const category = categoryFor(row.category);
    return { id: row.id, city: row.city, category, nameZh: row.nameZh, nameEn: row.nameEn, costPrice: row.costPrice, quotePrice: row.quotePrice, unit: unitToCurrent[row.pricingUnit], guideLanguage: category === "多语言导游" ? "English" : undefined, seatCount: row.seatCount ?? undefined, enabled: row.enabled, userAdded: true };
}
function itemFromStored(row: ProposalItemInput, index: number): QuoteItem {
    const meta = readMeta(row.details);
    const category = categoryFor(row.category);
    const id = row.id || `snapshot-item-${index}`;
    return { id, sourceKey: meta.sourceKey || `${row.source || "manual"}:${id}`, productId: row.quoteProductId || undefined, dayId: row.dayClientKey || undefined, source: row.source === "auto" || row.source === "template" ? "auto" : "manual", category, nameZh: row.nameZh, nameEn: row.nameEn, note: meta.note || "", quantity: row.quantity, costPrice: row.costPrice, quotePrice: row.quotePrice, unit: unitToCurrent[row.pricingUnit || "fixed_total"], invoiceGroup: meta.invoiceGroup || categoryInvoiceGroup(category), invoiceDescriptionEn: meta.invoiceDescriptionEn || row.nameEn, invoiceDescriptionAuto: meta.invoiceDescriptionAuto ?? true, cityEn: meta.cityEn, vehicleSeats: meta.vehicleSeats, customVehicle: meta.customVehicle, vehicleServiceType: meta.vehicleServiceType, serviceHours: meta.serviceHours, baseQuotePrice: meta.baseQuotePrice, travelFeeApplied: meta.travelFeeApplied, nameEdited: meta.nameEdited, costEdited: meta.costEdited, quoteEdited: meta.quoteEdited, quantityEdited: meta.quantityEdited, libraryQuote: meta.libraryQuote };
}
function travelDays(customer: CustomerChoice) {
    if (!customer.startDate)
        return [{ id: createId(), date: "", title: "Day 01", city: "" }];
    const start = new Date(`${customer.startDate}T12:00:00+08:00`);
    const end = customer.endDate ? new Date(`${customer.endDate}T12:00:00+08:00`) : start;
    const count = Math.max(1, Math.min(60, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1));
    return Array.from({ length: count }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return { id: createId(), date: date.toISOString().slice(0, 10), title: `Day ${String(index + 1).padStart(2, "0")}`, city: "" }; });
}
export function quoteFrom(customer: CustomerChoice, snapshot?: VersionSnapshot): DirectQuote {
    if (snapshot)
        return { people: snapshot.travelerCount, city: snapshot.days[0]?.city || "", days: snapshot.days.map((day) => ({ id: day.clientKey, date: day.serviceDate || "", title: `Day ${String(day.dayNumber).padStart(2, "0")}`, city: day.city })), items: snapshot.items.map(itemFromStored), updatedAt: new Date().toISOString() };
    const people = Math.max(1, Number.parseInt(customer.travelerCount || "1", 10) || 1);
    return { people, city: "", days: travelDays(customer), items: [], updatedAt: new Date().toISOString() };
}
const settings: AppSettings = { companyName: "Tripbook", currency: "RMB", priceIncludes: "Services listed in this proposal.", priceExcludes: "International flights, personal expenses and services not listed.", proposalNotice: "Availability and final arrangements are subject to confirmation." };
export function QuoteSystemWorkbench({ toolType, customers, versions, products, initialCustomerId = "", initialVersionId = "" }: {
    toolType: ProposalToolType;
    customers: CustomerChoice[];
    versions: VersionSummary[];
    products: QuoteProduct[];
    initialCustomerId?: string;
    initialVersionId?: string;
}) {
    const [customerId, setCustomerId] = useState(initialCustomerId);
    const [versionId, setVersionId] = useState(initialVersionId);
    const customer = customers.find((entry) => entry.id === customerId);
    const matchingVersions = versions.filter((entry) => entry.customerId === customerId && entry.toolType === toolType);
    const selectedVersion = matchingVersions.find((entry) => entry.id === versionId);
    return <div className="space-y-4">
    <section className="crm-panel grid gap-4 p-4 md:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)_auto] md:items-end">
      <label className="text-sm font-medium">CRM 客户档案 *<select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setVersionId(""); }} className="mt-1 block h-10 w-full rounded-md border bg-white px-3"><option value="">请先选择已成交客户</option>{customers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label className="text-sm font-medium">正式历史版本<select value={versionId} disabled={!customerId} onChange={(event) => setVersionId(event.target.value)} className="mt-1 block h-10 w-full rounded-md border bg-white px-3"><option value="">新建 / 当前草稿</option>{matchingVersions.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} V{entry.versionNumber} · {new Date(entry.publishedAt).toLocaleString("zh-CN")}</option>)}</select></label>
      <p className="text-xs text-muted-foreground">客户、人数和日期由 CRM 自动带入；正式版本使用 customer_id 归档。</p>
    </section>
    {!customer ? <div className="crm-panel grid min-h-80 place-items-center p-8 text-sm text-muted-foreground">选择 CRM 客户后进入 Quick Tour Proposal</div> : <EmbeddedQuoteSystem key={`${toolType}:${customer.id}:${versionId || "draft"}`} toolType={toolType} customer={customer} initial={selectedVersion?.snapshot as VersionSnapshot | undefined} products={products}/>}
  </div>;
}
function EmbeddedQuoteSystem({ toolType, customer, initial, products: productRows }: {
    toolType: ProposalToolType;
    customer: CustomerChoice;
    initial?: VersionSnapshot;
    products: QuoteProduct[];
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [shadow, setShadow] = useState<ShadowRoot | null>(null);
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState("");
    const [proposalId, setProposalId] = useState<string | undefined>();
    const [versionNote, setVersionNote] = useState("");
    const [costsHidden, setCostsHidden] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [piOpen, setPiOpen] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [catalog, setCatalog] = useState<PriceProduct[]>(() => productRows.map(productFromRow));
    const [directQuote, setDirectQuote] = useState<DirectQuote>(() => quoteFrom(customer, initial));
    const [groups, setGroups] = useState<DirectQuoteGroup[]>([{ id: `customer:${customer.id}`, name: customer.name, sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    const [selectedGroupId, setSelectedGroupId] = useState(`customer:${customer.id}`);
    const title = initial?.title || `${customer.name}${toolType === "quotation" ? "直接报价" : "英文行程"}`;
    useEffect(() => { if (hostRef.current && !hostRef.current.shadowRoot)
        setShadow(hostRef.current.attachShadow({ mode: "open" }));
    else if (hostRef.current?.shadowRoot)
        setShadow(hostRef.current.shadowRoot); }, []);
    const plan: ProposalPlan = useMemo(() => ({ id: proposalId || createId(), title, people: directQuote.people, guideLanguage: "English", autoMatch: false, days: directQuote.days.map((day) => ({ id: day.id, date: day.date, city: day.city || "", titleZh: "", titleEn: day.title, routeZh: "", routeEn: "", requiresVehicle: false, requiresGuide: false, guideLanguage: "English", linkedProductIds: [], includedEn: [] })), items: directQuote.items, updatedAt: directQuote.updatedAt }), [directQuote, proposalId, title]);
    const notify = (text: string) => setMessage(text);
    const toDraft = (): ProposalDraftInput => ({ proposalId, customerId: customer.id, toolType: "quotation", title, travelerCount: directQuote.people, days: directQuote.days.map((day, index) => ({ clientKey: day.id, dayNumber: index + 1, serviceDate: day.date || null, city: day.city || "", titleZh: day.title, titleEn: day.title, routeZh: "", routeEn: "", requiresVehicle: false, requiresGuide: false })), items: directQuote.items.map((item, index) => ({ id: item.id, dayClientKey: item.dayId || null, quoteProductId: item.productId || null, source: item.source, category: item.category, nameZh: item.nameZh, nameEn: item.nameEn, details: writeMeta(item), quantity: item.quantity, costPrice: item.costPrice, quotePrice: item.quotePrice, pricingUnit: unitToStored[item.unit], sortOrder: index })) });
    const ensureSaved = async (draft: ProposalDraftInput) => {
        if (proposalId)
            return proposalId;
        const result = await saveProposalAction(draft);
        if (!result.ok || !result.id)
            throw new Error(result.ok ? "保存草稿失败" : result.error);
        setProposalId(result.id);
        return result.id;
    };
    const save = () => startTransition(async () => { try {
        const result = await saveProposalAction(toDraft());
        if (!result.ok)
            throw new Error(result.error);
        if (result.id)
            setProposalId(result.id);
        notify("CRM 报价草稿已保存");
    }
    catch (error) {
        notify(error instanceof Error ? error.message : "保存失败");
    } });
    const publishQuote = () => startTransition(async () => { try {
        const draft = toDraft();
        const id = await ensureSaved(draft);
        const result = await publishProposalAction({ ...draft, proposalId: id, versionNote });
        if (!result.ok)
            throw new Error(result.error);
        notify("报价正式版本已冻结并归入客户档案");
    }
    catch (error) {
        notify(error instanceof Error ? error.message : "发布失败");
    } });
    const publishItinerary = async (document: ItineraryDocumentDraft) => {
        const parsed = parseItineraryDocument(document);
        const routeText = (day: typeof parsed.days[number]) => [day.transfer, day.guide, day.start, ...[day.fullDay, day.morning, day.afternoon, day.evening, day.remarks].filter((section) => section.title || section.body).map((section) => [section.title, section.body].filter(Boolean).join(": "))].filter(Boolean).join("\n");
        const draft: ProposalDraftInput = { proposalId, customerId: customer.id, toolType: "itinerary", title, travelerCount: Math.max(1, document.adults + document.children + document.seniors), days: parsed.days.map((day) => ({ clientKey: `document-day-${day.dayNumber}`, dayNumber: day.dayNumber, serviceDate: null, city: day.city, titleZh: "", titleEn: day.fullDay.title || day.morning.title || `Day ${day.dayNumber}`, routeZh: "", routeEn: routeText(day), requiresVehicle: Boolean(day.transfer), requiresGuide: Boolean(day.guide), notes: JSON.stringify({ itineraryDocumentDraft: document, itineraryDocumentDay: day }) })), items: [] };
        const id = await ensureSaved(draft);
        const result = await publishProposalAction({ ...draft, proposalId: id, versionNote });
        if (!result.ok)
            throw new Error(result.error);
        notify("行程正式版本已冻结并归入客户档案");
    };
    const addLibrary = async (item: QuoteItem, city: string) => { const next: PriceProduct = { id: createId(), city: city || "通用", category: item.category, nameZh: item.nameZh, nameEn: item.nameEn, costPrice: item.costPrice, quotePrice: item.quotePrice, unit: item.unit, enabled: true, userAdded: true }; const result = await saveQuoteProductAction({ city: next.city, category: next.category, nameZh: next.nameZh, nameEn: next.nameEn, costPrice: next.costPrice, quotePrice: next.quotePrice, pricingUnit: unitToStored[next.unit], seatCount: next.seatCount }); if (!result.ok || !result.id)
        throw new Error(result.ok ? "价格库保存失败" : result.error); const saved = { ...next, id: result.id }; setCatalog((current) => [...current, saved]); notify(`已加入价格库：${saved.nameZh}`); return saved; };
    const updateLibrary = async (product: PriceProduct) => { const result = await saveQuoteProductAction({ id: product.id, city: product.city, category: product.category, nameZh: product.nameZh, nameEn: product.nameEn, costPrice: product.costPrice, quotePrice: product.quotePrice, pricingUnit: unitToStored[product.unit], seatCount: product.seatCount }); if (!result.ok)
        throw new Error(result.error); setCatalog((current) => current.map((entry) => entry.id === product.id ? product : entry)); notify(`已更新价格项目：${product.nameZh}`); };
    const deleteLibrary = async (id: string) => { const result = await deleteQuoteProductAction(id); if (!result.ok)
        throw new Error(result.error); setCatalog((current) => current.filter((entry) => entry.id !== id)); notify("已从价格库移除"); };
    const copyCustomer = async () => { await navigator.clipboard.writeText(generateDirectQuoteText(directQuote)); notify("客户文字已复制"); };
    const changePeople = (value: number) => setDirectQuote((current) => ({ ...current, people: Math.max(1, Math.min(99, value)), updatedAt: new Date().toISOString() }));
    const content = <div className="embedded-current-system">
    <header className="topbar embedded-topbar"><div className="brand-lockup"><div><strong>Quick Tour Proposal</strong><span>{customer.name} · {toolType === "quotation" ? "直接报价" : "英文行程 Word 导出"}</span></div></div>{toolType === "quotation" && <><div className="top-controls"><div className="people-control"><span><Users size={16}/>人数</span><div><button onClick={() => changePeople(directQuote.people - 1)} aria-label="减少人数"><Minus size={15}/></button><strong>{directQuote.people}</strong><button onClick={() => changePeople(directQuote.people + 1)} aria-label="增加人数"><Plus size={15}/></button></div></div></div><div className="top-actions"><button className="ghost-button" onClick={() => setBulkOpen(true)}><SlidersHorizontal size={16}/>批量调整费用</button></div></>}</header>
    <div className="studio-meta-row"><span>CRM 客户：{customer.name}</span><span>出行日期：{customer.startDate || "待定"} 至 {customer.endDate || customer.startDate || "待定"}</span><label>版本说明<input value={versionNote} onChange={(event) => setVersionNote(event.target.value)} placeholder="本次调整说明"/></label></div>
    <div className={`content-area ${toolType === "quotation" ? "with-actionbar" : ""}`}>{toolType === "quotation" ? <DirectQuotePage quote={directQuote} setQuote={setDirectQuote as Dispatch<SetStateAction<DirectQuote>>} products={catalog} costsHidden={costsHidden} onToggleCosts={() => setCostsHidden((value) => !value)} notify={notify} onSaveItemToLibrary={addLibrary} onUpdateLibraryProduct={updateLibrary} onDeleteLibraryProduct={deleteLibrary} groups={groups} selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} onCreateGroup={async (name) => { const group = { id: createId(), name, sortOrder: groups.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; setGroups((current) => [...current, group]); return group; }} onRenameGroup={async (id, name) => { const current = groups.find((group) => group.id === id); if (!current)
        return null; const next = { ...current, name, updatedAt: new Date().toISOString() }; setGroups((rows) => rows.map((group) => group.id === id ? next : group)); return next; }}/> : <AutoDocumentPage embedded notify={notify} customerName={englishClientName(customer.name)} adults={directQuote.people} initialDraft={initial?.days?.map((day) => day.notes).filter(Boolean).map((note) => { try {
        return JSON.parse(String(note)).itineraryDocumentDraft as ItineraryDocumentDraft;
    }
    catch {
        return undefined;
    } }).find(Boolean)} storageKey={`tripbook-crm-itinerary-document:${customer.id}`} publishing={pending} onPublish={publishItinerary}/>}</div>
    {toolType === "quotation" && <footer className="actionbar embedded-actionbar"><span className={message.includes("失败") ? "sync-error" : ""}>{pending ? "正在保存与生成文件" : message || "当前 CRM 客户草稿尚未保存"}</span><div><button className="copy-button" disabled={pending} onClick={save}><Save size={17}/>保存草稿</button><button className="copy-button" onClick={copyCustomer}><ClipboardCopy size={17}/>复制为文字</button><button className="copy-button pi-export-button" onClick={() => setPiOpen(true)}><FileText size={17}/>导出 PI Word</button><button className="export-button" onClick={() => setPrintOpen(true)}><FileDown size={17}/>报价预览/PDF</button><button className="export-button" disabled={pending} onClick={publishQuote}><FileDown size={17}/>发布报价版本</button></div></footer>}
    {bulkOpen && <BulkDailyFeeModal quote={directQuote} onClose={() => setBulkOpen(false)} onApply={(items, text) => { setDirectQuote((current) => ({ ...current, items })); setBulkOpen(false); notify(text); }}/>}
    {piOpen && <ProformaInvoiceModal mode="direct" plan={plan} directQuote={directQuote} onApplyItems={(items) => setDirectQuote((current) => ({ ...current, items }))} onClose={() => setPiOpen(false)} notify={notify}/>}
    {printOpen && <PrintPreview mode="direct" plan={plan} directQuote={directQuote} settings={settings} onClose={() => setPrintOpen(false)}/>}
  </div>;
    return <div ref={hostRef} className="current-quote-shadow-host min-h-[720px] overflow-hidden rounded-lg border">{shadow && createPortal(<><link rel="stylesheet" href="/quote-system/current.css?v=20260906-crm"/><style>{`:host{display:block;height:100%;--blue:#2468e8;--blue-strong:#1454cc;--blue-soft:#eaf1ff;--navy:#152235;--muted:#6e788a;--border:#dfe5ee;--soft-border:#e9edf3;--panel:#fff;--canvas:#f4f7fb}.embedded-current-system{min-height:720px;display:flex;flex-direction:column;background:var(--canvas)}.embedded-topbar{height:64px;flex-basis:64px;padding:0 18px}.studio-meta-row{min-height:52px;display:flex;align-items:center;gap:16px;padding:7px 18px;background:#fff;border-bottom:1px solid var(--border);overflow-x:auto}.studio-meta-row label{display:flex;align-items:center;gap:7px;white-space:nowrap;font-size:12px}.studio-meta-row input{height:34px;min-width:220px;border:1px solid var(--border);border-radius:7px;padding:0 9px}.embedded-current-system>.content-area{flex:1;min-height:0}.embedded-actionbar{position:static;flex:0 0 62px}.current-quote-shadow-host{min-width:0}`}</style>{content}</>, shadow)}</div>;
}
