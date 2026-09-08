import { Plus, Trash2 } from "lucide-react";
import { bookingDescription, bookingLine, validPrice, type BookingDraft } from "../lib/quoteLibrary";
export function LibraryBookingForm({ value, onChange }: {
    value: BookingDraft;
    onChange: (draft: BookingDraft) => void;
}) {
    const changeLine = (key: string, patch: Partial<BookingDraft["lines"][number]>) => onChange({ ...value, lines: value.lines.map(l => l.key === key ? { ...l, ...patch } : l) });
    return <div className="library-booking-form">
    <div className="library-spec-intro"><strong>{value.kind === "ticket" ? "票种与价格" : value.kind === "guide" ? "导游服务规格" : "商品规格与价格"}</strong><small>{value.kind === "ticket" ? "不同票种分别计价，合并为一个项目" : value.kind === "guide" ? "数量为导游人数，单价为一名导游一天的价格" : "按商品单位计价，英文沿用报价库正文，可手动修改"}</small></div>
    {value.lines.map(line => {
            const option = value.options.find(o => o.productId === line.productId)!;
            return <div className="library-booking-line" key={line.key}>
        <div className="library-spec-select"><label>{value.kind === "ticket" ? "票种规格" : value.kind === "guide" ? "服务时长" : "商品规格"}<select aria-label={value.kind === "ticket" ? "票种规格" : value.kind === "guide" ? "导游服务时长" : "商品规格"} value={line.productId} onChange={e => {
                    const next = value.options.find(o => o.productId === e.target.value)!;
                    const englishBase = value.kind === "standard" && value.englishBase === option.nameEn ? next.nameEn : value.englishBase;
                    onChange({ ...value, englishBase, lines: value.lines.map(l => l.key === line.key ? { ...bookingLine(next, line.quantity), key: line.key } : l) });
                }}>{value.options.map(o => <option disabled={value.lines.some(l => l.key !== line.key && l.productId === o.productId)} value={o.productId} key={o.productId}>{o.spec.specZh || "默认规格"}{value.kind === "standard" ? ` · ${o.unit}` : ""}</option>)}</select></label>{value.kind === "ticket" && value.lines.length > 1 && <button className="icon-button danger" aria-label="移除此票种" onClick={() => onChange({ ...value, lines: value.lines.filter(l => l.key !== line.key) })}><Trash2 size={16}/></button>}</div>
        <div className="direct-price-fields">
          <label>{value.kind === "guide" ? "导游人数" : "数量"}<input aria-label={`${option.spec.specZh}数量`} type="number" min="0" step="1" value={line.quantity} onChange={e => changeLine(line.key, { quantity: Number(e.target.value) })}/></label>
          <label>成本单价<input aria-label={`${option.spec.specZh}成本单价`} type="number" min="0" placeholder="待填写" value={line.cost} onChange={e => changeLine(line.key, { cost: e.target.value })}/></label>
          <label>报价单价<input aria-label={`${option.spec.specZh}报价单价`} type="number" min="0" placeholder="待填写" value={line.quote} onChange={e => changeLine(line.key, { quote: e.target.value })}/></label>
        </div>
        {option.spec.warnings?.length ? <small className="library-warning">{option.spec.warnings.join("；")}</small> : null}
        {option.spec.source && <small className="library-source">{option.spec.source.file} · {option.spec.source.sheet} 第 {option.spec.source.row} 行</small>}
      </div>;
        })}
    {value.kind === "ticket" && value.lines.length < value.options.length && <button type="button" className="ghost-button" onClick={() => {
                const next = value.options.find(o => !value.lines.some(l => l.productId === o.productId))!;
                onChange({ ...value, lines: [...value.lines, bookingLine(next)] });
            }}><Plus size={15}/>增加一种票</button>}
    <label className="library-english-body">英文发票正文<textarea rows={2} value={value.englishBase} onChange={e => onChange({ ...value, englishBase: e.target.value })}/><small>{value.kind === "standard" ? "保留手写正文，不附加票种或导游文案" : "正文可修改，下方票种／数量／小时自动同步"}</small></label>
    <div className="library-description-preview"><small>最终英文发票描述</small><p>{bookingDescription(value)}</p></div>
    <div className="quick-line-preview"><span>项目报价合计</span><strong>{value.lines.some(l => l.quantity > 0 && !validPrice(l.quote)) ? "待填写报价" : `${value.lines.reduce((sum, l) => sum + (Number(l.quote) || 0) * l.quantity, 0).toLocaleString("zh-CN")} RMB`}</strong></div>
  </div>;
}
