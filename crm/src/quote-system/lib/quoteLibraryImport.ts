import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { createId } from "./id";
import { librarySpecKey } from "./quoteLibrary";
import { PRODUCT_CATEGORIES, PRICING_UNITS, type PriceProduct, type ProductCategory, type PricingUnit } from "../types";
export interface ImportRow {
    product?: PriceProduct;
    row: number;
    cells?: string[];
    source?: {
        file: string;
        sheet: string;
    };
    warnings: string[];
    error?: string;
    duplicate?: boolean;
}
export const LIBRARY_HEADERS = ["商品名称", "Product Name", "规格", "类别", "城市", "单位", "成本", "定价"];
export function validateLibraryProduct(product: PriceProduct): string | undefined {
    if (!product.city.trim() || !product.nameZh.trim() || !product.nameEn.trim())
        return "请补齐城市、中英文名称";
    if (!PRODUCT_CATEGORIES.includes(product.category) || !PRICING_UNITS.includes(product.unit))
        return "类别或单位无效";
    if (![product.costPrice, product.quotePrice].every(n => Number.isFinite(n) && n >= 0))
        return "价格必须为空或非负数字";
    if (product.library?.kind === "guide" && (product.category !== "多语言导游" || ![8, 10, 12].includes(product.library.guideHours!)))
        return "导游时长请选择8、10或12小时";
    if (product.library?.kind === "ticket" && product.category !== "景点门票")
        return "票种只适用于景点门票";
    return undefined;
}
const text = (node: Element | undefined | null) => node?.textContent || "";
const elements = (node: Document | Element, name: string) => Array.from(node.getElementsByTagName(name));
export function parseLibraryRows(rows: Array<{
    row: number;
    cells: string[];
}>, city: string, file: string, sheet: string): ImportRow[] {
    const header = rows.findIndex(r => r.cells[0]?.trim() === "商品名称" && r.cells[1]?.trim() === "Product Name");
    if (header < 0)
        throw new Error("未找到表头：商品名称、Product Name、规格、单位、成本、定价（A–H列）");
    return rows.slice(header + 1).filter(r => r.cells.some(c => c?.trim())).map(({ row, cells }) => {
        const [rawName = "", rawEn = "", rawSpec = ""] = cells;
        const nameZh = rawName.trim(), nameEn = rawEn.trim(), specZh = rawSpec.trim();
        const warnings: string[] = [];
        if (!nameZh)
            return { row, warnings, error: "缺少商品名称" };
        const explicitCategory = cells[3]?.trim();
        const category = explicitCategory || (/导游/.test(nameZh) ? "多语言导游" : cells[5]?.trim() === "张" ? "景点门票" : "");
        if (!PRODUCT_CATEGORIES.includes(category as ProductCategory))
            return { row, warnings, error: "请明确选择类别；用车及其他类别不自动推断" };
        const kind = category === "多语言导游" ? "guide" : category === "景点门票" ? "ticket" : "standard";
        if (kind !== "standard" && !specZh)
            return { row, warnings, error: "门票或导游缺少规格" };
        const rowCity = cells[4]?.trim() || city.trim();
        if (!rowCity)
            return { row, warnings, error: "请填写城市或指定导入城市" };
        const rawUnit = cells[5]?.trim() || "";
        const unit = ({ "张": "每人", "人": "每人", "天": "每天", "次": "每次" } as Record<string, string>)[rawUnit] || rawUnit;
        if (!PRICING_UNITS.includes(unit as PricingUnit))
            return { row, warnings, error: "请选择有效计价单位" };
        if (/故官/.test(nameZh))
            warnings.push("名称含“故官”，请核对；保留原文");
        if (/10\.32/.test(specZh))
            warnings.push("规格含“10.32”，请核对；不用于日期判断");
        const guideHours = kind === "guide" ? Number(specZh.match(/(\d+)\s*小时/)?.[1]) : undefined;
        if (kind === "guide" && ![8, 10, 12].includes(guideHours!))
            return { row, warnings, error: "导游时长需要明确为8、10或12小时" };
        if (!nameEn)
            return { row, warnings, error: "缺少英文正文，请补充后导入" };
        const costPending = !cells[6]?.trim(), quotePending = !cells[7]?.trim();
        if (costPending || quotePending)
            warnings.push("价格待填写：加入报价前必须补齐，允许明确填写0");
        const costPrice = costPending ? 0 : Number(cells[6]), quotePrice = quotePending ? 0 : Number(cells[7]);
        if (![costPrice, quotePrice].every(v => Number.isFinite(v) && v >= 0))
            return { row, warnings, error: "价格必须为空或非负数字" };
        return { row, warnings, product: {
                id: createId(), city: rowCity, category: category as ProductCategory, nameZh, nameEn, costPrice, quotePrice, unit: kind === "guide" ? "每天" : unit as PricingUnit, enabled: true, userAdded: true, guideLanguage: kind === "guide" ? "English" : undefined,
                library: { kind, specZh, guideHours, ticketType: kind === "ticket" ? (/成人票/.test(specZh) ? "adult" : /儿童票/.test(specZh) ? "child" : "standard") : undefined, costPending, quotePending, source: { file, sheet, row, originalSpec: rawSpec }, warnings: warnings.filter(w => !w.startsWith("价格待填写")) },
            } as PriceProduct };
    }).map((result, index) => ({ ...result, cells: [...rows.slice(header + 1).filter(r => r.cells.some(c => c?.trim()))[index].cells], source: { file, sheet } }));
}
export function parseLibraryPaste(value: string, city: string): ImportRow[] {
    const records: string[][] = [];
    let record: string[] = [], field = "", quoted = false;
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (char === '"') {
            if (quoted && value[i + 1] === '"') {
                field += '"';
                i++;
            }
            else if (quoted || !field)
                quoted = !quoted;
            else
                field += char;
        }
        else if (!quoted && (char === '\t' || char === '\n')) {
            record.push(field.replace(/\r$/, ""));
            field = "";
            if (char === '\n') {
                records.push(record);
                record = [];
            }
        }
        else
            field += char;
    }
    if (quoted)
        throw new Error("粘贴内容引号未闭合");
    if (field || record.length) {
        record.push(field.replace(/\r$/, ""));
        records.push(record);
    }
    if (records[0]?.[0] === "商品名称")
        records.shift();
    if (records.length > 500)
        throw new Error("单次最多500条，请拆分粘贴");
    return parseLibraryRows([{ row: 0, cells: LIBRARY_HEADERS }, ...records.map((cells, i) => ({ row: i + 1, cells }))], city, "手工批量录入", "粘贴");
}
export function markImportDuplicates(rows: ImportRow[], products: PriceProduct[]): ImportRow[] {
    const keys = new Set(products.map(librarySpecKey));
    return rows.map(row => {
        if (!row.product)
            return row;
        const key = librarySpecKey(row.product), duplicate = keys.has(key);
        keys.add(key);
        return { ...row, duplicate };
    });
}
export async function readLibraryWorkbook(buffer: ArrayBuffer, city: string, filename: string): Promise<ImportRow[]> {
    if (buffer.byteLength > 10 * 1024 * 1024)
        throw new Error("文件不能超过10MB");
    const zip = await JSZip.loadAsync(buffer);
    const xml = async (path: string) => {
        const entry = zip.file(path);
        if (!entry)
            throw new Error(`工作簿缺少 ${path}`);
        const value = await entry.async("string");
        if (value.length > 15 * 1024 * 1024)
            throw new Error("工作簿内容过大");
        if (/<!DOCTYPE|<!ENTITY/i.test(value))
            throw new Error("不支持含外部实体的工作簿");
        return new DOMParser().parseFromString(value, "text/xml");
    };
    const shared = zip.file("xl/sharedStrings.xml") ? elements(await xml("xl/sharedStrings.xml"), "si").map(si => elements(si, "t").map(text).join("")) : [];
    const workbook = await xml("xl/workbook.xml"), rels = await xml("xl/_rels/workbook.xml.rels");
    const result: ImportRow[] = [];
    for (const sheet of elements(workbook, "sheet")) {
        const rel = elements(rels, "Relationship").find(r => r.getAttribute("Id") === sheet.getAttribute("r:id"));
        const target = rel?.getAttribute("Target") || "";
        const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
        const doc = await xml(path);
        const rows = elements(doc, "row").map(r => ({ row: Number(r.getAttribute("r")), cells: elements(r, "c").reduce<string[]>((cells, c) => {
                const column = (c.getAttribute("r")?.match(/^[A-Z]+/)?.[0] || "A").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
                if (column > 7)
                    return cells;
                const raw = text(elements(c, "v")[0]);
                cells[column] = c.getAttribute("t") === "s" ? shared[Number(raw)] || "" : c.getAttribute("t") === "inlineStr" ? elements(c, "t").map(text).join("") : raw;
                if (elements(c, "f").length && column >= 6)
                    cells[column] = "公式价格请粘贴为数值";
                return cells;
            }, []) }));
        if (rows.length > 2000)
            throw new Error("单次最多导入2000行，请拆分文件");
        if (rows.some(r => r.cells[0]?.trim() === "商品名称"))
            result.push(...parseLibraryRows(rows, city, filename, sheet.getAttribute("name") || "Sheet1"));
    }
    if (!result.length)
        throw new Error("没有找到符合北京报价表格式的数据");
    return result;
}
