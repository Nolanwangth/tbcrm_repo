import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const accounts = [
    { id: "aa100000-0000-4000-8000-000000000001", username: "planner_zhangxujie", displayName: "张栩杰", role: "planner" },
    { id: "aa100000-0000-4000-8000-000000000002", username: "planner_xuchenlei", displayName: "徐晨雷", role: "planner" },
    { id: "aa100000-0000-4000-8000-000000000003", username: "service_caijinyang", displayName: "蔡觐阳", role: "service" },
    { id: "aa100000-0000-4000-8000-000000000004", username: "service_huangchuqiao", displayName: "黄楚乔", role: "service" },
    { id: "aa100000-0000-4000-8000-000000000005", username: "service_gaoyuanbo", displayName: "高苑博", role: "service" },
    { id: "aa100000-0000-4000-8000-000000000006", username: "admin", displayName: "管理员", role: "admin" },
];
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
};
const randomPassword = () => Array.from({ length: 20 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
const passwordHash = (password, salt) => crypto.scryptSync(password, salt, 64).toString("hex");
async function main() {
    const outputFile = argument("--output");
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!outputFile)
        throw new Error("用法：--output <汇总凭据文件>");
    if (!url || !key)
        throw new Error("缺少 Supabase 服务端配置");
    if (fs.existsSync(outputFile))
        throw new Error(`输出文件已存在：${outputFile}`);
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing, error: readError } = await supabase
        .from("crm_users")
        .select("id,username,display_name,role,active")
        .in("username", accounts.map((account) => account.username));
    if (readError)
        throw new Error(`读取正式账号失败：${readError.message}`);
    for (const account of accounts) {
        const user = existing?.find((item) => item.username === account.username);
        if (!user || user.id !== account.id)
            throw new Error(`正式账号不存在或固定 ID 不一致：${account.username}`);
    }
    const credentials = accounts.map((account) => ({ ...account, password: randomPassword() }));
    const rows = credentials.map((account) => {
        const salt = crypto.randomBytes(16).toString("hex");
        return {
            id: account.id,
            username: account.username,
            display_name: account.displayName,
            role: account.role,
            active: true,
            password_salt: salt,
            password_hash: passwordHash(account.password, salt),
        };
    });
    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    const body = [
        "Tripbook CRM 正式账号集中凭据",
        `生成时间：${new Date().toISOString()}`,
        "请勿上传、转发到群聊或放入更新包。",
        "",
        "用户名\t显示身份\t账号类型\t密码",
        ...credentials.map((account) => [account.username, account.displayName, account.role, account.password].join("\t")),
        "",
    ].join("\n");
    fs.writeFileSync(outputFile, body, { mode: 0o600, flag: "wx" });
    fs.chmodSync(outputFile, 0o600);
    const { error: updateError } = await supabase.from("crm_users").upsert(rows, { onConflict: "id" });
    if (updateError) {
        fs.unlinkSync(outputFile);
        throw new Error(`统一更新密码失败：${updateError.message}`);
    }
    const { error: sessionError } = await supabase
        .from("crm_auth_sessions")
        .delete()
        .in("user_id", accounts.map((account) => account.id));
    if (sessionError)
        throw new Error(`密码已更新，但清理旧会话失败：${sessionError.message}`);
    console.log(`六个正式账号密码已统一更新，旧会话已清除。凭据文件：${path.resolve(outputFile)}`);
}
main().catch((error) => {
    console.error(`集中密码更新失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
