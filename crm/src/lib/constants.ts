export const CUSTOMER_LEVELS = ["S", "A", "B", "C"] as const;
export const SERVICE_WORKBENCHES = ["A", "B", "C", "D", "E"] as const;
export const SERVICE_ASSIGNMENT_MODES = ["round_robin", "exclusive"] as const;
export const CUSTOMER_STATUSES = ["跟进中", "已成交", "已关闭"] as const;
export const BUSINESS_STAGES = ["沟通中", "制作中"] as const;
export const ITINERARY_STATUSES = ["暂不需要", "未出行程", "已出行程", "行程待修改"] as const;
export const QUOTATION_STATUSES = ["暂不需要", "未出报价", "已出报价", "报价待修改"] as const;
export const PLANNING_REQUEST_TYPES = ["itinerary", "quotation"] as const;
export const FOLDER_STATUSES = ["待发送", "已发送", "需修改", "最终版"] as const;
export const FOLDER_REVIEW_STATUSES = ["待审核", "已审核"] as const;
export const ITINERARY_PENDING_STATUSES = ["未出行程", "行程待修改"] as const;
export const QUOTATION_PENDING_STATUSES = ["未出报价", "报价待修改"] as const;
export const PRIORITIES = ["需立即处理", "紧急", "高", "中", "低"] as const;
export const WHATSAPP_STATUSES = ["未添加", "已添加邮箱", "已添加微信", "已添加whatsapp"] as const;
export const COMMUNICATION_STATUSES = [
    "待首次跟进",
    "客户已回复，待我方处理",
    "我方已回复，等待客户",
    "客户未读",
    "客户已读未回",
    "客户暂缓决定",
] as const;
export const SOURCES = [
    "Instagram 自然",
    "Instagram 广告",
    "直加",
    "Facebook 自然",
    "Facebook 广告",
    "转介绍",
    "B2B",
    "TikTok",
    "YouTube",
    "邮箱",
    "官网",
    "公众号",
    "其他",
] as const;
export const PROFILES = ["家庭", "情侣", "朋友", "个人", "未确定"] as const;
export const AMOUNT_RANGES = [
    "1万元以下",
    "1万至3万元",
    "3万至5万元",
    "5万至10万元",
    "10万元以上",
] as const;
export const FLIGHT_STATUSES = [
    "已购买",
    "日期已定，但暂未购买",
    "日期尚未确定",
    "未知",
] as const;
export const HOTEL_STATUSES = [
    "已自行安排",
    "需要我们安排酒店",
    "已基本选定，暂未预订",
    "尚未确定",
    "未知",
] as const;
export const SERVICE_TYPES = ["全托管", "拼接", "单项"] as const;
export const DOMESTIC_TRANSPORT_STATUSES = [
    "已自行安排",
    "需要我们安排",
    "部分已安排，部分需要我们安排",
    "尚未确定",
    "未知",
] as const;
export const CLARITY_LEVELS = ["明确", "大致明确", "未确定"] as const;
export const COMMUNICATION_EFFECTIVENESS = ["沟通积极", "沟通一般", "沟通较弱"] as const;
export const CLOSE_REASONS = [
    "连续两次已读未回",
    "客户明确表示不购买",
    "客户已选择其他公司",
    "客户取消出行计划",
    "联系方式无效",
    "重复客户",
    "无效或虚假询单",
    "其他",
] as const;
export const DELETE_REASONS = ["录入错误", "测试数据", "重复客户"] as const;
export function deriveBusinessStage(itineraryStatus: string, quotationStatus: string) {
    return itineraryStatus === "暂不需要" && quotationStatus === "暂不需要" ? "沟通中" : "制作中";
}
export function amountRangeFromValue(value?: number | null) {
    if (value == null || Number.isNaN(value))
        return null;
    if (value < 10000)
        return "1万元以下";
    if (value < 30000)
        return "1万至3万元";
    if (value < 50000)
        return "3万至5万元";
    if (value < 100000)
        return "5万至10万元";
    return "10万元以上";
}
