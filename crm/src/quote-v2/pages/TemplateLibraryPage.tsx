import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Copy, MapPinned, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { createId } from "../lib/id";
import { TEMPLATE_TYPES, type PriceProduct, type RouteTemplate } from "../types";
interface Props {
    templates: RouteTemplate[];
    setTemplates: Dispatch<SetStateAction<RouteTemplate[]>>;
    products: PriceProduct[];
    notify: (message: string) => void;
}
const emptyTemplate = (): RouteTemplate => ({
    id: createId(), city: "成都", type: "自定义一日模板", titleZh: "", titleEn: "", routeZh: "", routeEn: "",
    driverCategory: "市区用车", requiresVehicle: true, requiresGuide: true, linkedProductIds: [], includedEn: ["Private car", "Driver"],
});
function TemplateForm({ value, products, onClose, onSave }: {
    value: RouteTemplate;
    products: PriceProduct[];
    onClose: () => void;
    onSave: (value: RouteTemplate) => void;
}) {
    const [draft, setDraft] = useState(value);
    const linkable = products.filter((product) => product.city === draft.city && !product.seatCount && product.category !== "多语言导游");
    return <Modal title={value.titleZh ? "编辑路线模板" : "新建路线模板"} onClose={onClose} wide footer={<><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!draft.titleZh.trim()} onClick={() => onSave(draft)}>保存模板</button></>}>
    <div className="form-grid">
      <label>城市<input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })}/></label>
      <label>模板类型<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as RouteTemplate["type"] })}>{TEMPLATE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>中文标题<input value={draft.titleZh} onChange={(event) => setDraft({ ...draft, titleZh: event.target.value })}/></label>
      <label>英文标题<input value={draft.titleEn} onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })}/></label>
      <label className="full-span">中文路线<textarea rows={2} value={draft.routeZh} onChange={(event) => setDraft({ ...draft, routeZh: event.target.value })}/></label>
      <label className="full-span">英文路线<textarea rows={2} value={draft.routeEn} onChange={(event) => setDraft({ ...draft, routeEn: event.target.value })}/></label>
      <label>司机服务类型<select value={draft.driverCategory} onChange={(event) => setDraft({ ...draft, driverCategory: event.target.value as RouteTemplate["driverCategory"] })}>{["市区用车", "郊区用车", "接机", "送机", "接站", "送站"].map((type) => <option key={type}>{type}</option>)}</select></label>
      <div className="toggle-pair"><label className="check-field"><input type="checkbox" checked={draft.requiresVehicle} onChange={(event) => setDraft({ ...draft, requiresVehicle: event.target.checked })}/>需要用车</label><label className="check-field"><input type="checkbox" checked={draft.requiresGuide} onChange={(event) => setDraft({ ...draft, requiresGuide: event.target.checked })}/>需要导游</label></div>
      <label className="full-span">客户版 Included（每行一项）<textarea rows={3} value={draft.includedEn.join("\n")} onChange={(event) => setDraft({ ...draft, includedEn: event.target.value.split("\n").filter(Boolean) })}/></label>
      <div className="full-span linked-products"><span className="field-title">自动关联门票与服务</span><div>{linkable.map((product) => <label className="check-chip" key={product.id}><input type="checkbox" checked={draft.linkedProductIds.includes(product.id)} onChange={() => setDraft({ ...draft, linkedProductIds: draft.linkedProductIds.includes(product.id) ? draft.linkedProductIds.filter((id) => id !== product.id) : [...draft.linkedProductIds, product.id] })}/>{product.nameZh}</label>)}</div></div>
    </div>
  </Modal>;
}
export function TemplateLibraryPage({ templates, setTemplates, products, notify }: Props) {
    const [search, setSearch] = useState("");
    const [editing, setEditing] = useState<RouteTemplate | null>(null);
    const filtered = useMemo(() => templates.filter((template) => `${template.city}${template.titleZh}${template.routeZh}`.toLowerCase().includes(search.toLowerCase())), [templates, search]);
    const save = (template: RouteTemplate) => {
        setTemplates((current) => current.some((item) => item.id === template.id) ? current.map((item) => item.id === template.id ? { ...template, demo: item.demo } : item) : [...current, template]);
        setEditing(null);
        notify("路线模板已保存");
    };
    return <main className="library-page">
    <section className="library-heading"><div><span className="section-kicker">ROUTE LIBRARY</span><h1>路线模板库</h1><p>管理可快速加入方案的单日路线，以及它们的车辆、导游和门票关联。</p></div><button className="primary-button" onClick={() => setEditing(emptyTemplate())}><Plus size={17}/> 新建模板</button></section>
    <section className="library-toolbar"><label className="search-box"><Search size={16}/><input placeholder="搜索城市、模板或路线…" value={search} onChange={(event) => setSearch(event.target.value)}/></label><span>共 {filtered.length} 个模板</span></section>
    <section className="template-library-grid">{filtered.map((template) => <article className="library-card" key={template.id}>
      <div className="library-card-top"><span className="city-mark"><MapPinned size={17}/>{template.city}</span><span className="type-badge">{template.type}</span></div>
      <h3>{template.titleZh}</h3><span className="english-label">{template.titleEn}</span><p>{template.routeZh}</p>
      <div className="association-row"><span>{template.driverCategory ?? "无用车"}</span><span>{template.requiresGuide ? "需要导游" : "无导游"}</span><span>{template.linkedProductIds.length} 项关联</span></div>
      <footer><span>{template.demo ? "可编辑示例" : "自定义模板"}</span><div><button className="icon-button" aria-label={`复制${template.titleZh}`} onClick={() => { const copy = { ...template, id: createId(), titleZh: `${template.titleZh}（复制）`, demo: false }; setTemplates((current) => [...current, copy]); notify("模板已复制"); }}><Copy size={15}/></button><button className="icon-button" aria-label={`编辑${template.titleZh}`} onClick={() => setEditing(template)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`删除${template.titleZh}`} onClick={() => window.confirm(`删除模板“${template.titleZh}”？`) && setTemplates((current) => current.filter((item) => item.id !== template.id))}><Trash2 size={15}/></button></div></footer>
    </article>)}</section>
    {editing && <TemplateForm value={editing} products={products} onClose={() => setEditing(null)} onSave={save}/>}
  </main>;
}
