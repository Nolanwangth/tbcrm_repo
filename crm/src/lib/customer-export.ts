import ExcelJS from "exceljs";
import type { Customer } from "@/lib/types";
type ExportValue = string | number | boolean | Date | null;
type ExportColumn = {
    header: string;
    width: number;
    kind?: "date" | "dateOnly" | "currency" | "integer" | "percent" | "text";
};
const COLORS = {
    header: "FF172033",
    headerText: "FFFFFFFF",
    border: "FFE2E8F0",
    alternate: "FFF8FAFC",
    text: "FF1E293B",
    muted: "FF64748B",
};
const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
function text(value: unknown) {
    if (value == null || value === "")
        return null;
    return String(value);
}
function date(value?: string | null) {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? null
        : new Date(parsed.getTime() + CHINA_UTC_OFFSET_MS);
}
function folderPath(customer: Customer, folderId: string | null) {
    if (!folderId)
        return "根目录";
    const folders = new Map((customer.folders ?? []).map((folder) => [folder.id, folder]));
    const names: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null = folderId;
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const folder = folders.get(currentId);
        if (!folder)
            break;
        names.unshift(folder.name);
        currentId = folder.parentId;
    }
    return names.length ? names.join(" / ") : "根目录";
}
function addSheet(workbook: ExcelJS.Workbook, name: string, columns: ExportColumn[], rows: ExportValue[][]) {
    const sheet = workbook.addWorksheet(name, {
        views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
        properties: { defaultRowHeight: 21 },
    });
    sheet.columns = columns.map((column) => ({
        header: column.header,
        key: column.header,
        width: column.width,
    }));
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
    };
    const header = sheet.getRow(1);
    header.height = 28;
    header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
        cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = { bottom: { style: "thin", color: { argb: COLORS.header } } };
    });
    rows.forEach((values, rowIndex) => {
        const row = sheet.addRow(values);
        row.height = 24;
        row.eachCell({ includeEmpty: true }, (cell, columnIndex) => {
            const column = columns[columnIndex - 1];
            cell.font = { color: { argb: COLORS.text }, size: 10 };
            cell.alignment = {
                vertical: "middle",
                horizontal: column.kind === "currency" || column.kind === "integer" || column.kind === "percent" ? "right" : "left",
                wrapText: column.kind === "text",
            };
            cell.border = { bottom: { style: "hair", color: { argb: COLORS.border } } };
            if (rowIndex % 2 === 1) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.alternate } };
            }
            if (column.kind === "date" && cell.value instanceof Date)
                cell.numFmt = "yyyy-mm-dd hh:mm";
            if (column.kind === "dateOnly" && cell.value instanceof Date)
                cell.numFmt = "yyyy-mm-dd";
            if (column.kind === "currency" && typeof cell.value === "number")
                cell.numFmt = '¥#,##0.00';
            if (column.kind === "integer" && typeof cell.value === "number")
                cell.numFmt = "0";
            if (column.kind === "percent" && typeof cell.value === "number")
                cell.numFmt = "0.0%";
        });
    });
    if (!rows.length) {
        const emptyRow = sheet.addRow(["暂无记录"]);
        emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.muted } };
    }
    return sheet;
}
export async function buildCustomerExport(customers: Customer[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Tripbook CRM";
    workbook.company = "Tripbook";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = false;
    addSheet(workbook, "客户概览", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "来源渠道", width: 18 },
        { header: "具体来源", width: 20 },
        { header: "转介绍人", width: 18 },
        { header: "合作方", width: 18 },
        { header: "国籍", width: 14 },
        { header: "客户联系方式", width: 28, kind: "text" },
        { header: "沟通方式", width: 18 },
        { header: "客户画像", width: 14 },
        { header: "首次询单时间", width: 19, kind: "date" },
        { header: "当前等级", width: 12 },
        { header: "系统建议等级", width: 14 },
        { header: "优先级", width: 12 },
        { header: "沟通状态", width: 20 },
        { header: "客户整体状态", width: 16 },
        { header: "业务阶段", width: 14 },
        { header: "行程状态", width: 16 },
        { header: "行程状态更新时间", width: 19, kind: "date" },
        { header: "报价状态", width: 16 },
        { header: "报价状态更新时间", width: 19, kind: "date" },
        { header: "预计金额区间", width: 16 },
        { header: "预计具体金额", width: 16, kind: "currency" },
        { header: "成交总金额", width: 16, kind: "currency" },
        { header: "成交日期", width: 16, kind: "dateOnly" },
        { header: "关闭时间", width: 19, kind: "date" },
        { header: "关闭原因", width: 20 },
        { header: "最近跟进时间", width: 19, kind: "date" },
        { header: "最新跟进总结", width: 42, kind: "text" },
        { header: "创建时间", width: 19, kind: "date" },
        { header: "最近更新时间", width: 19, kind: "date" },
    ], customers.map((customer) => [
        customer.id,
        customer.name,
        customer.source,
        text(customer.sourceDetail),
        text(customer.referrerName),
        text(customer.partnerName),
        text(customer.nationality),
        text(customer.contact),
        customer.whatsappStatus,
        customer.profile,
        date(customer.firstInquiryAt),
        customer.level,
        customer.systemSuggestedLevel,
        customer.priority,
        customer.communicationStatus,
        customer.status,
        customer.businessStage,
        customer.itineraryStatus,
        date(customer.itineraryStatusUpdatedAt),
        customer.quotationStatus,
        date(customer.quotationStatusUpdatedAt),
        text(customer.amountRange),
        customer.expectedAmount ?? null,
        customer.wonAmount ?? null,
        date(customer.wonAt),
        date(customer.closedAt),
        text(customer.closeReason),
        date(customer.latestFollowUpAt),
        text(customer.latestFollowUpSummary),
        date(customer.createdAt),
        date(customer.updatedAt),
    ]));
    addSheet(workbook, "旅行需求", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "预计开始日期", width: 16 },
        { header: "预计结束日期", width: 16 },
        { header: "模糊出行时间", width: 20 },
        { header: "出行人数", width: 14 },
        { header: "旅行天数", width: 14 },
        { header: "目的地", width: 24, kind: "text" },
        { header: "国际机票情况", width: 24 },
        { header: "酒店安排情况", width: 24 },
        { header: "服务类型", width: 14 },
        { header: "国内交通预订情况", width: 34 },
        { header: "特殊需求或补充说明", width: 48, kind: "text" },
        { header: "时间明确度", width: 14 },
        { header: "人数明确度", width: 14 },
        { header: "目的地明确度", width: 16 },
        { header: "天数明确度", width: 14 },
    ], customers.map((customer) => [
        customer.id,
        customer.name,
        text(customer.travelNeed.expectedStartDate),
        text(customer.travelNeed.expectedEndDate),
        text(customer.travelNeed.fuzzyTravelTime),
        text(customer.travelNeed.travelerCount),
        text(customer.travelNeed.travelDays),
        text(customer.travelNeed.destinations),
        text(customer.travelNeed.flightStatus),
        text(customer.travelNeed.hotelStatus),
        text(customer.travelNeed.serviceType),
        text(customer.travelNeed.domesticTransportStatus),
        text(customer.travelNeed.specialRequirements),
        text(customer.travelNeed.timeClarity),
        text(customer.travelNeed.peopleClarity),
        text(customer.travelNeed.destinationClarity),
        text(customer.travelNeed.daysClarity),
    ]));
    addSheet(workbook, "首次评分", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "评分版本", width: 12 },
        { header: "总分", width: 10, kind: "integer" },
        { header: "建议等级", width: 12 },
        { header: "确认等级", width: 12 },
        { header: "可评分项目", width: 12, kind: "integer" },
        { header: "总项目", width: 10, kind: "integer" },
        { header: "可计算比例", width: 14, kind: "percent" },
        { header: "S级必要条件满足", width: 18 },
        { header: "S级必要条件说明", width: 40, kind: "text" },
        { header: "出行准备度", width: 14, kind: "integer" },
        { header: "沟通有效性", width: 14, kind: "integer" },
        { header: "需求明确度", width: 14, kind: "integer" },
        { header: "客户画像", width: 12, kind: "integer" },
        { header: "预计金额", width: 12, kind: "integer" },
    ], customers.map((customer) => [
        customer.id,
        customer.name,
        customer.score.scoringVersion,
        customer.score.totalScore,
        customer.score.suggestedLevel,
        customer.score.confirmedLevel,
        customer.score.filledItemCount,
        customer.score.totalItemCount,
        customer.score.calculableRatio,
        customer.score.sEligible ? "是" : "否",
        customer.score.sEligibilityReasons.join("；") || null,
        customer.score.breakdown.travelReadiness,
        customer.score.breakdown.communication,
        customer.score.breakdown.demandClarity,
        customer.score.breakdown.profile,
        customer.score.breakdown.amount,
    ]));
    addSheet(workbook, "跟进记录", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "跟进记录ID", width: 38 },
        { header: "沟通状态", width: 20 },
        { header: "跟进总结", width: 60, kind: "text" },
        { header: "距离上一条", width: 18 },
        { header: "创建时间", width: 19, kind: "date" },
        { header: "最后修改时间", width: 19, kind: "date" },
    ], customers.flatMap((customer) => customer.followUps.map((followUp) => [
        customer.id,
        customer.name,
        followUp.id,
        followUp.communicationStatus,
        followUp.summary,
        text(followUp.previousInterval),
        date(followUp.createdAt),
        date(followUp.updatedAt),
    ])));
    addSheet(workbook, "行程报价记录", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "记录ID", width: 38 },
        { header: "类型", width: 12 },
        { header: "当时状态", width: 18 },
        { header: "制作或修改要求", width: 64, kind: "text" },
        { header: "记录时间", width: 19, kind: "date" },
    ], customers.flatMap((customer) => customer.planningRequests.map((request) => [
        customer.id,
        customer.name,
        request.id,
        request.requestType === "itinerary" ? "行程" : "报价",
        request.status,
        text(request.content),
        date(request.createdAt),
    ])));
    addSheet(workbook, "资料修改历史", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "修改记录ID", width: 38 },
        { header: "字段", width: 24 },
        { header: "修改前", width: 48, kind: "text" },
        { header: "修改后", width: 48, kind: "text" },
        { header: "修改时间", width: 19, kind: "date" },
    ], customers.flatMap((customer) => customer.auditLogs.map((log) => [
        customer.id,
        customer.name,
        log.id,
        log.fieldName,
        text(log.oldValue),
        text(log.newValue),
        date(log.changedAt),
    ])));
    addSheet(workbook, "等级变化历史", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "等级记录ID", width: 38 },
        { header: "原等级", width: 12 },
        { header: "新等级", width: 12 },
        { header: "变更时间", width: 19, kind: "date" },
    ], customers.flatMap((customer) => customer.levelChanges.map((change) => [
        customer.id,
        customer.name,
        change.id,
        text(change.fromLevel),
        change.toLevel,
        date(change.changedAt),
    ])));
    addSheet(workbook, "文件与文件夹", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "节点类型", width: 12 },
        { header: "节点ID", width: 38 },
        { header: "名称", width: 32 },
        { header: "所在路径", width: 46, kind: "text" },
        { header: "审核状态", width: 14 },
        { header: "文件夹状态", width: 16 },
        { header: "文件大小（字节）", width: 18, kind: "integer" },
        { header: "文件类型", width: 24 },
        { header: "创建时间", width: 19, kind: "date" },
    ], customers.flatMap((customer) => [
        ...(customer.folders ?? []).map((folder) => [
            customer.id,
            customer.name,
            "文件夹",
            folder.id,
            folder.name,
            folderPath(customer, folder.parentId),
            folder.reviewStatus,
            folder.status,
            null,
            null,
            date(folder.createdAt),
        ]),
        ...(customer.files ?? []).map((file) => [
            customer.id,
            customer.name,
            "文件",
            file.id,
            file.name,
            folderPath(customer, file.folderId),
            null,
            null,
            file.sizeBytes,
            text(file.mimeType),
            date(file.createdAt),
        ]),
    ]));
    addSheet(workbook, "文件夹状态历史", [
        { header: "客户ID", width: 38 },
        { header: "客户名称", width: 20 },
        { header: "文件夹ID", width: 38 },
        { header: "文件夹路径", width: 46, kind: "text" },
        { header: "原状态", width: 14 },
        { header: "新状态", width: 14 },
        { header: "修改时间", width: 19, kind: "date" },
    ], customers.flatMap((customer) => (customer.folders ?? []).flatMap((folder) => folder.statusHistory.map((history) => [
        customer.id,
        customer.name,
        folder.id,
        `${folderPath(customer, folder.parentId)} / ${folder.name}`.replace(/^根目录 \//, ""),
        history.oldStatus,
        history.newStatus,
        date(history.changedAt),
    ]))));
    return workbook.xlsx.writeBuffer();
}
