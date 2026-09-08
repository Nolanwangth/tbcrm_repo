import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
{"files": ["src/components/customer-table.tsx"], "rules": {"react-hooks/incompatible-library": "off"}},
{"files": ["src/components/file-preview-dialog.tsx"], "rules": {"@next/next/no-img-element": "off"}},
{"files": ["src/components/inline-service-row.tsx"], "rules": {"react-hooks/set-state-in-effect": "off"}},
{"files": ["src/components/legacy-proposal-preview.tsx"], "rules": {"@next/next/no-css-tags": "off"}},
{"files": ["src/components/private-file-thumbnail.tsx"], "rules": {"@next/next/no-img-element": "off"}},
{"files": ["src/components/quote-system-workbench.tsx"], "rules": {"@next/next/no-css-tags": "off"}},
{"files": ["src/components/quote-v2-workbench.tsx"], "rules": {"@next/next/no-css-tags": "off", "react-hooks/set-state-in-effect": "off", "react-hooks/exhaustive-deps": "off"}},
{"files": ["src/components/quote-version-print.tsx"], "rules": {"@next/next/no-css-tags": "off"}},
{"files": ["src/quote-system/components/PrintPreview.tsx"], "rules": {"@next/next/no-img-element": "off"}},
{"files": ["src/quote-system/components/ProformaInvoiceModal.tsx"], "rules": {"@typescript-eslint/no-unused-vars": "off"}},
{"files": ["src/quote-system/components/QuickQuoteModal.tsx"], "rules": {"react-hooks/preserve-manual-memoization": "off", "react-hooks/set-state-in-effect": "off"}},
{"files": ["src/quote-system/components/QuoteCart.tsx"], "rules": {"react-hooks/refs": "off"}},
{"files": ["src/quote-system/lib/margin.ts"], "rules": {"@typescript-eslint/no-unused-vars": "off"}},
    { files: ["src/quote-v2/**"], rules: {
            "react-hooks/preserve-manual-memoization": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/refs": "off",
            "@next/next/no-img-element": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        } },
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        ".backup_*/**",
        "Tripbook-CRM-*/**",
    ]),
]);
export default eslintConfig;
