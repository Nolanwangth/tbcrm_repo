"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { manageAccountAction, type AccountCommand } from "@/app/actions/account-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CrmUserRole } from "@/lib/types";
type User = {
    id: string;
    username: string;
    display_name: string;
    role: string;
    active: boolean;
    must_change_password: boolean;
};
type Slot = {
    slot: string;
    user_id: string | null;
    enabled: boolean;
};
type Event = {
    id: string;
    action: string;
    actor_user_id: string;
    target_user_id: string | null;
    before_data: unknown;
    after_data: unknown;
    created_at: string;
};
const roleLabels = { planner: "规划师", operations: "计调", admin: "管理员" };
const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";
export function AccountManagement({ users, slots, events, page, total }: {
    users: User[];
    slots: Slot[];
    events: Event[];
    page: number;
    total: number;
}) {
    const router = useRouter();
    const [showInactive, setShowInactive] = useState(false);
    const [search, setSearch] = useState("");
    const visibleUsers = users.filter(u => (showInactive || u.active) && `${u.display_name} ${u.username}`.toLowerCase().includes(search.toLowerCase()));
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [temporary, setTemporary] = useState<string | null>(null);
    const [editing, setEditing] = useState<User | null>(null);
    async function execute(command: AccountCommand) {
        if (busy)
            return;
        setBusy(true);
        setNotice("");
        try {
            const result = await manageAccountAction(command);
            if (!result.ok) {
                setNotice(result.error ?? "保存失败");
                return;
            }
            setTemporary(result.temporaryPassword ?? null);
            setNotice("已保存。停用、密码重置或角色变更会立即撤销该账号的旧会话。");
            setEditing(null);
            router.refresh();
        }
        catch {
            setNotice("请求失败，未确认保存成功。请重新加载核对后重试。");
        }
        finally {
            setBusy(false);
        }
    }
    const name = (id: string | null) => users.find(u => u.id === id)?.display_name ?? "—";
    return <div className="space-y-6">
    <header><p className="text-sm text-muted-foreground">系统设置 / 组织与权限</p><h1 className="mt-1 text-2xl font-semibold">账号管理</h1><p className="mt-2 text-sm text-muted-foreground">规划师、计调协同办理业务；管理员负责权限配置、财务审核和付款登记。</p></header>
    {notice && <p role="status" className="rounded-lg border bg-card p-4 text-sm">{notice}</p>}
    {temporary && <section role="alert" className="space-y-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-950"><p>临时密码仅本次显示，请安全转交本人。首次登录必须修改。</p><code className="block break-all select-all rounded border bg-white p-3">{temporary}</code><Button variant="outline" onClick={() => setTemporary(null)}>已转交，隐藏密码</Button></section>}
    <section className="rounded-xl border bg-card p-5"><h2 className="mb-4 text-lg font-semibold">创建账号</h2><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void execute({ action: "create", username: String(f.get("username")), displayName: String(f.get("displayName")), role: f.get("role") as CrmUserRole }); }}>
      <label className="grid gap-2 text-sm">登录账号<Input name="username" required pattern="[a-zA-Z0-9_.\-]{3,64}" placeholder="英文、数字，3–64 位"/></label>
      <label className="grid gap-2 text-sm">显示名称<Input name="displayName" required maxLength={80}/></label>
      <label className="grid gap-2 text-sm">账号类型<select name="role" className={selectClass}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button disabled={busy}>创建并生成临时密码</Button>
    </form></section>
    <section className="rounded-xl border bg-card"><div className="flex flex-wrap items-center gap-4 p-5"><h2 className="mr-auto text-lg font-semibold">人员账号 <span className="text-sm text-muted-foreground">{visibleUsers.length} / {users.length} 个</span></h2><Input className="w-52" aria-label="搜索人员账号" placeholder="搜索姓名或登录账号" value={search} onChange={e => setSearch(e.target.value)}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}/>包括已停用账号</label></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted"><tr>{['人员 / 登录账号', '角色', '状态', '密码状态', '操作'].map(t => <th key={t} className="px-5 py-3">{t}</th>)}</tr></thead><tbody>{visibleUsers.map(u => <tr key={u.id} className="border-t"><td className="px-5 py-4"><p className="font-medium">{u.display_name}</p><p className="text-xs text-muted-foreground">{u.username}</p></td><td>{roleLabels[u.role as CrmUserRole]}</td><td>{u.active ? "启用" : "已停用"}</td><td>{u.must_change_password ? "待修改临时密码" : "已设置"}</td><td className="space-x-2"><Button variant="outline" size="sm" onClick={() => setEditing(u)}>编辑</Button><Button disabled={busy} variant="outline" size="sm" onClick={() => { if (window.confirm(`重置 ${u.display_name} 的密码并退出其所有设备？`))
        void execute({ action: "reset_password", id: u.id }); }}>重置密码</Button></td></tr>)}</tbody></table></div></section>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open)
        setEditing(null); }}><DialogContent>{editing && <><DialogTitle>编辑 {editing.username}</DialogTitle><DialogDescription>角色或启停状态变更后，该账号旧会话将立即失效。</DialogDescription><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void execute({ action: "update", id: editing.id, displayName: editing.display_name, role: editing.role as CrmUserRole, active: editing.active }); }}><label className="grid gap-2 text-sm">显示名称<Input required value={editing.display_name} onChange={e => setEditing({ ...editing, display_name: e.target.value })}/></label><label className="grid gap-2 text-sm">角色<select className={selectClass} value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="flex h-9 items-center gap-2"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })}/>启用账号</label><Button disabled={busy}>保存</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button></form></>}</DialogContent></Dialog>
    <section className="rounded-xl border bg-card p-5"><h2 className="mb-4 text-lg font-semibold">A–E 席位配置</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{slots.map(s => <form key={`${s.slot}-${s.user_id}-${s.enabled}`} className="space-y-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void execute({ action: "seat", slot: s.slot as "A", userId: String(f.get("userId")) || null, enabled: f.get("enabled") === "on" }); }}><h3 className="font-semibold">规划师 {s.slot}</h3><select aria-label={`席位 ${s.slot} 账号`} name="userId" defaultValue={s.user_id ?? ""} className={`${selectClass} w-full`}><option value="">未绑定</option>{users.filter(u => u.role === "planner" && u.active).map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}</select><label className="flex gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={s.enabled}/>参与分配</label><Button disabled={busy} size="sm" variant="outline">保存席位</Button></form>)}</div></section>
    <section className="rounded-xl border bg-card p-5"><h2 className="mb-4 text-lg font-semibold">操作历史</h2><div className="space-y-3">{events.map(e => <details key={e.id} className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer">{new Date(e.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {name(e.actor_user_id)} · {({ create: '创建账号', update: '更新账号', reset_password: '重置密码', seat: '配置席位', change_own_password: '修改个人密码' } as Record<string, string>)[e.action] ?? e.action} · {name(e.target_user_id)}</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><pre className="overflow-auto rounded bg-muted p-3">变更前{JSON.stringify(e.before_data, null, 2)}</pre><pre className="overflow-auto rounded bg-muted p-3">变更后{JSON.stringify(e.after_data, null, 2)}</pre></div></details>)}{!events.length && <p className="text-sm text-muted-foreground">暂无账号操作记录</p>}</div><div className="mt-4 flex items-center gap-4 text-sm">{page > 1 && <Link href={`/accounts?page=${page - 1}`}>上一页</Link>}<span>第 {page} 页 · 共 {total} 条</span>{page * 25 < total && <Link href={`/accounts?page=${page + 1}`}>下一页</Link>}</div></section>
  </div>;
}
