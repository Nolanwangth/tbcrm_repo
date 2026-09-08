"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { quoteFrom } from "@/components/quote-system-workbench";
import { PrintPreview } from "@/quote-system/components/PrintPreview";
import { downloadBlob, generateItineraryDocx } from "@/quote-system/lib/docxGenerator";
import { parseItineraryDocument, type ItineraryDocumentDraft } from "@/quote-system/lib/itineraryDocument";
import type { ProposalDraftInput } from "@/lib/proposals";
import type { ProposalPlan } from "@/quote-system/types";
export function LegacyProposalPreview({ snapshot }: {
    snapshot: ProposalDraftInput;
}) {
    const [preview, setPreview] = useState(false), [message, setMessage] = useState("");
    const quote = quoteFrom({ id: snapshot.customerId, name: snapshot.title, travelerCount: String(snapshot.travelerCount), startDate: null, endDate: null }, snapshot);
    const plan: ProposalPlan = { id: snapshot.proposalId ?? "legacy", title: snapshot.title, people: snapshot.travelerCount, guideLanguage: "English", autoMatch: false, days: [], items: quote.items, updatedAt: "" };
    const draft = snapshot.days.flatMap(d => { try {
        return [JSON.parse(d.notes ?? "{}").itineraryDocumentDraft as ItineraryDocumentDraft];
    }
    catch {
        return [];
    } }).find(Boolean);
    async function word() { try {
        if (!draft)
            throw new Error("此旧版未保存 Word 原始资料，只能查看原始行程字段");
        const file = await generateItineraryDocx(parseItineraryDocument(draft));
        downloadBlob(file.blob, file.filename);
        setMessage("已按旧版快照导出 Word");
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "导出失败");
    } }
    return <section className="space-y-4 rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">{snapshot.title}</h2><p className="text-sm text-muted-foreground">旧版正式快照只读。人数、项目、日期和金额保持原值，不从当前价格库重新获取。</p>
    <div className="flex gap-3">{snapshot.toolType === 'quotation' ? <Button onClick={() => setPreview(true)}>查看原报价 / 打印 PDF</Button> : <Button onClick={() => void word()}>导出原版行程 Word</Button>}</div>
    {message && <p role="status">{message}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">Day / 服务</th><th>内容</th><th>数量</th><th>报价金额</th></tr></thead><tbody>{snapshot.toolType === 'quotation' ? snapshot.items.map((item, i) => <tr className="border-b" key={i}><td className="p-3">{item.category}</td><td>{item.nameZh}<br />{item.nameEn}</td><td>{item.quantity}</td><td>{(item.quantity * item.quotePrice).toFixed(2)}</td></tr>) : snapshot.days.map(d => <tr className="border-b" key={d.clientKey}><td className="p-3">Day {d.dayNumber} · {d.serviceDate}<br />{d.city}</td><td colSpan={3} className="whitespace-pre-wrap p-3">{d.titleEn}<br />{d.routeEn}</td></tr>)}</tbody></table></div>
    {preview && <><link rel="stylesheet" href="/quote-system/current.css"/><style>{`.print-preview-layer{z-index:130}@media print{body *{visibility:visible!important}}`}</style><PrintPreview mode="direct" plan={plan} directQuote={quote} settings={{ companyName: "Tripbook", currency: "RMB", priceIncludes: "Services listed in this proposal.", priceExcludes: "International flights, personal expenses and services not listed.", proposalNotice: "Availability and final arrangements are subject to confirmation." }} onClose={() => setPreview(false)}/></>}
  </section>;
}
