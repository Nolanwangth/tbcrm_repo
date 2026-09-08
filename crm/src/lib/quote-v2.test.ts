import { describe, it, expect } from "vitest";
import { validateQuoteV2, quoteV2CatalogSchemas, type QuoteV2Snapshot } from "./quote-v2";
import { createEmptyPlan, defaultSettings, seedProducts, seedTemplates } from "@/quote-v2/data/seed";
const snapshot = (): QuoteV2Snapshot => ({ schemaVersion: 2, sourceVersion: "2.0.0", customerId: "a0000000-0000-4000-8000-000000000023", toolType: "quotation", title: "验收", travelerCount: 3, partyConfirmed: true, groupId: null, mode: "direct", costsHidden: false, plan: { ...createEmptyPlan(), people: 3 }, directQuote: { people: 3, city: "北京", days: [], items: [], updatedAt: "2026-09-07" }, itinerary: { clientName: "验收", adults: 2, children: 1, seniors: 0, itineraryText: "" }, settings: defaultSettings, products: seedProducts, templates: seedTemplates });
describe("CRM 2.0 snapshot boundary", () => {
    it("accepts complete source catalog and all three party counts", () => expect(validateQuoteV2(snapshot()).error).toBeUndefined());
    it("rejects name-only association", () => expect(validateQuoteV2({ ...snapshot(), customerId: "Grace" }).error).toBeTruthy());
    it("rejects a confirmed party count mismatch", () => expect(validateQuoteV2({ ...snapshot(), travelerCount: 2 }).error).toMatch("人数"));
    it("retains full product specifications and extra version metadata", () => {
        const value = { ...snapshot(), futureExport: { font: "Chinese" }, products: [{ ...seedProducts[0], library: { kind: "ticket", specZh: "儿童票", ticketType: "child", source: { file: "reference.xlsx", sheet: "Tickets", row: 3, originalSpec: "child" } } }] };
        expect(validateQuoteV2(value).snapshot).toMatchObject(value);
    });
    it("rejects incomplete shared settings", () => expect(quoteV2CatalogSchemas.settings.safeParse({ currency: "USD" }).success).toBe(false));
    it("rejects negative and non-finite prices", () => {
        for (const costPrice of [-1, Infinity, NaN])
            expect(quoteV2CatalogSchemas.products.safeParse([{ ...seedProducts[0], costPrice }]).success).toBe(false);
    });
    it("rejects malformed guide hours", () => expect(quoteV2CatalogSchemas.products.safeParse([{ ...seedProducts[0], library: { kind: "guide", specZh: "导游", guideHours: -8 } }]).success).toBe(false));
    it("rejects incomplete templates", () => expect(quoteV2CatalogSchemas.templates.safeParse([{ id: "template" }]).success).toBe(false));
});
