import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getServiceWorkbenchForUser } from "@/lib/repositories/service-assignments";
export const metadata: Metadata = {
    title: "旅业 CRM",
    description: "面向中国入境游业务的轻量客户管理系统",
};
export default async function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    const user = await getCurrentUser();
    const ownServiceWorkbench = user?.role === "planner" ? await getServiceWorkbenchForUser(user.id) : null;
    return (<html lang="zh-CN" className="h-full">
      <body className="min-h-full antialiased">
        <TooltipProvider>
          <AppShell user={user} ownServiceWorkbench={ownServiceWorkbench}>{children}</AppShell>
          <Toaster richColors position="top-center"/>
        </TooltipProvider>
      </body>
    </html>);
}
