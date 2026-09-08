import { loginAction } from "@/app/actions/auth-actions";
export default async function LoginPage({ searchParams }: {
    searchParams: Promise<{
        error?: string;
        message?: string;
        returnTo?: string;
    }>;
}) {
    const { error, message, returnTo } = await searchParams;
    return <main className="grid min-h-dvh bg-[#102821] lg:grid-cols-2">
    <section className="flex flex-col justify-between p-8 text-white lg:p-16">
      <p className="text-sm font-semibold tracking-[0.2em]">TRIPBOOK · CRM</p>
      <div className="my-10 max-w-lg"><p className="mb-5 text-sm text-[#bed1c7]">清晰运营台</p><h1 className="text-3xl font-semibold leading-tight lg:text-5xl">从客户需求，<br />到每一天的旅程。</h1><p className="mt-6 max-w-md text-base leading-7 text-[#bed1c7]">客户、行程报价和在线服务清单集中协作。规划师与计调共同交付，管理员统一管理。</p></div>
      <p className="text-xs text-[#bed1c7]">本地试验开发环境 · 不连接生产数据</p>
    </section>
    <section className="grid place-items-center rounded-t-3xl bg-background p-6 lg:rounded-none lg:p-12">
      <form action={loginAction} className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-7 shadow-sm sm:p-10">
        <input type="hidden" name="returnTo" value={returnTo ?? "/dashboard"}/>
        <div><h2 className="text-2xl font-semibold">欢迎回来</h2><p className="mt-2 text-sm text-muted-foreground">使用你的 TripBook 账号登录。</p></div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        <label className="block text-sm font-medium">账号<input name="username" required autoComplete="username" className="mt-2 h-11 w-full rounded-md border bg-background px-3"/></label>
        <label className="block text-sm font-medium">密码<input name="password" type="password" required autoComplete="current-password" className="mt-2 h-11 w-full rounded-md border bg-background px-3"/></label>
        <button className="h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-white hover:brightness-95">登录工作台</button>
        <p className="text-xs leading-6 text-muted-foreground">初次使用临时密码登录后，需要设置新密码。忘记密码请联系管理员重置。</p>
      </form>
    </section>
  </main>;
}
