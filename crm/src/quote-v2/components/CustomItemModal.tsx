import { useState } from "react";
import { Modal } from "./Modal";
import { createId } from "../lib/id";
import type { ProductCategory, QuoteItem } from "../types";
interface Props {
    onClose: () => void;
    onAdd: (item: QuoteItem) => void;
    dayOptions?: Array<{
        id: string;
        label: string;
    }>;
    defaultDayId?: string;
}
export function CustomItemModal({ onClose, onAdd, dayOptions = [], defaultDayId = "" }: Props) {
    const [nameZh, setNameZh] = useState("自定义服务");
    const [nameEn, setNameEn] = useState("Custom service");
    const [quantity, setQuantity] = useState(1);
    const [costPrice, setCostPrice] = useState(0);
    const [quotePrice, setQuotePrice] = useState(0);
    const [note, setNote] = useState("");
    const [dayId, setDayId] = useState(defaultDayId);
    const submit = () => {
        if (!nameZh.trim())
            return;
        onAdd({
            id: createId(),
            sourceKey: `manual:${createId()}`,
            dayId: dayId || undefined,
            source: "manual",
            category: "自定义项目" as ProductCategory,
            nameZh: nameZh.trim(),
            nameEn: nameEn.trim(),
            invoiceDescriptionEn: nameEn.trim(),
            invoiceDescriptionAuto: false,
            invoiceGroup: "service",
            note: note.trim(),
            quantity: Math.max(0, Math.round(quantity || 0)),
            costPrice: Math.max(0, Math.round(costPrice || 0)),
            quotePrice: Math.max(0, Math.round(quotePrice || 0)),
            unit: "每次",
            nameEdited: true,
            costEdited: true,
            quoteEdited: true,
            quantityEdited: true,
        });
    };
    return (<Modal title="添加自定义报价项目" onClose={onClose} footer={<><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" onClick={submit}>加入报价</button></>}>
      <div className="form-grid">
        <label>中文名称<input value={nameZh} onChange={(event) => setNameZh(event.target.value)}/></label>
        <label>英文发票描述<textarea rows={2} value={nameEn} onChange={(event) => setNameEn(event.target.value)}/></label>
        <label>数量<input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></label>
        <label>成本单价<input type="number" min="0" value={costPrice} onChange={(event) => setCostPrice(Number(event.target.value))}/></label>
        <label>报价单价<input type="number" min="0" value={quotePrice} onChange={(event) => setQuotePrice(Number(event.target.value))}/></label>
        {dayOptions.length > 0 && <label>所属 Day<select value={dayId} onChange={(event) => setDayId(event.target.value)}><option value="">不指定</option>{dayOptions.map((day) => <option value={day.id} key={day.id}>{day.label}</option>)}</select></label>}
        <label className="full-span">备注<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)}/></label>
      </div>
    </Modal>);
}
