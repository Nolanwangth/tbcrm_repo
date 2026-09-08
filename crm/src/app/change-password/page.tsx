import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { changePasswordAction, logoutAction } from "@/app/actions/auth-actions";
export default async function ChangePasswordPage({ searchParams }: {
    searchParams: Promise<{
        error?: string;
    }>;
}) {
    const user = await getCurrentUser({ allowPasswordChange: true });
    if (!user)
        redirect("/login");
    const { error } = await searchParams;
    return <main className="mx-auto max-w-lg space-y-6 p-6"><div><h1 className="text-2xl font-semibold">设置个人密码</h1><p className="mt-2 text-muted-foreground">{user.mustChangePassword ? "当前使用临时密码。完成修改后才能进入系统。" : "修改后将退出所有设备，需要重新登录。"}</p></div>
    <form action={changePasswordAction} className="space-y-4 rounded-xl border bg-card p-6">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {[['oldPassword', '当前密码', 'current-password'], ['password', '新密码（至少 12 位，包含字母和数字）', 'new-password'], ['confirmation', '再次输入新密码', 'new-password']].map(([name, label, autocomplete]) => <label key={name} className="block text-sm font-medium">{label}<input name={name} type="password" autoComplete={autocomplete} required maxLength={128} className="mt-2 w-full rounded-md border bg-background px-3 py-2.5"/></label>)}
      <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">保存新密码并重新登录</button>
    </form><form action={logoutAction}><button className="text-sm underline">退出登录</button></form>
  </main>;
}
