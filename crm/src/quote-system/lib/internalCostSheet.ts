import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import type { QuoteItem } from "../types";
import { isMarginEligibleCategory } from "./margin";
import type { InvoiceDay } from "./proformaInvoice";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export interface InternalCostSheetOptions {
    customerName: string;
    days: InvoiceDay[];
    items: QuoteItem[];
    issueDate?: string;
}
export interface GeneratedInternalCostSheet {
    filename: string;
    data: Uint8Array;
    totalCost: number;
    totalQuote: number;
    totalMargin: number;
    marginRate: number | null;
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
    const run = doc.createElementNS(W, "w:r");
    if (runProperties)
        run.appendChild(runProperties);
    if (bold !== undefined) {
        const rPr = ensureChild(doc, run, "rPr");
        const existingBold = firstDirect(rPr, "b");
        if (bold && !existingBold)
            rPr.appendChild(doc.createElementNS(W, "w:b"));
        if (!bold && existingBold)
            rPr.removeChild(existingBold);
    }
    const textNode = doc.createElementNS(W, "w:t");
    textNode.setAttribute("xml:space", "preserve");
    textNode.appendChild(doc.createTextNode(text));
    run.appendChild(textNode);
    paragraph.appendChild(run);
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
function setVerticalMerge(doc: Document, cell: Element, mode: "restart" | "continue") {
    const tcPr = ensureChild(doc, cell, "tcPr");
    let merge = firstDirect(tcPr, "vMerge");
    if (!merge) {
        merge = doc.createElementNS(W, "w:vMerge");
        tcPr.appendChild(merge);
    }
    if (mode === "restart")
        merge.setAttributeNS(W, "w:val", "restart");
    else
        merge.removeAttributeNS(W, "val");
}
function keepRowWithNext(doc: Document, row: Element) {
    directChildren(row, "tc").forEach((cell) => {
        directChildren(cell, "p").forEach((paragraph) => {
            let pPr = firstDirect(paragraph, "pPr");
            if (!pPr) {
                pPr = doc.createElementNS(W, "w:pPr");
                paragraph.insertBefore(pPr, paragraph.firstChild);
            }
            if (!firstDirect(pPr, "keepNext"))
                pPr.appendChild(doc.createElementNS(W, "w:keepNext"));
        });
    });
}
function setWordAttribute(element: Element, localName: string, value: string) {
    element.setAttributeNS(W, `w:${localName}`, value);
}
function addCityColumn(doc: Document, costTable: Element, pattern: Element, totalRow: Element) {
    const grid = firstDirect(costTable, "tblGrid");
    if (!grid)
        throw new Error("内部成本表缺少列宽定义");
    const gridColumns = directChildren(grid, "gridCol");
    if (gridColumns.length === 10) {
        const cityGridColumn = gridColumns[1].cloneNode(true) as Element;
        grid.insertBefore(cityGridColumn, gridColumns[1]);
    }
    else if (gridColumns.length !== 11) {
        throw new Error("内部成本表列结构不完整");
    }
    const rows = directChildren(costTable, "tr");
    const header = rows.find((row) => {
        const text = row.textContent || "";
        return text.includes("日期") && text.includes("分类");
    });
    if (!header)
        throw new Error("内部成本表缺少表头");
    [header, pattern].forEach((row, rowIndex) => {
        const cells = directChildren(row, "tc");
        if (cells.length === 10) {
            const cityCell = cells[1].cloneNode(true) as Element;
            replaceCellText(doc, cityCell, rowIndex === 0 ? "城市" : "[[CITY]]", rowIndex === 0 ? true : undefined);
            row.insertBefore(cityCell, cells[1]);
        }
        else if (cells.length !== 11) {
            throw new Error("内部成本表明细列结构不完整");
        }
    });
    const widths = ["950", "800", "850", "1950", "600", "1150", "1150", "1250", "1250", "1150", "1860"];
    directChildren(grid, "gridCol").forEach((column, index) => setWordAttribute(column, "w", widths[index]));
    [header, pattern].forEach((row) => {
        directChildren(row, "tc").forEach((cell, index) => {
            const tcPr = ensureChild(doc, cell, "tcPr");
            const tcW = ensureChild(doc, tcPr, "tcW");
            setWordAttribute(tcW, "w", widths[index]);
            setWordAttribute(tcW, "type", "dxa");
        });
    });
    const totalCells = directChildren(totalRow, "tc");
    const totalFirstCellProperties = totalCells[0] ? ensureChild(doc, totalCells[0], "tcPr") : undefined;
    const totalGridSpan = totalFirstCellProperties ? ensureChild(doc, totalFirstCellProperties, "gridSpan") : undefined;
    if (totalGridSpan)
        setWordAttribute(totalGridSpan, "val", "7");
}
function replaceExactText(doc: Document, replacements: Record<string, string>) {
    const textNodes = doc.getElementsByTagNameNS(W, "t");
    for (let index = 0; index < textNodes.length; index += 1) {
        const node = textNodes.item(index);
        if (!node)
            continue;
        const replacement = replacements[node.textContent || ""];
        if (replacement === undefined)
            continue;
        const lines = replacement.split("\n");
        node.textContent = lines[0];
        const run = node.parentNode;
        if (!run || lines.length === 1)
            continue;
        let anchor: Node = node;
        lines.slice(1).forEach((line) => {
            const lineBreak = doc.createElementNS(W, "w:br");
            const text = doc.createElementNS(W, "w:t");
            text.setAttribute("xml:space", "preserve");
            text.appendChild(doc.createTextNode(line));
            run.insertBefore(lineBreak, anchor.nextSibling);
            run.insertBefore(text, lineBreak.nextSibling);
            anchor = text;
        });
    }
}
const safeFilename = (value: string) => value.trim().replace(/[/\\:*?"<>|]+/g, "_").replace(/\s+/g, " ").replace(/[ ._]+$/g, "") || "Client";
const nonNegative = (value: number) => Math.max(0, Number(value) || 0);
const moneyText = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
const rateText = (margin: number, quote: number) => quote > 0 ? `${((margin / quote) * 100).toFixed(1)}%` : "—";
const parseDate = (value: string): [
    number,
    number,
    number
] | null => {
    const match = String(value || "").match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};
const compactDate = (value: [
    number,
    number,
    number
]) => `${value[0]}/${String(value[1]).padStart(2, "0")}/${String(value[2]).padStart(2, "0")}`;
function travelDateRange(days: InvoiceDay[]) {
    const dates = days.map((day) => parseDate(day.date)).filter(Boolean) as Array<[
        number,
        number,
        number
    ]>;
    const dateKey = ([year, month, day]: [
        number,
        number,
        number
    ]) => year * 10000 + month * 100 + day;
    dates.sort((a, b) => dateKey(a) - dateKey(b));
    if (!dates.length)
        return "—";
    const start = compactDate(dates[0]);
    const end = compactDate(dates.at(-1) as [
        number,
        number,
        number
    ]);
    return start === end ? start : `${start} – ${end}`;
}
function itineraryOverview(days: InvoiceDay[]) {
    const cities = days
        .map((day) => day.city.trim())
        .filter(Boolean)
        .filter((city, index, values) => index === 0 || city !== values[index - 1]);
    return cities.length ? cities.join(" - ") : "暂无";
}
function itemOverview(items: QuoteItem[], category: QuoteItem["category"]) {
    const lines = items
        .filter((item) => item.category === category)
        .map((item) => {
        const name = item.nameZh.trim() || item.nameEn.trim();
        if (!name)
            return "";
        return `${name}（成本价 ${moneyText(nonNegative(item.costPrice))} RMB；报价 ${moneyText(nonNegative(item.quotePrice))} RMB）`;
    })
        .filter(Boolean);
    return lines.length ? lines.join("\n") : "暂无";
}
export async function generateInternalCostSheet(template: Uint8Array, options: InternalCostSheetOptions): Promise<GeneratedInternalCostSheet> {
    if (!options.items.length)
        throw new Error("当前报价中没有可生成成本表的明细");
    const zip = await JSZip.loadAsync(template);
    const documentEntry = zip.file("word/document.xml");
    if (!documentEntry)
        throw new Error("内部成本表模板缺少 word/document.xml");
    const xmlText = await documentEntry.async("string");
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.getElementsByTagName("parsererror").length)
        throw new Error("内部成本表模板XML解析失败");
    const tables = Array.from({ length: doc.getElementsByTagNameNS(W, "tbl").length }, (_, index) => doc.getElementsByTagNameNS(W, "tbl").item(index) as Element);
    const costTable = tables.find((table) => (table.textContent || "").includes("[[ITEM_NAME_ZH]]"));
    if (!costTable)
        throw new Error("内部成本表模板结构不完整");
    const rows = directChildren(costTable, "tr");
    const pattern = rows.find((row) => (row.textContent || "").includes("[[ITEM_NAME_ZH]]"));
    const totalRow = rows.find((row) => (row.textContent || "").includes("[[TOTAL_COST]]"));
    if (!pattern || !totalRow)
        throw new Error("内部成本表模板缺少明细行或合计行");
    addCityColumn(doc, costTable, pattern, totalRow);
    const dayMap = new Map(options.days.map((day) => [day.id, day]));
    const dayOrder = new Map(options.days.map((day, index) => [day.id, index]));
    const orderedItems = options.items
        .map((item, originalIndex) => {
        const day = item.dayId ? dayMap.get(item.dayId) : undefined;
        return {
            item,
            originalIndex,
            groupKey: item.dayId ? `day:${item.dayId}` : "all-days",
            dateLabel: day?.date || (item.dayId ? "—" : "全程"),
            cityLabel: day?.city.trim() || "—",
        };
    })
        .sort((a, b) => {
        const aOrder = a.item.dayId ? dayOrder.get(a.item.dayId) ?? options.days.length + 1 : options.days.length;
        const bOrder = b.item.dayId ? dayOrder.get(b.item.dayId) ?? options.days.length + 1 : options.days.length;
        return aOrder - bOrder || a.originalIndex - b.originalIndex;
    });
    let totalCost = 0;
    let totalQuote = 0;
    let marginCostBasis = 0;
    let marginQuoteBasis = 0;
    let previousGroupKey = "";
    let dayGroupIndex = -1;
    orderedItems.forEach(({ item, groupKey, dateLabel, cityLabel }, orderedIndex) => {
        const firstInDayGroup = groupKey !== previousGroupKey;
        if (firstInDayGroup) {
            dayGroupIndex += 1;
            previousGroupKey = groupKey;
        }
        const quantity = nonNegative(item.quantity);
        const costUnit = nonNegative(item.costPrice);
        const quoteUnit = nonNegative(item.quotePrice);
        const costSubtotal = quantity * costUnit;
        const quoteSubtotal = quantity * quoteUnit;
        const margin = quoteSubtotal - costSubtotal;
        totalCost += costSubtotal;
        totalQuote += quoteSubtotal;
        if (isMarginEligibleCategory(item.category)) {
            marginCostBasis += costSubtotal;
            marginQuoteBasis += quoteSubtotal;
        }
        const row = pattern.cloneNode(true) as Element;
        const cells = directChildren(row, "tc");
        const values = [
            firstInDayGroup ? dateLabel : "",
            firstInDayGroup ? cityLabel : "",
            item.category || "其他",
            item.nameZh.trim() || item.nameEn.trim() || "未命名项目",
            moneyText(quantity),
            moneyText(costUnit),
            moneyText(quoteUnit),
            moneyText(costSubtotal),
            moneyText(quoteSubtotal),
            moneyText(margin),
            rateText(margin, quoteSubtotal),
        ];
        if (cells.length < values.length)
            throw new Error("内部成本表明细列结构不完整");
        values.forEach((value, cellIndex) => replaceCellText(doc, cells[cellIndex], value));
        setVerticalMerge(doc, cells[0], firstInDayGroup ? "restart" : "continue");
        setVerticalMerge(doc, cells[1], firstInDayGroup ? "restart" : "continue");
        setShading(doc, row, dayGroupIndex % 2 === 0 ? "FFFFFF" : "F2F2F2");
        if (orderedItems[orderedIndex + 1]?.groupKey === groupKey)
            keepRowWithNext(doc, row);
        costTable.insertBefore(row, totalRow);
    });
    costTable.removeChild(pattern);
    const totalMargin = marginQuoteBasis - marginCostBasis;
    const totalCells = directChildren(totalRow, "tc");
    if (totalCells.length < 5)
        throw new Error("内部成本表合计行结构不完整");
    replaceCellText(doc, totalCells[1], moneyText(totalCost), true);
    replaceCellText(doc, totalCells[2], moneyText(totalQuote), true);
    replaceCellText(doc, totalCells[3], moneyText(totalMargin), true);
    replaceCellText(doc, totalCells[4], rateText(totalMargin, marginQuoteBasis), true);
    replaceExactText(doc, {
        "[[CUSTOMER_NAME]]": options.customerName.trim(),
        "[[TRAVEL_DATES]]": travelDateRange(options.days),
        "[[ISSUE_DATE]]": options.issueDate || new Date().toISOString().slice(0, 10),
        "[[ITEM_COUNT]]": String(options.items.length),
        "[[ITINERARY_OVERVIEW]]": itineraryOverview(options.days),
        "[[FLIGHT_OVERVIEW]]": itemOverview(options.items, "机票"),
        "[[HOTEL_OVERVIEW]]": itemOverview(options.items, "酒店"),
        "[[RAIL_OVERVIEW]]": itemOverview(options.items, "高铁"),
    });
    zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
    return {
        filename: `${safeFilename(options.customerName)}_Internal Cost Sheet.docx`,
        data: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
        totalCost,
        totalQuote,
        totalMargin,
        marginRate: marginQuoteBasis > 0 ? totalMargin / marginQuoteBasis : null,
    };
}
