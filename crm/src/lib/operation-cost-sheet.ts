import { createHash } from "node:crypto";
import JSZip from "jszip";
import type { BookingStatus, OperationCategory, OperationSection, } from "@/lib/operations";
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_XML_CHARS = 5 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 200;
const MONEY_TOLERANCE = 0.01;
const REQUIRED_DETAIL_HEADERS = [
    "日期",
    "分类",
    "中文项目名",
    "数量",
    "成本单价",
    "报价单价",
    "成本小计",
    "报价小计",
    "毛利",
    "毛利率",
] as const;
export type OperationCostSheetDay = {
    dayNumber: number;
    serviceDate: string;
    city: string | null;
};
export type OperationCostSheetItem = {
    rowKey: string;
    dayNumber: number;
    serviceDate: string;
    city: string | null;
    sourceCategory: string;
    section: OperationSection;
    category: OperationCategory;
    title: string;
    details: string | null;
    bookingStatus: BookingStatus;
    quantity: number;
    unit: string;
    invoiceUnitCost: number;
    customerUnitQuote: number;
    checkInDate: string | null;
    transportType: string | null;
    origin: string | null;
    destination: string | null;
    supplierName?: string | null;
    referenceNumber?: string | null;
    departureTime?: string | null;
    checkOutDate?: string | null;
    roomType?: string | null;
    roomCount?: number | null;
    confidence?: "high" | "medium" | "low";
    sourceText?: string | null;
};
export type OperationCostSheetPreview = {
    template: "tripbook-internal-cost-sheet-v1" | "tripbook-operations-service-list-v1" | "legacy-freeform-v1";
    format?: "structured" | "legacy";
    templateVersion?: string;
    clientLabel: string | null;
    travelStartDate: string;
    travelEndDate: string;
    declaredItemCount: number | null;
    contentHash: string;
    days: OperationCostSheetDay[];
    items: OperationCostSheetItem[];
    counts: {
        daily: number;
        hotel: number;
        transport: number;
    };
    totals: {
        cost: number;
        quote: number;
        grossProfit: number;
    };
    warnings: string[];
    unmatchedLines?: string[];
};
const OPERATIONS_TEMPLATE_CODE = "TRIPBOOK_OPERATIONS_SERVICE_LIST";
const OPERATIONS_TEMPLATE_HEADERS = ["行标识", "行号", "Day", "开始日期", "结束日期", "城市", "服务类型", "项目名称", "数量", "单位", "供应商", "成本单价", "客户报价单价", "出发地", "目的地", "班次/确认号", "时间", "房型", "间数", "备注"] as const;
export class CostSheetParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CostSheetParseError";
    }
}
function decodeEntities(value: string) {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}
function normalizeText(value: string) {
    return decodeEntities(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function blocks(xml: string, tag: string) {
    const expression = new RegExp(`<w:${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:${tag}>`, "g");
    return xml.match(expression) ?? [];
}
function cellText(cellXml: string) {
    const values = Array.from(cellXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g), (match) => match[1]);
    return normalizeText(values.join(""));
}
function tableRows(tableXml: string) {
    return blocks(tableXml, "tr").map((row) => blocks(row, "tc").map(cellText));
}
function findColumn(header: string[], label: string, required = true) {
    const index = header.findIndex((cell) => cell.startsWith(label));
    if (index < 0 && required) {
        throw new CostSheetParseError(`成本明细表缺少“${label}”列`);
    }
    return index;
}
function parseNumber(value: string, label: string) {
    const normalized = value.replace(/,/g, "").replace(/\s*RMB\s*/gi, "").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        throw new CostSheetParseError(`${label}不是有效数字：${value || "空值"}`);
    }
    return parsed;
}
function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function parseDate(value: string, label: string) {
    const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!match)
        throw new CostSheetParseError(`${label}格式无法识别：${value || "空值"}`);
    const [, year, month, day] = match;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const parsed = new Date(`${normalized}T12:00:00+08:00`);
    if (Number.isNaN(parsed.getTime())) {
        throw new CostSheetParseError(`${label}不是有效日期：${value}`);
    }
    const verified = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(parsed);
    if (verified !== normalized)
        throw new CostSheetParseError(`${label}不是有效日期：${value}`);
    return normalized;
}
function findValueAfter(rows: string[][], labelPrefix: string) {
    for (const row of rows) {
        const index = row.findIndex((cell) => cell.startsWith(labelPrefix));
        if (index >= 0 && row[index + 1])
            return row[index + 1];
    }
    return null;
}
function parseTravelDates(value: string | null) {
    if (!value)
        return null;
    const match = value.match(/(\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*[–—-]\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
    if (!match)
        return null;
    return {
        start: parseDate(match[1], "行程开始日期"),
        end: parseDate(match[2], "行程结束日期"),
    };
}
function mapCategory(sourceCategory: string, title: string) {
    if (sourceCategory.includes("酒店")) {
        return {
            section: "hotel" as const,
            category: "hotel" as const,
            bookingStatus: "pending" as const,
            unit: "间夜",
            transportType: null,
        };
    }
    if (sourceCategory.includes("机票") || sourceCategory.includes("航班")) {
        return {
            section: "transport" as const,
            category: "flight" as const,
            bookingStatus: "pending" as const,
            unit: "张",
            transportType: "国内航班",
        };
    }
    if (sourceCategory.includes("高铁") ||
        sourceCategory.includes("火车") ||
        sourceCategory.includes("铁路")) {
        return {
            section: "transport" as const,
            category: "rail" as const,
            bookingStatus: "pending" as const,
            unit: "张",
            transportType: sourceCategory,
        };
    }
    if (sourceCategory.includes("用车") || sourceCategory.includes("车辆") || title.includes("用车")) {
        return {
            section: "daily" as const,
            category: "driver" as const,
            bookingStatus: "not_required" as const,
            unit: "项",
            transportType: null,
        };
    }
    if (sourceCategory.includes("导游") || title.includes("导游")) {
        return {
            section: "daily" as const,
            category: "guide" as const,
            bookingStatus: "not_required" as const,
            unit: "项",
            transportType: null,
        };
    }
    if (sourceCategory.includes("门票") || sourceCategory.includes("景点")) {
        return {
            section: "daily" as const,
            category: "ticket" as const,
            bookingStatus: "pending" as const,
            unit: "张",
            transportType: null,
        };
    }
    return {
        section: "daily" as const,
        category: "other" as const,
        bookingStatus: "not_required" as const,
        unit: "项",
        transportType: null,
    };
}
function mapOperationsCategory(sourceCategory: string) {
    const mappings: Record<string, {
        section: OperationSection;
        category: OperationCategory;
        bookingStatus: BookingStatus;
    }> = {
        "酒店": { section: "hotel", category: "hotel", bookingStatus: "pending" },
        "航班": { section: "transport", category: "flight", bookingStatus: "pending" },
        "高铁": { section: "transport", category: "rail", bookingStatus: "pending" },
        "其他大交通": { section: "transport", category: "other_transport", bookingStatus: "pending" },
        "车辆": { section: "daily", category: "driver", bookingStatus: "pending" },
        "导游": { section: "daily", category: "guide", bookingStatus: "pending" },
        "门票": { section: "daily", category: "ticket", bookingStatus: "pending" },
        "餐饮": { section: "daily", category: "meal", bookingStatus: "pending" },
        "保险": { section: "daily", category: "insurance", bookingStatus: "pending" },
        "其他": { section: "daily", category: "other", bookingStatus: "pending" },
    };
    const mapped = mappings[sourceCategory];
    if (!mapped)
        throw new CostSheetParseError(`不支持的服务类型：${sourceCategory}`);
    return mapped;
}
function parseOperationsTemplate(tables: string[][][], bytes: Uint8Array): OperationCostSheetPreview | null {
    const allRows = tables.flat();
    const templateCode = findValueAfter(allRows, "模板代码");
    if (templateCode !== OPERATIONS_TEMPLATE_CODE)
        return null;
    const templateVersion = findValueAfter(allRows, "模板版本");
    if (templateVersion !== "1")
        throw new CostSheetParseError(`暂不支持服务清单模板版本 ${templateVersion || "空"}`);
    const detailRows = tables.find((rows) => rows[0]?.length === OPERATIONS_TEMPLATE_HEADERS.length && OPERATIONS_TEMPLATE_HEADERS.every((header, index) => rows[0]?.[index] === header));
    if (!detailRows)
        throw new CostSheetParseError("Tripbook 服务清单表头已被修改，请重新下载模板");
    const clientLabel = findValueAfter(allRows, "客户/团名");
    const declaredStart = findValueAfter(allRows, "开始日期");
    const declaredEnd = findValueAfter(allRows, "结束日期");
    const items: OperationCostSheetItem[] = [];
    const daysByNumber = new Map<number, OperationCostSheetDay>();
    const rowKeys = new Set<string>();
    for (const [index, row] of detailRows.slice(1).entries()) {
        if (!row.some(Boolean))
            continue;
        if (row.length !== OPERATIONS_TEMPLATE_HEADERS.length)
            throw new CostSheetParseError(`服务明细第 ${index + 2} 行列数异常或包含合并单元格`);
        const dayNumber = Number(row[2]);
        const serviceDate = parseDate(row[3], `第 ${index + 2} 行开始日期`);
        const endDate = row[4] ? parseDate(row[4], `第 ${index + 2} 行结束日期`) : serviceDate;
        const title = row[7]?.trim();
        const quantity = parseNumber(row[8], `${title || `第 ${index + 2} 行`}数量`);
        const invoiceUnitCost = parseNumber(row[11] || "0", `${title}成本单价`);
        const customerUnitQuote = parseNumber(row[12] || "0", `${title}报价单价`);
        if (!Number.isInteger(dayNumber) || dayNumber < 1)
            throw new CostSheetParseError(`第 ${index + 2} 行 Day 无效`);
        if (!title)
            throw new CostSheetParseError(`第 ${index + 2} 行项目名称为空`);
        if (quantity <= 0 || invoiceUnitCost < 0 || customerUnitQuote < 0)
            throw new CostSheetParseError(`${title}包含不允许的数量或金额`);
        if (endDate < serviceDate)
            throw new CostSheetParseError(`${title}的结束日期早于开始日期`);
        const mapped = mapOperationsCategory(row[6]);
        const rowKey = row[0]?.trim();
        if (!rowKey)
            throw new CostSheetParseError(`第 ${index + 2} 行缺少稳定行标识`);
        if (rowKeys.has(rowKey))
            throw new CostSheetParseError(`服务清单存在重复行标识：${rowKey}`);
        rowKeys.add(rowKey);
        const roomCount = row[18] ? parseNumber(row[18], `${title}间数`) : null;
        if (roomCount != null && (!Number.isInteger(roomCount) || roomCount <= 0))
            throw new CostSheetParseError(`${title}间数必须是正整数`);
        const departureTime = row[16]?.trim() || null;
        if (departureTime && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(departureTime))
            throw new CostSheetParseError(`${title}时间格式无效，请使用 HH:MM`);
        const city = row[5]?.trim() || null;
        const existingDay = daysByNumber.get(dayNumber);
        if (existingDay && existingDay.serviceDate !== serviceDate)
            throw new CostSheetParseError(`Day ${dayNumber} 出现多个开始日期`);
        daysByNumber.set(dayNumber, { dayNumber, serviceDate, city: existingDay?.city || city });
        items.push({
            rowKey,
            dayNumber,
            serviceDate,
            city,
            sourceCategory: row[6],
            section: mapped.section,
            category: mapped.category,
            title,
            details: row[19]?.trim() || null,
            bookingStatus: mapped.bookingStatus,
            quantity,
            unit: row[9]?.trim() || "项",
            invoiceUnitCost,
            customerUnitQuote,
            checkInDate: mapped.category === "hotel" ? serviceDate : null,
            checkOutDate: mapped.category === "hotel" ? endDate : null,
            transportType: mapped.section === "transport" ? row[6] : null,
            origin: row[13]?.trim() || null,
            destination: row[14]?.trim() || null,
            supplierName: row[10]?.trim() || null,
            referenceNumber: row[15]?.trim() || null,
            departureTime,
            roomType: row[17]?.trim() || null,
            roomCount,
            confidence: "high",
            sourceText: row.join(" | "),
        });
    }
    if (!items.length)
        throw new CostSheetParseError("服务清单中没有可导入项目");
    const days = Array.from(daysByNumber.values()).sort((a, b) => a.dayNumber - b.dayNumber);
    const travelStartDate = declaredStart ? parseDate(declaredStart, "开始日期") : days[0].serviceDate;
    const travelEndDate = declaredEnd ? parseDate(declaredEnd, "结束日期") : days.at(-1)!.serviceDate;
    if (travelEndDate < travelStartDate)
        throw new CostSheetParseError("团组结束日期早于开始日期");
    if (items.some((item) => item.serviceDate < travelStartDate || item.serviceDate > travelEndDate))
        throw new CostSheetParseError("服务日期超出团组日期范围");
    const totals = items.reduce((result, item) => ({ cost: result.cost + item.quantity * item.invoiceUnitCost, quote: result.quote + item.quantity * item.customerUnitQuote, grossProfit: 0 }), { cost: 0, quote: 0, grossProfit: 0 });
    totals.cost = roundMoney(totals.cost);
    totals.quote = roundMoney(totals.quote);
    totals.grossProfit = roundMoney(totals.quote - totals.cost);
    return {
        template: "tripbook-operations-service-list-v1",
        format: "structured",
        templateVersion: "1",
        clientLabel,
        travelStartDate,
        travelEndDate,
        declaredItemCount: items.length,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        days,
        items,
        counts: { daily: items.filter((item) => item.section === "daily").length, hotel: items.filter((item) => item.section === "hotel").length, transport: items.filter((item) => item.section === "transport").length },
        totals,
        warnings: items.some((item) => !item.supplierName) ? ["部分服务尚未填写供应商，请由计调补充。"] : [],
        unmatchedLines: [],
    };
}
function parseRoute(title: string, category: OperationCategory) {
    if (category !== "flight" && category !== "rail" && category !== "other_transport") {
        return { origin: null, destination: null };
    }
    const withoutSuffix = title
        .replace(/(?:机票|航班|高铁票|火车票|高铁|火车)\s*$/u, "")
        .trim();
    const match = withoutSuffix.match(/^(.+?)\s*[-–—→]\s*(.+)$/u);
    return match
        ? { origin: match[1].trim(), destination: match[2].trim() }
        : { origin: null, destination: null };
}
function assertDocxBytes(input: Uint8Array) {
    if (input.byteLength === 0)
        throw new CostSheetParseError("文件内容为空");
    if (input.byteLength > MAX_DOCX_BYTES) {
        throw new CostSheetParseError("成本表 DOCX 不能超过 10 MB");
    }
    if (input[0] !== 0x50 || input[1] !== 0x4b) {
        throw new CostSheetParseError("文件不是有效的 DOCX 压缩包");
    }
}
export async function parseOperationCostSheet(input: ArrayBuffer | Uint8Array): Promise<OperationCostSheetPreview> {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    assertDocxBytes(bytes);
    let archive: JSZip;
    try {
        archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
    }
    catch {
        throw new CostSheetParseError("DOCX 文件损坏或无法解压");
    }
    const entries = Object.keys(archive.files);
    if (entries.length > MAX_ARCHIVE_ENTRIES) {
        throw new CostSheetParseError("DOCX 内部文件数量异常，已停止解析");
    }
    if (entries.some((entry) => entry.includes("..") || entry.startsWith("/"))) {
        throw new CostSheetParseError("DOCX 包含不安全的文件路径");
    }
    if (entries.some((entry) => /vbaProject\.bin$/i.test(entry))) {
        throw new CostSheetParseError("不支持包含宏的 Word 文件");
    }
    const documentEntry = archive.file("word/document.xml");
    if (!documentEntry)
        throw new CostSheetParseError("DOCX 缺少 word/document.xml");
    const documentXml = await documentEntry.async("string");
    if (documentXml.length > MAX_DOCUMENT_XML_CHARS) {
        throw new CostSheetParseError("Word 主文档内容过大，已停止解析");
    }
    const tables = blocks(documentXml, "tbl").map(tableRows);
    const operationsTemplate = parseOperationsTemplate(tables, bytes);
    if (operationsTemplate)
        return operationsTemplate;
    const detailRows = tables.find((rows) => {
        const header = rows[0] ?? [];
        return REQUIRED_DETAIL_HEADERS.every((expected) => header.some((cell) => cell.startsWith(expected)));
    });
    if (!detailRows) {
        throw new CostSheetParseError("未找到成本明细表，请确认文件来自内部成本表导出");
    }
    const detailHeader = detailRows[0];
    const columns = {
        date: findColumn(detailHeader, "日期"),
        city: findColumn(detailHeader, "城市", false),
        category: findColumn(detailHeader, "分类"),
        title: findColumn(detailHeader, "中文项目名"),
        quantity: findColumn(detailHeader, "数量"),
        invoiceUnitCost: findColumn(detailHeader, "成本单价"),
        customerUnitQuote: findColumn(detailHeader, "报价单价"),
        costSubtotal: findColumn(detailHeader, "成本小计"),
        quoteSubtotal: findColumn(detailHeader, "报价小计"),
    };
    const lastRequiredColumn = Math.max(columns.date, columns.category, columns.title, columns.quantity, columns.invoiceUnitCost, columns.customerUnitQuote, columns.costSubtotal, columns.quoteSubtotal);
    const allRows = tables.flat();
    const clientLabel = findValueAfter(allRows, "客户 / Client");
    const declaredItemText = findValueAfter(allRows, "项目数量 / Items");
    const declaredItemCount = declaredItemText
        ? parseNumber(declaredItemText, "项目数量")
        : null;
    if (declaredItemCount != null && !Number.isInteger(declaredItemCount)) {
        throw new CostSheetParseError("项目数量必须是整数");
    }
    const declaredTravelDates = parseTravelDates(findValueAfter(allRows, "行程日期 / Travel Dates"));
    const rawItems: Array<{
        serviceDate: string;
        city: string | null;
        sourceCategory: string;
        title: string;
        quantity: number;
        invoiceUnitCost: number;
        customerUnitQuote: number;
    }> = [];
    let currentDate = "";
    let currentCity: string | null = null;
    let declaredTotals: {
        cost: number;
        quote: number;
        grossProfit: number;
    } | null = null;
    for (const [rowOffset, row] of detailRows.slice(1).entries()) {
        if (row.some((cell) => cell.includes("合计 / TOTAL"))) {
            const numericCells = row.slice(-4);
            if (numericCells.length >= 3) {
                declaredTotals = {
                    cost: parseNumber(numericCells[0], "合计成本"),
                    quote: parseNumber(numericCells[1], "合计报价"),
                    grossProfit: parseNumber(numericCells[2], "合计毛利"),
                };
            }
            break;
        }
        if (row.length <= lastRequiredColumn) {
            throw new CostSheetParseError(`第 ${rowOffset + 2} 行列数不足，无法安全导入`);
        }
        if (row[columns.date]) {
            currentDate = parseDate(row[columns.date], "明细日期");
            if (columns.city >= 0 && !row[columns.city])
                currentCity = null;
        }
        if (!currentDate) {
            throw new CostSheetParseError(`第 ${rowOffset + 2} 行缺少日期`);
        }
        if (columns.city >= 0 && row[columns.city])
            currentCity = row[columns.city];
        const sourceCategory = row[columns.category];
        const title = row[columns.title];
        if (!sourceCategory || !title) {
            throw new CostSheetParseError(`第 ${rowOffset + 2} 行缺少分类或中文项目名`);
        }
        const quantity = parseNumber(row[columns.quantity], `${title}数量`);
        const invoiceUnitCost = parseNumber(row[columns.invoiceUnitCost], `${title}成本单价`);
        const customerUnitQuote = parseNumber(row[columns.customerUnitQuote], `${title}报价单价`);
        const sourceCostSubtotal = parseNumber(row[columns.costSubtotal], `${title}成本小计`);
        const sourceQuoteSubtotal = parseNumber(row[columns.quoteSubtotal], `${title}报价小计`);
        if (quantity <= 0 || invoiceUnitCost < 0 || customerUnitQuote < 0) {
            throw new CostSheetParseError(`${title}包含不允许的数量或金额`);
        }
        if (Math.abs(quantity * invoiceUnitCost - sourceCostSubtotal) > MONEY_TOLERANCE ||
            Math.abs(quantity * customerUnitQuote - sourceQuoteSubtotal) > MONEY_TOLERANCE) {
            throw new CostSheetParseError(`${title}的单价与小计不一致`);
        }
        rawItems.push({
            serviceDate: currentDate,
            city: currentCity,
            sourceCategory,
            title,
            quantity,
            invoiceUnitCost,
            customerUnitQuote,
        });
    }
    if (!rawItems.length)
        throw new CostSheetParseError("成本明细表中没有可导入项目");
    if (declaredItemCount != null && declaredItemCount !== rawItems.length) {
        throw new CostSheetParseError(`文件声明 ${declaredItemCount} 项，但实际解析到 ${rawItems.length} 项`);
    }
    const orderedDates = Array.from(new Set(rawItems.map((item) => item.serviceDate)));
    const warnings = new Set<string>();
    const days = orderedDates.map((serviceDate, index) => {
        const cities = Array.from(new Set(rawItems
            .filter((item) => item.serviceDate === serviceDate)
            .map((item) => item.city)
            .filter((city): city is string => Boolean(city))));
        if (cities.length > 1) {
            warnings.add(`${serviceDate}包含多个城市，Day 城市已合并显示，请复核。`);
        }
        return {
            dayNumber: index + 1,
            serviceDate,
            city: cities.length ? cities.join(" / ") : null,
        };
    });
    const dayNumberByDate = new Map(days.map((day) => [day.serviceDate, day.dayNumber]));
    const rowKeyOccurrences = new Map<string, number>();
    const items = rawItems.map((item): OperationCostSheetItem => {
        const mapped = mapCategory(item.sourceCategory, item.title);
        const route = parseRoute(item.title, mapped.category);
        if (mapped.section === "hotel") {
            warnings.add("酒店明细缺少离店日期、房型、间数和晚数，导入后请人工补充。");
        }
        if (mapped.section === "transport") {
            warnings.add("大交通明细缺少航班号/车次和出发时间，导入后请人工补充。");
        }
        if (mapped.category === "other" &&
            !["服务费", "保险"].some((known) => item.sourceCategory.includes(known))) {
            warnings.add(`“${item.sourceCategory}”暂按“其他服务”导入，请复核分类。`);
        }
        const dayNumber = dayNumberByDate.get(item.serviceDate);
        if (!dayNumber)
            throw new CostSheetParseError(`${item.serviceDate}未能建立对应 Day`);
        const rowIdentity = `${item.serviceDate}:${item.sourceCategory}:${item.title}`;
        const occurrence = (rowKeyOccurrences.get(rowIdentity) ?? 0) + 1;
        rowKeyOccurrences.set(rowIdentity, occurrence);
        return {
            rowKey: `${rowIdentity}:${occurrence}`,
            dayNumber,
            serviceDate: item.serviceDate,
            city: item.city,
            sourceCategory: item.sourceCategory,
            section: mapped.section,
            category: mapped.category,
            title: item.title,
            details: item.sourceCategory === item.title ? null : `来源分类：${item.sourceCategory}`,
            bookingStatus: mapped.bookingStatus,
            quantity: item.quantity,
            unit: mapped.unit,
            invoiceUnitCost: item.invoiceUnitCost,
            customerUnitQuote: item.customerUnitQuote,
            checkInDate: mapped.section === "hotel" ? item.serviceDate : null,
            transportType: mapped.transportType,
            origin: route.origin,
            destination: route.destination,
        };
    });
    const totals = items.reduce((result, item) => {
        result.cost += item.quantity * item.invoiceUnitCost;
        result.quote += item.quantity * item.customerUnitQuote;
        return result;
    }, { cost: 0, quote: 0, grossProfit: 0 });
    totals.cost = roundMoney(totals.cost);
    totals.quote = roundMoney(totals.quote);
    totals.grossProfit = roundMoney(totals.quote - totals.cost);
    if (declaredTotals &&
        (Math.abs(declaredTotals.cost - totals.cost) > MONEY_TOLERANCE ||
            Math.abs(declaredTotals.quote - totals.quote) > MONEY_TOLERANCE ||
            Math.abs(declaredTotals.grossProfit - totals.grossProfit) > MONEY_TOLERANCE)) {
        throw new CostSheetParseError("解析后的成本、报价或毛利与文件合计不一致");
    }
    const travelStartDate = declaredTravelDates?.start ?? orderedDates[0];
    const travelEndDate = declaredTravelDates?.end ?? orderedDates.at(-1)!;
    if (!declaredTravelDates) {
        warnings.add("未识别到行程日期范围，已使用明细中的首末日期。");
    }
    if (columns.city < 0) {
        warnings.add("原文件未提供城市列；Day 和服务城市需在导入后补充。");
    }
    else if (rawItems.some((item) => !item.city)) {
        warnings.add("部分明细未填写城市；对应 Day 或服务城市需在导入后补充。");
    }
    if (orderedDates.some((date) => date < travelStartDate || date > travelEndDate)) {
        throw new CostSheetParseError("明细日期超出了文件声明的行程日期范围");
    }
    warnings.add("原文件未提供服务单位；系统按服务类别使用默认单位，请在导入后复核。");
    const counts = {
        daily: items.filter((item) => item.section === "daily").length,
        hotel: items.filter((item) => item.section === "hotel").length,
        transport: items.filter((item) => item.section === "transport").length,
    };
    const contentHash = createHash("sha256")
        .update(JSON.stringify({
        clientLabel,
        travelStartDate,
        travelEndDate,
        days,
        items,
        totals,
    }))
        .digest("hex");
    return {
        template: "tripbook-internal-cost-sheet-v1",
        format: "structured",
        templateVersion: "1",
        clientLabel,
        travelStartDate,
        travelEndDate,
        declaredItemCount,
        contentHash,
        days,
        items,
        counts,
        totals,
        warnings: Array.from(warnings),
        unmatchedLines: [],
    };
}
function genericCategory(line: string) {
    const candidates: Array<[
        RegExp,
        string
    ]> = [
        [/酒店|住宿/, "酒店"], [/航班|机票/, "航班"], [/高铁|火车|动车/, "高铁"],
        [/接机|送机|接站|送站|包车|用车|司机|车辆/, "车辆"], [/导游|司导/, "导游"],
        [/门票|景点|索道|缆车|游船|观光车/, "门票"], [/餐厅|用餐|午餐|晚餐/, "餐饮"], [/保险|保单/, "保险"],
    ] as const;
    return candidates.find(([pattern]) => pattern.test(line))?.[1] ?? null;
}
function genericDate(line: string, year: number) {
    const full = line.match(/(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})日?/);
    if (full)
        return parseDate(`${full[1]}-${full[2]}-${full[3]}`, "服务日期");
    const short = line.match(/(?:^|\s)(\d{1,2})[月/.](\d{1,2})日?(?:\s|$)/);
    return short ? parseDate(`${year}-${short[1]}-${short[2]}`, "服务日期") : null;
}
function genericEndDate(line: string, year: number) {
    const fullRange = line.match(/\d{4}[年/.\-]\d{1,2}[月/.\-]\d{1,2}日?\s*(?:至|到|[-–—~～])\s*(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})日?/);
    if (fullRange)
        return parseDate(`${fullRange[1]}-${fullRange[2]}-${fullRange[3]}`, "服务结束日期");
    const shortRange = line.match(/\d{1,2}[月/.]\d{1,2}日?\s*(?:至|到|[-–—~～])\s*(\d{1,2})[月/.](\d{1,2})日?/);
    return shortRange ? parseDate(`${year}-${shortRange[1]}-${shortRange[2]}`, "服务结束日期") : null;
}
function parseLegacyText(text: string, bytes: Uint8Array): OperationCostSheetPreview {
    const lines = text.replace(/\r/g, "").split("\n").map((line) => normalizeText(line)).filter(Boolean);
    const year = Number(lines.join(" ").match(/20\d{2}/)?.[0] ?? new Date().getFullYear());
    const raw: Array<{
        line: string;
        date: string;
        endDate: string | null;
        type: string;
    }> = [];
    const unmatchedLines: string[] = [];
    let currentDate: string | null = null;
    for (const line of lines) {
        currentDate = genericDate(line, year) ?? currentDate;
        const type = genericCategory(line);
        if (type && currentDate)
            raw.push({ line, date: currentDate, endDate: genericEndDate(line, year), type });
        else if (line.length > 3 && !/客户|人数|路线|服务清单|备注|日期/.test(line))
            unmatchedLines.push(line);
    }
    if (!raw.length)
        throw new CostSheetParseError("自由格式文件未识别到同时包含日期和服务类型的项目；请改用 Tripbook 计调服务清单 v1");
    const dates = Array.from(new Set(raw.map((entry) => entry.date))).sort();
    const dayByDate = new Map(dates.map((date, index) => [date, index + 1]));
    const items = raw.map((entry, index): OperationCostSheetItem => {
        const mapped = mapOperationsCategory(entry.type);
        const amountMatches = Array.from(entry.line.matchAll(/(?:¥|￥|RMB\s*)?([0-9]+(?:\.[0-9]+)?)/gi)).map((match) => Number(match[1]));
        const cleaned = entry.line.replace(/20\d{2}[年/.\-]\d{1,2}[月/.\-]\d{1,2}日?/g, "").replace(/(?:^|\s)\d{1,2}[月/.]\d{1,2}日?/g, "").trim();
        return {
            rowKey: `legacy:${entry.date}:${index + 1}:${createHash("sha1").update(entry.line).digest("hex").slice(0, 10)}`,
            dayNumber: dayByDate.get(entry.date)!, serviceDate: entry.date, city: null, sourceCategory: entry.type,
            section: mapped.section, category: mapped.category, title: cleaned || entry.type, details: "由自由格式兼容解析生成，请人工复核",
            bookingStatus: mapped.bookingStatus, quantity: 1, unit: "项", invoiceUnitCost: amountMatches.at(-2) ?? 0, customerUnitQuote: amountMatches.at(-1) ?? 0,
            checkInDate: mapped.category === "hotel" ? entry.date : null, checkOutDate: mapped.category === "hotel" ? entry.endDate : null, transportType: mapped.section === "transport" ? entry.type : null,
            origin: null, destination: null, confidence: amountMatches.length ? "medium" : "low", sourceText: entry.line,
        };
    });
    const totals = items.reduce((sum, item) => ({ cost: sum.cost + item.invoiceUnitCost, quote: sum.quote + item.customerUnitQuote, grossProfit: 0 }), { cost: 0, quote: 0, grossProfit: 0 });
    totals.grossProfit = roundMoney(totals.quote - totals.cost);
    return {
        template: "legacy-freeform-v1", format: "legacy", templateVersion: "1", clientLabel: null,
        travelStartDate: dates[0], travelEndDate: dates.at(-1)!, declaredItemCount: null,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        days: dates.map((serviceDate, index) => ({ dayNumber: index + 1, serviceDate, city: null })), items,
        counts: { daily: items.filter((item) => item.section === "daily").length, hotel: items.filter((item) => item.section === "hotel").length, transport: items.filter((item) => item.section === "transport").length },
        totals, warnings: ["当前文件使用自由格式兼容解析；请逐项核对低置信度项目和未匹配内容。"], unmatchedLines,
    };
}
export async function parseOperationServiceList(input: ArrayBuffer | Uint8Array, filename: string) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (filename.toLowerCase().endsWith(".txt"))
        return parseLegacyText(new TextDecoder("utf-8").decode(bytes), bytes);
    try {
        return await parseOperationCostSheet(bytes);
    }
    catch (error) {
        const archive = await JSZip.loadAsync(bytes);
        const xml = await archive.file("word/document.xml")?.async("string");
        if (!xml)
            throw error;
        if (xml.includes(OPERATIONS_TEMPLATE_CODE))
            throw error;
        const paragraphs = blocks(xml, "p").map(cellText).filter(Boolean).join("\n");
        return parseLegacyText(paragraphs, bytes);
    }
}
