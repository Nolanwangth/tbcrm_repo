import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { QuoteItem } from "../types";
import { createProformaInvoiceDownload, generateProformaInvoices, prepareInvoiceItems } from "./proformaInvoice";
const templatePath = new URL("../../../public/quote-v2/templates/proforma_invoice_template.docx", import.meta.url);
const item = (values: Partial<QuoteItem> & Pick<QuoteItem, "id" | "dayId" | "category" | "nameZh" | "nameEn" | "quotePrice">): QuoteItem => ({
    sourceKey: values.id,
    source: "manual",
    note: "",
    quantity: 1,
    costPrice: 0,
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
async function documentXml(data: Uint8Array) {
    const zip = await JSZip.loadAsync(data);
    return await zip.file("word/document.xml")?.async("string") || "";
}
describe("proforma invoice generation", () => {
    it("keeps the v2 opening logo within its original header cell", async () => {
        const zip = await JSZip.loadAsync(await readFile(templatePath));
        const xml = await zip.file("word/document.xml")!.async("string");
        const firstExtent = xml.match(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
        expect(firstExtent?.slice(1)).toEqual(["986663", "831754"]);
        expect(xml).toContain("Quboke");
    });
    it("keeps the opening WhatsApp country code at +86 in the PI template", async () => {
        const zip = await JSZip.loadAsync(await readFile(templatePath));
        const xml = await zip.file("word/document.xml")?.async("string") || "";
        expect(xml.match(/<w:t>\+86<\/w:t>/g)).toHaveLength(1);
        expect(xml).toContain("FAX：（+86）0571-58120334");
        expect(xml).toContain("24-hour contact number: +86 13717821971");
    });
    it("adds a solid border at each later service-day boundary", async () => {
        const template = new Uint8Array(await readFile(templatePath));
        const results = await generateProformaInvoices(template, {
            customerName: "Jasmine",
            days: [{ id: "d1", date: "2026-07-09", city: "北京" }, { id: "d2", date: "2026-07-10", city: "上海" }],
            items: [
                item({ id: "d1-driver", dayId: "d1", category: "市区用车", nameZh: "用车", nameEn: "Car", quotePrice: 100 }),
                item({ id: "d2-guide", dayId: "d2", category: "多语言导游", nameZh: "导游", nameEn: "Guide", quotePrice: 200 }),
            ],
            hotelFeeEnabled: true,
            transportationFeeEnabled: true,
        });
        const xml = await documentXml(results.find((result) => result.group === "service")!.data);
        expect(xml).toContain('w:top w:val="single" w:sz="12" w:color="7F8C9F"');
    });
    it("uses the latest manually edited travel quote instead of an old base price", () => {
        const edited = item({
            id: "hotel-edited",
            dayId: "d1",
            category: "酒店",
            nameZh: "酒店",
            nameEn: "Hotel",
            quotePrice: 600,
            baseQuotePrice: 600,
            travelFeeApplied: false,
        });
        const [adjusted] = prepareInvoiceItems([edited], true, true);
        expect(adjusted).toMatchObject({
            baseQuotePrice: 600,
            quotePrice: 630,
            travelFeeApplied: true,
            note: "报价已包含5%服务费",
        });
        expect(prepareInvoiceItems([adjusted], true, true)[0].quotePrice).toBe(630);
    });
    it("creates three separate invoices while preserving fixed template parts", async () => {
        const template = new Uint8Array(await readFile(templatePath));
        const items: QuoteItem[] = [
            item({
                id: "driver",
                dayId: "d1",
                category: "市区用车",
                nameZh: "5座用车",
                nameEn: "Beijing private transfer service",
                invoiceDescriptionEn: "Beijing private transfer service with 5-seat vehicle (Service hours: 8 hrs/day)",
                quotePrice: 1000,
            }),
            item({
                id: "hotel",
                dayId: "d1",
                category: "酒店",
                nameZh: "酒店",
                nameEn: "Beijing Hotel, 2 nights",
                invoiceDescriptionEn: "Beijing Hotel, 2 nights",
                quotePrice: 1001,
                baseQuotePrice: 1001,
            }),
            item({
                id: "flight",
                dayId: "d1",
                category: "机票",
                nameZh: "机票",
                nameEn: "Beijing to Shanghai flight",
                invoiceDescriptionEn: "Beijing to Shanghai flight",
                quotePrice: 2000,
                baseQuotePrice: 2000,
            }),
        ];
        const results = await generateProformaInvoices(template, {
            customerName: "Jasmine",
            days: [{ id: "d1", date: "2026-07-09", city: "北京" }],
            items,
            hotelFeeEnabled: true,
            transportationFeeEnabled: false,
            issueDate: "2026-07-24",
        });
        expect(results.map((result) => result.filename)).toEqual([
            "Jasmine_PROFORMA_INVOICE.docx",
            "Jasmine_PROFORMA_INVOICE_Hotel.docx",
            "Jasmine_PROFORMA_INVOICE_Transportation.docx",
        ]);
        expect(results.map((result) => result.total)).toEqual([1000, 1052, 2000]);
        const [serviceText, hotelText, transportText] = await Promise.all(results.map((result) => documentText(result.data)));
        const xmlFiles = await Promise.all(results.map((result) => documentXml(result.data)));
        for (const text of [serviceText, hotelText, transportText]) {
            expect(text).toContain("CRT-2026-7979-BJ-301");
            expect(text).toContain("Deposit refund and service item cancellation policy");
            expect(text).toContain("Date 2026-07-24");
        }
        for (const xml of xmlFiles) {
            expect(xml).not.toMatch(/<w:highlight[^>]+w:val="(?:red|darkRed)"/i);
        }
        expect(serviceText).toContain("A deposit of 300 RMB is required");
        expect(serviceText).toContain("remaining balance of 700 RMB");
        expect(serviceText).toContain("Tour Guide None 0");
        expect(hotelText).toContain("Full payment is required in advance for hotel invoices.");
        expect(hotelText).toContain("Beijing Hotel, 2 nights");
        expect(hotelText).toContain("1052");
        expect(hotelText).not.toContain("Include 5% service fee");
        expect(transportText).toContain("Full payment is required in advance for transportation invoices.");
        const download = await createProformaInvoiceDownload("Jasmine", results);
        expect(download).toMatchObject({
            filename: "Jasmine_PROFORMA_INVOICES_3_FILES.zip",
            mimeType: "application/zip",
            invoiceCount: 3,
        });
        const packaged = await JSZip.loadAsync(download.data);
        expect(Object.keys(packaged.files).sort()).toEqual([
            "Jasmine_PROFORMA_INVOICE.docx",
            "Jasmine_PROFORMA_INVOICE_Hotel.docx",
            "Jasmine_PROFORMA_INVOICE_Transportation.docx",
        ].sort());
    });
    it("downloads one invoice directly without wrapping it in a zip", async () => {
        const source = {
            group: "service" as const,
            filename: "Jasmine_PROFORMA_INVOICE.docx",
            data: new Uint8Array([1, 2, 3]),
            total: 1000,
        };
        const download = await createProformaInvoiceDownload("Jasmine", [source]);
        expect(download).toMatchObject({
            filename: source.filename,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            invoiceCount: 1,
        });
        expect(download.data).toEqual(source.data);
    });
});
