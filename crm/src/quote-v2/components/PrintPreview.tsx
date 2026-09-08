import { useEffect } from "react";
import { projectLibraryItems } from "../lib/quoteLibrary";
import { Printer, X } from "lucide-react";
import tripbookMark from "../assets/tripbook-mark.png";
import { buildCustomerProposal, calculateTotals, customerEnglishText } from "../lib/logic";
import type { AppSettings, DirectQuote, ProposalPlan } from "../types";
interface Props {
    mode: "quick" | "direct";
    plan: ProposalPlan;
    directQuote: DirectQuote;
    settings: AppSettings;
    onClose: () => void;
}
export function PrintPreview({ mode, plan, directQuote, settings, onClose }: Props) {
    const proposal = buildCustomerProposal(plan);
    const directTotal = calculateTotals(directQuote.items).quoteTotal;
    useEffect(() => {
        const previousTitle = document.title;
        document.title = "Quick Tour Proposal";
        return () => { document.title = previousTitle; };
    }, []);
    return <div className="print-preview-layer">
    <div className="print-toolbar">
      <div><strong>客户版打印预览</strong><span>A4 横向 · 不含成本、毛利和内部备注</span></div>
      <div><button className="ghost-button" onClick={onClose}><X size={16}/> 关闭</button><button className="primary-button" onClick={() => window.print()}><Printer size={16}/> 打印 / 保存 PDF</button></div>
    </div>
    <article className="print-sheet">
      <header className="proposal-header"><div className="proposal-brand"><img className="proposal-brand-mark" src={tripbookMark.src} alt="Tripbook"/><div className="proposal-title"><span className="proposal-brand-name">Tripbook</span><h1>QUICK TOUR PROPOSAL</h1></div></div><div className="proposal-meta"><span>Guests</span><strong>{mode === "quick" ? plan.people : directQuote.people}</strong></div></header>
      {mode === "quick" ? <>
        <table className="proposal-table quick-proposal-table"><thead><tr><th>Date / Day</th><th>Itinerary</th><th>Price Details</th></tr></thead><tbody>{proposal.days.map((day) => <tr key={day.dayLabel}><td><strong>{day.dayLabel}</strong><span>{day.date || "Date TBD"}</span></td><td>{day.itinerary}</td><td><ul className="price-lines">{day.priceLines.map((line, index) => <li key={`${line.name}-${index}`}><span>{line.name}</span><strong>{line.amount.toLocaleString("en-US")} RMB</strong></li>)}</ul><div className="day-total"><span>Day Total</span><strong>{day.dayTotal.toLocaleString("en-US")} RMB</strong></div></td></tr>)}</tbody></table>
        {proposal.days.length === 0 && <div className="print-empty">No itinerary days have been added yet.</div>}
        <div className="proposal-total"><span>Total Price</span><strong>{proposal.totalPrice.toLocaleString("en-US")} <small>RMB</small></strong></div>
      </> : <>
        <div className="direct-print-days">{directQuote.days.map((day, index) => {
                const dayItems = projectLibraryItems(directQuote.items.filter((item) => item.dayId === day.id));
                return <section className="direct-print-day" key={day.id}>
            <header><div><strong>Day {String(index + 1).padStart(2, "0")}</strong><span>{day.date || "Date TBD"}</span></div><strong>Day Total&nbsp; {calculateTotals(dayItems).quoteTotal.toLocaleString("en-US")} RMB</strong></header>
            <table className="proposal-table direct-print-table"><thead><tr><th>Service</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead><tbody>{dayItems.map((item) => <tr key={item.id}><td><strong>{customerEnglishText(item.nameEn || item.nameZh, "Custom service")}</strong></td><td>{item.quantity}</td><td>{item.quotePrice.toLocaleString("en-US")} RMB</td><td><strong>{(item.quotePrice * item.quantity).toLocaleString("en-US")} RMB</strong></td></tr>)}</tbody></table>
          </section>;
            })}</div>
        <div className="proposal-total"><span>Total Price</span><strong>{directTotal.toLocaleString("en-US")} <small>RMB</small></strong></div>
      </>}
      <footer className="proposal-notes"><section><strong>Price Includes</strong><p>{customerEnglishText(settings.priceIncludes, "Included services are listed above.")}</p></section><section><strong>Price Excludes</strong><p>{customerEnglishText(settings.priceExcludes, "Excluded services are not included in the quoted price.")}</p></section><section><strong>Preliminary Proposal Notice</strong><p>{customerEnglishText(settings.proposalNotice, "Availability and final arrangements are subject to confirmation.")}</p></section></footer>
    </article>
  </div>;
}
