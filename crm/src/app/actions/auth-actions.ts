"use server";
import { redirect } from "next/navigation";
import { getCurrentUser, login, logout, verifyPassword } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "node:crypto";
export async function loginAction(formData: FormData) {
    const requestedReturnTo = String(formData.get("returnTo") ?? "");
    const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/customers";
    const result = await login(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""));
    if (!result.ok)
        redirect(`/login?error=${encodeURIComponent(result.error ?? "登录失败")}&returnTo=${encodeURIComponent(returnTo)}`);
    redirect(result.mustChangePassword ? "/change-password" : returnTo);
}
export async function changePasswordAction(formData: FormData) {
    const user = await getCurrentUser({ allowPasswordChange: true });
    if (!user)
        redirect("/login");
    const password = String(formData.get("password") ?? "");
    const oldPassword = String(formData.get("oldPassword") ?? "");
    const fail = (message: string): never => redirect(`/change-password?error=${encodeURIComponent(message)}`);
    if (password.length < 12 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))
        fail("新密码需为 12–128 位，包含字母和数字");
    if (password !== formData.get("confirmation"))
        fail("两次新密码不一致");
    if (password === oldPassword)
        fail("新密码不能与原密码相同");
    const db = getSupabaseAdmin();
    const { data } = await db.from("crm_users").select("password_hash,password_salt").eq("id", user.id).single();
    if (!data || !verifyPassword(oldPassword, data.password_salt, data.password_hash))
        fail("当前密码错误");
    const salt = crypto.randomBytes(32).toString("hex");
    const { error } = await db.rpc("crm_change_own_password", { p_actor: user.id, p_old_hash: data!.password_hash, p_salt: salt, p_hash: crypto.scryptSync(password, salt, 64).toString("hex") });
    if (error)
        fail(error.message);
    await logout();
    redirect("/login?message=" + encodeURIComponent("密码已更新，所有旧会话已撤销，请使用新密码登录"));
}
export async function logoutAction() {
    await logout();
    redirect("/login");
}
