import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const ACCOUNTS = [
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
function randomPassword() {
    return Array.from({ length: 20 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}
function passwordHash(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
}
function readCredentials(file) {
    const result = new Map();
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim() || line.startsWith("#"))
            continue;
        const [id, username, displayName, role, password] = line.split("\t");
        if (!id || !username || !displayName || !role || !password)
            throw new Error(`凭据文件格式错误：${username || line}`);
        result.set(username, { id, username, displayName, role, password });
    }
    return result;
}
function writeCredentials(file, credentials) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    const body = [
        "# Tripbook CRM 正式账号凭据，请勿放入更新包或代码仓库。",
        "# 格式：固定ID<TAB>用户名<TAB>显示身份<TAB>类型<TAB>初始密码",
        ...ACCOUNTS.map((account) => {
            const credential = credentials.get(account.username);
            return [account.id, account.username, account.displayName, account.role, credential.password].join("\t");
        }),
        "",
    ].join("\n");
    fs.writeFileSync(file, body, { mode: 0o600, flag: "wx" });
    fs.chmodSync(file, 0o600);
}
async function main() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
    const credentialsFile = argument("--credentials");
    const outputFile = argument("--output");
    const supplied = credentialsFile ? readCredentials(credentialsFile) : null;
    if (supplied && (supplied.size !== ACCOUNTS.length || ACCOUNTS.some((account) => !supplied.has(account.username)))) {
        throw new Error("凭据文件必须完整包含六个正式账号");
    }
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing, error: readError } = await supabase
        .from("crm_users")
        .select("id,username,display_name,role,active,password_salt,password_hash")
        .in("username", ACCOUNTS.map((account) => account.username));
    if (readError)
        throw new Error(`读取账号失败：${readError.message}`);
    const existingByUsername = new Map((existing ?? []).map((user) => [user.username, user]));
    if (existingByUsername.size > 0 && existingByUsername.size < ACCOUNTS.length && !supplied) {
        throw new Error("检测到部分正式账号；请使用首台服务器的完整 --credentials 文件修复，脚本不会自行轮换已有密码");
    }
    const credentials = supplied ?? new Map(ACCOUNTS.map((account) => [account.username, { ...account, password: randomPassword() }]));
    if (!supplied && existingByUsername.size === 0) {
        if (!outputFile)
            throw new Error("首次创建账号必须提供 --output，将初始凭据写入服务器受限目录");
        if (fs.existsSync(outputFile))
            throw new Error(`凭据输出文件已存在：${outputFile}`);
        writeCredentials(outputFile, credentials);
    }
    for (const account of ACCOUNTS) {
        const current = existingByUsername.get(account.username);
        const credential = credentials.get(account.username);
        if (current) {
            if (current.id !== account.id)
                throw new Error(`账号 ${account.username} 的ID与正式配置不一致，已停止操作`);
            if (supplied && passwordHash(credential.password, current.password_salt) !== current.password_hash) {
                throw new Error(`账号 ${account.username} 的现有密码与凭据文件不一致，已停止操作`);
            }
            const { error } = await supabase.from("crm_users").update({ display_name: account.displayName, role: account.role, active: true }).eq("id", account.id);
            if (error)
                throw new Error(`更新账号 ${account.username} 失败：${error.message}`);
            continue;
        }
        const salt = crypto.randomBytes(16).toString("hex");
        const { error } = await supabase.from("crm_users").insert({
            id: account.id,
            username: account.username,
            display_name: account.displayName,
            role: account.role,
            active: true,
            password_salt: salt,
            password_hash: passwordHash(credential.password, salt),
        });
        if (error)
            throw new Error(`创建账号 ${account.username} 失败：${error.message}`);
    }
    let customers = [];
    for (let from = 0;; from += 1000) {
        const { data, error } = await supabase.from("customers").select("id,assignee,assignee_user_id").range(from, from + 999);
        if (error)
            throw new Error(`读取负责人数据失败：${error.message}`);
        customers.push(...(data ?? []));
        if (!data || data.length < 1000)
            break;
    }
    const bound = {};
    for (const account of ACCOUNTS.filter((item) => item.role !== "admin")) {
        const ids = customers
            .filter((customer) => !customer.assignee_user_id && String(customer.assignee ?? "").trim() === account.displayName)
            .map((customer) => customer.id);
        bound[account.username] = ids.length;
        for (let index = 0; index < ids.length; index += 100) {
            const { error } = await supabase
                .from("customers")
                .update({ assignee_user_id: account.id, assignee: account.displayName })
                .in("id", ids.slice(index, index + 100));
            if (error)
                throw new Error(`绑定 ${account.displayName} 的客户失败：${error.message}`);
        }
    }
    console.log(JSON.stringify({ accounts: ACCOUNTS.length, created: ACCOUNTS.length - existingByUsername.size, existing: existingByUsername.size, bound }, null, 2));
    if (!supplied && existingByUsername.size === 0)
        console.log(`初始凭据已保存到：${path.resolve(outputFile)}`);
}
main().catch((error) => {
    console.error(`正式账号配置失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
