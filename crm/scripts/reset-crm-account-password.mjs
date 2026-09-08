import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
};
async function main() {
    const username = argument("--username");
    const outputFile = argument("--output");
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!username || !outputFile)
        throw new Error("用法：--username <账号> --output <受限凭据文件>");
    if (!url || !key)
        throw new Error("缺少 Supabase 服务端配置");
    if (fs.existsSync(outputFile))
        throw new Error(`输出文件已存在：${outputFile}`);
    const password = Array.from({ length: 20 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: user, error: readError } = await supabase.from("crm_users").select("id,username,display_name").eq("username", username).maybeSingle();
    if (readError || !user)
        throw new Error(`找不到账号：${username}`);
    const { error: updateError } = await supabase.from("crm_users").update({ password_salt: salt, password_hash: hash }).eq("id", user.id);
    if (updateError)
        throw new Error(`更新密码失败：${updateError.message}`);
    const { error: sessionError } = await supabase.from("crm_auth_sessions").delete().eq("user_id", user.id);
    if (sessionError)
        throw new Error(`密码已更新，但清理旧会话失败：${sessionError.message}`);
    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    fs.writeFileSync(outputFile, `账号\t显示身份\t新密码\n${user.username}\t${user.display_name}\t${password}\n`, { mode: 0o600, flag: "wx" });
    fs.chmodSync(outputFile, 0o600);
    console.log(`密码已重置，全部旧会话已失效。凭据文件：${path.resolve(outputFile)}`);
}
main().catch((error) => {
    console.error(`重置失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
