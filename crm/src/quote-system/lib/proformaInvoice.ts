import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { projectLibraryItems } from "./quoteLibrary";
import { applyTravelServiceFee, categoryInvoiceGroup } from "./invoiceDescription";
import type { InvoiceGroup, QuoteItem } from "../types";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CITY_CODES: Record<string, string> = {
    北京: "BJ", 上海: "SH", 重庆: "CQ", 成都: "CD", 西安: "XA", 张家界: "ZJJ", 广州: "GZ", 深圳: "SZ",
    香港: "HK", 杭州: "HZ", 苏州: "SZH", 桂林: "GL", 昆明: "KM", 丽江: "LJ", 大理: "DL", 厦门: "XM",
    武汉: "WH", 南京: "NJ", 青岛: "QD",
};
export interface InvoiceDay {
    id: string;
    date: string;
    city: string;
}
export interface ProformaOptions {
    customerName: string;
    days: InvoiceDay[];
    items: QuoteItem[];
    hotelFeeEnabled: boolean;
    transportationFeeEnabled: boolean;
    issueDate?: string;
}
export interface GeneratedInvoice {
    group: InvoiceGroup;
    filename: string;
    data: Uint8Array;
    total: number;
}
export interface ProformaInvoiceDownload {
    filename: string;
    data: Uint8Array;
    mimeType: string;
    invoiceCount: number;
    fileCount: number;
}
export interface DownloadableInternalCostSheet {
    filename: string;
    data: Uint8Array;
}
interface InvoiceRow {
    date?: string;
    item: string;
    description: string;
    price: number;
    fill?: string;
}
const directChildren = (node: Element, localName: string): Element[] => {
    const result: Element[] = [];
    for (let index = 0; index < node.childNodes.length; index += 1) {
        const child = node.childNodes.item(index);
        if (child?.nodeType === 1 && (child as Element).localName === localName)
            result.push(child as Element);
    }
    return result;
};
const firstDirect = (node: Element, localName: string): Element | undefined => directChildren(node, localName)[0];
const ensureChild = (doc: Document, parent: Element, localName: string): Element => {
    const existing = firstDirect(parent, localName);
    if (existing)
        return existing;
    const created = doc.createElementNS(W, `w:${localName}`);
    parent.appendChild(created);
    return created;
};
function firstDescendant(node: Element, localName: string): Element | undefined {
    const values = node.getElementsByTagNameNS(W, localName);
    return values.length ? values.item(0) as Element : undefined;
}
function replaceCellText(doc: Document, cell: Element, text: string, bold?: boolean) {
    const sourceParagraph = firstDirect(cell, "p");
    const paragraph = sourceParagraph ? sourceParagraph.cloneNode(true) as Element : doc.createElementNS(W, "w:p");
    const paragraphProperties = firstDirect(paragraph, "pPr");
    while (paragraph.firstChild)
        paragraph.removeChild(paragraph.firstChild);
    if (paragraphProperties)
        paragraph.appendChild(paragraphProperties);
    const sourceRun = sourceParagraph ? firstDescendant(sourceParagraph, "r") : undefined;
    const runProperties = sourceRun ? firstDirect(sourceRun, "rPr")?.cloneNode(true) as Element | undefined : undefined;
    const lines = String(text ?? "").split(/\r?\n/);
    lines.forEach((line, index) => {
        const run = doc.createElementNS(W, "w:r");
        if (runProperties)
            run.appendChild(runProperties.cloneNode(true));
        if (bold !== undefined) {
            const rPr = ensureChild(doc, run, "rPr");
            const existingBold = firstDirect(rPr, "b");
            if (bold && !existingBold)
                rPr.appendChild(doc.createElementNS(W, "w:b"));
            if (!bold && existingBold)
                rPr.removeChild(existingBold);
        }
        if (index > 0)
            run.appendChild(doc.createElementNS(W, "w:br"));
        const textNode = doc.createElementNS(W, "w:t");
        textNode.setAttribute("xml:space", "preserve");
        textNode.appendChild(doc.createTextNode(line));
        run.appendChild(textNode);
        paragraph.appendChild(run);
    });
    directChildren(cell, "p").forEach((element) => cell.removeChild(element));
    cell.appendChild(paragraph);
}
function setShading(doc: Document, row: Element, fill: string) {
    directChildren(row, "tc").forEach((cell) => {
        const tcPr = ensureChild(doc, cell, "tcPr");
        let shading = firstDirect(tcPr, "shd");
        if (!shading) {
            shading = doc.createElementNS(W, "w:shd");
            tcPr.appendChild(shading);
        }
        shading.setAttributeNS(W, "w:fill", fill);
    });
}
function setRowTopBorder(doc: Document, row: Element) {
    directChildren(row, "tc").forEach((cell) => {
        const tcPr = ensureChild(doc, cell, "tcPr");
        const borders = firstDirect(tcPr, "tcBorders") ?? doc.createElementNS(W, "w:tcBorders");
        if (!borders.parentNode)
            tcPr.appendChild(borders);
        const top = firstDirect(borders, "top") ?? doc.createElementNS(W, "w:top");
        if (!top.parentNode)
            borders.appendChild(top);
        top.setAttributeNS(W, "w:val", "single");
        top.setAttributeNS(W, "w:sz", "12");
        top.setAttributeNS(W, "w:color", "7F8C9F");
        top.setAttributeNS(W, "w:space", "0");
    });
}
function setVerticalMerge(doc: Document, cell: Element, mode: "restart" | "continue" | "none") {
    const tcPr = ensureChild(doc, cell, "tcPr");
    const existing = firstDirect(tcPr, "vMerge");
    if (mode === "none") {
        if (existing)
            tcPr.removeChild(existing);
        return;
    }
    const merge = existing ?? doc.createElementNS(W, "w:vMerge");
    if (!existing)
        tcPr.appendChild(merge);
    if (mode === "restart")
        merge.setAttributeNS(W, "w:val", "restart");
    else
        merge.removeAttributeNS(W, "val");
}
function removeRedHighlights(doc: Document) {
    const highlights = doc.getElementsByTagNameNS(W, "highlight");
    for (let index = highlights.length - 1; index >= 0; index -= 1) {
        const highlight = highlights.item(index) as Element;
        const value = (highlight.getAttributeNS(W, "val") || highlight.getAttribute("w:val") || "").toLowerCase();
        if (value === "red" || value === "darkred")
            highlight.parentNode?.removeChild(highlight);
    }
}
const parseDate = (value: string): [
    number,
    number,
    number
] | null => {
    const match = String(value || "").match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};
const compactDate = ([year, month, day]: [
    number,
    number,
    number
]) => `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
const shortDate = ([, month, day]: [
    number,
    number,
    number
]) => `${month}${day}`;
const formatDay = (date: string) => {
    const parsed = parseDate(date);
    return parsed ? `${MONTHS[parsed[1]]} ${parsed[2]}` : date;
};
const safeFilename = (value: string) => value.trim().replace(/[/\\:*?"<>|]+/g, "_").replace(/\s+/g, " ").replace(/[ ._]+$/g, "") || "Client";
const moneyText = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);
const itemAmount = (item: QuoteItem) => Math.max(0, Number(item.quotePrice) || 0) * Math.max(0, Number(item.quantity) || 0);
const invoiceGroup = (item: QuoteItem): InvoiceGroup => item.invoiceGroup ?? categoryInvoiceGroup(item.category);
function commonInvoiceMeta(options: ProformaOptions) {
    const parsedDates = options.days.map((day) => parseDate(day.date)).filter(Boolean) as Array<[
        number,
        number,
        number
    ]>;
    parsedDates.sort((a, b) => compactDate(a).localeCompare(compactDate(b)));
    const today = new Date();
    const fallback: [
        number,
        number,
        number
    ] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
    const start = parsedDates[0] ?? fallback;
    const end = parsedDates.at(-1) ?? fallback;
    const cities = [...new Set(options.days.map((day) => day.city).filter(Boolean))];
    const cityCode = cities.slice(0, 5).map((city) => CITY_CODES[city] || city.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()).join("") || "CN";
    return {
        invoiceNo: `CRT-${start[0]}-${shortDate(start)}${shortDate(end)}-${cityCode}-301`,
        dateRange: `${compactDate(start)}-${compactDate(end)}`,
    };
}
function descriptionFor(item: QuoteItem): string {
    if (item.category === "服务费") {
        const unit = Number(item.quotePrice) || 0;
        return `Service Fee: ${moneyText(unit)}RMB/person\nIncludes online customer support, travel issue resolution, coordination of driver transfers`;
    }
    return item.invoiceDescriptionEn?.trim() || item.nameEn.trim() || item.nameZh.trim() || "None";
}
function serviceRows(options: ProformaOptions, items: QuoteItem[]): InvoiceRow[] {
    const globals = items.filter((item) => !item.dayId);
    const rows: InvoiceRow[] = [];
    options.days.forEach((day, dayIndex) => {
        const dayItems = items.filter((item) => item.dayId === day.id || (dayIndex === 0 && globals.includes(item)));
        if (!dayItems.length)
            return;
        const fill = dayIndex % 2 === 0 ? "E7E6E6" : "FFFFFF";
        const definitions: Array<{
            label: string;
            match: (item: QuoteItem) => boolean;
        }> = [
            { label: "Private Driver", match: (item) => ["市区用车", "郊区用车", "接机", "送机", "接站", "送站"].includes(item.category) },
            { label: "Tour Guide", match: (item) => item.category === "多语言导游" },
            { label: "Attraction Tickets", match: (item) => ["景点门票", "景区交通", "缆车", "游船"].includes(item.category) },
            { label: "Travel Insurance", match: (item) => item.category === "保险" },
            { label: "Service Fee", match: (item) => item.category === "服务费" },
        ];
        const used = new Set<string>();
        definitions.forEach(({ label, match }) => {
            const matched = dayItems.filter(match);
            matched.forEach((item) => used.add(item.id));
            if (!matched.length)
                rows.push({ date: formatDay(day.date), item: label, description: "None", price: 0, fill });
            else
                matched.forEach((item) => rows.push({ date: formatDay(day.date), item: label, description: descriptionFor(item), price: itemAmount(item), fill }));
        });
        dayItems.filter((item) => !used.has(item.id)).forEach((item) => rows.push({ date: formatDay(day.date), item: "Other Service", description: descriptionFor(item), price: itemAmount(item), fill }));
    });
    return rows;
}
function arrangementRows(group: InvoiceGroup, items: QuoteItem[]): InvoiceRow[] {
    return items.map((item) => ({
        item: group === "hotel" ? "Hotel" : item.category === "机票" ? "Flight" : item.category === "高铁" ? "High-Speed Rail" : "Transportation",
        description: descriptionFor(item),
        price: itemAmount(item),
    }));
}
function insertServiceRows(doc: Document, table: Element, insertBefore: Element, pattern: Element, rows: InvoiceRow[]) {
    let groupStart = 0;
    while (groupStart < rows.length) {
        const date = rows[groupStart].date;
        let groupEnd = groupStart;
        while (groupEnd + 1 < rows.length && rows[groupEnd + 1].date === date)
            groupEnd += 1;
        for (let index = groupStart; index <= groupEnd; index += 1) {
            const data = rows[index];
            const row = pattern.cloneNode(true) as Element;
            const cells = directChildren(row, "tc");
            replaceCellText(doc, cells[0], index === groupStart ? data.date || "" : "");
            replaceCellText(doc, cells[1], data.item, true);
            replaceCellText(doc, cells[2], data.description);
            replaceCellText(doc, cells.at(-1) as Element, moneyText(data.price));
            setShading(doc, row, data.fill || "FFFFFF");
            if (index === groupStart && groupStart > 0)
                setRowTopBorder(doc, row);
            setVerticalMerge(doc, cells[0], index === groupStart ? "restart" : "continue");
            table.insertBefore(row, insertBefore);
        }
        let labelStart = groupStart;
        const insertedRows = directChildren(table, "tr").slice(directChildren(table, "tr").indexOf(insertBefore) - (groupEnd - groupStart + 1), directChildren(table, "tr").indexOf(insertBefore));
        while (labelStart <= groupEnd) {
            const label = rows[labelStart].item;
            let labelEnd = labelStart;
            while (labelEnd + 1 <= groupEnd && rows[labelEnd + 1].item === label)
                labelEnd += 1;
            for (let index = labelStart; index <= labelEnd; index += 1) {
                const cell = directChildren(insertedRows[index - groupStart], "tc")[1];
                if (index > labelStart)
                    replaceCellText(doc, cell, "");
                setVerticalMerge(doc, cell, index === labelStart ? "restart" : "continue");
            }
            labelStart = labelEnd + 1;
        }
        groupStart = groupEnd + 1;
    }
}
function insertArrangementRows(doc: Document, table: Element, insertBefore: Element, pattern: Element, rows: InvoiceRow[]) {
    const inserted: Element[] = [];
    rows.forEach((data, index) => {
        const row = pattern.cloneNode(true) as Element;
        const cells = directChildren(row, "tc");
        replaceCellText(doc, cells[0], index === 0 ? "Travel Arrangement" : "", true);
        replaceCellText(doc, cells[1], data.item, true);
        replaceCellText(doc, cells[2], data.description);
        replaceCellText(doc, cells.at(-1) as Element, moneyText(data.price));
        setVerticalMerge(doc, cells[0], index === 0 ? "restart" : "continue");
        table.insertBefore(row, insertBefore);
        inserted.push(row);
    });
    let start = 0;
    while (start < rows.length) {
        let end = start;
        while (end + 1 < rows.length && rows[end + 1].item === rows[start].item)
            end += 1;
        for (let index = start; index <= end; index += 1) {
            const cell = directChildren(inserted[index], "tc")[1];
            if (index > start)
                replaceCellText(doc, cell, "");
            setVerticalMerge(doc, cell, index === start ? "restart" : "continue");
        }
        start = end + 1;
    }
}
function adjustedItems(options: ProformaOptions): QuoteItem[] {
    return options.items.map((item) => {
        const group = invoiceGroup(item);
        if (group !== "hotel" && group !== "transportation")
            return item;
        const enabled = group === "hotel" ? options.hotelFeeEnabled : options.transportationFeeEnabled;
        const base = item.baseQuotePrice ?? item.quotePrice;
        const feeNote = "报价已包含5%服务费";
        const otherNotes = item.note
            .split(" · ")
            .map((part) => part.trim())
            .filter((part) => part && part !== feeNote);
        return {
            ...item,
            baseQuotePrice: base,
            travelFeeApplied: enabled,
            quotePrice: applyTravelServiceFee(base, enabled),
            note: [...otherNotes, ...(enabled ? [feeNote] : [])].join(" · "),
        };
    });
}
async function generateOne(template: Uint8Array, options: ProformaOptions, group: InvoiceGroup, allItems: QuoteItem[], sharedMeta: ReturnType<typeof commonInvoiceMeta>): Promise<GeneratedInvoice | null> {
    const items = allItems.filter((item) => invoiceGroup(item) === group);
    if (!items.length)
        return null;
    const zip = await JSZip.loadAsync(template);
    const documentEntry = zip.file("word/document.xml");
    if (!documentEntry)
        throw new Error("PI模板缺少 word/document.xml");
    const xmlText = await documentEntry.async("string");
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    const parserError = doc.getElementsByTagName("parsererror");
    if (parserError.length)
        throw new Error("PI模板XML解析失败");
    const tables = Array.from({ length: doc.getElementsByTagNameNS(W, "tbl").length }, (_, index) => doc.getElementsByTagNameNS(W, "tbl").item(index) as Element);
    if (tables.length < 3)
        throw new Error("PI模板表格结构不完整");
    const mainTable = tables[0];
    const signatureTable = tables[2];
    const sourceRows = directChildren(mainTable, "tr");
    if (sourceRows.length < 25)
        throw new Error("PI模板第一页结构与预期不符");
    const servicePattern = sourceRows[9].cloneNode(true) as Element;
    const arrangementPattern = sourceRows[19].cloneNode(true) as Element;
    const contractRow = sourceRows[22];
    const remarksRow = sourceRows[23];
    for (let index = 21; index >= 9; index -= 1)
        mainTable.removeChild(sourceRows[index]);
    const headerRows = directChildren(mainTable, "tr");
    replaceCellText(doc, directChildren(headerRows[5], "tc")[0], `Invoice No.: ${sharedMeta.invoiceNo}\nDate: ${sharedMeta.dateRange}`, true);
    replaceCellText(doc, directChildren(headerRows[6], "tc")[0], `Contact Person: ${options.customerName}`, true);
    const rows = group === "service" ? serviceRows(options, projectLibraryItems(items)) : arrangementRows(group, projectLibraryItems(items));
    if (group === "service")
        insertServiceRows(doc, mainTable, contractRow, servicePattern, rows);
    else
        insertArrangementRows(doc, mainTable, contractRow, arrangementPattern, rows);
    const total = items.reduce((sum, item) => sum + itemAmount(item), 0);
    const contractCells = directChildren(contractRow, "tc");
    replaceCellText(doc, contractCells.at(-1) as Element, `Total (RMB): ${moneyText(total)}`, true);
    const remarksCell = directChildren(remarksRow, "tc")[0];
    if (group === "service") {
        const deposit = Math.round(total * 0.3);
        const balance = total - deposit;
        replaceCellText(doc, remarksCell, `Remarks:\nPayment Term: A deposit of ${moneyText(deposit)} RMB is required, with the remaining balance of ${moneyText(balance)} RMB to be paid on the day of service. Credit cards and Alipay Pay are accepted.`);
    }
    else if (group === "hotel") {
        replaceCellText(doc, remarksCell, "Remarks:\nPayment Term: Full payment is required in advance for hotel invoices.");
    }
    else {
        replaceCellText(doc, remarksCell, "Remarks:\nPayment Term: Full payment is required in advance for transportation invoices.");
    }
    const signatureRows = directChildren(signatureTable, "tr");
    const buyerCells = directChildren(signatureRows[1], "tc");
    replaceCellText(doc, buyerCells[0], options.customerName);
    const dateCells = directChildren(signatureRows[2], "tc");
    replaceCellText(doc, dateCells.at(-1) as Element, `Date ${options.issueDate || new Date().toISOString().slice(0, 10)}`);
    removeRedHighlights(doc);
    zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
    const suffix = group === "service" ? "" : group === "hotel" ? "_Hotel" : "_Transportation";
    return {
        group,
        filename: `${safeFilename(options.customerName)}_PROFORMA_INVOICE${suffix}.docx`,
        data: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
        total,
    };
}
export async function generateProformaInvoices(template: Uint8Array, options: ProformaOptions): Promise<GeneratedInvoice[]> {
    const items = adjustedItems(options);
    const sharedMeta = commonInvoiceMeta({ ...options, items });
    const generated = await Promise.all([
        generateOne(template, options, "service", items, sharedMeta),
        generateOne(template, options, "hotel", items, sharedMeta),
        generateOne(template, options, "transportation", items, sharedMeta),
    ]);
    return generated.filter(Boolean) as GeneratedInvoice[];
}
export async function createProformaInvoiceDownload(customerName: string, invoices: GeneratedInvoice[], internalCostSheet?: DownloadableInternalCostSheet): Promise<ProformaInvoiceDownload> {
    if (!invoices.length)
        throw new Error("没有可下载的形式发票");
    if (invoices.length === 1 && !internalCostSheet) {
        return {
            filename: invoices[0].filename,
            data: invoices[0].data,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            invoiceCount: 1,
            fileCount: 1,
        };
    }
    const zip = new JSZip();
    invoices.forEach((invoice) => zip.file(invoice.filename, invoice.data));
    if (internalCostSheet)
        zip.file(internalCostSheet.filename, internalCostSheet.data);
    const fileCount = invoices.length + (internalCostSheet ? 1 : 0);
    return {
        filename: internalCostSheet
            ? `${safeFilename(customerName)}_PI_AND_INTERNAL_COST_${fileCount}_FILES.zip`
            : `${safeFilename(customerName)}_PROFORMA_INVOICES_${invoices.length}_FILES.zip`,
        data: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
        mimeType: "application/zip",
        invoiceCount: invoices.length,
        fileCount,
    };
}
export function prepareInvoiceItems(items: QuoteItem[], hotelFeeEnabled: boolean, transportationFeeEnabled: boolean): QuoteItem[] {
    return adjustedItems({ customerName: "", days: [], items, hotelFeeEnabled, transportationFeeEnabled });
}
