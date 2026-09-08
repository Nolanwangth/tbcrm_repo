import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
interface Props {
    children: ReactNode;
}
interface State {
    error: Error | null;
}
export class AppErrorBoundary extends Component<Props, State> {
    state: State = { error: null };
    static getDerivedStateFromError(error: Error): State {
        return { error };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[quick-tour-proposal] application render failed", error, info.componentStack);
    }
    render() {
        if (!this.state.error)
            return this.props.children;
        return <main className="server-gate">
      <section className="server-gate-card app-error-card">
        <div className="server-gate-brand"><span><TriangleAlert size={28}/></span><div><strong>页面没有成功加载</strong><small>共享数据未被修改</small></div></div>
        <div className="server-gate-status server-gate-error">
          <strong>浏览器兼容性或本机草稿数据阻止了页面显示。</strong>
          <span>请先重新加载；若仍无法进入，请联系管理员导出并检查本机草稿，切勿直接清除浏览器数据。</span>
          <button className="primary-button" onClick={() => window.location.reload()}><RefreshCw size={16}/>重新加载</button>
        </div>
      </section>
    </main>;
    }
}
