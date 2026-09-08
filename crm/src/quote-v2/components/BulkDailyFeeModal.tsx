import { useMemo, useState } from "react";
import { ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { applyDailyFeeBulkChanges, summarizeDailyFeeImpact, type DailyFeeBulkChanges, } from "../lib/logic";
import type { DirectQuote, QuoteItem } from "../types";
import { Modal } from "./Modal";
interface Props {
    quote: DirectQuote;
    onClose: () => void;
    onApply: (items: QuoteItem[], message: string) => void;
}
const optionalNumber = (value: string): number | undefined => {
    if (!value.trim())
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : undefined;
};
export function BulkDailyFeeModal({ quote, onClose, onApply }: Props) {
    const [serviceQuantity, setServiceQuantity] = useState(String(quote.people));
    const [serviceCost, setServiceCost] = useState("");
    const [serviceQuote, setServiceQuote] = useState("");
    const [insuranceQuantity, setInsuranceQuantity] = useState(String(quote.people));
    const [insuranceCost, setInsuranceCost] = useState("");
    const [insuranceQuote, setInsuranceQuote] = useState("");
    const [previewing, setPreviewing] = useState(false);
    const serviceImpact = useMemo(() => summarizeDailyFeeImpact(quote.items, "服务费"), [quote.items]);
    const insuranceImpact = useMemo(() => summarizeDailyFeeImpact(quote.items, "保险"), [quote.items]);
    const changes: DailyFeeBulkChanges = {
        serviceFee: {
            quantity: optionalNumber(serviceQuantity),
            costPrice: optionalNumber(serviceCost),
            quotePrice: optionalNumber(serviceQuote),
        },
        insurance: {
            quantity: optionalNumber(insuranceQuantity),
            costPrice: optionalNumber(insuranceCost),
            quotePrice: optionalNumber(insuranceQuote),
        },
    };
    const hasChanges = Object.values(changes).some((patch) => patch && Object.values(patch).some((value) => value !== undefined));
    const affectedItems = serviceImpact.itemCount + insuranceImpact.itemCount;
    const update = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setPreviewing(false);
    };
    const apply = () => {
        if (!hasChanges || affectedItems === 0)
            return;
        const parts = [
            serviceImpact.itemCount ? `${serviceImpact.dayCount}天服务费` : "",
            insuranceImpact.itemCount ? `${insuranceImpact.dayCount}天保险` : "",
        ].filter(Boolean);
        onApply(applyDailyFeeBulkChanges(quote.items, changes), `已批量修改${parts.join("和")}`);
    };
    return (<Modal title="批量调整服务费与保险" wide onClose={onClose} footer={previewing
            ? <>
            <button className="ghost-button" onClick={() => setPreviewing(false)}>返回修改</button>
            <button className="primary-button" disabled={!hasChanges || affectedItems === 0} onClick={apply}>确认批量修改</button>
          </>
            : <>
            <button className="ghost-button" onClick={onClose}>取消</button>
            <button className="primary-button" disabled={!hasChanges || affectedItems === 0} onClick={() => setPreviewing(true)}>检查影响范围</button>
          </>}>
      <div className="bulk-fee-modal">
        <div className="bulk-fee-intro">
          <span><UsersRound size={18}/></span>
          <div><strong>当前报价共 {quote.people} 人</strong><p>只修改当前报价中已经存在的服务费和保险；留空的价格字段保持原值。</p></div>
        </div>

        {!previewing ? <div className="bulk-fee-cards">
          <section>
            <header><span><WalletCards size={18}/></span><div><strong>服务费</strong><small>{serviceImpact.dayCount} 个日期 · {serviceImpact.itemCount} 项明细</small></div></header>
            <div className="bulk-fee-fields">
              <label>收费人数<input type="number" min="0" value={serviceQuantity} onChange={(event) => update(setServiceQuantity)(event.target.value)}/><small>例如9人中只收5位成人，请填写5</small></label>
              <label>单人成本价<input type="number" min="0" value={serviceCost} placeholder="留空不修改" onChange={(event) => update(setServiceCost)(event.target.value)}/></label>
              <label>单人报价价<input type="number" min="0" value={serviceQuote} placeholder="留空不修改" onChange={(event) => update(setServiceQuote)(event.target.value)}/></label>
            </div>
          </section>

          <section>
            <header><span><ShieldCheck size={18}/></span><div><strong>保险</strong><small>{insuranceImpact.dayCount} 个日期 · {insuranceImpact.itemCount} 项明细</small></div></header>
            <div className="bulk-fee-fields">
              <label>保险人数<input type="number" min="0" value={insuranceQuantity} onChange={(event) => update(setInsuranceQuantity)(event.target.value)}/><small>默认使用当前总人数，可手动修改</small></label>
              <label>单人成本价<input type="number" min="0" value={insuranceCost} placeholder="留空不修改" onChange={(event) => update(setInsuranceCost)(event.target.value)}/></label>
              <label>单人报价价<input type="number" min="0" value={insuranceQuote} placeholder="留空不修改" onChange={(event) => update(setInsuranceQuote)(event.target.value)}/></label>
            </div>
          </section>
        </div> : <div className="bulk-fee-confirmation">
          <strong>请确认影响范围</strong>
          <p>将修改 <b>{serviceImpact.itemCount}</b> 项服务费（{serviceImpact.dayCount} 个日期）和 <b>{insuranceImpact.itemCount}</b> 项保险（{insuranceImpact.dayCount} 个日期）。</p>
          <span>不会新增缺失项目，不会修改“我的价格库”，也不会影响以后新建的报价。</span>
        </div>}
      </div>
    </Modal>);
}
