import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
{ extends: true, test: { name: "node", environment: "node", include: ["src/lib/quote-v2.test.ts","src/quote-v2/lib/catalogV2.test.ts","src/quote-v2/lib/docxGenerator.test.ts","src/quote-v2/lib/id.test.ts","src/quote-v2/lib/internalCostSheet.test.ts","src/quote-v2/lib/invoiceDescription.test.ts","src/quote-v2/lib/itineraryDocument.test.ts","src/quote-v2/lib/logic.test.ts","src/quote-v2/lib/margin.test.ts","src/quote-v2/lib/proformaInvoice.test.ts","src/quote-v2/lib/quoteLibrary.test.ts","src/quote-v2/lib/versioning.test.ts"] } },
{ extends: true, test: { name: "browser", environment: "jsdom", exclude: ["src/lib/quote-v2.test.ts","src/quote-v2/lib/catalogV2.test.ts","src/quote-v2/lib/docxGenerator.test.ts","src/quote-v2/lib/id.test.ts","src/quote-v2/lib/internalCostSheet.test.ts","src/quote-v2/lib/invoiceDescription.test.ts","src/quote-v2/lib/itineraryDocument.test.ts","src/quote-v2/lib/logic.test.ts","src/quote-v2/lib/margin.test.ts","src/quote-v2/lib/proformaInvoice.test.ts","src/quote-v2/lib/quoteLibrary.test.ts","src/quote-v2/lib/versioning.test.ts","**/node_modules/**","**/.next/**","**/.backup_*/**","**/Tripbook-CRM-*/**"] } }
],
        setupFiles: ["./src/test/setup.ts"],
        exclude: ["**/node_modules/**", "**/.next/**", "**/.backup_*/**", "**/Tripbook-CRM-*/**"],
        coverage: { reporter: ["text", "json", "html"] },
    },
    resolve: {
        alias: {
            "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
