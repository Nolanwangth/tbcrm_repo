import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { GUIDE_LANGUAGES, type DayPlan, type PriceProduct } from "../types";
interface Props {
    day: DayPlan;
    products: PriceProduct[];
    onClose: () => void;
    onSave: (day: DayPlan) => void;
    isFirstDay?: boolean;
}
export function DayEditor({ day, products, onClose, onSave, isFirstDay = false }: Props) {
    const [draft, setDraft] = useState(day);
    const cityProducts = useMemo(() => products.filter((product) => product.enabled && product.city === draft.city), [products, draft.city]);
    const vehicleProducts = cityProducts.filter((product) => product.seatCount && product.category === draft.driverCategory);
    const linkedProducts = cityProducts.filter((product) => !product.seatCount && product.category !== "多语言导游");
    const toggleLinked = (id: string) => setDraft((current) => ({
        ...current,
        linkedProductIds: current.linkedProductIds.includes(id)
            ? current.linkedProductIds.filter((target) => target !== id)
            : [...current.linkedProductIds, id],
    }));
    return (<Modal title="编辑每日行程" onClose={onClose} wide footer={<><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSave(draft)}>保存并重新匹配</button></>}>
      <div className="form-grid">
        <label>日期<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/>{isFirstDay && <small>修改第一天后，后续日期会自动连续顺延</small>}</label>
        <label>城市<input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })}/></label>
        <label>中文标题<input value={draft.titleZh} onChange={(event) => setDraft({ ...draft, titleZh: event.target.value })}/></label>
        <label>英文标题<input value={draft.titleEn} onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })}/></label>
        <label className="full-span">中文路线<textarea rows={2} value={draft.routeZh} onChange={(event) => setDraft({ ...draft, routeZh: event.target.value })}/></label>
        <label className="full-span">英文路线<textarea rows={2} value={draft.routeEn} onChange={(event) => setDraft({ ...draft, routeEn: event.target.value })}/></label>
        <label className="check-field"><input type="checkbox" checked={draft.requiresVehicle} onChange={(event) => setDraft({ ...draft, requiresVehicle: event.target.checked })}/> 当天需要用车</label>
        <label>手动车型覆盖
          <select value={draft.vehicleProductId ?? ""} onChange={(event) => setDraft({ ...draft, vehicleProductId: event.target.value || undefined })}>
            <option value="">按人数自动推荐</option>
            {vehicleProducts.map((product) => <option value={product.id} key={product.id}>{product.nameZh}</option>)}
          </select>
        </label>
        <label className="check-field"><input type="checkbox" checked={draft.requiresGuide} onChange={(event) => setDraft({ ...draft, requiresGuide: event.target.checked })}/> 当天需要导游</label>
        <label>当天导游语言
          <select value={draft.guideLanguage ?? ""} onChange={(event) => setDraft({ ...draft, guideLanguage: event.target.value ? event.target.value as DayPlan["guideLanguage"] : undefined })}>
            <option value="">跟随全局设置</option>
            {GUIDE_LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
          </select>
        </label>
        <div className="full-span linked-products">
          <span className="field-title">关联门票与服务</span>
          <div>{linkedProducts.map((product) => (<label className="check-chip" key={product.id}>
              <input type="checkbox" checked={draft.linkedProductIds.includes(product.id)} onChange={() => toggleLinked(product.id)}/>
              {product.nameZh}
            </label>))}</div>
        </div>
      </div>
    </Modal>);
}
