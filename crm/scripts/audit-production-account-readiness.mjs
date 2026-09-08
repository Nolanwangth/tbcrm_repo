import { createClient } from "@supabase/supabase-js";
const officialNames = ["张栩杰", "徐晨雷", "蔡觐阳", "黄楚乔", "高苑博"];
const HOUR = 60 * 60 * 1000;
async function main() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error("缺少 Supabase 服务端配置");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    let customers = [];
    for (let from = 0;; from += 1000) {
        const { data, error } = await supabase
            .from("customers")
            .select("id,assignee,status,itinerary_status,quotation_status,itinerary_status_updated_at,quotation_status_updated_at,follow_ups(updated_at)")
            .range(from, from + 999);
        if (error)
            throw new Error(`读取客户失败：${error.message}`);
        customers.push(...(data ?? []));
        if (!data || data.length < 1000)
            break;
    }
    const now = Date.now();
    const owners = {};
    let adminOverdue = 0;
    for (const customer of customers) {
        const owner = String(customer.assignee ?? "").trim() || "（未分配）";
        const item = owners[owner] ?? { total: 0, active: 0, overdueDDL: 0 };
        item.total += 1;
        if (customer.status === "跟进中") {
            item.active += 1;
            let overdue = 0;
            if (["未出行程", "行程待修改"].includes(customer.itinerary_status) && now >= new Date(customer.itinerary_status_updated_at).getTime() + 24 * HOUR)
                overdue += 1;
            if (["未出报价", "报价待修改"].includes(customer.quotation_status) && now >= new Date(customer.quotation_status_updated_at).getTime() + 48 * HOUR)
                overdue += 1;
            if (customer.quotation_status === "已出报价") {
                const latestFollowUp = (customer.follow_ups ?? []).reduce((latest, followUp) => Math.max(latest, new Date(followUp.updated_at).getTime()), 0);
                const anchor = latestFollowUp || new Date(customer.quotation_status_updated_at).getTime();
                if (now >= anchor + 48 * HOUR)
                    overdue += 1;
            }
            item.overdueDDL += overdue;
            adminOverdue += overdue;
        }
        owners[owner] = item;
    }
    const { error: usersError } = await supabase.from("crm_users").select("id").limit(1);
    console.log(JSON.stringify({
        auditedAt: new Date(now).toISOString(),
        customerCount: customers.length,
        officialOwners: Object.fromEntries(officialNames.map((name) => [name, owners[name] ?? { total: 0, active: 0, overdueDDL: 0 }])),
        unassigned: owners["（未分配）"] ?? { total: 0, active: 0, overdueDDL: 0 },
        unmatchedOwners: Object.fromEntries(Object.entries(owners).filter(([name]) => name !== "（未分配）" && !officialNames.includes(name))),
        adminOverdueDDL: adminOverdue,
        accountSchemaAvailable: !usersError,
    }, null, 2));
}
main().catch((error) => {
    console.error(`账号适配审计失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
