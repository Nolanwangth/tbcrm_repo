import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BedDouble, Calculator, CarFront, ChevronDown, ChevronUp, ConciergeBell, Eye, EyeOff, FilePenLine, GripVertical, Library, MoreHorizontal, PanelRightClose, PanelRightOpen, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { categoryInvoiceGroup } from "../lib/invoiceDescription";
import { applyManualQuotePriceEdit, calculateTotals } from "../lib/logic";
import { calculateMarginBreakdown, marginCategoryForItem, type MarginCategory } from "../lib/margin";
import type { InvoiceGroup, PriceProduct, QuoteItem } from "../types";
import { Modal } from "./Modal";
import { bookingToItems, draftFromItems, groupQuoteItems, projectLibraryItems } from "../lib/quoteLibrary";
import { LibraryBookingModal } from "./LibraryBookingModal";
interface QuoteCartProps {
    items: QuoteItem[];
    onChange: (items: QuoteItem[]) => void;
    onAddCustom: (dayId?: string) => void;
    dayLabels?: Record<string, string>;
    groups?: Array<{
        id: string;
        label: string;
        date?: string;
    }>;
    onAddGroup?: () => void;
    onDeleteGroup?: (id: string) => void;
    onInsertGroup?: (id: string, position: "before" | "after") => void;
    onMoveGroup?: (id: string, direction: "up" | "down") => void;
    onReorderGroup?: (sourceId: string, targetId: string) => void;
    onGroupDateChange?: (id: string, date: string) => void;
    onSelectGroup?: (id: string) => void;
    selectedGroupId?: string;
    onSaveToLibrary?: (item: QuoteItem) => PriceProduct | void;
    onClearAll?: () => void;
    costsHidden: boolean;
    onToggleCosts: () => void;
    title?: string;
    libraryProductIds?: string[];
    onUpdateLibraryDescription?: (productId: string, description: string, nameZh: string) => void;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
    dayOverview?: ReactNode;
    compactInactiveGroups?: boolean;
    focusSelectedGroup?: boolean;
}
const nonNegative = (value: string) => Math.max(0, Math.round(Number(value) || 0));
const money = (value: number) => value.toLocaleString("zh-CN");
const INVOICE_GROUP_LABELS: Record<InvoiceGroup, string> = {
    service: "服务发票",
    hotel: "酒店发票",
    transportation: "大交通发票",
};
const MARGIN_LABELS = { transportation: "交通", hotel: "酒店", service: "服务" } as const;
const QUOTE_CATEGORY_META: Record<MarginCategory, {
    label: string;
    icon: typeof CarFront;
}> = {
    transportation: { label: "交通", icon: CarFront }, hotel: { label: "酒店", icon: BedDouble }, service: { label: "服务", icon: ConciergeBell },
};
export function QuoteCart({ items, onChange, onAddCustom, dayLabels = {}, groups = [], onAddGroup, onDeleteGroup, onInsertGroup, onMoveGroup, onReorderGroup, onGroupDateChange, onSelectGroup, selectedGroupId, onSaveToLibrary, onClearAll, costsHidden, onToggleCosts, title = "报价明细", libraryProductIds = [], onUpdateLibraryDescription, collapsed = false, onToggleCollapsed, dayOverview, compactInactiveGroups = false, focusSelectedGroup = false, }: QuoteCartProps) {
    const totals = calculateTotals(items);
    const [editingBooking, setEditingBooking] = useState<QuoteItem[] | null>(null);
    const marginBreakdown = calculateMarginBreakdown(items);
    const [editingDescription, setEditingDescription] = useState<QuoteItem | null>(null);
    const [nameZhDraft, setNameZhDraft] = useState("");
    const [descriptionDraft, setDescriptionDraft] = useState("");
    const [updateLibrary, setUpdateLibrary] = useState(false);
    const [openDayMenuId, setOpenDayMenuId] = useState<string | null>(null);
    const [dayMenuPosition, setDayMenuPosition] = useState<{
        top: number;
        right: number;
    } | null>(null);
    const [draggingDayId, setDraggingDayId] = useState<string | null>(null);
    const [marginCalculatorOpen, setMarginCalculatorOpen] = useState(false);
    const [marginSummaryOpen, setMarginSummaryOpen] = useState(false);
    const [marginDraftItems, setMarginDraftItems] = useState<QuoteItem[]>([]);
    const quoteListRef = useRef<HTMLDivElement | null>(null);
    const dayGroupRefs = useRef(new Map<string, HTMLElement>());
    useEffect(() => {
        if (!selectedGroupId)
            return;
        const list = quoteListRef.current;
        const selectedDay = dayGroupRefs.current.get(selectedGroupId);
        if (!list || !selectedDay)
            return;
        const frame = window.requestAnimationFrame(() => {
            list.scrollTo({ top: Math.max(0, selectedDay.offsetTop - list.offsetTop - 8), behavior: "auto" });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [selectedGroupId]);
    useEffect(() => {
        if (!openDayMenuId)
            return;
        const close = () => { setOpenDayMenuId(null); setDayMenuPosition(null); };
        window.addEventListener("resize", close);
        window.addEventListener("scroll", close, true);
        return () => {
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", close, true);
        };
    }, [openDayMenuId]);
    const update = (id: string, patch: Partial<QuoteItem>) => {
        onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
    };
    const updateQuotePrice = (id: string, value: string) => {
        onChange(items.map((item) => item.id === id
            ? applyManualQuotePriceEdit(item, nonNegative(value))
            : item));
    };
    const unassigned = items.filter((item) => !item.dayId || !groups.some((group) => group.id === item.dayId));
    const sections = groups.length
        ? [
            ...groups.map((group) => ({ ...group, items: items.filter((item) => item.dayId === group.id) })),
            ...(unassigned.length ? [{ id: "", label: "未分配项目", items: unassigned }] : []),
        ]
        : [{ id: "", label: "全部项目", items }];
    const visibleSections = focusSelectedGroup && selectedGroupId
        ? sections.filter((section) => section.id === selectedGroupId)
        : sections;
    const openDaySection = openDayMenuId ? sections.find((section) => section.id === openDayMenuId) : undefined;
    const toggleDayMenu = (dayId: string, anchor: HTMLButtonElement) => {
        if (openDayMenuId === dayId) {
            setOpenDayMenuId(null);
            setDayMenuPosition(null);
            return;
        }
        const rect = anchor.getBoundingClientRect();
        setDayMenuPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
        setOpenDayMenuId(dayId);
    };
    const closeDayMenu = () => {
        setOpenDayMenuId(null);
        setDayMenuPosition(null);
    };
    const openMarginCalculator = () => {
        setMarginDraftItems(items.map((item) => ({ ...item })));
        setMarginCalculatorOpen(true);
    };
    const updateMarginDraft = (id: string, patch: Partial<QuoteItem>) => {
        setMarginDraftItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    };
    const applyMarginDraft = () => {
        const drafts = new Map(marginDraftItems.map((item) => [item.id, item]));
        onChange(items.map((item) => {
            const draft = drafts.get(item.id);
            if (!draft)
                return item;
            const withQuote = draft.quotePrice === item.quotePrice ? item : applyManualQuotePriceEdit(item, draft.quotePrice);
            return {
                ...withQuote,
                quantity: draft.quantity,
                costPrice: draft.costPrice,
                quantityEdited: item.quantityEdited || draft.quantity !== item.quantity,
                costEdited: item.costEdited || draft.costPrice !== item.costPrice,
            };
        }));
        setMarginCalculatorOpen(false);
    };
    const openDescriptionEditor = (item: QuoteItem) => {
        if (item.libraryQuote) {
            setEditingBooking(groupQuoteItems(items).find(group => group.some(i => i.id === item.id))!);
            return;
        }
        setEditingDescription(item);
        setNameZhDraft(item.nameZh);
        setDescriptionDraft(item.invoiceDescriptionEn?.trim() || item.nameEn.trim());
        setUpdateLibrary(false);
    };
    const saveCurrentItemToLibrary = (item: QuoteItem) => {
        const savedProduct = onSaveToLibrary?.(item);
        if (savedProduct)
            update(item.id, { productId: savedProduct.id });
    };
    const saveDescription = () => {
        if (!editingDescription || !nameZhDraft.trim() || !descriptionDraft.trim())
            return;
        const nameZh = nameZhDraft.trim();
        const description = descriptionDraft.trim();
        update(editingDescription.id, {
            nameZh,
            nameEdited: true,
            nameEn: description,
            invoiceDescriptionEn: description,
            invoiceDescriptionAuto: false,
        });
        if (updateLibrary && editingDescription.productId && onUpdateLibraryDescription) {
            onUpdateLibraryDescription(editingDescription.productId, description, nameZh);
        }
        setEditingDescription(null);
    };
    const startDayDrag = (event: DragEvent, dayId: string) => {
        setDraggingDayId(dayId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", dayId);
    };
    const dropDay = (event: DragEvent, targetId: string) => {
        event.preventDefault();
        const sourceId = draggingDayId || event.dataTransfer.getData("text/plain");
        setDraggingDayId(null);
        if (sourceId && sourceId !== targetId)
            onReorderGroup?.(sourceId, targetId);
    };
    const renderRow = (item: QuoteItem) => (<div className="quote-row" data-hidden={costsHidden} key={item.id}>
      <div className="quote-name">
        <input value={item.nameZh} readOnly={!!item.libraryQuote} aria-label="商品名称" onChange={(event) => update(item.id, { nameZh: event.target.value, nameEdited: true })}/>
        <p className="quote-english-copy" title={item.invoiceDescriptionEn?.trim() || item.nameEn.trim()}>
          {item.invoiceDescriptionEn?.trim() || item.nameEn.trim() || "No English invoice description"}
        </p>
        <div className="quote-name-meta">
          <span>
            {item.dayId ? dayLabels[item.dayId] ?? "所属行程" : item.source === "auto" ? "自动匹配" : "手动添加"}
            {item.note ? ` · ${item.note}` : ""}
          </span>
          <select className="invoice-group-select" value={item.invoiceGroup ?? categoryInvoiceGroup(item.category)} aria-label={`${item.nameZh}发票归类`} title="选择导出到哪一类PI发票" onChange={(event) => update(item.id, { invoiceGroup: event.target.value as InvoiceGroup })}>
            {(Object.entries(INVOICE_GROUP_LABELS) as Array<[
        InvoiceGroup,
        string
    ]>).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          {item.nameEdited && onSaveToLibrary && !item.productId && <button onClick={() => saveCurrentItemToLibrary(item)} title="把当前名称和价格保存到报价库"><Library size={11}/>存入报价库</button>}
        </div>
      </div>
      <input className="number-input" type="number" min="0" value={item.quantity} aria-label={`${item.nameZh}数量`} onChange={(event) => update(item.id, { quantity: nonNegative(event.target.value), quantityEdited: true })}/>
      {!costsHidden && <input className="money-input" type="number" min="0" value={item.costPrice} aria-label={`${item.nameZh}成本价`} onChange={(event) => update(item.id, { costPrice: nonNegative(event.target.value), costEdited: true })}/>}
      <input className="money-input quote-price" type="number" min="0" value={item.quotePrice} aria-label={`${item.nameZh}报价价`} onChange={(event) => updateQuotePrice(item.id, event.target.value)}/>
      <strong>{money(item.quotePrice * item.quantity)}</strong>
      <div className="quote-row-actions">
        <button className="icon-button" onClick={() => openDescriptionEditor(item)} aria-label={`编辑${item.nameZh}中英文文案`} title="编辑中英文文案"><Pencil size={15}/></button>
        <button className="icon-button danger" onClick={() => window.confirm(`删除“${item.nameZh}”？`) && onChange(items.filter((target) => target.id !== item.id))} aria-label={`删除${item.nameZh}`}><Trash2 size={15}/></button>
      </div>
    </div>);
    return (<>
    {editingBooking && <LibraryBookingModal initial={draftFromItems(editingBooking)} onClose={() => setEditingBooking(null)} onSave={draft => {
                const replacement = bookingToItems(draft, editingBooking[0].dayId || "", editingBooking);
                const ids = new Set(editingBooking.map(i => i.id));
                let inserted = false;
                onChange(items.flatMap(i => { if (!ids.has(i.id))
                    return [i]; if (inserted)
                    return []; inserted = true; return replacement; }));
                setEditingBooking(null);
            }}/>}
    <section className={`panel quote-panel ${collapsed ? "collapsed" : ""}`}>
      <header className="panel-header quote-header">
        <div className="quote-title-with-collapse">
          {onToggleCollapsed && <button className="quote-collapse-button" onClick={onToggleCollapsed} title={collapsed ? "展开当前直接报价" : "收起当前直接报价"}>{collapsed ? <PanelRightOpen size={18}/> : <PanelRightClose size={18}/>}</button>}
          <div className="quote-title-copy"><h2>{title}</h2><span>{items.length} 项服务</span></div>
        </div>
        <div className="quote-header-actions">
          {onAddGroup && <button className="ghost-button compact" onClick={onAddGroup}><Plus size={14}/>新增一天</button>}
          {items.length > 0 && onClearAll && <button className="ghost-button compact clear-all-button" onClick={onClearAll}><Trash2 size={14}/>清空全部报价</button>}
          <button className="ghost-button compact" onClick={onToggleCosts}>{costsHidden ? <Eye size={15}/> : <EyeOff size={15}/>}{costsHidden ? "显示内部数据" : "隐藏成本与毛利"}</button>
        </div>
      </header>

      {dayOverview}

      <div className="quote-table-head" data-hidden={costsHidden}>
        <span>项目</span>
        <span>数量</span>
        {!costsHidden && <span>成本价</span>}
        <span>报价价</span>
        <span>小计</span>
        <span />
      </div>

      <div className={`quote-list grouped-quote-list ${focusSelectedGroup ? "focused-quote-list" : ""}`} ref={quoteListRef}>
        {groups.length === 0 && items.length === 0 ? (<div className="empty-state small">
            <FilePenLine size={28}/>
            <strong>报价购物车还是空的</strong>
            <span>添加路线自动匹配，或手动加入服务</span>
          </div>) : visibleSections.map((section) => {
            const compact = Boolean(compactInactiveGroups && section.id && selectedGroupId !== section.id);
            const categoryCounts = (Object.keys(QUOTE_CATEGORY_META) as MarginCategory[])
                .map((category) => ({ category, count: section.items.filter((item) => marginCategoryForItem(item) === category).length }))
                .filter(({ count }) => count > 0);
            return <section className={`quote-day-group ${selectedGroupId === section.id ? "selected focused-day-card" : ""} ${compact ? "compact" : ""} ${draggingDayId === section.id ? "dragging" : ""}`} key={section.id || "unassigned"} ref={(element) => {
                    if (!section.id)
                        return;
                    if (element)
                        dayGroupRefs.current.set(section.id, element);
                    else
                        dayGroupRefs.current.delete(section.id);
                }} onDragOver={section.id && onReorderGroup ? (event) => event.preventDefault() : undefined} onDrop={section.id && onReorderGroup ? (event) => dropDay(event, section.id) : undefined}>
            <header>
              <div>{onSelectGroup && section.id ? <button className="group-select-button" onClick={() => onSelectGroup(section.id)} title={compact ? `展开并编辑${section.label}` : `查看${section.label}`}><strong>{section.label}</strong></button> : <strong>{section.label}</strong>}{onGroupDateChange && section.id ? <input type="date" value={section.date ?? ""} aria-label={`${section.label}日期`} onChange={(event) => onGroupDateChange(section.id, event.target.value)}/> : section.date && <span>{section.date}</span>}</div>
              <div className="quote-day-heading-actions">
                <span>小计 {money(calculateTotals(section.items).quoteTotal)} RMB</span>
                {section.id && onReorderGroup && <button className="day-drag-handle" draggable onDragStart={(event) => startDayDrag(event, section.id)} onDragEnd={() => setDraggingDayId(null)} aria-label={`拖动${section.label}排序`} title="拖动调整 Day 顺序"><GripVertical size={15}/></button>}
                {section.id && (onInsertGroup || onMoveGroup || onDeleteGroup) && <div className="day-order-menu-wrap">
                  <button className="day-order-menu-button" onClick={(event) => toggleDayMenu(section.id, event.currentTarget)} aria-label={`${section.label}操作菜单`} aria-expanded={openDayMenuId === section.id}><MoreHorizontal size={16}/></button>
                </div>}
              </div>
            </header>
            {compact ? <button className="quote-day-preview" onClick={() => section.id && onSelectGroup?.(section.id)}>
              <span className="quote-day-preview-copy"><strong>{section.items.length ? `${section.items.length} 项明细` : "当天暂无报价明细"}</strong><small>{section.items.slice(0, 3).map((item) => item.nameZh).join(" · ") || "点击开始录入"}</small></span>
              <span className="quote-day-preview-categories">{categoryCounts.map(({ category, count }) => <i className={`category-dot category-dot-${category}`} key={category}>{QUOTE_CATEGORY_META[category].label}{count}</i>)}</span>
              <span className="quote-day-preview-action">展开编辑</span>
            </button> : section.items.length ? (Object.keys(QUOTE_CATEGORY_META) as MarginCategory[]).map((category) => {
                    const categoryItems = section.items.filter((item) => marginCategoryForItem(item) === category);
                    if (!categoryItems.length)
                        return null;
                    const meta = QUOTE_CATEGORY_META[category];
                    const Icon = meta.icon;
                    return <section className={`quote-item-category category-${category}`} key={category}><header><span><Icon size={14}/>{meta.label}</span><small>{groupQuoteItems(categoryItems).length} 项</small></header>{groupQuoteItems(categoryItems).map(group => {
                            if (!group[0].libraryQuote)
                                return renderRow(group[0]);
                            const summary = projectLibraryItems(group)[0] || { ...group[0], nameZh: group[0].libraryQuote!.productNameZh, quantity: 1, quotePrice: 0, invoiceDescriptionEn: group[0].libraryQuote!.englishBase };
                            return <div className="library-quote-group" key={group[0].id}>
                  <header><div><strong>{summary.nameZh}</strong><small>{group.length} 种规格 · {summary.quantity * summary.quotePrice} RMB</small></div><div className="row-actions"><button className="ghost-button" onClick={() => setEditingBooking(group)}><Pencil size={14}/>编辑票种／规格</button><button className="icon-button danger" aria-label={`删除组合项目${summary.nameZh}`} onClick={() => window.confirm(`删除“${summary.nameZh}”全部规格？`) && onChange(items.filter(i => !group.some(g => g.id === i.id)))}><Trash2 size={15}/></button></div></header>
                  <p className="library-group-description">{summary.invoiceDescriptionEn}</p>
                  {group.map(renderRow)}
                </div>;
                        })}</section>;
                }) : <div className="quote-day-empty">当天暂无报价明细</div>}
            {section.id && <button className="add-line-button group-add-line" onClick={() => onAddCustom(section.id)}><Plus size={15}/> 在{section.label}新增明细</button>}
          </section>;
        })}
      </div>

      {!groups.length && <button className="add-line-button" onClick={() => onAddCustom()}><Plus size={16}/> 添加自定义项目</button>}

      <div className={`quote-summary ${costsHidden ? "customer-safe" : ""} ${!marginSummaryOpen || costsHidden ? "margin-collapsed" : "margin-expanded"}`}>
        {!costsHidden && (<div className={`summary-internal margin-summary-shell ${marginSummaryOpen ? "open" : "collapsed"}`}>
            <div className="margin-summary-tools">
              <span>毛利计算</span>
              <div>
                <button onClick={openMarginCalculator} aria-label="打开毛利透明试算"><Calculator size={13}/>透明试算</button>
                <button onClick={() => setMarginSummaryOpen((current) => !current)} aria-expanded={marginSummaryOpen} aria-controls="quote-margin-breakdown">
                  {marginSummaryOpen ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}{marginSummaryOpen ? "收起" : "展开"}
                </button>
              </div>
            </div>
            {marginSummaryOpen && <div className="summary-margin-breakdown" id="quote-margin-breakdown">
              {(["transportation", "hotel", "service"] as const).map((category) => {
                    const summary = marginBreakdown[category];
                    return <div className="margin-breakdown-row" key={category}><span>{MARGIN_LABELS[category]}</span><small>成本 {money(summary.costBasis)} · 报价 {money(summary.quoteBasis)}</small><strong className={summary.profit >= 0 ? "green" : "red"}>毛利 {money(summary.profit)} / {(summary.margin * 100).toFixed(1)}%</strong></div>;
                })}
              <div className="margin-overall-row"><span>综合</span><small>成本 {money(marginBreakdown.overall.costBasis)} · 报价 {money(marginBreakdown.overall.quoteBasis)}</small><strong className={marginBreakdown.overall.profit >= 0 ? "green" : "red"}>毛利 {money(marginBreakdown.overall.profit)} / {(marginBreakdown.overall.margin * 100).toFixed(1)}%</strong></div>
              
              <div><span>成本总额</span><strong>{money(totals.costTotal)} RMB</strong></div>
              <div><span>报价总额</span><strong className="blue">{money(totals.quoteTotal)} RMB</strong></div>
            </div>}
          </div>)}
        <div className="customer-total">
          <span>总价（供客户查看）</span>
          <strong>{money(totals.quoteTotal)} <small>RMB</small></strong>
        </div>
      </div>
    </section>
    {openDaySection && dayMenuPosition && typeof document !== "undefined" && createPortal(<div className="day-order-menu day-order-menu-portal" style={{ top: dayMenuPosition.top, right: dayMenuPosition.right }} role="menu">
        {onInsertGroup && <><button onClick={() => { onInsertGroup(openDaySection.id, "before"); closeDayMenu(); }}><Plus size={13}/>此前插入一天</button><button onClick={() => { onInsertGroup(openDaySection.id, "after"); closeDayMenu(); }}><Plus size={13}/>此后插入一天</button></>}
        {onMoveGroup && <><button disabled={groups[0]?.id === openDaySection.id} onClick={() => { onMoveGroup(openDaySection.id, "up"); closeDayMenu(); }}><ChevronUp size={13}/>上移一天</button><button disabled={groups[groups.length - 1]?.id === openDaySection.id} onClick={() => { onMoveGroup(openDaySection.id, "down"); closeDayMenu(); }}><ChevronDown size={13}/>下移一天</button></>}
        {onDeleteGroup && groups.length > 1 && <button className="danger" onClick={() => { onDeleteGroup(openDaySection.id); closeDayMenu(); }}><Trash2 size={13}/>删除这一天</button>}
      </div>, document.body)}
    {editingDescription && <Modal title={`编辑中英文文案 · ${editingDescription.nameZh}`} onClose={() => setEditingDescription(null)} footer={<><button className="ghost-button" onClick={() => setEditingDescription(null)}>取消</button><button className="primary-button" disabled={!nameZhDraft.trim() || !descriptionDraft.trim()} onClick={saveDescription}>保存文案</button></>}>
      <div className="description-edit-form">
        <label>中文项目名称<input autoFocus value={nameZhDraft} onChange={(event) => setNameZhDraft(event.target.value)} placeholder="用于报价表和内部成本表"/></label>
        <label>英文发票文案<textarea rows={5} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} placeholder="English invoice description"/></label>
        {editingDescription.productId && libraryProductIds.includes(editingDescription.productId) && onUpdateLibraryDescription
                ? <label className="update-library-choice"><input type="checkbox" checked={updateLibrary} onChange={(event) => setUpdateLibrary(event.target.checked)}/><span>同时更新“我的价格库”中的中英文文案</span></label>
                : null}
        <p>数量、成本价和报价价仍直接在报价表格中修改。</p>
      </div>
    </Modal>}
    {marginCalculatorOpen && <Modal title="毛利透明试算" wide className="margin-calculator-modal" onClose={() => setMarginCalculatorOpen(false)} footer={<>
        <button className="ghost-button" onClick={() => setMarginDraftItems(items.map((item) => ({ ...item })))}><RotateCcw size={14}/>恢复当前报价</button>
        <button className="ghost-button" onClick={() => setMarginCalculatorOpen(false)}>取消</button>
        <button className="primary-button" onClick={applyMarginDraft}>应用到正式报价</button>
      </>}>
      <div className="margin-calculator">
        <section className="margin-formula-note">
          <Calculator size={20}/>
          <div><strong>每一步都按当前数量实时计算</strong><span>项目报价 = 数量 × 单价　·　毛利 = 项目报价 − 项目成本　·　毛利率 = 毛利 ÷ 项目报价</span></div>
          <em>窗口内修改仅用于试算</em>
        </section>
        <div className="margin-calculator-summary">
          {(["transportation", "hotel", "service"] as const).map((category) => {
                const summary = calculateMarginBreakdown(marginDraftItems)[category];
                const Icon = QUOTE_CATEGORY_META[category].icon;
                return <article className={`category-${category}`} key={category}>
              <header><span><Icon size={14}/>{MARGIN_LABELS[category]}</span><small>{marginDraftItems.filter((item) => marginCategoryForItem(item) === category).length} 项</small></header>
              <div><span>成本 ¥{money(summary.costBasis)}</span><span>报价 ¥{money(summary.quoteBasis)}</span></div>
              <strong className={summary.profit >= 0 ? "green" : "red"}>毛利 ¥{money(summary.profit)} <small>{(summary.margin * 100).toFixed(1)}%</small></strong>
            </article>;
            })}
          {(() => {
                const summary = calculateMarginBreakdown(marginDraftItems).overall;
                return <article className="margin-calculator-overall"><header><span>综合结果</span><small>{marginDraftItems.length} 项</small></header><div><span>成本 ¥{money(summary.costBasis)}</span><span>报价 ¥{money(summary.quoteBasis)}</span></div><strong className={summary.profit >= 0 ? "green" : "red"}>毛利 ¥{money(summary.profit)} <small>{(summary.margin * 100).toFixed(1)}%</small></strong></article>;
            })()}
        </div>
        <section className="margin-calculator-items">
          <header><span>项目与所属 Day</span><span>分类</span><span>数量</span><span>单位成本</span><span>单位报价</span><span>项目毛利</span><span>毛利率</span></header>
          <div>{marginDraftItems.map((item) => {
                const category = marginCategoryForItem(item);
                const cost = item.quantity * item.costPrice;
                const quote = item.quantity * item.quotePrice;
                const profit = quote - cost;
                const margin = quote === 0 ? 0 : profit / quote;
                return <div className={`margin-calculator-item category-${category}`} key={item.id}>
              <label><strong>{item.nameZh}</strong><small>{item.dayId ? dayLabels[item.dayId] ?? "所属行程" : "未分配"}</small></label>
              <span className="margin-category-badge">{MARGIN_LABELS[category]}</span>
              <input type="number" min="0" value={item.quantity} aria-label={`${item.nameZh}试算数量`} onChange={(event) => updateMarginDraft(item.id, { quantity: nonNegative(event.target.value) })}/>
              <input type="number" min="0" value={item.costPrice} aria-label={`${item.nameZh}试算单位成本`} onChange={(event) => updateMarginDraft(item.id, { costPrice: nonNegative(event.target.value) })}/>
              <input type="number" min="0" value={item.quotePrice} aria-label={`${item.nameZh}试算单位报价`} onChange={(event) => updateMarginDraft(item.id, { quotePrice: nonNegative(event.target.value) })}/>
              <strong className={profit >= 0 ? "green" : "red"}>¥{money(profit)}</strong>
              <strong className={profit >= 0 ? "green" : "red"}>{(margin * 100).toFixed(1)}%</strong>
            </div>;
            })}</div>
        </section>
        <p className="margin-calculator-footnote">点击“应用到正式报价”后，试算中的数量、单位成本和单位报价才会写回当前报价；关闭或取消不会保存。</p>
      </div>
    </Modal>}
    </>);
}
