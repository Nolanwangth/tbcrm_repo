import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { sessionCookieName, sessionCookieSecure } from "@/lib/auth-cookie";
import type { CrmUserRole } from "@/lib/types";
const DAY = 60 * 60 * 24;
function hashToken(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function verifyPassword(password: string, salt: string, expected: string) {
    const actual = crypto.scryptSync(password, salt, 64).toString("hex");
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const readCurrentUser = cache(async () => {
    const cookieStore = await cookies();
    if (!isSupabaseConfigured())
        return null;
    const token = cookieStore.get(sessionCookieName())?.value;
    if (!token)
        return null;
    const { data } = await getSupabaseAdmin().from("crm_auth_sessions").select("expires_at, crm_users(id, username, display_name, role, active, must_change_password)").eq("token_hash", hashToken(token)).maybeSingle();
    const user = Array.isArray(data?.crm_users) ? data?.crm_users[0] : data?.crm_users;
    if (!data || new Date(data.expires_at) <= new Date() || !user || !user.active)
        return null;
    return { id: String(user.id), username: String(user.username), displayName: String(user.display_name), role: user.role as CrmUserRole, mustChangePassword: Boolean(user.must_change_password) };
});
export async function getCurrentUser(options: {
    allowPasswordChange?: boolean;
} = {}) {
    const user = await readCurrentUser();
    return user?.mustChangePassword && !options.allowPasswordChange ? null : user;
}
export async function login(username: string, password: string) {
    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase.from("crm_users").select("id, username, display_name, role, password_salt, password_hash, active, must_change_password").eq("username", username.trim()).maybeSingle();
    if (!user?.active || !verifyPassword(password, user.password_salt, user.password_hash))
        return { ok: false, error: "账号或密码错误" };
    const token = crypto.randomBytes(32).toString("hex");
    const { error } = await supabase.rpc("crm_create_auth_session", { p_token_hash: hashToken(token), p_user: user.id, p_password_hash: user.password_hash, p_expires: new Date(Date.now() + DAY * 7 * 1000).toISOString() });
    if (error)
        return { ok: false, error: "无法建立登录会话，请重试" };
    (await cookies()).set(sessionCookieName(), token, { httpOnly: true, sameSite: "lax", secure: sessionCookieSecure(), maxAge: DAY * 7, path: "/" });
    return { ok: true, mustChangePassword: Boolean(user.must_change_password) };
}
export async function logout() {
    const jar = await cookies();
    const cookieName = sessionCookieName();
    const token = jar.get(cookieName)?.value;
    if (token && isSupabaseConfigured())
        await getSupabaseAdmin().from("crm_auth_sessions").delete().eq("token_hash", hashToken(token));
    jar.delete(cookieName);
}
