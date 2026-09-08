import { describe, expect, it } from "vitest";
import { applyTravelServiceFee, buildGuideInvoiceDescription, buildVehicleInvoiceDescription, cityEnglish, serviceHoursSuffix, vehicleLabel, } from "./invoiceDescription";
describe("invoice descriptions", () => {
    it("uses the standard private transfer wording and default service hours", () => {
        expect(buildVehicleInvoiceDescription({
            city: "张家界",
            seats: "5",
            customVehicle: "",
            serviceType: "private-transfer",
            serviceHours: "",
        })).toBe("Zhangjiajie private transfer service with 5-seat vehicle (Service hours: 8 hrs/day)");
    });
    it("supports pickup wording without service hours", () => {
        expect(buildVehicleInvoiceDescription({
            city: "北京",
            seats: "7",
            customVehicle: "",
            serviceType: "airport-pickup",
            serviceHours: "10 hrs/day",
        })).toBe("Beijing airport pick-up service with 7-seat vehicle");
    });
    it("supports custom vehicle names and replacement service hours", () => {
        expect(vehicleLabel("", "Mercedes-Benz Sprinter")).toBe("Mercedes-Benz Sprinter");
        expect(serviceHoursSuffix("10 hrs/day")).toBe("(Service hours: 10 hrs/day)");
        expect(buildGuideInvoiceDescription("成都", "English", "6 hrs/day"))
            .toBe("One-day English tour guide service in Chengdu (Service hours: 6 hrs/day)");
    });
    it("rounds the optional five percent fee upward", () => {
        expect(applyTravelServiceFee(1001, true)).toBe(1052);
        expect(applyTravelServiceFee(1001, false)).toBe(1001);
    });
    it("uses stored city translations before the pinyin fallback", () => {
        expect(cityEnglish("西安")).toBe("Xi'an");
        expect(cityEnglish("芙蓉镇")).toBe("Furong Town");
    });
    it("transliterates unknown cities and translates common place suffixes", () => {
        expect(cityEnglish("凤凰古城")).toBe("Fenghuang Ancient Town");
        expect(cityEnglish("乌鲁木齐")).toBe("Wulumuqi");
        expect(cityEnglish("测试县")).toBe("Ceshi County");
    });
});
