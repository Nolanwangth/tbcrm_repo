import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { bookingDescription, bookingLine, bookingToItems, bookingValid, draftFromItems, draftFromProducts, groupQuoteItems, projectLibraryItems, synchronizeLibraryDescriptions } from "./quoteLibrary";
import { markImportDuplicates, parseLibraryRows, readLibraryWorkbook } from "./quoteLibraryImport";
import { calculateTotals, generateDirectQuoteText, insertDirectQuoteDay, reorderDirectQuoteDays } from "./logic";
import { calculateMarginBreakdown } from "./margin";
import { generateProformaInvoices, createProformaInvoiceDownload } from "./proformaInvoice";
import { normalizeDirectQuote } from "./storage";
import type { DirectQuote, PriceProduct } from "../types";
let products: PriceProduct[];
beforeAll(async () => {
    const buffer = await readFile(new URL("../../../public/quote-v2/beijing-quote-library.xlsx", import.meta.url));
    products = (await readLibraryWorkbook(Uint8Array.from(buffer).buffer, "北京", "北京景点.xlsx")).flatMap(r => r.product ? [r.product] : []);
});
function ticketDraft() {
    const p = products.find(p => p.nameZh === "八达岭长城门票+缆车单程票")!;
    const draft = draftFromProducts(products, p, 2);
    draft.lines[0] = { ...draft.lines[0], cost: "80", quote: "120" };
    draft.lines.push({ ...bookingLine(draft.options[1], 1), cost: "40", quote: "60" });
    return draft;
}
describe("Beijing library import", () => {
    it("imports 31 ticket and 6 guide specifications, preserves missing prices", () => {
        expect(products).toHaveLength(37);
        expect(products.filter(p => p.library?.kind === "ticket")).toHaveLength(31);
        expect(products.filter(p => p.library?.kind === "guide")).toHaveLength(6);
        expect(products.every(p => p.library?.costPending && p.library.quotePending)).toBe(true);
    });
    it("keeps source row, text and flags suspicious content without changing it", () => {
        const palace = products.find(p => p.library?.source?.row === 3)!;
        expect(palace.nameZh).toBe("故官");
        expect(palace.library?.warnings?.length).toBeGreaterThan(0);
        expect(products.find(p => p.library?.source?.row === 18)?.library?.source?.originalSpec).toContain("10.32");
        expect(palace.library?.ticketType).toBe("standard");
    });
    it("skips both existing and intra-file duplicates instead of overwriting", () => {
        const entries = products.map(p => ({ row: p.library!.source!.row, product: p, warnings: [] }));
        expect(markImportDuplicates(entries, products).every(r => r.duplicate)).toBe(true);
        expect(markImportDuplicates([entries[0], entries[0]], [])[1].duplicate).toBe(true);
    });
    it("distinguishes explicit zero, blank and invalid prices", () => {
        const headers = { row: 2, cells: ["商品名称", "Product Name", "规格", "", "", "单位", "成本", "定价"] };
        const row = (cost: string, quote: string) => parseLibraryRows([headers, { row: 3, cells: ["测试", "Test", "成人票", "", "", "张", cost, quote] }], "北京", "test.xlsx", "Sheet1")[0];
        expect(row("0", "0").product?.library?.costPending).toBe(false);
        expect(row("", "0").product?.library?.costPending).toBe(true);
        expect(row("-1", "20").error).toBeTruthy();
    });
});
describe("ticket and guide booking", () => {
    it("blocks missing prices but accepts a deliberate zero", () => {
        const p = products[0], draft = draftFromProducts(products, p, 1);
        expect(bookingValid(draft)).toBe(false);
        expect(() => bookingToItems(draft, "d1")).toThrow();
        draft.lines[0].cost = "0";
        draft.lines[0].quote = "0";
        expect(bookingValid(draft)).toBe(true);
    });
    it("stores independent ticket items, totals them exactly, projects only one customer item", () => {
        const items = bookingToItems(ticketDraft(), "d1");
        expect(items).toHaveLength(2);
        expect(groupQuoteItems(items)).toHaveLength(1);
        expect(calculateTotals(items)).toMatchObject({ costTotal: 200, quoteTotal: 300, profit: 100 });
        expect(calculateMarginBreakdown(items).service.profit).toBe(100);
        const projected = projectLibraryItems(items);
        expect(projected).toHaveLength(1);
        expect(projected[0].quotePrice).toBe(300);
        expect(projected[0].nameEn).toContain("2 adult tickets, 1 child ticket");
        expect(projected[0].nameEn).not.toMatch(/旺季|淡季|18|免费|peak/i);
    });
    it("preserves manually edited body while quantities and hours update", () => {
        const draft = ticketDraft();
        draft.englishBase = "My edited attraction";
        const items = synchronizeLibraryDescriptions(bookingToItems(draft, "d1").map(i => ({ ...i, quantity: i.quantity + 1 })));
        expect(projectLibraryItems(items)[0].nameEn).toBe("My edited attraction — 3 adult tickets, 2 child tickets");
    });
    it("omits zero quantities and rejects fractions, negative and duplicate specifications", () => {
        const draft = ticketDraft();
        draft.lines[1].quantity = 0;
        expect(bookingToItems(draft, "d1")).toHaveLength(1);
        expect(bookingDescription(draft)).not.toContain("child");
        draft.lines[0].quantity = 0.5;
        expect(bookingValid(draft)).toBe(false);
        draft.lines[0].quantity = -1;
        expect(bookingValid(draft)).toBe(false);
        draft.lines[0].quantity = 1;
        draft.lines[1].productId = draft.lines[0].productId;
        expect(bookingValid(draft)).toBe(false);
    });
    it.each([8, 10, 12])("bills two guides for one %s-hour day without multiplying hours or guests", hours => {
        const p = products.find(p => p.nameZh === "英文导游（长城）" && p.library?.guideHours === hours)!;
        const draft = draftFromProducts(products, p, 20);
        expect(draft.lines[0].quantity).toBe(1);
        draft.lines[0] = { ...draft.lines[0], quantity: 2, cost: "800", quote: "1000" };
        const items = bookingToItems(draft, "d1");
        expect(calculateTotals(items).quoteTotal).toBe(2000);
        expect(projectLibraryItems(items)[0].quantity).toBe(2);
        expect(projectLibraryItems(items)[0].quotePrice).toBe(1000);
        expect(items[0].nameEn).toContain(`(Service hours: ${hours} hrs/day) — 2 guides`);
        expect(items[0].nameEn.match(/Service hours/g)).toHaveLength(1);
        expect(items[0].nameEn).not.toContain("Great Wall");
    });
    it("keeps snapshots independent of catalog edits and roundtrips flat classic-compatible items", () => {
        const draft = ticketDraft();
        const items = bookingToItems(draft, "d1");
        draft.options[0].spec.specZh = "changed";
        expect(items[0].libraryQuote?.spec.specZh).toBe("成人票");
        const loaded = normalizeDirectQuote(JSON.parse(JSON.stringify({ people: 3, city: "北京", days: [{ id: "d1", date: "2026-09-10", city: "北京" }], items })));
        expect(projectLibraryItems(loaded.items)[0].quotePrice).toBe(300);
        const edited = draftFromItems(loaded.items);
        edited.lines[1].quote = "100";
        const saved = bookingToItems(edited, "d1", loaded.items);
        expect(saved.map(i => i.id)).toEqual(items.map(i => i.id));
        expect(calculateTotals(saved).quoteTotal).toBe(340);
    });
    it("never merges separate bookings or Days and keeps stable Day ids after reorder", () => {
        const items = [...bookingToItems(ticketDraft(), "d1"), ...bookingToItems(ticketDraft(), "d1")];
        expect(groupQuoteItems(items)).toHaveLength(2);
        const quote: DirectQuote = { people: 3, city: "北京", updatedAt: "", days: [{ id: "d1", title: "Day 1", city: "北京", date: "2026-09-01" }, { id: "d2", title: "Day 2", city: "北京", date: "2026-09-02" }], items };
        const changed = reorderDirectQuoteDays(quote, "d1", "d2");
        expect(changed.items).toEqual(items);
        expect(insertDirectQuoteDay(quote, "d1", "before").quote.items.filter(i => i.libraryQuote)).toEqual(items);
        const copy = { ...items[0], dayId: "d2" };
        expect(groupQuoteItems([items[0], copy])).toHaveLength(2);
    });
    it("customer text uses a combined description and one amount", () => {
        const quote: DirectQuote = { people: 3, city: "北京", updatedAt: "", days: [{ id: "d1", title: "Day 1", city: "北京", date: "2026-09-01" }], items: bookingToItems(ticketDraft(), "d1") };
        const text = generateDirectQuoteText(quote);
        expect(text).toContain("2 adult tickets, 1 child ticket: 300 RMB");
        expect(text.match(/Badaling/g)).toHaveLength(1);
    });
    it("generates multi-day PI and ZIP with grouped tickets and unchanged deposit rules", async () => {
        const items = [...bookingToItems(ticketDraft(), "d1"), ...bookingToItems(ticketDraft(), "d2")];
        const template = await readFile(new URL("../../../public/quote-v2/templates/proforma_invoice_template.docx", import.meta.url));
        const invoices = await generateProformaInvoices(template, { customerName: "Beijing Library QA", days: [{ id: "d1", date: "2026-09-10", city: "北京" }, { id: "d2", date: "2026-09-11", city: "北京" }], items, hotelFeeEnabled: false, transportationFeeEnabled: false });
        expect(invoices).toHaveLength(1);
        expect(invoices[0].total).toBe(600);
        const zip = await JSZip.loadAsync(invoices[0].data);
        const xml = await zip.file("word/document.xml")!.async("string");
        expect(xml.match(/2 adult tickets, 1 child ticket/g)).toHaveLength(2);
        expect(xml.includes("A deposit of 180 RMB is required")).toBe(true);
        expect(xml.includes("remaining balance of 420 RMB")).toBe(true);
        expect(xml.includes('w:val="single"')).toBe(true);
        const download = await createProformaInvoiceDownload("QA", invoices, { filename: "cost.docx", data: invoices[0].data });
        expect(download.mimeType).toBe("application/zip");
        expect(Object.keys((await JSZip.loadAsync(download.data)).files)).toHaveLength(2);
    });
});
