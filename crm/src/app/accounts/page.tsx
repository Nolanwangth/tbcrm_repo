import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccountManagement } from "@/components/account-management";
export default async function AccountsPage({ searchParams }: {
    searchParams: Promise<{
        page?: string;
    }>;
}) {
    const user = await getCurrentUser();
    if (!user)
        redirect("/login");
    if (user.role !== "admin")
        return <section role="alert" className="rounded-xl border bg-card p-8"><h1 className="text-xl font-semibold">无权访问账号管理</h1><p className="mt-2">账号和席位配置仅限管理员。</p></section>;
    const page = Math.max(1, Math.min(10000, Number((await searchParams).page) || 1));
    const db = getSupabaseAdmin();
    const [users, slots, events] = await Promise.all([
        db.from("crm_users").select("id,username,display_name,role,active,must_change_password").order("created_at"),
        db.from("service_workbench_slots").select("slot,user_id,enabled").order("slot"),
        db.from("crm_account_events").select("id,action,actor_user_id,target_user_id,before_data,after_data,created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id").range((page - 1) * 25, page * 25 - 1),
    ]);
    const error = users.error || slots.error || events.error;
    if (error)
        throw new Error("无法读取账号管理：" + error.message);
    return <AccountManagement users={users.data ?? []} slots={slots.data ?? []} events={events.data ?? []} page={page} total={events.count ?? 0}/>;
}
