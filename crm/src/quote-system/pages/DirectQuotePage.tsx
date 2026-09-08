import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronLeft, ChevronRight, Eye, FolderKanban, GripVertical, Library, PackagePlus, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { QuoteCart } from "../components/QuoteCart";
import { CustomItemModal } from "../components/CustomItemModal";
import { Modal } from "../components/Modal";
import { PriceProductEditModal } from "../components/PriceProductEditModal";
import { QuickQuoteModal } from "../components/QuickQuoteModal";
import { LibraryBookingModal } from "../components/LibraryBookingModal";
import { bookingToItems, draftFromProducts, type BookingDraft } from "../lib/quoteLibrary";
import { addDaysToDate, addProductToDirectQuote, calculateTotals, insertDirectQuoteDay, moveDirectQuoteDay, removeDirectQuoteDay, reorderDirectQuoteDays, resetDirectQuote, synchronizeDirectQuoteDailyFees, type DirectQuoteDayInsertPosition, type DirectQuoteDayMoveDirection } from "../lib/logic";
import { marginCategoryForItem, type MarginCategory } from "../lib/margin";
import type { DirectQuote, DirectQuoteGroup, PriceProduct, QuoteItem } from "../types";
interface Props {
    quote: DirectQuote;
    setQuote: Dispatch<SetStateAction<DirectQuote>>;
    products: PriceProduct[];
    costsHidden: boolean;
    onToggleCosts: () => void;
    notify: (message: string) => void;
    onSaveItemToLibrary: (item: QuoteItem, city: string) => Promise<PriceProduct>;
    onUpdateLibraryProduct: (product: PriceProduct) => Promise<void>;
    onDeleteLibraryProduct: (id: string) => Promise<void>;
    groups: DirectQuoteGroup[];
    selectedGroupId: string;
    onSelectGroup: (id: string) => void;
    onCreateGroup: (name: string) => Promise<DirectQuoteGroup | null>;
    onRenameGroup: (id: string, name: string) => Promise<DirectQuoteGroup | null>;
}
type LibraryGroup = "all" | "vehicle" | "guide" | "ticket" | "other";
const LIBRARY_GROUPS: Array<{
    id: LibraryGroup;
    label: string;
}> = [
    { id: "all", label: "全部" },
    { id: "vehicle", label: "车辆" },
    { id: "guide", label: "导游" },
    { id: "ticket", label: "门票" },
    { id: "other", label: "其他" },
];
const libraryGroup = (product: PriceProduct): Exclude<LibraryGroup, "all"> => {
    if (["市区用车", "郊区用车", "接机", "送机", "接站", "送站"].includes(product.category) || /司机|用车|车辆|座车/.test(product.nameZh))
        return "vehicle";
    if (product.category === "多语言导游" || /导游/.test(product.nameZh))
        return "guide";
    if (["景点门票", "景区交通", "缆车", "游船"].includes(product.category) || /门票/.test(product.nameZh))
        return "ticket";
    return "other";
};
export function DirectQuotePage({ quote, setQuote, products, costsHidden, onToggleCosts, notify, onSaveItemToLibrary, onUpdateLibraryProduct, onDeleteLibraryProduct, groups, selectedGroupId, onSelectGroup, onCreateGroup, onRenameGroup, }: Props) {
    const [selectedDayId, setSelectedDayId] = useState(quote.days[0]?.id ?? "");
    const [customOpen, setCustomOpen] = useState(false);
    const [customDayId, setCustomDayId] = useState("");
    const [libraryQuery, setLibraryQuery] = useState("");
    const [libraryCategory, setLibraryCategory] = useState<LibraryGroup>("all");
    const [libraryCity, setLibraryCity] = useState("全部城市");
    const [editingProduct, setEditingProduct] = useState<PriceProduct | null>(null);
    const [groupManagerOpen, setGroupManagerOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [groupNames, setGroupNames] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((group) => [group.id, group.name])));
    const [groupSaving, setGroupSaving] = useState(false);
    const [entryCollapsed, setEntryCollapsed] = useState(false);
    const [quoteCollapsed, setQuoteCollapsed] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [overviewHoverDayId, setOverviewHoverDayId] = useState("");
    const [overviewPinnedDayId, setOverviewPinnedDayId] = useState("");
    const [overviewDraggingDayId, setOverviewDraggingDayId] = useState("");
    const overviewHoverTimer = useRef<number | null>(null);
    const overviewListRef = useRef<HTMLDivElement | null>(null);
    const overviewCardRefs = useRef(new Map<string, HTMLElement>());
    const activeDayId = quote.days.some((day) => day.id === selectedDayId) ? selectedDayId : quote.days[0]?.id ?? "";
    const activeDayIndex = Math.max(0, quote.days.findIndex((day) => day.id === activeDayId));
    const activeDay = quote.days[activeDayIndex];
    const userProducts = useMemo(() => products.filter((product) => product.enabled && product.userAdded), [products]);
    const libraryCities = useMemo(() => Array.from(new Set(userProducts.map((product) => product.city))).sort((a, b) => a.localeCompare(b, "zh-CN")), [userProducts]);
    const visibleLibraryProducts = useMemo(() => {
        const keyword = libraryQuery.trim().toLocaleLowerCase();
        return userProducts.filter((product) => (libraryCategory === "all" || libraryGroup(product) === libraryCategory) &&
            (libraryCity === "全部城市" || product.city === libraryCity) &&
            (!keyword || `${product.nameZh} ${product.nameEn} ${product.city}`.toLocaleLowerCase().includes(keyword)));
    }, [libraryCategory, libraryCity, libraryQuery, userProducts]);
    const groupedLibraryProducts = LIBRARY_GROUPS
        .filter((group) => group.id !== "all")
        .map((group) => ({ ...group, items: visibleLibraryProducts.filter((product) => libraryGroup(product) === group.id) }))
        .filter((group) => group.items.length > 0);
    const dayOverview = quote.days.map((day, index) => {
        const dayItems = quote.items.filter((item) => item.dayId === day.id);
        const categorySet = new Set(dayItems.map(marginCategoryForItem));
        const total = calculateTotals(dayItems).quoteTotal;
        return { day, index, itemCount: dayItems.length, total, categorySet };
    });
    const overviewPreviewDayId = overviewHoverDayId || overviewPinnedDayId;
    const overviewPreview = dayOverview.find(({ day }) => day.id === overviewPreviewDayId);
    const updateOverviewItem = (itemId: string, patch: Partial<QuoteItem>) => setQuote((current) => ({
        ...current,
        items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
        updatedAt: new Date().toISOString(),
    }));
    const showOverviewPreview = (dayId: string) => {
        if (overviewHoverTimer.current !== null)
            window.clearTimeout(overviewHoverTimer.current);
        overviewHoverTimer.current = null;
        setOverviewHoverDayId(dayId);
    };
    const hideOverviewPreviewSoon = () => {
        if (overviewHoverTimer.current !== null)
            window.clearTimeout(overviewHoverTimer.current);
        overviewHoverTimer.current = window.setTimeout(() => {
            setOverviewHoverDayId("");
            overviewHoverTimer.current = null;
        }, 220);
    };
    useEffect(() => () => {
        if (overviewHoverTimer.current !== null)
            window.clearTimeout(overviewHoverTimer.current);
    }, []);
    useEffect(() => {
        const selectedCard = overviewCardRefs.current.get(activeDayId);
        if (!selectedCard)
            return;
        const frame = window.requestAnimationFrame(() => selectedCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
        return () => window.cancelAnimationFrame(frame);
    }, [activeDayId, quote.days.length]);
    const selectOverviewDay = (dayId: string) => {
        setSelectedDayId(dayId);
        overviewCardRefs.current.get(dayId)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    };
    const selectAdjacentDay = (offset: -1 | 1) => {
        const target = quote.days[activeDayIndex + offset];
        if (target)
            selectOverviewDay(target.id);
    };
    const addQuickQuoteItem = async (item: QuoteItem, saveToLibrary: boolean) => {
        const isDailyFee = item.category === "保险" || item.category === "服务费";
        const existingDailyFee = isDailyFee ? quote.items.find((entry) => entry.dayId === item.dayId && entry.category === item.category) : undefined;
        let savedItem = existingDailyFee ? { ...existingDailyFee, ...item, id: existingDailyFee.id, sourceKey: existingDailyFee.sourceKey } : item;
        if (saveToLibrary) {
            const savedProduct = await onSaveItemToLibrary(savedItem, activeDay?.city || quote.city);
            savedItem = { ...savedItem, productId: savedProduct.id };
        }
        setQuote((current) => ({
            ...current,
            items: existingDailyFee ? current.items.map((entry) => entry.id === existingDailyFee.id ? savedItem : entry) : [...current.items, savedItem],
            updatedAt: new Date().toISOString(),
        }));
        if (!saveToLibrary)
            notify(`${existingDailyFee ? "已更新" : "已加入"} Day ${String(activeDayIndex + 1).padStart(2, "0")}：${item.nameZh}`);
    };
    const [libraryDraft, setLibraryDraft] = useState<BookingDraft | null>(null);
    const addLibraryItems = (items: QuoteItem[]) => {
        setQuote(current => ({ ...current, items: [...current.items, ...items], updatedAt: new Date().toISOString() }));
        notify(`已加入 Day ${String(activeDayIndex + 1).padStart(2, "0")}：${items[0]?.libraryQuote?.productNameZh}`);
    };
    const addLibraryProduct = (product: PriceProduct) => {
        if (product.library) {
            setLibraryDraft(draftFromProducts(products, product, quote.people));
            return;
        }
        if (!activeDayId)
            return;
        setQuote((current) => synchronizeDirectQuoteDailyFees(addProductToDirectQuote(current, product, activeDayId), products));
        notify(`已加入 Day ${String(activeDayIndex + 1).padStart(2, "0")}：${product.nameZh}`);
    };
    const addDay = () => {
        const anchorDayId = quote.days[quote.days.length - 1]?.id ?? "";
        const result = insertDirectQuoteDay(quote, anchorDayId, "after");
        setQuote(synchronizeDirectQuoteDailyFees(result.quote, products));
        setSelectedDayId(result.insertedDayId);
        notify("已新增一天直接报价");
    };
    const insertDay = (anchorDayId: string, position: DirectQuoteDayInsertPosition) => {
        const result = insertDirectQuoteDay(quote, anchorDayId, position);
        setQuote(synchronizeDirectQuoteDailyFees(result.quote, products));
        setSelectedDayId(result.insertedDayId);
        const insertedIndex = result.quote.days.findIndex((day) => day.id === result.insertedDayId);
        notify(`已插入 Day ${String(insertedIndex + 1).padStart(2, "0")}`);
    };
    const moveDay = (dayId: string, direction: DirectQuoteDayMoveDirection) => {
        setQuote((current) => synchronizeDirectQuoteDailyFees(moveDirectQuoteDay(current, dayId, direction), products));
        setSelectedDayId(dayId);
        notify(direction === "up" ? "已上移一天" : "已下移一天");
    };
    const reorderDay = (sourceDayId: string, targetDayId: string) => {
        setQuote((current) => synchronizeDirectQuoteDailyFees(reorderDirectQuoteDays(current, sourceDayId, targetDayId), products));
        setSelectedDayId(sourceDayId);
        notify("已调整 Day 顺序");
    };
    const deleteDay = (dayId: string) => {
        if (quote.days.length <= 1 || !window.confirm("删除这一天及其全部报价明细？"))
            return;
        const deletedIndex = quote.days.findIndex((day) => day.id === dayId);
        const next = removeDirectQuoteDay(quote, dayId);
        setQuote(synchronizeDirectQuoteDailyFees(next, products));
        setSelectedDayId(next.days[Math.min(deletedIndex, next.days.length - 1)]?.id ?? "");
    };
    const updateDayDate = (dayId: string, date: string) => setQuote((current) => {
        const index = current.days.findIndex((day) => day.id === dayId);
        const days = current.days.map((day, dayIndex) => ({ ...day, date: dayIndex === index ? date : index === 0 && date ? addDaysToDate(date, dayIndex) : day.date }));
        return { ...current, days, updatedAt: new Date().toISOString() };
    });
    const updateDayCity = (city: string) => setQuote((current) => ({
        ...current,
        city,
        days: current.days.map((day) => day.id === activeDayId ? { ...day, city } : day),
        updatedAt: new Date().toISOString(),
    }));
    return (<main className={`workspace direct-workspace simplified-direct-workspace ${entryCollapsed ? "entry-collapsed" : ""} ${quoteCollapsed ? "quote-collapsed" : ""}`}>
      <section className="direct-owner-group-bar">
        <div><span><FolderKanban size={17}/></span><div><strong>直接报价所属分组</strong><small>保存版本时会归入所选分组，所有员工均可查看</small></div></div>
        <label>
          <select value={selectedGroupId} onChange={(event) => onSelectGroup(event.target.value)}>
            <option value="" disabled>请选择分组</option>
            {groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
          </select>
        </label>
        <button className="ghost-button" onClick={() => {
            setGroupNames(Object.fromEntries(groups.map((group) => [group.id, group.name])));
            setGroupManagerOpen(true);
        }}><Pencil size={14}/>管理分组</button>
      </section>
      <section className="panel direct-entry-panel">
        <header className="panel-header direct-entry-header"><h2>快速录入报价</h2><div className="direct-entry-actions"><button className="quote-collapse-button direct-entry-collapse-button" onClick={() => setEntryCollapsed((current) => { const next = !current; if (next && quoteCollapsed)
        setQuoteCollapsed(false); return next; })} title={entryCollapsed ? "展开快速录入" : "收起快速录入"} aria-label={entryCollapsed ? "展开快速录入" : "收起快速录入"}>{entryCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button></div></header>
        <div className="direct-entry-scroll">
          <div className="direct-day-tabs" aria-label="选择报价日期">{dayOverview.map(({ day, index, itemCount, total }) => <button className={day.id === activeDayId ? "selected" : ""} key={day.id} onClick={() => setSelectedDayId(day.id)}><strong>Day {String(index + 1).padStart(2, "0")}</strong><span>{day.date?.slice(5) || "待定"} · {day.city || quote.city}</span><small>{itemCount} 项 · ¥{total.toLocaleString("zh-CN")}</small></button>)}</div>
          <section className="direct-day-context" aria-label="当前录入日期和城市">
            <div><span>当前录入</span><strong>Day {String(activeDayIndex + 1).padStart(2, "0")}</strong><small>{activeDay?.date || "日期待定"}</small></div>
            <label>当前城市<input value={activeDay?.city || quote.city} onChange={(event) => updateDayCity(event.target.value)} placeholder="例如：张家界"/></label>
          </section>

          <section className="direct-source-section generic-source-section">
            <div className="direct-section-heading"><div><strong>新增报价项目</strong><span>先选项目类型，再填写名称和价格</span></div><span className="active-day-chip">Day {String(activeDayIndex + 1).padStart(2, "0")}</span></div>
            <QuickQuoteModal products={products} onAddItems={addLibraryItems} embedded key={activeDayId} dayId={activeDayId} dayLabel={`Day ${String(activeDayIndex + 1).padStart(2, "0")}`} dayCity={activeDay?.city || quote.city} people={quote.people} existingCategories={quote.items.filter((item) => item.dayId === activeDayId).map((item) => item.category)} onAdd={addQuickQuoteItem} onCityChange={updateDayCity}/>
          </section>

          <section className={`direct-source-section user-library-section ${libraryOpen ? "open" : "closed"}`}>
            <div className="direct-section-heading"><div><strong>我的价格库</strong><span>只显示你主动保存的项目</span></div><div className="library-heading-actions"><span>{userProducts.length} 项</span><button type="button" className="direct-library-toggle" onClick={() => setLibraryOpen((current) => !current)} aria-expanded={libraryOpen}>{libraryOpen ? "收起" : "展开"}</button></div></div>
            {libraryOpen && (userProducts.length ? <>
              <div className="direct-library-tools">
                <label className="direct-library-search"><Search size={14}/><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="搜索名称、英文文案或城市"/></label>
                <div className="direct-library-filter-row"><span>分类</span><div>{LIBRARY_GROUPS.map((group) => <button className={libraryCategory === group.id ? "selected" : ""} key={group.id} onClick={() => setLibraryCategory(group.id)}>{group.label}</button>)}</div></div>
                <div className="direct-library-filter-row city-filter-row"><span>城市</span><div><button className={libraryCity === "全部城市" ? "selected" : ""} onClick={() => setLibraryCity("全部城市")}>全部城市</button>{libraryCities.map((city) => <button className={libraryCity === city ? "selected" : ""} key={city} onClick={() => setLibraryCity(city)}>{city}</button>)}</div></div>
              </div>
              {groupedLibraryProducts.length ? <div className="direct-library-groups">{groupedLibraryProducts.map((group) => <section key={group.id}><header><strong>{group.label}</strong><span>{group.items.length} 项</span></header><div className="direct-user-products">{group.items.map((product) => <article key={product.id}>
                <button className="direct-product-add" onClick={() => addLibraryProduct(product)} title={`加入 ${product.nameZh}`}>
                  <div><strong>{product.nameZh}</strong><small>{product.library?.specZh || product.nameEn}</small><span>{product.city} · {product.category}</span></div>
                  <div><strong>{product.library?.quotePending ? "待填写" : `¥${product.quotePrice.toLocaleString("zh-CN")}`}</strong><PackagePlus size={15}/></div>
                </button>
                <div className="direct-product-actions"><button onClick={() => setEditingProduct(product)} aria-label={`编辑${product.nameZh}`} title="编辑价格库项目"><Pencil size={13}/></button><button className="danger" onClick={() => { if (!window.confirm(`删除价格库项目“${product.nameZh}”？\n不会删除当前报价中已经加入的项目。`))
                        return; onDeleteLibraryProduct(product.id); notify(`已从价格库删除：${product.nameZh}`); }} aria-label={`删除${product.nameZh}`} title="删除价格库项目"><Trash2 size={13}/></button></div>
              </article>)}</div></section>)}</div> : <div className="direct-library-empty"><Search size={22}/><span>没有匹配的价格库项目</span><small>请调整搜索、分类或城市筛选</small></div>}
            </> : <div className="direct-library-empty"><Library size={22}/><span>还没有手动保存的价格</span><small>录入通用项目时勾选“同时加入我的价格库”即可保存</small></div>)}
          </section>
        </div>
      </section>

      {libraryDraft && <LibraryBookingModal initial={libraryDraft} onClose={() => setLibraryDraft(null)} onSave={value => { addLibraryItems(bookingToItems(value, activeDayId)); setLibraryDraft(null); }}/>}
      <QuoteCart title="当前直接报价" items={quote.items} onChange={(items) => setQuote((current) => ({ ...current, items, updatedAt: new Date().toISOString() }))} onAddCustom={(dayId) => { setCustomDayId(dayId ?? activeDayId); setSelectedDayId(dayId ?? activeDayId); setCustomOpen(true); }} groups={quote.days.map((day, index) => ({ id: day.id, label: `Day ${String(index + 1).padStart(2, "0")}`, date: day.date }))} dayLabels={Object.fromEntries(quote.days.map((day, index) => [day.id, `Day ${String(index + 1).padStart(2, "0")}`]))} onAddGroup={addDay} onDeleteGroup={deleteDay} onInsertGroup={insertDay} onMoveGroup={moveDay} onReorderGroup={reorderDay} onGroupDateChange={updateDayDate} onSelectGroup={setSelectedDayId} selectedGroupId={activeDayId} onSaveToLibrary={(item) => void onSaveItemToLibrary(item, activeDay?.city || quote.city)} libraryProductIds={userProducts.map((product) => product.id)} onUpdateLibraryDescription={(productId, description, nameZh) => {
            const product = products.find((entry) => entry.id === productId);
            if (!product)
                return;
            void onUpdateLibraryProduct({ ...product, nameZh, nameEn: description });
            notify(`已同步更新价格库：${product.nameZh}`);
        }} dayOverview={<div className="quote-canvas-day-overview" aria-label="多天报价概览">
          <div className="quote-canvas-day-overview-title">
            <div><strong>多日总览</strong><span>拖动调整顺序；预览可直接修改当天项目</span></div>
            <div className="overview-quick-nav">
              <button disabled={activeDayIndex <= 0} onClick={() => selectAdjacentDay(-1)} aria-label="定位到上一天" title="上一天"><ChevronLeft size={14}/></button>
              <label><span>快速定位</span><select value={activeDayId} aria-label="快速定位到指定Day" onChange={(event) => selectOverviewDay(event.target.value)}>{dayOverview.map(({ day, index }) => <option value={day.id} key={day.id}>Day {String(index + 1).padStart(2, "0")} · {day.city || quote.city || "城市待定"} · {day.date?.slice(5) || "日期待定"}</option>)}</select></label>
              <button disabled={activeDayIndex >= quote.days.length - 1} onClick={() => selectAdjacentDay(1)} aria-label="定位到下一天" title="下一天"><ChevronRight size={14}/></button>
              <button className="overview-add-day" onClick={addDay}><Plus size={13}/>末尾新增</button>
            </div>
          </div>
          <div className="quote-canvas-day-overview-list" ref={overviewListRef}>{dayOverview.map(({ day, index, itemCount, total, categorySet }) => <article key={day.id} ref={(element) => { if (element)
                overviewCardRefs.current.set(day.id, element);
            else
                overviewCardRefs.current.delete(day.id); }} className={`${day.id === activeDayId ? "selected" : ""} ${overviewDraggingDayId === day.id ? "dragging" : ""}`} draggable onDragStart={(event) => { setOverviewDraggingDayId(day.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", day.id); }} onDragEnd={() => setOverviewDraggingDayId("")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const sourceId = overviewDraggingDayId || event.dataTransfer.getData("text/plain"); setOverviewDraggingDayId(""); if (sourceId && sourceId !== day.id)
                reorderDay(sourceId, day.id); }}>
            <button className="overview-day-main" onClick={() => selectOverviewDay(day.id)} title={`定位并编辑 Day ${String(index + 1).padStart(2, "0")}`}>
              <span className="overview-day-number">Day {String(index + 1).padStart(2, "0")}</span>
              <span className="overview-day-city">{day.city || quote.city || "城市待定"}</span>
              <span className="overview-day-meta">{day.date || "日期待定"} · {itemCount} 项</span>
              <span className="overview-day-total">¥{total.toLocaleString("zh-CN")}</span>
              <span className="overview-category-status">{(["transportation", "hotel", "service"] as MarginCategory[]).filter((category) => categorySet.has(category)).map((category) => <i className={`category-dot category-dot-${category}`} key={category}/>)}</span>
            </button>
            <div className="overview-day-actions">
              <span title="拖动调整 Day 顺序"><GripVertical size={13}/></span>
              <button className={overviewPreviewDayId === day.id ? "active" : ""} onMouseEnter={() => showOverviewPreview(day.id)} onMouseLeave={hideOverviewPreviewSoon} onClick={() => { setOverviewPinnedDayId((current) => current === day.id ? "" : day.id); selectOverviewDay(day.id); }} title="预览并编辑当天项目" aria-label={`预览Day ${String(index + 1).padStart(2, "0")}`}><Eye size={13}/></button>
              <button onClick={() => insertDay(day.id, "after")} title="在此后插入一天" aria-label={`在Day ${String(index + 1).padStart(2, "0")}后插入一天`}><Plus size={13}/></button>
              <button disabled={quote.days.length <= 1} onClick={() => deleteDay(day.id)} title="删除这一天" aria-label={`删除Day ${String(index + 1).padStart(2, "0")}`}><Trash2 size={12}/></button>
            </div>
          </article>)}</div>
          {overviewPreview && <section className="overview-day-editor" onMouseEnter={() => showOverviewPreview(overviewPreview.day.id)} onMouseLeave={hideOverviewPreviewSoon}>
            <header><div><strong>Day {String(overviewPreview.index + 1).padStart(2, "0")} · {overviewPreview.day.city || quote.city || "城市待定"}</strong><span>{overviewPreview.day.date || "日期待定"} · {overviewPreview.itemCount} 项 · 小计 ¥{overviewPreview.total.toLocaleString("zh-CN")}</span></div><button onClick={() => { selectOverviewDay(overviewPreview.day.id); setOverviewPinnedDayId(overviewPreview.day.id); }}>进入完整编辑</button></header>
            <div className={`overview-editor-head ${costsHidden ? "cost-hidden" : ""}`}><span>项目</span><span>数量</span>{!costsHidden && <span>成本</span>}<span>报价</span><span>小计</span></div>
            <div className="overview-editor-list">{quote.items.filter((item) => item.dayId === overviewPreview.day.id).map((item) => {
                    const category = marginCategoryForItem(item);
                    return <div className={`overview-editor-row category-${category} ${costsHidden ? "cost-hidden" : ""}`} key={item.id}>
                <label><i className={`category-dot category-dot-${category}`}/><input aria-label={`${item.nameZh}预览项目名称`} value={item.nameZh} onChange={(event) => updateOverviewItem(item.id, { nameZh: event.target.value, nameEdited: true })}/></label>
                <input type="number" min="0" aria-label={`${item.nameZh}预览数量`} value={item.quantity} onChange={(event) => updateOverviewItem(item.id, { quantity: Math.max(0, Number(event.target.value) || 0), quantityEdited: true })}/>
                {!costsHidden && <input type="number" min="0" aria-label={`${item.nameZh}预览成本`} value={item.costPrice} onChange={(event) => updateOverviewItem(item.id, { costPrice: Math.max(0, Number(event.target.value) || 0), costEdited: true })}/>}
                <input type="number" min="0" aria-label={`${item.nameZh}预览报价`} value={item.quotePrice} onChange={(event) => updateOverviewItem(item.id, { quotePrice: Math.max(0, Number(event.target.value) || 0), quoteEdited: true })}/>
                <strong>¥{(item.quantity * item.quotePrice).toLocaleString("zh-CN")}</strong>
              </div>;
                })}{overviewPreview.itemCount === 0 && <div className="overview-editor-empty">当天暂无项目，可点击“进入完整编辑”后新增。</div>}</div>
          </section>}
        </div>} onClearAll={() => {
            setClearConfirmOpen(true);
        }} costsHidden={costsHidden} onToggleCosts={onToggleCosts} collapsed={quoteCollapsed} onToggleCollapsed={() => setQuoteCollapsed((current) => { const next = !current; if (next && entryCollapsed)
        setEntryCollapsed(false); return next; })}/>
      {clearConfirmOpen && <Modal title="清空全部报价" onClose={() => setClearConfirmOpen(false)} footer={<><button className="ghost-button" onClick={() => setClearConfirmOpen(false)}>取消</button><button className="primary-button danger-button" onClick={() => {
                    const reset = resetDirectQuote(quote);
                    setQuote(reset);
                    setSelectedDayId(reset.days[0]?.id ?? "");
                    setClearConfirmOpen(false);
                    notify("已清空报价，并恢复为仅 Day 01");
                }}>确认清空</button></>}>
        <p className="modal-hint">将删除当前报价的所有项目和新增 Day，只保留 Day 01。已保存的历史版本不会删除。</p>
      </Modal>}
      {customOpen && <CustomItemModal defaultDayId={customDayId} dayOptions={quote.days.map((day, index) => ({ id: day.id, label: `Day ${String(index + 1).padStart(2, "0")}` }))} onClose={() => setCustomOpen(false)} onAdd={(item) => { setQuote((current) => ({ ...current, items: [...current.items, item] })); setCustomOpen(false); notify("自定义项目已加入"); }}/>}
      {editingProduct && <PriceProductEditModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={(product) => { void onUpdateLibraryProduct(product); setEditingProduct(null); }}/>}
      {groupManagerOpen && <Modal title="管理直接报价分组" onClose={() => setGroupManagerOpen(false)} footer={<button className="primary-button" onClick={() => setGroupManagerOpen(false)}>完成</button>}>
        <div className="direct-group-manager">
          <div className="direct-group-create">
            <label>新增分组<input value={newGroupName} maxLength={50} placeholder="例如：A员工组" onChange={(event) => setNewGroupName(event.target.value)}/></label>
            <button className="primary-button" disabled={!newGroupName.trim() || groupSaving} onClick={async () => {
                setGroupSaving(true);
                const created = await onCreateGroup(newGroupName);
                setGroupSaving(false);
                if (!created)
                    return;
                setGroupNames((current) => ({ ...current, [created.id]: created.name }));
                setNewGroupName("");
            }}><Plus size={15}/>新增</button>
          </div>
          <div className="direct-group-list">
            {groups.map((group) => {
                const value = groupNames[group.id] ?? group.name;
                return <div key={group.id}><input value={value} maxLength={50} onChange={(event) => setGroupNames((current) => ({ ...current, [group.id]: event.target.value }))}/><button disabled={!value.trim() || value.trim() === group.name || groupSaving} onClick={async () => {
                        setGroupSaving(true);
                        const renamed = await onRenameGroup(group.id, value);
                        setGroupSaving(false);
                        if (renamed)
                            setGroupNames((current) => ({ ...current, [group.id]: renamed.name }));
                    }}><Save size={14}/>保存名称</button></div>;
            })}
          </div>
          <p>第一版不提供删除分组，避免已有报价失去归属。</p>
        </div>
      </Modal>}
    </main>);
}
