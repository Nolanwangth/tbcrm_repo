"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
const role = z.enum(["planner", "operations", "admin"]);
const command = z.discriminatedUnion("action", [
    z.object({ action: z.literal("create"), username: z.string().regex(/^[a-zA-Z0-9_.-]{3,64}$/), displayName: z.string().trim().min(1).max(80), role }),
    z.object({ action: z.literal("update"), id: z.string().uuid(), displayName: z.string().trim().min(1).max(80), role, active: z.boolean() }),
    z.object({ action: z.literal("reset_password"), id: z.string().uuid() }),
    z.object({ action: z.literal("seat"), slot: z.enum(["A", "B", "C", "D", "E"]), userId: z.string().uuid().nullable(), enabled: z.boolean() }),
]);
export type AccountCommand = z.infer<typeof command>;
export async function manageAccountAction(input: AccountCommand): Promise<{
    ok: boolean;
    error?: string;
    temporaryPassword?: string;
}> {
    const actor = await getCurrentUser();
    if (actor?.role !== "admin")
        return { ok: false, error: "只有管理员可以管理账号与席位" };
    const parsed = command.safeParse(input);
    if (!parsed.success)
        return { ok: false, error: "账号信息无效，请检查名称、角色及账号格式" };
    const value = parsed.data;
    let temporaryPassword: string | undefined;
    let values: Record<string, unknown> = {};
    if (value.action === "create" || value.action === "reset_password") {
        temporaryPassword = `Tb!${crypto.randomBytes(18).toString("base64url")}7`;
        const salt = crypto.randomBytes(32).toString("hex");
        values = { password_salt: salt, password_hash: crypto.scryptSync(temporaryPassword, salt, 64).toString("hex") };
    }
    if (value.action === "create")
        Object.assign(values, { username: value.username, display_name: value.displayName, role: value.role });
    if (value.action === "update")
        values = { display_name: value.displayName, role: value.role, active: value.active };
    if (value.action === "seat")
        values = { slot: value.slot, enabled: value.enabled };
    const { error } = await getSupabaseAdmin().rpc("crm_manage_account", {
        p_actor: actor.id, p_action: value.action,
        p_target: "id" in value ? value.id : value.action === "seat" ? value.userId : null,
        p_values: values,
    });
    if (error)
        return { ok: false, error: error.code === "23505" ? "账号已存在，或规划师已绑定其他席位" : error.message };
    revalidatePath("/", "layout");
    return { ok: true, temporaryPassword };
}
