import { useState } from "react";
import { GUIDE_LANGUAGES, PRODUCT_CATEGORIES, PRICING_UNITS, type GuideLanguage, type PriceProduct, type ProductCategory, type PricingUnit } from "../types";
import { Modal } from "./Modal";
import { priceInput } from "../lib/quoteLibrary";
import { validateLibraryProduct } from "../lib/quoteLibraryImport";
interface Props {
    product: PriceProduct;
    onClose: () => void;
    onSave: (product: PriceProduct) => void;
    error?: string;
    busy?: boolean;
}
export function PriceProductEditModal({ product, onClose, onSave, error, busy }: Props) {
    const [draft, setDraft] = useState({ ...product, library: product.library || { kind: "standard" as const, specZh: "" } });
    const submit = () => {
        if (validateLibraryProduct(draft))
            return;
        onSave({
            ...draft,
            city: draft.city.trim(),
            nameZh: draft.nameZh.trim(),
            nameEn: draft.nameEn.trim(),
            costPrice: draft.costPrice,
            quotePrice: draft.quotePrice,
        });
    };
    return (<Modal title={`编辑报价库项目 · ${product.nameZh || "新商品"}`} onClose={onClose} footer={<><button className="ghost-button" disabled={busy} onClick={onClose}>取消</button><button className="primary-button" disabled={busy || !!validateLibraryProduct(draft)} onClick={submit}>{busy ? "保存中…" : "保存修改"}</button></>}>
      <div className="form-grid">
        {error && <p role="alert" className="full-span library-warning">{error}</p>}
        <label>城市<input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })}/></label>
        <label>分类<select value={draft.category} onChange={(event) => {
            const category = event.target.value as ProductCategory;
            const kind = category === "景点门票" ? "ticket" : category === "多语言导游" ? "guide" : "standard";
            setDraft({ ...draft, category, unit: kind === "guide" ? "每天" : kind === "ticket" ? "每人" : draft.unit, library: { ...draft.library, kind, guideHours: kind === "guide" ? 8 : undefined } });
        }}>{PRODUCT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>中文名称<input value={draft.nameZh} onChange={(event) => setDraft({ ...draft, nameZh: event.target.value })}/></label>
        <label>单位<select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value as PricingUnit })}>{PRICING_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        {draft.category === "多语言导游" && <label>导游语言<select value={draft.guideLanguage || ""} onChange={e => setDraft({ ...draft, guideLanguage: e.target.value ? e.target.value as GuideLanguage : undefined })}><option value="">未指定</option>{GUIDE_LANGUAGES.map(language => <option key={language}>{language}</option>)}</select></label>}
        {["市区用车", "郊区用车", "接机", "送机", "接站", "送站"].includes(draft.category) && <label>车辆座位数<input type="number" min="1" value={draft.seatCount ?? ""} onChange={e => setDraft({ ...draft, seatCount: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined })}/></label>}
        <label className="full-span">英文发票文案<textarea rows={4} value={draft.nameEn} onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}/></label>
        {draft.library && <>
          <label className="full-span">中文规格<input value={draft.library.specZh} onChange={e => setDraft({ ...draft, library: { ...draft.library!, specZh: e.target.value } })} placeholder="例如：成人票／8小时每天"/></label>
          {draft.library.kind === "ticket" && <label>英文票种<select value={draft.library.ticketType || "standard"} onChange={e => setDraft({ ...draft, library: { ...draft.library!, ticketType: e.target.value as "adult" | "child" | "standard" } })}><option value="standard">普通票（不推断年龄）</option><option value="adult">成人票 Adult</option><option value="child">儿童票 Child</option></select></label>}
          {draft.library.kind === "guide" && <label>服务小时<select value={draft.library.guideHours || 8} onChange={e => setDraft({ ...draft, library: { ...draft.library!, guideHours: Number(e.target.value) } })}>{[8, 10, 12].map(h => <option key={h} value={h}>{h} 小时／天</option>)}</select></label>}
          {draft.library.source && <p className="full-span library-source">来源：{draft.library.source.file} / {draft.library.source.sheet} 第{draft.library.source.row}行<br />原始规格：{draft.library.source.originalSpec}</p>}
          {!!draft.library.warnings?.length && <p className="full-span library-warning">{draft.library.warnings.join("；")}</p>}
        </>}
        <label>成本价<input type="number" min="0" step="any" placeholder="待填写" value={priceInput(draft.costPrice, draft.library.costPending)} onChange={(event) => setDraft({ ...draft, costPrice: Number(event.target.value), library: { ...draft.library, costPending: event.target.value === "" } })}/></label>
        <label>报价价<input type="number" min="0" step="any" placeholder="待填写" value={priceInput(draft.quotePrice, draft.library.quotePending)} onChange={(event) => setDraft({ ...draft, quotePrice: Number(event.target.value), library: { ...draft.library, quotePending: event.target.value === "" } })}/></label>
        <label className="check-field"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })}/>启用</label>
        <p className="full-span modal-hint">修改只影响以后从价格库加入的项目，不会改变当前报价中已有的明细。</p>
      </div>
    </Modal>);
}
