import { describe, expect, it } from "vitest";
import { dateMinusDays, operationAttachmentFolderName, operationFinancials, operationPhase, reminderMatchesTimingFilter, validateOperationReminder, type OperationReminder, type OperationServiceItem, } from "@/lib/operations";
const item = (input: Partial<OperationServiceItem> = {}): OperationServiceItem => ({
    id: crypto.randomUUID(),
    caseId: "case",
    dayId: null,
    section: "hotel",
    category: "hotel",
    title: "酒店",
    details: null,
    city: "北京",
    serviceDate: "2026-08-20",
    bookingStatus: "pending",
    supplierName: null,
    quantity: 2,
    unit: "间夜",
    invoiceUnitCost: 600,
    customerUnitQuote: 900,
    finalSupplierSettlement: null,
    finalCustomerSettlement: null,
    confirmationFileId: null,
    invoiceFileId: null,
    checkInDate: null,
    checkOutDate: null,
    roomType: null,
    roomCount: null,
    nightCount: null,
    transportType: null,
    origin: null,
    destination: null,
    referenceNumber: null,
    departureTime: null,
    notes: null,
    sortOrder: 0,
    ...input,
});
const reminder = (input: Partial<OperationReminder> = {}): OperationReminder => ({
    id: crypto.randomUUID(),
    caseId: "case",
    dayId: null,
    serviceItemId: null,
    title: "确认预订",
    dueDate: "2026-08-23",
    anchorType: "service",
    offsetDays: 7,
    autoKey: "case:service:v1:confirm",
    isAuto: true,
    status: "pending",
    completedAt: null,
    taskKind: "checklist",
    templateKey: "confirm",
    templateVersion: "v1",
    assigneeUserId: null,
    assigneeName: null,
    isCustomized: false,
    ...input,
});
describe("计调状态", () => {
    it("缺少日期时归入日期不完整", () => {
        expect(operationPhase({ arrivalDate: null, departureDate: null, items: [] }, "2026-08-01"))
            .toBe("date_incomplete");
    });
    it("尚未抵达且存在待预订项目时归入处理中", () => {
        expect(operationPhase({
            arrivalDate: "2026-08-20",
            departureDate: "2026-08-30",
            items: [item()],
        }, "2026-08-01")).toBe("processing");
    });
    it("尚未录入任何预订项目时仍归入处理中，而不是误判为预订完成", () => {
        expect(operationPhase({
            arrivalDate: "2026-08-20",
            departureDate: "2026-08-30",
            items: [],
        }, "2026-08-01")).toBe("processing");
    });
    it("预订完成后归入待接待，到达后进入服务中，离境后结束", () => {
        const operation = {
            arrivalDate: "2026-08-20",
            departureDate: "2026-08-30",
            items: [item({ bookingStatus: "confirmed", confirmationFileId: "file" })],
        };
        expect(operationPhase(operation, "2026-08-01")).toBe("waiting");
        expect(operationPhase(operation, "2026-08-20")).toBe("in_service");
        expect(operationPhase(operation, "2026-08-31")).toBe("completed");
    });
});
describe("计调财务", () => {
    it("计算预计成本、客户报价、毛利和毛利率", () => {
        expect(operationFinancials([item()])).toMatchObject({
            expectedCost: 1200,
            expectedRevenue: 1800,
            expectedGrossProfit: 600,
            expectedMarginRate: 1 / 3,
            finalComplete: false,
        });
    });
    it("录入双方最终结算后计算最终毛利", () => {
        expect(operationFinancials([
            item({ finalSupplierSettlement: 1100, finalCustomerSettlement: 1800 }),
        ])).toMatchObject({
            finalCost: 1100,
            finalRevenue: 1800,
            finalGrossProfit: 700,
            finalMarginRate: 700 / 1800,
            finalComplete: true,
        });
    });
    it("只要仍有服务未录入最终结算，就不提前显示最终毛利", () => {
        expect(operationFinancials([
            item({ finalSupplierSettlement: 1100, finalCustomerSettlement: 1800 }),
            item({
                invoiceUnitCost: null,
                customerUnitQuote: null,
                finalSupplierSettlement: null,
                finalCustomerSettlement: null,
            }),
        ])).toMatchObject({
            finalCost: 1100,
            finalRevenue: 1800,
            finalGrossProfit: null,
            finalMarginRate: null,
            finalComplete: false,
        });
    });
});
describe("提醒日期", () => {
    it("按中国日期计算提前天数", () => {
        expect(dateMinusDays("2026-08-20", 15)).toBe("2026-08-05");
    });
    it("固定日期提醒缺少日期时给出明确错误，日期完整时允许提交", () => {
        expect(validateOperationReminder({
            title: "确认酒店",
            anchorType: "fixed",
            dueDate: "",
        })).toBe("请选择提醒日期");
        expect(validateOperationReminder({
            title: "确认酒店",
            anchorType: "fixed",
            dueDate: "2026-08-05",
        })).toBeNull();
    });
    it("关联服务提醒校验服务和日期", () => {
        expect(validateOperationReminder({
            title: "预订提醒",
            anchorType: "service",
            serviceItemId: "",
            offsetDays: 7,
        })).toBe("请选择关联服务");
        expect(validateOperationReminder({
            title: "预订提醒",
            anchorType: "service",
            serviceItemId: "service-1",
            serviceDate: "2026-08-20",
            offsetDays: 7,
        })).toBeNull();
    });
    it("未来七天只包含今天之后七日内的待处理任务", () => {
        expect(reminderMatchesTimingFilter(reminder(), "next7", "2026-08-20", "2026-08-27"))
            .toBe(true);
        expect(reminderMatchesTimingFilter(reminder({ dueDate: "2026-08-28" }), "next7", "2026-08-20", "2026-08-27")).toBe(false);
        expect(reminderMatchesTimingFilter(reminder({ dueDate: "2026-08-23", status: "completed" }), "next7", "2026-08-20", "2026-08-27")).toBe(false);
    });
    it("日期待确认和全部未来保持独立筛选语义", () => {
        expect(reminderMatchesTimingFilter(reminder({ dueDate: null }), "date_pending", "2026-08-20")).toBe(true);
        expect(reminderMatchesTimingFilter(reminder({ dueDate: "2026-09-20" }), "upcoming", "2026-08-20")).toBe(true);
    });
});
describe("计调附件目录", () => {
    it("使用服务日期和名称生成目录，并清理路径分隔符与换行", () => {
        expect(operationAttachmentFolderName("2026-08-06", "北京/接机\n服务"))
            .toBe("2026-08-06-北京-接机 服务");
    });
    it("缺少日期和名称时使用明确占位名称", () => {
        expect(operationAttachmentFolderName(null, "")).toBe("日期待补充-未命名服务");
    });
});
