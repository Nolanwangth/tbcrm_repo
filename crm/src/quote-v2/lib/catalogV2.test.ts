import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { LIBRARY_HEADERS, parseLibraryRows, parseLibraryPaste, markImportDuplicates, validateLibraryProduct } from "./quoteLibraryImport";
import { bookingDescription, bookingToItems, draftFromProducts, synchronizeLibraryDescriptions } from "./quoteLibrary";
import { searchCatalog } from "./catalogSearch";
import { loadDirectQuote, normalizeProducts, STORAGE_KEYS } from "./storage";
import type { PriceProduct } from "../types";
const row = (cells: string[], city = "北京") => parseLibraryRows([{ row: 1, cells: LIBRARY_HEADERS }, { row: 2, cells }], city, "qa.xlsx", "Sheet1")[0];
const ordinary = () => row(["测试游船", "Boat service", "包船", "游船", "北京", "每次", "50", "100"]).product!;
afterEach(() => vi.unstubAllGlobals());
describe("V2 catalog validation and generic discovery", () => {
    it("accepts explicit ordinary categories, rejects guessing a vehicle", () => {
        expect(ordinary().library?.kind).toBe("standard");
        expect(row(["5座用车", "Vehicle", "8小时", "", "北京", "每天", "", ""]).error).toContain("明确");
        expect(row(["5座用车", "Vehicle", "8小时", "市区用车", "北京", "每天", "", ""]).product?.category).toBe("市区用车");
    });
    it("uses row city before fallback, requires a city and unit", () => {
        expect(row(["船", "Boat", "", "游船", "上海", "每次", "", "0"]).product?.city).toBe("上海");
        expect(row(["船", "Boat", "", "游船", "", "每次", "", "0"], "").error).toContain("城市");
        expect(row(["船", "Boat", "", "游船", "北京", "无效", "", "0"]).error).toContain("单位");
    });
    it("preserves raw input and source even on invalid preview rows", () => {
        const invalid = row(["车", "Car", "原始规格", "", "", "辆", "", ""]);
        expect(invalid.cells?.[2]).toBe("原始规格");
        expect(invalid.source?.file).toBe("qa.xlsx");
    });
    it("parses Excel multiline quoted paste, blank and explicit zero independently", () => {
        const rows = parseLibraryPaste('船\t"Boat\nservice"\t包船\t游船\t北京\t每次\t\t0\n船2\tBoat2\t\t游船\t北京\t每次\t12.5\t20', "北京");
        expect(rows).toHaveLength(2);
        expect(rows[0].product?.nameEn).toBe("Boat\nservice");
        expect(rows[0].product?.library).toMatchObject({ costPending: true, quotePending: false });
        expect(rows[1].product?.costPrice).toBe(12.5);
    });
    it("blocks over500 pasted rows and invalid prices", () => {
        expect(() => parseLibraryPaste(Array(501).fill("船\tBoat").join("\n"), "北京")).toThrow("500");
        expect(row(["船", "Boat", "", "游船", "北京", "每次", "=1+1", "0"]).error).toContain("价格");
        expect(validateLibraryProduct({ ...ordinary(), quotePrice: -1 })).toBeTruthy();
    });
    it("skips duplicates by city category name spec", () => {
        const p = ordinary();
        const rows = [p, { ...p, id: "copy" }, { ...p, id: "city", city: "上海" }].map(product => ({ row: 1, product, warnings: [] }));
        expect(markImportDuplicates(rows, []).map(r => !!r.duplicate)).toEqual([false, true, false]);
    });
    it("finds legacy ordinary entries without a library field and filters city/category/enabled", () => {
        const p = { ...ordinary(), library: undefined };
        const list = [p, { ...p, id: "other", city: "上海" }, { ...p, id: "off", enabled: false }];
        expect(searchCatalog(list, "北京", "游船", "测")).toEqual([p]);
        expect(searchCatalog(list, "北京", "景点门票", "测")).toHaveLength(0);
    });
    it("retains ordinary category/unit/English and never adds ticket or guide suffixes", () => {
        const p = ordinary();
        const draft = draftFromProducts([p], p, 8);
        draft.lines[0].quantity = 2;
        expect(bookingDescription(draft)).toBe("Boat service");
        const items = bookingToItems(draft, "day");
        expect(items[0]).toMatchObject({ category: "游船", unit: "每次", quantity: 2, costPrice: 50, quotePrice: 100 });
        p.nameEn = "Changed live library";
        expect(synchronizeLibraryDescriptions(items)[0].nameEn).toBe("Boat service");
    });
    it("ordinary hotel keeps hotel invoice and daily unit", () => {
        const p: PriceProduct = { ...ordinary(), category: "酒店", unit: "每天" };
        expect(bookingToItems(draftFromProducts([p], p, 8), "d")[0]).toMatchObject({ invoiceGroup: "hotel", quantity: 1, unit: "每天" });
    });
    it("never resurrects deleted products or replaces prices with seeds", () => {
        expect(normalizeProducts([])).toEqual([]);
        expect(normalizeProducts([{ ...ordinary(), id: "insurance", quotePrice: 77 }])[0].quotePrice).toBe(77);
    });
});
describe("three versions and isolated draft", () => {
    it.each([[null, "classic"], ["classic", "classic"], ["current", "current"], ["v2", "v2"], ["invalid", "classic"]])("routes preference %s to %s", (preference, expected) => {
        let target = "";
        vm.runInNewContext(readFileSync("src/quote-v2/reference/system-version-router.js", "utf8"), { window: { localStorage: { getItem: () => preference }, location: { replace: (url: string) => { target = url; } } } });
        expect(target).toBe(`/${expected}/`);
    });
    it("first copies legacy draft, then reads its independent V2 draft without changing legacy", () => {
        const legacy = { people: 3, city: "北京", days: [{ id: "d", city: "北京", date: "2026-09-03", title: "Day 01" }], items: [] };
        const values = new Map([["qtp-direct-quote-v1", JSON.stringify(legacy)]]);
        vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null });
        expect(loadDirectQuote().people).toBe(3);
        values.set(STORAGE_KEYS.direct, JSON.stringify({ ...legacy, people: 7 }));
        expect(loadDirectQuote().people).toBe(7);
        expect(JSON.parse(values.get("qtp-direct-quote-v1")!).people).toBe(3);
    });
});
