"use client";
import { useId, useState } from "react";
import { ChartNoAxesCombined, CircleOff } from "lucide-react";
import type { TrendMetric } from "@/lib/analytics";
import { cn } from "@/lib/utils";
type Point = {
    key: string;
    label: string;
    inquiries: number;
    wonCustomers: number;
    wonAmount: number;
};
const metrics: {
    value: TrendMetric;
    label: string;
    description: string;
}[] = [
    { value: "inquiries", label: "询单量", description: "按首次询单时间" },
    { value: "wonCustomers", label: "成交客户数", description: "按实际成交时间" },
    { value: "wonAmount", label: "成交金额", description: "按实际成交时间" },
];
function niceMaximum(value: number) {
    if (value <= 4)
        return 4;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const nice = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
}
export function DashboardChart({ points }: {
    points: Point[];
}) {
    const [metric, setMetric] = useState<TrendMetric>("inquiries");
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const gradientId = useId();
    const width = 1120;
    const height = 340;
    const padding = { left: 72, right: 28, top: 30, bottom: 52 };
    const plotBottom = height - padding.bottom;
    const values = points.map((point) => point[metric]);
    const max = niceMaximum(Math.max(...values, 1));
    const coordinates = points.map((point, index) => ({
        ...point,
        x: padding.left + (index / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right),
        y: padding.top + (1 - point[metric] / max) * (plotBottom - padding.top),
    }));
    const exactFormatter = new Intl.NumberFormat("zh-CN", metric === "wonAmount"
        ? { style: "currency", currency: "CNY", maximumFractionDigits: 0 }
        : { maximumFractionDigits: 0 });
    const axisFormatter = new Intl.NumberFormat("zh-CN", metric === "wonAmount"
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { maximumFractionDigits: 0 });
    const selectedMetric = metrics.find((item) => item.value === metric) ?? metrics[0];
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
    const areaPath = coordinates.length
        ? `M ${coordinates[0].x} ${plotBottom} L ${coordinates.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${coordinates.at(-1)?.x ?? padding.left} ${plotBottom} Z`
        : "";
    const hovered = hoveredIndex == null ? null : coordinates[hoveredIndex];
    const tooltipWidth = 196;
    const tooltipHeight = 66;
    const tooltipX = hovered
        ? Math.min(Math.max(hovered.x - tooltipWidth / 2, padding.left), width - padding.right - tooltipWidth)
        : 0;
    const tooltipY = hovered ? Math.max(8, hovered.y - tooltipHeight - 18) : 0;
    return (<section className="crm-panel overflow-hidden">
      <header className="crm-section-header">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <ChartNoAxesCombined className="size-4.5" strokeWidth={1.8}/>
          </span>
          <div>
            <h2 className="crm-section-title">经营趋势</h2>
            <p className="crm-section-description">
              {selectedMetric.description}；没有数据的日期自动补 0。
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {metrics.map((item) => (<button key={item.value} type="button" aria-pressed={metric === item.value} className={cn("h-8 rounded-md px-3 text-[11px] font-medium text-slate-500 transition-[background-color,color,box-shadow] duration-150 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30", metric === item.value && "bg-white text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.1)]")} onClick={() => {
                setMetric(item.value);
                setHoveredIndex(null);
            }}>
              {item.label}
            </button>))}
        </div>
      </header>

      {points.length ? (<div className="crm-scrollbar overflow-x-auto px-4 pb-4 pt-2 sm:px-5">
          <svg viewBox={`0 0 ${width} ${height}`} className="block h-[340px] min-w-[760px] w-full" role="img" aria-label={`${selectedMetric.label}趋势图`}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.13"/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.015"/>
              </linearGradient>
              <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
                <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#0f172a" floodOpacity="0.12"/>
              </filter>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + ratio * (plotBottom - padding.top);
                const value = max * (1 - ratio);
                return (<g key={ratio}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e8edf3" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                  <text x={padding.left - 13} y={y + 4} textAnchor="end" fontSize="10" fontFamily="var(--font-geist-mono)" fill="#94a3b8">
                    {axisFormatter.format(value)}
                  </text>
                </g>);
            })}

            <path d={areaPath} fill={`url(#${gradientId})`} className="transition-all duration-300"/>
            <polyline fill="none" stroke="#3974e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={linePoints} className="transition-all duration-300"/>

            {coordinates.map((point, index) => (<g key={point.key}>
                <rect x={point.x - (width - padding.left - padding.right) / Math.max(points.length, 1) / 2} y={padding.top} width={(width - padding.left - padding.right) / Math.max(points.length, 1)} height={plotBottom - padding.top} fill="transparent" pointerEvents="all" cursor="crosshair" tabIndex={0} aria-label={`${point.label}，${selectedMetric.label}：${exactFormatter.format(point[metric])}`} onMouseEnter={() => setHoveredIndex(index)} onMouseMove={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)}/>
                {index % labelStep === 0 && (<text x={point.x} y={height - 20} textAnchor="middle" fontSize="10" fontFamily="var(--font-geist-sans)" fill="#94a3b8">
                    {point.label}
                  </text>)}
              </g>))}

            {hovered && (<g className="pointer-events-none">
                <line x1={hovered.x} x2={hovered.x} y1={padding.top} y2={plotBottom} stroke="#94a3b8" strokeDasharray="3 5" strokeOpacity="0.55" vectorEffect="non-scaling-stroke"/>
                <circle cx={hovered.x} cy={hovered.y} r="7" fill="#fff" stroke="#3974e8" strokeWidth="2.5"/>
                <circle cx={hovered.x} cy={hovered.y} r="2.5" fill="#3974e8"/>
                <g filter={`url(#${gradientId}-shadow)`}>
                  <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="10" fill="#ffffff" stroke="#e2e8f0"/>
                </g>
                <text x={tooltipX + 15} y={tooltipY + 23} fontSize="10" fill="#64748b">
                  {hovered.label} · {selectedMetric.label}
                </text>
                <text x={tooltipX + 15} y={tooltipY + 48} fontSize="17" fontWeight="600" fontFamily="var(--font-geist-mono)" fill="#0f172a">
                  {exactFormatter.format(hovered[metric])}
                </text>
              </g>)}
          </svg>
        </div>) : (<div className="p-5">
          <div className="crm-empty">
            <div>
              <CircleOff className="mx-auto size-7 text-slate-300"/>
              <p className="mt-3 font-medium text-slate-700">所选时间范围暂无趋势数据</p>
              <p className="mt-1 text-[11px] text-muted-foreground">调整统计周期后再查看。</p>
            </div>
          </div>
        </div>)}
    </section>);
}
