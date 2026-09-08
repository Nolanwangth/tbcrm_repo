import { useMemo, useState } from "react";
import { BedDouble, Download, FileText, Plane, ShieldCheck } from "lucide-react";
import { categoryInvoiceGroup } from "../lib/invoiceDescription";
import { generateInternalCostSheet } from "../lib/internalCostSheet";
import { calculateTotals } from "../lib/logic";
import { createProformaInvoiceDownload, generateProformaInvoices, prepareInvoiceItems, type InvoiceDay } from "../lib/proformaInvoice";
import type { DirectQuote, ProposalPlan, QuoteItem } from "../types";
import { Modal } from "./Modal";
interface Props {
    mode: "quick" | "direct";
    plan: ProposalPlan;
    directQuote: DirectQuote;
    onApplyItems: (items: QuoteItem[]) => void;
    onClose: () => void;
    notify: (message: string) => void;
}
const itemGroup = (item: QuoteItem) => item.invoiceGroup ?? categoryInvoiceGroup(item.category);
const totalFor = (items: QuoteItem[], group: "service" | "hotel" | "transportation") => items.filter((item) => itemGroup(item) === group).reduce((sum, item) => sum + item.quotePrice * item.quantity, 0);
const WORD_TEMPLATE_REVISION = "v2-20260903-logo-fit-whatsapp-86-deposit-30";
const wordTemplateUrl = (name: "proforma-invoice" | "internal-cost-sheet") => {
    const url = new URL(`/api/word-templates/v2/${name}`, window.location.origin);
    url.searchParams.set("v", WORD_TEMPLATE_REVISION);
    return url;
};
const fetchWordTemplate = async (name: "proforma-invoice" | "internal-cost-sheet", label: string) => {
    const response = await fetch(wordTemplateUrl(name), { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) {
        throw new Error(`无法读取${label}模板（服务器返回 ${response.status}）`);
    }
    return new Uint8Array(await response.arrayBuffer());
};
export function ProformaInvoiceModal({ mode, plan, directQuote, onApplyItems, onClose, notify }: Props) {
    const [customerName, setCustomerName] = useState(plan.title !== "未命名快速方案" ? plan.title : "");
    const [hotelFeeEnabled, setHotelFeeEnabled] = useState(true);
    const [transportationFeeEnabled, setTransportationFeeEnabled] = useState(true);
    const [exporting, setExporting] = useState(false);
    const sourceItems = mode === "quick" ? plan.items : directQuote.items;
    const adjustedItems = useMemo(() => prepareInvoiceItems(sourceItems, hotelFeeEnabled, transportationFeeEnabled), [hotelFeeEnabled, sourceItems, transportationFeeEnabled]);
    const days: InvoiceDay[] = mode === "quick"
        ? plan.days.map((day) => ({ id: day.id, date: day.date, city: day.city }))
        : directQuote.days.map((day) => ({ id: day.id, date: day.date, city: day.city || directQuote.city }));
    const serviceTotal = totalFor(adjustedItems, "service");
    const hotelTotal = totalFor(adjustedItems, "hotel");
    const transportationTotal = totalFor(adjustedItems, "transportation");
    const invoiceCount = (["service", "hotel", "transportation"] as const)
        .filter((group) => adjustedItems.some((item) => itemGroup(item) === group)).length;
    const internalTotals = useMemo(() => calculateTotals(adjustedItems), [adjustedItems]);
    const exportInvoices = async () => {
        if (!customerName.trim() || !sourceItems.length)
            return;
        setExporting(true);
        try {
            const [template, costTemplate] = await Promise.all([
                fetchWordTemplate("proforma-invoice", "PI Word"),
                fetchWordTemplate("internal-cost-sheet", "内部成本表"),
            ]);
            const options = {
                customerName: customerName.trim(),
                days,
                items: sourceItems,
                hotelFeeEnabled,
                transportationFeeEnabled,
            };
            const [generated, costSheet] = await Promise.all([
                generateProformaInvoices(template, options),
                generateInternalCostSheet(costTemplate, {
                    customerName: customerName.trim(),
                    days,
                    items: adjustedItems,
                }),
            ]);
            if (!generated.length)
                throw new Error("当前报价中没有可导出的发票明细");
            onApplyItems(adjustedItems);
            const download = await createProformaInvoiceDownload(customerName.trim(), generated, costSheet);
            const data = download.data.buffer.slice(download.data.byteOffset, download.data.byteOffset + download.data.byteLength) as ArrayBuffer;
            const url = URL.createObjectURL(new Blob([data], { type: download.mimeType }));
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = download.filename;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify(`已生成 ${download.invoiceCount} 份客户 PI 和内部成本表，并打包为 ZIP`);
            onClose();
        }
        catch (error) {
            window.alert(error instanceof Error ? error.message : "Word PI导出失败");
        }
        finally {
            setExporting(false);
        }
    };
    return (<Modal wide title="导出形式发票 Word" onClose={onClose} footer={<><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" disabled={exporting || !customerName.trim() || !sourceItems.length} onClick={exportInvoices}><Download size={16}/>{exporting ? "正在生成…" : `导出 PI + 成本表（ZIP）`}</button></>}>
      <div className="pi-export-modal">
        <div className="pi-fixed-notice"><ShieldCheck size={19}/><div><strong>固定模板保护</strong><span>银行信息、付款与取消条款、服务说明和签章将按老工具模板原样保留。</span></div></div>
        <label className="pi-customer-field">客户英文名<input autoFocus value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="例如：Jasmine"/><small>用于 Contact Person、内部成本表和导出文件名</small></label>
        <div className="pi-invoice-cards">
          <article><FileText size={20}/><div><strong>服务发票</strong><span>司机、导游、门票、保险和服务费</span><b>{serviceTotal.toLocaleString("zh-CN")} RMB</b></div><small>默认30%定金</small></article>
          <article><BedDouble size={20}/><div><strong>酒店发票</strong><span>酒店住宿项目</span><b>{hotelTotal.toLocaleString("zh-CN")} RMB</b></div><label><input type="checkbox" checked={hotelFeeEnabled} onChange={(event) => setHotelFeeEnabled(event.target.checked)}/>报价加入5%</label></article>
          <article><Plane size={20}/><div><strong>大交通发票</strong><span>机票和高铁项目</span><b>{transportationTotal.toLocaleString("zh-CN")} RMB</b></div><label><input type="checkbox" checked={transportationFeeEnabled} onChange={(event) => setTransportationFeeEnabled(event.target.checked)}/>报价加入5%</label></article>
        </div>
        <div className="pi-internal-cost-card">
          <div><strong>内部成本汇总表</strong><span>全部项目按交通、酒店、服务分类计入总毛利与毛利率</span></div>
          <div><small>成本 {internalTotals.costTotal.toLocaleString("zh-CN")} RMB</small><b>毛利 {internalTotals.profit.toLocaleString("zh-CN")} RMB</b></div>
        </div>
        <p className="pi-export-hint">酒店及大交通的5%会合并到报价并向上取整；内部成本表仍显示原始成本。</p>
      </div>
    </Modal>);
}
