import { describe, expect, it } from "vitest";
import { financeClaimPaymentSummary, operationItemClaimBaseAmount, validateFinanceClaimInput, validateFinancePayment, } from "@/lib/finance";
describe("报账金额", () => {
    it("优先使用最终供应商结算金额", () => {
        expect(operationItemClaimBaseAmount({
            finalSupplierSettlement: 1180,
            invoiceUnitCost: 600,
            quantity: 2,
        })).toBe(1180);
    });
    it("没有最终结算时使用发票单价乘数量", () => {
        expect(operationItemClaimBaseAmount({
            finalSupplierSettlement: null,
            invoiceUnitCost: 600,
            quantity: 2,
        })).toBe(1200);
    });
    it("汇总多次付款并计算剩余金额", () => {
        expect(financeClaimPaymentSummary({
            amount: 1200,
            payments: [
                { amount: 500 },
                { amount: 300 },
            ],
        })).toEqual({ paid: 800, remaining: 400 });
    });
});
describe("费用申请类型", () => {
    it("个人垫付报销只要求收款方", () => {
        expect(validateFinanceClaimInput({
            claimType: "personal_reimbursement",
            payeeName: "张导",
            selectedItems: [{ supplierName: null }],
        })).toBeNull();
    });
    it("供应商付款必须由同一供应商构成且收款方一致", () => {
        expect(validateFinanceClaimInput({
            claimType: "supplier_payment",
            payeeName: "甲酒店",
            selectedItems: [{ supplierName: "甲酒店" }, { supplierName: "乙车队" }],
        })).toBe("一张供应商付款申请不能混合不同供应商");
        expect(validateFinanceClaimInput({
            claimType: "supplier_payment",
            payeeName: "乙酒店",
            selectedItems: [{ supplierName: "甲酒店" }],
        })).toBe("收款方必须与所选服务项目的供应商一致");
    });
});
describe("付款登记", () => {
    const valid = {
        amount: 500,
        remaining: 1000,
        paidAt: "2026-08-05T10:00",
        paidByName: "王财务",
        hasReceipt: true,
    };
    it("要求付款时间、经办人和回执", () => {
        expect(validateFinancePayment({ ...valid, paidAt: "" })).toBe("请选择付款时间");
        expect(validateFinancePayment({ ...valid, paidByName: "" })).toBe("请填写财务经办人");
        expect(validateFinancePayment({ ...valid, hasReceipt: false })).toBe("请上传付款回执");
    });
    it("阻止超额付款", () => {
        expect(validateFinancePayment({ ...valid, amount: 1001 })).toBe("付款金额不能超过剩余待付金额");
    });
    it("允许一次付清或分批付款", () => {
        expect(validateFinancePayment(valid)).toBeNull();
        expect(validateFinancePayment({ ...valid, amount: 1000 })).toBeNull();
    });
});
