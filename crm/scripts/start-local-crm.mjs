import { spawn } from 'node:child_process';
import { openSync, closeSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { cp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:3001';
const preview = process.argv.includes('--preview');
const db = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (db !== 'http://127.0.0.1:54321')
    throw new Error('仅允许本机 Supabase 54321');
async function ready() { try {
    const r = await fetch(base + '/login', { signal: AbortSignal.timeout(2000) });
    return r.ok && (await r.text()).includes('TripBook');
}
catch {
    return false;
} }
if (await ready()) {
    console.log(`CRM 已运行，无需重启：${base}`);
    process.exit(0);
}
const lock = path.join(tmpdir(), 'tripbook-crm-3001-start.lock');
try {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 1)
        throw new Error('启动锁内容异常，请由维护人员检查 ' + lock);
    let alive = true;
    try {
        process.kill(pid, 0);
    }
    catch (error) {
        if (error.code === 'ESRCH')
            alive = false;
        else
            throw error;
    }
    if (alive)
        throw new Error('另一个 CRM 启动器正在运行，请等待其完成，不要同时构建。');
    unlinkSync(lock);
}
catch (error) {
    if (error.code !== 'ENOENT')
        throw error;
}
const lockFd = openSync(lock, 'wx', 0o600);
writeFileSync(lockFd, String(process.pid));
closeSync(lockFd);
process.on('exit', () => { try {
    unlinkSync(lock);
}
catch { } });
process.on('SIGINT', () => process.exit(1));
process.on('SIGTERM', () => process.exit(1));
try {
    await fetch(base, { signal: AbortSignal.timeout(2000) });
    throw new Error('3001 已有服务但未通过检查；不会强制结束它，请检查原终端。');
}
catch (e) {
    if (e.message.includes('已有服务'))
        throw e;
}
const health = await fetch(db + '/auth/v1/health', { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }, signal: AbortSignal.timeout(5000) });
if (!health.ok)
    throw new Error('本地 Supabase 未就绪，请先运行 pnpm supabase start');
const log = '/tmp/tripbook-crm-3001.log';
const fd = openSync(log, 'a', 0o600);
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
if (preview) {
    console.log('正在预编译本地验收页面（只构建本机，不部署），详细进度见 ' + log);
    await new Promise((resolve, reject) => {
        const build = spawn(process.execPath, [next, 'build'], { cwd: root, env: process.env, stdio: ['ignore', fd, fd] });
        build.on('error', reject);
        build.on('exit', code => code === 0 ? resolve() : reject(new Error('本地预编译失败，请检查日志；数据库没有回滚或重置')));
    });
    await cp(path.join(root, 'public'), path.join(root, '.next/standalone/public'), { recursive: true });
    await cp(path.join(root, '.next/static'), path.join(root, '.next/standalone/.next/static'), { recursive: true });
    const playwrightPackage = path.dirname(createRequire(import.meta.url).resolve('playwright-core/package.json'));
    const relativePackage = path.relative(root, playwrightPackage);
    if (relativePackage.startsWith('..'))
        throw new Error('PDF 组件必须来自本 CRM 的锁定依赖');
    await cp(playwrightPackage, path.join(root, '.next/standalone', relativePackage), { recursive: true });
    const pnpmDirectory = path.join(root, 'node_modules/.pnpm');
    for (const name of await readdir(pnpmDirectory)) {
        if (name.startsWith('@img+sharp'))
            await cp(path.join(pnpmDirectory, name), path.join(root, '.next/standalone/node_modules/.pnpm', name), { recursive: true, verbatimSymlinks: true });
    }
    await new Promise((resolve, reject) => {
        const check = spawn(process.execPath, ['-e', 'require("sharp"); require("playwright-core")'], { cwd: path.join(root, '.next/standalone'), stdio: ['ignore', fd, fd] });
        check.on('error', reject);
        check.on('exit', code => code === 0 ? resolve() : reject(new Error('文档运行依赖检查失败，请查看日志')));
    });
}
const args = preview ? [path.join(root, '.next/standalone/server.js')] : [next, 'dev', '--hostname', '127.0.0.1', '--port', '3001', '--turbopack'];
const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...(preview ? { NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '3001', CRM_SESSION_COOKIE_NAME: process.env.CRM_SESSION_COOKIE_NAME || 'crm_session_dev' } : {}) }, detached: true, stdio: ['ignore', fd, fd] });
child.unref();
closeSync(fd);
console.log(`CRM ${preview ? '预编译验收版' : '开发版'}正在后台启动（PID ${child.pid}），日志：${log}`);
for (let attempt = 0; attempt < 30; attempt++) {
    if (await ready()) {
        console.log(`CRM 已就绪：${base}；关闭启动终端不会退出系统。`);
        process.exit(0);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
}
throw new Error(`启动尚未就绪，请查看 ${log}；脚本没有强制停止任何现有服务。`);
