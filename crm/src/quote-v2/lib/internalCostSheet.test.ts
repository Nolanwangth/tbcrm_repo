import { readFile } from "node:fs/promises";
import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { QuoteItem } from "../types";
import { generateInternalCostSheet } from "./internalCostSheet";
import { createProformaInvoiceDownload, prepareInvoiceItems } from "./proformaInvoice";
const templatePath = new URL("../../../public/quote-v2/templates/internal_cost_sheet_template.docx", import.meta.url);
const item = (values: Partial<QuoteItem> & Pick<QuoteItem, "id" | "category" | "nameZh">): QuoteItem => ({
    sourceKey: values.id,
    source: "manual",
    nameEn: "",
    note: "",
    quantity: 1,
    costPrice: 0,
    quotePrice: 0,
    unit: "固定总价",
    nameEdited: true,
    costEdited: true,
    quoteEdited: true,
    quantityEdited: true,
    ...values,
});
async function documentText(data: Uint8Array) {
    const zip = await JSZip.loadAsync(data);
    const xml = await zip.file("word/document.xml")?.async("string");
    return (xml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
describe("internal cost sheet generation", () => {
    it("creates one consolidated Chinese cost and margin sheet with raw costs", async () => {
        const template = new Uint8Array(await readFile(templatePath));
        const sourceItems = [
            item({
                id: "driver",
                dayId: "d1",
                category: "市区用车",
                nameZh: "7座用车",
                quantity: 1,
                costPrice: 500,
                quotePrice: 800,
            }),
            item({
                id: "hotel",
                dayId: "d2",
                category: "酒店",
                nameZh: "成都东方广场假日酒店",
                quantity: 2,
                costPrice: 1000,
                quotePrice: 1001,
                baseQuotePrice: 1001,
            }),
            item({
                id: "insurance",
                dayId: "d1",
                category: "保险",
                nameZh: "旅游保险",
                quantity: 5,
                costPrice: 5,
                quotePrice: 10,
            }),
            item({
                id: "flight",
                dayId: "d2",
                category: "机票",
                nameZh: "成都至上海机票",
                costPrice: 600,
                quotePrice: 700,
            }),
        ];
        const adjusted = prepareInvoiceItems(sourceItems, true, true);
        const result = await generateInternalCostSheet(template, {
            customerName: "Jasmine",
            days: [
                { id: "d1", date: "2026-07-29", city: "成都" },
                { id: "d2", date: "2026-07-30", city: "成都" },
                { id: "d3", date: "2026-08-01", city: "上海" },
            ],
            items: adjusted,
            issueDate: "2026-07-29",
        });
        expect(result.filename).toBe("Jasmine_Internal Cost Sheet.docx");
        expect(result).toMatchObject({
            totalCost: 3125,
            totalQuote: 3689,
            totalMargin: 564,
        });
        expect(result.marginRate).toBeCloseTo(564 / 3689);
        const text = await documentText(result.data);
        expect(text).toContain("INTERNAL COST SHEET");
        expect(text).toContain("INTERNAL USE ONLY");
        expect(text).toContain("Jasmine");
        expect(text).toContain("2026/07/29 – 2026/08/01");
        expect(text).toContain("7座用车");
        expect(text).toContain("成都东方广场假日酒店");
        expect(text).toContain("旅游保险");
        expect(text).toContain("成都 - 上海");
        expect(text).toContain("城市");
        expect(text).toContain("成都");
        expect(text).toContain("成都至上海机票");
        expect(text).toContain("暂无");
        expect(text).toContain("1,052");
        expect(text).toContain("3,125");
        expect(text).toContain("3,689");
        expect(text).toContain("564");
        expect(text).not.toContain("[[ITEM_NAME_ZH]]");
        const zip = await JSZip.loadAsync(result.data);
        const xml = await zip.file("word/document.xml")?.async("string") || "";
        expect(xml.match(/<w:vMerge[^>]*w:val="restart"[^>]*>/g)).toHaveLength(4);
        expect(xml.match(/<w:vMerge\/>/g)).toHaveLength(4);
        expect(xml).toContain('<w:gridSpan w:val="7"/>');
        const xmlDocument = new DOMParser().parseFromString(xml, "application/xml");
        const xmlTables = xmlDocument.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "tbl");
        const generatedTable = Array.from({ length: xmlTables.length }, (_, index) => xmlTables.item(index))
            .find((table) => table?.textContent?.includes("成本单价") && table.textContent.includes("7座用车"));
        expect(generatedTable).toBeTruthy();
        const xmlRows = Array.from({ length: generatedTable?.childNodes.length || 0 }, (_, index) => generatedTable?.childNodes.item(index)).filter((node) => node?.nodeType === 1 && (node as Element).localName === "tr");
        for (const row of xmlRows) {
            if (!row || !["7座用车", "旅游保险", "成都东方广场假日酒店", "成都至上海机票"].some((name) => row.textContent?.includes(name)))
                continue;
            const cells = Array.from({ length: row.childNodes.length }, (_, index) => row.childNodes.item(index))
                .filter((node) => node?.nodeType === 1 && (node as Element).localName === "tc");
            expect(cells).toHaveLength(11);
        }
        const lastRowContaining = (value: string) => [...xml.matchAll(new RegExp(`<w:tr(?:(?!</w:tr>)[\\s\\S])*${value}(?:(?!</w:tr>)[\\s\\S])*</w:tr>`, "g"))].at(-1)?.[0] || "";
        const driverRow = lastRowContaining("7座用车");
        const insuranceRow = lastRowContaining("旅游保险");
        const hotelRow = lastRowContaining("成都东方广场假日酒店");
        const flightRow = lastRowContaining("成都至上海机票");
        expect(driverRow).toContain('w:fill="FFFFFF"');
        expect(insuranceRow).toContain('w:fill="FFFFFF"');
        expect(hotelRow).toContain('w:fill="F2F2F2"');
        expect(flightRow).toContain('w:fill="F2F2F2"');
    });
    it("lists every hotel, flight and rail item on its own overview line with cost and quote prices", async () => {
        const template = new Uint8Array(await readFile(templatePath));
        const result = await generateInternalCostSheet(template, {
            customerName: "Multiple Travel Items",
            days: [{ id: "d1", date: "2026-08-06", city: "成都" }],
            items: [
                item({ id: "hotel-1", category: "酒店", nameZh: "成都智选假日", costPrice: 500, quotePrice: 525 }),
                item({ id: "hotel-2", category: "酒店", nameZh: "重庆智选假日", costPrice: 1200, quotePrice: 1260 }),
                item({ id: "flight-1", category: "机票", nameZh: "北京至成都机票", costPrice: 1000, quotePrice: 1100 }),
                item({ id: "flight-2", category: "机票", nameZh: "成都至上海机票", costPrice: 800, quotePrice: 880 }),
                item({ id: "rail-1", category: "高铁", nameZh: "成都至重庆高铁", costPrice: 150, quotePrice: 180 }),
                item({ id: "rail-2", category: "高铁", nameZh: "重庆至西安高铁", costPrice: 300, quotePrice: 360 }),
            ],
            issueDate: "2026-07-30",
        });
        const text = await documentText(result.data);
        expect(text).toContain("成都智选假日（成本价 500 RMB；报价 525 RMB）");
        expect(text).toContain("重庆智选假日（成本价 1,200 RMB；报价 1,260 RMB）");
        expect(text).toContain("北京至成都机票（成本价 1,000 RMB；报价 1,100 RMB）");
        expect(text).toContain("成都至上海机票（成本价 800 RMB；报价 880 RMB）");
        expect(text).toContain("成都至重庆高铁（成本价 150 RMB；报价 180 RMB）");
        expect(text).toContain("重庆至西安高铁（成本价 300 RMB；报价 360 RMB）");
        const zip = await JSZip.loadAsync(result.data);
        const xml = await zip.file("word/document.xml")?.async("string") || "";
        expect(xml).toMatch(/成都智选假日[\s\S]*?<w:br\/>[\s\S]*?重庆智选假日/);
        expect(xml).toMatch(/北京至成都机票[\s\S]*?<w:br\/>[\s\S]*?成都至上海机票/);
        expect(xml).toMatch(/成都至重庆高铁[\s\S]*?<w:br\/>[\s\S]*?重庆至西安高铁/);
    });
    it("packages customer PI files and the internal sheet into one zip", async () => {
        const costSheet = {
            filename: "Jasmine_Internal Cost Sheet.docx",
            data: new Uint8Array([7, 8, 9]),
        };
        const invoice = {
            group: "service" as const,
            filename: "Jasmine_PROFORMA_INVOICE.docx",
            data: new Uint8Array([1, 2, 3]),
            total: 1000,
        };
        const download = await createProformaInvoiceDownload("Jasmine", [invoice], costSheet);
        expect(download).toMatchObject({
            filename: "Jasmine_PI_AND_INTERNAL_COST_2_FILES.zip",
            mimeType: "application/zip",
            invoiceCount: 1,
            fileCount: 2,
        });
        const zip = await JSZip.loadAsync(download.data);
        expect(Object.keys(zip.files).sort()).toEqual([
            "Jasmine_Internal Cost Sheet.docx",
            "Jasmine_PROFORMA_INVOICE.docx",
        ].sort());
    });
});
