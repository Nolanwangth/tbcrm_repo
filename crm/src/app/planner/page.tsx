import Link from "next/link";
import { ArrowRight, FileText, Calculator, FolderClock } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
const tools = [
    { href: "/planner/tools/itinerary", number: "01", icon: FileText, title: "行程制作", description: "将逐日英文行程整理成 TripBook 行程书。关联客户资料，保存草稿、正式版本与 Word / PDF。", details: "英文行程编辑 · 客户人数 · Word 模板 · 历史版本" },
    { href: "/planner/tools/quotation", number: "02", icon: Calculator, title: "报价制作", description: "使用新版 2.0 的直接报价与快速方案。按天编排服务，核算成人儿童规格、费用和毛利。", details: "多日价格库 · 行程模板 · 分组 · PI Word · 客户 PDF" }
];
export default function PlannerPage() {
    return <div className="space-y-6">
  <PageHeading eyebrow="方案中心 / QUICK TOUR PROPOSAL 2.0" title="行程报价制作" description="所有方案从 CRM 客户出发。跟进中与已成交客户可制作，已关闭客户保留历史查看与导出。"/>
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#102821] px-6 py-5 text-white"><div><h2 className="font-semibold">编辑、保存、交付，一个工作流程</h2><p className="mt-1 text-sm text-white/75">价格库、模板与设置在 CRM 内独立保存；正式版本冻结数据和原始 PDF。</p></div><Link href="/customers" className="inline-flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm hover:bg-white/10">打开客户档案<ArrowRight className="size-4"/></Link></div>
  <section className="grid gap-5 lg:grid-cols-2">{tools.map(({ href, number, icon: Icon, title, description, details }) => <Link key={href} href={href} className="group flex flex-col rounded-xl border bg-card p-6 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:p-8"><div className="flex items-center justify-between"><span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6"/></span><span className="font-mono text-sm text-muted-foreground">{number}</span></div><h2 className="mt-7 text-2xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p><p className="mt-5 border-t pt-5 text-xs leading-6 text-muted-foreground">{details}</p><span className="mt-7 inline-flex items-center gap-3 self-start rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white">选择客户，开始制作<ArrowRight className="size-4 transition-transform group-hover:translate-x-1"/></span></Link>)}</section>
  <section className="flex items-start gap-3 rounded-xl border bg-card p-5"><FolderClock className="mt-0.5 size-5 shrink-0 text-primary"/><div><h2 className="text-sm font-semibold">继续已有方案</h2><p className="mt-1 text-sm text-muted-foreground">进入对应工具并选择客户，即可打开服务器草稿和历史正式版本。正式版本不能直接改写，请使用“基于此版本新建草稿”。</p></div></section>
 </div>;
}
