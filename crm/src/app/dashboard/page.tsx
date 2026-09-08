import Link from "next/link";
import { Banknote, CalendarDays, ChartNoAxesCombined, CircleOff, FilePenLine, Handshake, MessagesSquare, ReceiptText, Timer, UsersRound, } from "lucide-react";
import { DashboardChart } from "@/components/dashboard-chart";
import { FilterBar } from "@/components/filter-bar";
import { PageHeading } from "@/components/page-heading";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { businessDateKey, businessDateLabel, resolveBusinessRange } from "@/lib/business-time";
import { aggregateTrend, calculateConversionCycleAnalysis, calculateDashboard, calculateSourceAnalysis, } from "@/lib/analytics";
import { getCustomers, getExpectedAmountMetrics } from "@/lib/repositories/customers";
const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("zh-CN");
const decimal = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const cycleDays = (value: number | null) => value == null ? "—" : `${decimal.format(value)} 天`;
const businessDate = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});
export default async function DashboardPage({ searchParams, }: {
    searchParams: Promise<{
        preset?: string;
        start?: string;
        end?: string;
    }>;
}) {
    const params = await searchParams;
    const preset = params.preset ?? "month";
    const { start, end, granularity } = resolveBusinessRange(preset, params.start, params.end);
    const rangeDuration = end.getTime() - start.getTime() + 1;
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - rangeDuration + 1);
    const [{ customers }, expectedAmountMetrics] = await Promise.all([
        getCustomers({ summary: true }),
        getExpectedAmountMetrics(start, end),
    ]);
    const metrics = calculateDashboard(customers, start, end);
    const conversionCycle = calculateConversionCycleAnalysis(customers, start, end, previousStart, previousEnd);
    const trend = aggregateTrend(customers, start, end, granularity);
    const sources = calculateSourceAnalysis(customers, start, end);
    const expectedAmountHref = `/customers?${new URLSearchParams({
        expectedAmount: "待补充",
        inquiryFrom: businessDateKey(start),
        inquiryTo: businessDateKey(end),
    })}`;
    const presets = [["today", "今天"], ["week", "本周"], ["month", "本月"], ["year", "本年"], ["30days", "近 30 天"]];
    const primaryCards = [
        {
            label: "询单量",
            value: number.format(metrics.inquiries),
            hint: "首次询单发生在所选时间内",
            icon: MessagesSquare,
            tone: "blue" as const,
            emphasis: true,
        },
        {
            label: "成交金额",
            value: currency.format(metrics.wonAmount),
            hint: "按实际成交时间统计",
            icon: Banknote,
            tone: "emerald" as const,
            emphasis: true,
        },
        {
            label: "预计金额总量",
            value: currency.format(expectedAmountMetrics.total),
            hint: `按首次询单时间：已填写 ${number.format(expectedAmountMetrics.filled)} 位，待补充 ${number.format(expectedAmountMetrics.missing)} 位`,
            icon: ReceiptText,
            tone: "amber" as const,
            emphasis: true,
            href: expectedAmountHref,
        },
        {
            label: "成交率",
            value: percent(metrics.conversionRate),
            hint: "成交客户数 ÷ 询单量",
            icon: ChartNoAxesCombined,
            tone: "violet" as const,
        },
        {
            label: "当前跟进客户数",
            value: number.format(metrics.activeCustomers),
            hint: "当前仍处于跟进中的客户",
            icon: UsersRound,
            tone: "blue" as const,
        },
    ];
    const customerMetrics = [
        ["成交客户数", number.format(metrics.wonCustomers)],
        ["平均客单价", currency.format(metrics.averageOrderValue)],
        ["无效客户数", number.format(metrics.closedCustomers)],
        ["无效率", percent(metrics.invalidRate)],
    ];
    const planningMetrics = [
        ["未出行程", number.format(metrics.planning.unissuedItineraries), FilePenLine],
        ["未出报价", number.format(metrics.planning.unissuedQuotations), ReceiptText],
        ["行程待修改", number.format(metrics.planning.itineraryRevisions), FilePenLine],
        ["报价待修改", number.format(metrics.planning.quotationRevisions), ReceiptText],
    ];
    const cohortMetrics = [
        ["批次询单总数", number.format(metrics.cohort.inquiries)],
        ["当前已成交", number.format(metrics.cohort.wonCustomers)],
        ["最终成交金额", currency.format(metrics.cohort.wonAmount)],
        ["批次成交率", percent(metrics.cohort.conversionRate)],
        ["批次平均客单价", currency.format(metrics.cohort.averageOrderValue)],
        ["当前跟进", number.format(metrics.cohort.activeCustomers)],
        ["已关闭", number.format(metrics.cohort.closedCustomers)],
    ];
    const rangeLabel = `${businessDateLabel(start)} — ${businessDateLabel(end)}`;
    const cycleComparison = conversionCycle.changeDays == null
        ? conversionCycle.previousSamples
            ? "本期暂无样本"
            : "上期暂无样本"
        : Math.abs(conversionCycle.changeDays) < 0.05
            ? "与上期持平"
            : conversionCycle.changeDays < 0
                ? `较上期缩短 ${decimal.format(Math.abs(conversionCycle.changeDays))} 天`
                : `较上期延长 ${decimal.format(conversionCycle.changeDays)} 天`;
    const cycleHint = conversionCycle.samples
        ? `中位数 ${cycleDays(conversionCycle.medianDays)} · ${conversionCycle.samples} 单 · ${cycleComparison}`
        : "所选周期暂无有效成交样本";
    const dashboardQuery = new URLSearchParams({ preset });
    if (params.start)
        dashboardQuery.set("start", params.start);
    if (params.end)
        dashboardQuery.set("end", params.end);
    const cycleReturnTo = `/dashboard?${dashboardQuery.toString()}#conversion-cycle`;
    return (<div className="space-y-6">
      <PageHeading title="业务总览" eyebrow="BUSINESS INTELLIGENCE" description="经营结果、询单批次、制作任务和来源效率的实时数据总览。" className="mb-0"/>

      <FilterBar>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
              <CalendarDays className="size-4" strokeWidth={1.8}/>
            </span>
            <div>
              <p className="crm-label">统计周期</p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-700">{rangeLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100/80 p-1 xl:ml-5">
            {presets.map(([value, label]) => (<Button key={value} size="sm" variant={preset === value ? "default" : "ghost"} className={preset !== value ? "bg-transparent shadow-none" : ""} asChild>
                <Link href={`/dashboard?preset=${value}`}>{label}</Link>
              </Button>))}
          </div>
          <form className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <input type="hidden" name="preset" value="custom"/>
            <Input type="date" name="start" defaultValue={params.start} required className="w-40" aria-label="开始日期"/>
            <span className="text-[11px] text-muted-foreground">至</span>
            <Input type="date" name="end" defaultValue={params.end} required className="w-40" aria-label="结束日期"/>
            <Button type="submit" size="sm" variant={preset === "custom" ? "default" : "outline"}>应用日期</Button>
          </form>
        </div>
      </FilterBar>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1900px]:grid-cols-6">
        {primaryCards.map(({ href, ...card }) => href ? (<Link key={card.label} href={href} aria-label={`${card.label}，查看所选周期待补充客户`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30">
            <StatCard {...card} className="h-full"/>
          </Link>) : <StatCard key={card.label} {...card}/>)}
        <Link href="#conversion-cycle" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30">
          <StatCard label="平均成交周期" value={cycleDays(conversionCycle.averageDays)} hint={cycleHint} icon={Timer} tone="amber" className="h-full"/>
        </Link>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
        <SectionCard title="客户结构" description="成交表现与无效客户情况。" contentClassName="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          {customerMetrics.map(([label, value]) => (<div key={label} className="bg-white px-5 py-4">
              <p className="crm-label">{label}</p>
              <p className="crm-metric mt-2 text-[20px] font-semibold text-slate-900">{value}</p>
            </div>))}
        </SectionCard>

        <SectionCard title="制作任务" description="当前行程与报价待制作、待修改数量。" contentClassName="grid grid-cols-2 gap-px bg-slate-100">
          {planningMetrics.map(([label, value, Icon]) => (<div key={String(label)} className="bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="crm-label">{String(label)}</p>
                <Icon className="size-3.5 text-slate-400" strokeWidth={1.8}/>
              </div>
              <p className="crm-metric mt-2 text-[20px] font-semibold text-slate-900">{String(value)}</p>
            </div>))}
        </SectionCard>
      </div>

      <SectionCard title="询单批次表现" description="按首次询单时间形成客户批次，持续追踪该批次后续经营结果。" contentClassName="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        {cohortMetrics.map(([label, value]) => (<div key={label} className="bg-white px-5 py-4">
            <p className="crm-label">{label}</p>
            <p className="crm-metric mt-2 text-[19px] font-semibold text-slate-900">{value}</p>
          </div>))}
        <div className="flex items-start gap-3 bg-blue-50/45 px-5 py-4 text-[11px] leading-5 text-slate-600">
          <Handshake className="mt-0.5 size-4 shrink-0 text-blue-600" strokeWidth={1.8}/>
          <p>询单批次按首次询单时间选人；后续月份发生的成交仍计入原询单批次。</p>
        </div>
      </SectionCard>

      <DashboardChart points={trend}/>

      <div id="conversion-cycle" className="scroll-mt-6">
        <SectionCard title="成交周期分析" description="从首次询单到实际成交，按中国时区自然日计算；统计范围按成交日期筛选。" actions={(<div className="text-right">
              <p className="crm-label">上一周期平均</p>
              <p className="mt-1 font-mono text-[13px] font-semibold text-slate-800">
                {cycleDays(conversionCycle.previousAverageDays)}
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {conversionCycle.previousSamples} 单
                </span>
              </p>
            </div>)} contentClassName="divide-y divide-slate-100">
          <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)]">
            <section className="border-b border-slate-100 p-5 xl:border-b-0 xl:border-r">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-[12px] font-semibold text-slate-900">周期分布</h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">用于识别成交集中区间和长周期订单。</p>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">有效样本 {conversionCycle.samples}</p>
              </div>
              <div className="space-y-3.5">
                {conversionCycle.distribution.map((bucket) => (<div key={bucket.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                      <span className="font-medium text-slate-700">{bucket.label}</span>
                      <span className="font-mono text-slate-600">{bucket.count} 单 · {percent(bucket.share)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${bucket.share * 100}%` }}/>
                    </div>
                  </div>))}
              </div>
              {conversionCycle.excludedSamples > 0 && (<p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-800">
                  另有 {conversionCycle.excludedSamples} 个成交客户因日期缺失或先后顺序异常未进入统计。
                </p>)}
            </section>

            <section className="p-5">
              <div className="mb-3">
                <h3 className="text-[12px] font-semibold text-slate-900">按客户来源</h3>
                <p className="mt-1 text-[10px] text-muted-foreground">比较不同获客来源的成交速度；少于 3 单时标记为样本较少。</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200/80">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead>来源</TableHead>
                      <TableHead className="text-right">样本</TableHead>
                      <TableHead className="text-right">平均周期</TableHead>
                      <TableHead className="text-right">中位数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversionCycle.bySource.map((row) => (<TableRow key={row.source}>
                        <TableCell className="font-medium text-slate-800">{row.source}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.samples}
                          {row.samples < 3 && <span className="ml-1 text-[9px] text-amber-700">样本少</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono">{cycleDays(row.averageDays)}</TableCell>
                        <TableCell className="text-right font-mono">{cycleDays(row.medianDays)}</TableCell>
                      </TableRow>))}
                    {!conversionCycle.bySource.length && (<TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">所选周期暂无来源成交周期数据</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <section>
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-900">成交周期最长客户</h3>
                <p className="mt-1 text-[10px] text-muted-foreground">最多展示 10 位，点击客户名称可进入资料复盘。</p>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{rangeLabel}</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    {[
            "客户",
            "来源",
            "首次询单",
            "成交日期",
            "成交周期",
        ].map((label, index) => <TableHead key={label} className={index === 4 ? "text-right" : ""}>{label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversionCycle.slowestCustomers.map((customer) => {
            const customerQuery = new URLSearchParams({ returnTo: cycleReturnTo });
            return (<TableRow key={customer.id}>
                        <TableCell>
                          <Link href={`/customers/${customer.id}?${customerQuery.toString()}`} className="font-medium text-blue-700 hover:underline">
                            {customer.name}
                          </Link>
                        </TableCell>
                        <TableCell>{customer.source}</TableCell>
                        <TableCell className="font-mono text-[11px]">{businessDate.format(new Date(customer.firstInquiryAt))}</TableCell>
                        <TableCell className="font-mono text-[11px]">{businessDate.format(new Date(customer.wonAt))}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{customer.cycleDays} 天</TableCell>
                      </TableRow>);
        })}
                  {!conversionCycle.slowestCustomers.length && (<TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">所选周期暂无可复盘的成交客户</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </section>
        </SectionCard>
      </div>

      <SectionCard title="来源分析" description="经营结果口径：询单按首次询单时间，成交客户及金额按实际成交时间。" contentClassName="overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              {["来源", "询单量", "成交客户数", "成交金额", "成交率", "平均客单价"].map((item, index) => (<TableHead key={item} className={index > 0 ? "text-right" : ""}>{item}</TableHead>))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((row) => (<TableRow key={row.source}>
                <TableCell className="font-medium text-slate-800">{row.source}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.inquiries}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.wonCustomers}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{currency.format(row.wonAmount)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{percent(row.conversionRate)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{currency.format(row.averageOrderValue)}</TableCell>
              </TableRow>))}
            {!sources.length && (<TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <CircleOff className="mx-auto mb-2 size-6 text-slate-300"/>
                  <p className="font-medium text-slate-600">所选时间范围暂无来源数据</p>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </SectionCard>
    </div>);
}
