import { DatabaseZap } from "lucide-react";
export function PreviewBanner() {
    return (<div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      <DatabaseZap className="size-4 shrink-0"/>
      <span>
        当前为界面预览模式，显示与数据库种子一致的演示客户；连接 Supabase 后，新增、修改和文件操作将写入数据库。
      </span>
    </div>);
}
