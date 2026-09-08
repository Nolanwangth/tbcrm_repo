"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlaneTakeoff } from "lucide-react";
import { logoutAction } from "@/app/actions/auth-actions";
import { ServiceAlertBanner } from "@/components/service-alert-banner";
import { cn } from "@/lib/utils";
import type { CrmUserRole, ServiceWorkbench } from "@/lib/types";
const mainNavigation = [["/dashboard", "业务总览"], ["/customers", "客户管理"], ["/planner", "行程报价制作"], ["/operations", "计调与服务"], ["/finance", "报账中心"], ["/feedback", "系统反馈"]];
const customerNavigation = [["/customers", "全部客户"], ...["A", "B", "C", "D", "E"].map(s => [`/planner/${s}`, `规划师 ${s}`]), ["/planner/unassigned", "待分配"], ["/won", "已成交"], ["/closed", "已关闭"]];
const roleLabels: Record<CrmUserRole, string> = { planner: "规划师", operations: "计调", admin: "管理员" };
export function AppShell({ children, user, ownServiceWorkbench }: {
    children: React.ReactNode;
    user: {
        displayName: string;
        username: string;
        role: CrmUserRole;
    } | null;
    ownServiceWorkbench?: ServiceWorkbench | null;
}) {
    const pathname = usePathname();
    if (["/login", "/change-password"].includes(pathname) || pathname.startsWith("/planner/print/"))
        return <>{children}</>;
    const customerArea = pathname.startsWith("/customers") || /^\/planner\/(A|B|C|D|E|unassigned)(\/|$)/.test(pathname) || ["/won", "/closed"].includes(pathname);
    const active = (href: string) => href === "/customers" ? customerArea : href === "/planner" ? pathname === "/planner" || pathname.startsWith("/planner/tools") : pathname.startsWith(href);
    return <div className="min-h-screen bg-background">
    <header className="crm-commandbar sticky top-0 z-[70] bg-[#102821] text-white shadow-sm"><div className="mx-auto flex min-h-16 max-w-[1920px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-primary"><PlaneTakeoff className="size-5"/></span><span className="text-base font-semibold tracking-tight">TripBook <span className="font-normal text-white/70">CRM</span></span></Link>
      <nav aria-label="主导航" className="order-3 flex w-full gap-1 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:flex-1 lg:pb-0">{[...mainNavigation, ...(user?.role === "admin" ? [["/accounts", "账号管理"]] : [])].map(([href, label]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("shrink-0 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white", active(href) && "bg-white/15 text-white ring-1 ring-inset ring-white/10")}>{label}</Link>)}</nav>
      <div className="ml-auto flex items-center gap-3 text-xs"><span className="hidden rounded border border-white/20 px-2 py-1 text-white/75 xl:inline">本地试验版</span>{user && <><Link href="/change-password" title="修改个人密码" className="text-right"><span className="block font-medium">{user.displayName}</span><span className="text-white/65">{roleLabels[user.role]}</span></Link><form action={logoutAction}><button className="rounded px-2 py-2 text-white/80 hover:bg-white/10">退出</button></form></>}</div>
    </div></header>
    {customerArea && <div className="border-b bg-card"><nav aria-label="客户视图" className="mx-auto flex max-w-[1920px] gap-1 overflow-x-auto px-4 py-2 lg:px-8">{customerNavigation.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", pathname === href && "bg-primary/10 font-semibold text-primary")}>{label}{href === `/planner/${ownServiceWorkbench}` && <span className="ml-1.5 text-xs">· 我的</span>}</Link>)}</nav></div>}
    {user && <ServiceAlertBanner />}
    <main id="main-content" className="mx-auto min-w-0 max-w-[1920px] px-4 py-6 lg:px-8 lg:py-7">{children}</main>
  </div>;
}
