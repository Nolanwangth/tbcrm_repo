import { useMemo, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { CalendarDays, CarFront, ChevronDown, ChevronRight, Copy, GripVertical, MapPin, Pencil, Search, Trash2, UserRound, WandSparkles } from "lucide-react";
import { addDaysToDate, cascadeDatesFromFirstDay, createDayFromTemplate, removeDayAndAutoItems, synchronizeAutoQuote } from "../lib/logic";
import { createId } from "../lib/id";
import type { DayPlan, PriceProduct, ProposalPlan, RouteTemplate } from "../types";
import { QuoteCart } from "../components/QuoteCart";
import { QuickQuoteModal } from "../components/QuickQuoteModal";
import { DayEditor } from "../components/DayEditor";
interface Props {
    initialDate?: string | null;
    plan: ProposalPlan;
    setPlan: Dispatch<SetStateAction<ProposalPlan>>;
    templates: RouteTemplate[];
    products: PriceProduct[];
    costsHidden: boolean;
    onToggleCosts: () => void;
    notify: (message: string) => void;
    onSaveItemToLibrary: (item: ProposalPlan["items"][number], city: string) => PriceProduct | Promise<PriceProduct>;
}
export function QuickPlanPage({ initialDate, plan, setPlan, templates, products, costsHidden, onToggleCosts, notify, onSaveItemToLibrary }: Props) {
    const [search, setSearch] = useState("");
    const [city, setCity] = useState("全部城市");
    const [collapsed, setCollapsed] = useState<string[]>([]);
    const [editingDay, setEditingDay] = useState<DayPlan | null>(null);
    const [customOpen, setCustomOpen] = useState(false);
    const [customDayId, setCustomDayId] = useState("");
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const cities = useMemo(() => Array.from(new Set(templates.map((template) => template.city))), [templates]);
    const visibleTemplates = templates.filter((template) => (city === "全部城市" || template.city === city) &&
        `${template.titleZh}${template.routeZh}`.toLowerCase().includes(search.toLowerCase()));
    const grouped = cities.map((groupCity) => ({ city: groupCity, items: visibleTemplates.filter((item) => item.city === groupCity) })).filter((group) => group.items.length);
    const dayLabels = Object.fromEntries(plan.days.map((day, index) => [day.id, `Day ${String(index + 1).padStart(2, "0")}`]));
    const addTemplate = (template: RouteTemplate) => {
        setPlan((current) => {
            const day = createDayFromTemplate(template, current.days.length);
            if (current.days[0]?.date)
                day.date = addDaysToDate(current.days[0].date, current.days.length);
            else if (initialDate)
                day.date = addDaysToDate(initialDate, current.days.length);
            const next = { ...current, days: [...current.days, day] };
            return current.autoMatch ? synchronizeAutoQuote(next, products) : next;
        });
        notify(`已添加：${template.titleZh}`);
    };
    const deleteDay = (day: DayPlan) => {
        const manualCount = plan.items.filter((item) => item.source === "manual" && item.dayId === day.id).length;
        const prompt = manualCount
            ? `删除“${day.titleZh}”？${manualCount} 个手动项目将保留在报价中。`
            : `删除“${day.titleZh}”？关联的自动报价也会删除。`;
        if (!window.confirm(prompt))
            return;
        setPlan((current) => synchronizeAutoQuote(removeDayAndAutoItems(current, day.id), products));
    };
    const duplicateDay = (day: DayPlan) => {
        setPlan((current) => {
            const copied = { ...day, id: createId(), date: "", titleZh: `${day.titleZh}（复制）` };
            return synchronizeAutoQuote({ ...current, days: [...current.days, copied] }, products);
        });
        notify("已复制 Day");
    };
    const saveDay = (day: DayPlan) => {
        setPlan((current) => {
            const dayIndex = current.days.findIndex((target) => target.id === day.id);
            let days = current.days.map((target) => target.id === day.id ? day : target);
            if (dayIndex === 0 && day.date !== current.days[0]?.date) {
                days = cascadeDatesFromFirstDay(days, day.date);
            }
            return synchronizeAutoQuote({ ...current, days }, products);
        });
        setEditingDay(null);
        notify(plan.days[0]?.id === day.id ? "第一天已更新，后续日期已同步顺延" : "Day 已更新并重新匹配");
    };
    const dropDay = (event: DragEvent, targetId: string) => {
        event.preventDefault();
        if (!draggingId || draggingId === targetId)
            return;
        setPlan((current) => {
            const days = [...current.days];
            const sourceIndex = days.findIndex((day) => day.id === draggingId);
            const targetIndex = days.findIndex((day) => day.id === targetId);
            const [moved] = days.splice(sourceIndex, 1);
            days.splice(targetIndex, 0, moved);
            return { ...current, days, updatedAt: new Date().toISOString() };
        });
        setDraggingId(null);
    };
    const addQuickQuoteItem = async (item: ProposalPlan["items"][number], saveToLibrary: boolean) => {
        try {
            const isDailyFee = item.category === "保险" || item.category === "服务费";
            const existingDailyFee = isDailyFee ? plan.items.find((entry) => entry.dayId === item.dayId && entry.category === item.category) : undefined;
            let savedItem = existingDailyFee
                ? { ...existingDailyFee, ...item, id: existingDailyFee.id, sourceKey: existingDailyFee.sourceKey }
                : item;
            if (saveToLibrary) {
                const savedProduct = await onSaveItemToLibrary(savedItem, plan.days.find((entry) => entry.id === item.dayId)?.city ?? "通用");
                savedItem = { ...savedItem, productId: savedProduct.id };
            }
            setPlan((current) => ({
                ...current,
                items: existingDailyFee ? current.items.map((entry) => entry.id === existingDailyFee.id ? savedItem : entry) : [...current.items, savedItem],
                updatedAt: new Date().toISOString(),
            }));
            if (!saveToLibrary)
                notify(`${existingDailyFee ? "已更新" : "已加入"} ${dayLabels[item.dayId ?? ""] ?? "报价"}：${item.nameZh}`);
            setCustomOpen(false);
        }
        catch (error) {
            notify(error instanceof Error ? `${error.message}；录入内容已保留` : "保存失败，录入内容已保留");
        }
    };
    return (<main className="workspace quick-workspace">
      <section className="panel templates-panel">
        <header className="panel-header"><div><h2>路线模板</h2><span>点击即可加入行程</span></div></header>
        <div className="filter-row">
          <label className="search-box"><Search size={16}/><input placeholder="搜索模板…" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
          <select value={city} onChange={(event) => setCity(event.target.value)}><option>全部城市</option>{cities.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="template-groups">
          {grouped.map((group) => {
            const isCollapsed = collapsed.includes(group.city);
            return <div className="template-group" key={group.city}>
              <button className="group-title" onClick={() => setCollapsed((value) => value.includes(group.city) ? value.filter((item) => item !== group.city) : [...value, group.city])}>
                <span>{group.city}<small>{group.items.length}</small></span>{isCollapsed ? <ChevronRight size={16}/> : <ChevronDown size={16}/>}
              </button>
              {!isCollapsed && group.items.map((template) => (<button className="template-item" onClick={() => addTemplate(template)} key={template.id}>
                  <CalendarDays size={16}/><span><strong>{template.titleZh}</strong><small>{template.type}</small></span><span className="template-add">＋</span>
                </button>))}
            </div>;
        })}
          {grouped.length === 0 && <div className="empty-state small"><Search size={26}/><strong>没有匹配模板</strong></div>}
        </div>
      </section>

      <section className="panel itinerary-panel">
        <header className="panel-header">
          <div><h2>当前行程</h2><span>{plan.days.length ? `${plan.days.length}天 · ${plan.title}` : "从左侧添加路线"}</span></div>
          <span className={`status-pill ${plan.autoMatch ? "active" : ""}`}><WandSparkles size={14}/>{plan.autoMatch ? "自动匹配中" : "仅编辑行程"}</span>
        </header>
        <div className="day-list">
          {plan.days.length === 0 ? (<div className="empty-state itinerary-empty">
              <div className="empty-icon"><MapPin size={30}/></div>
              <strong>开始组合你的快速行程</strong>
              <span>从左侧选择路线模板；车辆、导游与门票会自动加入报价。</span>
            </div>) : plan.days.map((day, index) => {
            const language = day.guideLanguage ?? plan.guideLanguage;
            const vehicle = plan.items.find((item) => item.dayId === day.id && ["市区用车", "郊区用车", "接机", "送机", "接站", "送站"].includes(item.category));
            return (<article className={`day-card ${draggingId === day.id ? "dragging" : ""}`} key={day.id} draggable onDragStart={() => setDraggingId(day.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropDay(event, day.id)}>
                <button className="drag-handle" aria-label="拖动排序"><GripVertical size={17}/></button>
                <div className="day-badge"><span>DAY</span><strong>{String(index + 1).padStart(2, "0")}</strong><small>{day.date ? day.date.slice(5).replace("-", "/") : "待定"}</small></div>
                <div className="day-content">
                  <div className="day-title"><div><strong>{day.titleZh}</strong><span>{day.city}</span></div><div className="day-actions">
                    <button className="icon-button" onClick={() => setEditingDay(day)} aria-label="编辑"><Pencil size={15}/></button>
                    <button className="icon-button" onClick={() => duplicateDay(day)} aria-label="复制"><Copy size={15}/></button>
                    <button className="icon-button danger" onClick={() => deleteDay(day)} aria-label="删除"><Trash2 size={15}/></button>
                  </div></div>
                  <p>{day.routeZh}</p>
                  <div className="day-meta">
                    <span><CarFront size={15}/> {vehicle?.nameZh.replace(/（.*）/, "") ?? (day.requiresVehicle ? "需手动选择车型" : "无用车")}</span>
                    <span><UserRound size={15}/> {day.requiresGuide ? language : "无导游"}</span>
                  </div>
                </div>
              </article>);
        })}
        </div>
        {plan.days.length > 0 && <p className="drag-tip"><GripVertical size={14}/> 拖动 Day 卡片可调整顺序，编号会自动更新</p>}
      </section>

      <QuoteCart items={plan.items} onChange={(items) => setPlan((current) => ({ ...current, items, updatedAt: new Date().toISOString() }))} onAddCustom={(dayId) => { setCustomDayId(dayId ?? ""); setCustomOpen(true); }} dayLabels={dayLabels} groups={plan.days.map((day, index) => ({ id: day.id, label: `Day ${String(index + 1).padStart(2, "0")}`, date: day.date }))} onSaveToLibrary={(item) => onSaveItemToLibrary(item, plan.days.find((day) => day.id === item.dayId)?.city ?? "通用")} onClearAll={() => {
            if (!window.confirm("清空全部报价明细？行程会保留，自动匹配将关闭。"))
                return;
            setPlan((current) => ({ ...current, autoMatch: false, items: [], updatedAt: new Date().toISOString() }));
            notify("已清空全部报价，行程已保留，自动匹配已关闭");
        }} costsHidden={costsHidden} onToggleCosts={onToggleCosts}/>

      {editingDay && <DayEditor day={editingDay} products={products} isFirstDay={plan.days[0]?.id === editingDay.id} onClose={() => setEditingDay(null)} onSave={saveDay}/>}
      {customOpen && <QuickQuoteModal dayId={customDayId} dayLabel={dayLabels[customDayId] ?? "当前日期"} dayCity={plan.days.find((day) => day.id === customDayId)?.city ?? ""} guideLanguage={plan.days.find((day) => day.id === customDayId)?.guideLanguage ?? plan.guideLanguage} people={plan.people} existingCategories={plan.items.filter((item) => item.dayId === customDayId).map((item) => item.category)} onClose={() => setCustomOpen(false)} onAdd={addQuickQuoteItem}/>}
    </main>);
}
