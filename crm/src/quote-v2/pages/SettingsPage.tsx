import { useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { DatabaseBackup, Download, FileClock, RotateCcw, Save, Upload } from "lucide-react";
import { SavedVersionsPanel } from "../components/SavedVersionsPanel";
import type { AppSettings, DirectQuoteGroup, SavedDirectQuote, SavedProposal } from "../types";
interface Props {
    settings: AppSettings;
    setSettings: Dispatch<SetStateAction<AppSettings>>;
    savedProposals: SavedProposal[];
    onLoadProposal: (proposal: SavedProposal) => void;
    onDeleteProposal: (id: string) => void;
    onDuplicateProposal: (proposal: SavedProposal) => void;
    onEditProposalNote: (proposal: SavedProposal) => void;
    onRenameCustomer: (customerName: string) => void;
    onRenameProposal: (customerName: string, proposalName: string) => void;
    onDeleteCustomer: (customerName: string) => void;
    onDeleteProposalGroup: (customerName: string, proposalName: string) => void;
    savedDirectQuotes: SavedDirectQuote[];
    directGroups: DirectQuoteGroup[];
    onLoadDirectQuote: (proposal: SavedDirectQuote) => void;
    onDeleteDirectQuote: (id: string) => void;
    onDuplicateDirectQuote: (proposal: SavedDirectQuote) => void;
    onEditDirectQuoteNote: (proposal: SavedDirectQuote) => void;
    onRenameDirectCustomer: (customerName: string) => void;
    onRenameDirectProposal: (customerName: string, proposalName: string) => void;
    onDeleteDirectCustomer: (customerName: string) => void;
    onDeleteDirectProposal: (customerName: string, proposalName: string) => void;
    onExport: () => void;
    onImport: (file: File) => void;
    onReset: () => void;
}
export function SettingsPage({ settings, setSettings, savedProposals, onLoadProposal, onDeleteProposal, onDuplicateProposal, onEditProposalNote, onRenameCustomer, onRenameProposal, onDeleteCustomer, onDeleteProposalGroup, savedDirectQuotes, directGroups, onLoadDirectQuote, onDeleteDirectQuote, onDuplicateDirectQuote, onEditDirectQuoteNote, onRenameDirectCustomer, onRenameDirectProposal, onDeleteDirectCustomer, onDeleteDirectProposal, onExport, onImport, onReset, }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const selectFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file)
        onImport(file); event.target.value = ""; };
    return <main className="settings-page">
    <section className="library-heading"><div><span className="section-kicker">SHARED SETTINGS</span><h1>设置与共享数据</h1><p>价格、模板和已保存版本由内网服务器统一保存，浏览器与 DMG 客户端共用。</p></div></section>
    <div className="settings-grid">
      <section className="settings-card"><header><span className="settings-icon"><Save size={20}/></span><div><h2>客户方案默认内容</h2><p>用于客户版打印预览，不会显示内部成本信息。</p></div></header><div className="settings-form"><label>显示名称<input value={settings.companyName} onChange={(event) => setSettings({ ...settings, companyName: event.target.value })}/></label><label>Price Includes<textarea rows={4} value={settings.priceIncludes} onChange={(event) => setSettings({ ...settings, priceIncludes: event.target.value })}/></label><label>Price Excludes<textarea rows={4} value={settings.priceExcludes} onChange={(event) => setSettings({ ...settings, priceExcludes: event.target.value })}/></label><label>Preliminary Proposal Notice<textarea rows={4} value={settings.proposalNotice} onChange={(event) => setSettings({ ...settings, proposalNotice: event.target.value })}/></label></div></section>
      <section className="settings-card"><header><span className="settings-icon"><DatabaseBackup size={20}/></span><div><h2>JSON 备份与恢复</h2><p>导出当前内容，必要时可恢复到共享服务器。</p></div></header><div className="backup-actions"><button className="setting-action" onClick={onExport}><span><Download size={19}/></span><div><strong>导出 JSON 备份</strong><small>包含模板、价格、当前方案和已保存版本</small></div></button><button className="setting-action" onClick={() => fileRef.current?.click()}><span><Upload size={19}/></span><div><strong>导入 JSON 恢复</strong><small>导入后会同步给所有员工</small></div></button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={selectFile}/><button className="setting-action danger-zone" onClick={onReset}><span><RotateCcw size={19}/></span><div><strong>清空并恢复示例数据</strong><small>会影响所有员工，需要连续两次确认</small></div></button></div></section>
      <section className="settings-card recent-card"><header><span className="settings-icon"><FileClock size={20}/></span><div><h2>快速方案存档</h2><p>按“客户 → 方案 → V1 / V2 / V3”保存；每个方案最多保留 30 个版本。</p></div></header><SavedVersionsPanel savedProposals={savedProposals} onLoad={onLoadProposal} onDeleteVersion={onDeleteProposal} onDuplicate={onDuplicateProposal} onEditNote={onEditProposalNote} onRenameCustomer={onRenameCustomer} onRenameProposal={onRenameProposal} onDeleteCustomer={onDeleteCustomer} onDeleteProposal={onDeleteProposalGroup} getMetadata={(saved) => `${saved.plan.days.length} 天 · ${saved.plan.people} 人`} emptyLabel="在“快速方案”顶部点击“保存版本”创建 V1"/></section>
      <section className="settings-card recent-card"><header><span className="settings-icon"><FileClock size={20}/></span><div><h2>直接报价存档</h2><p>按直接报价页面中选择的分组归档，所有员工均可查看。</p></div></header><SavedVersionsPanel savedProposals={savedDirectQuotes} onLoad={onLoadDirectQuote} onDeleteVersion={onDeleteDirectQuote} onDuplicate={onDuplicateDirectQuote} onEditNote={onEditDirectQuoteNote} onRenameCustomer={onRenameDirectCustomer} onRenameProposal={onRenameDirectProposal} onDeleteCustomer={onDeleteDirectCustomer} onDeleteProposal={onDeleteDirectProposal} getMetadata={(saved) => `${directGroups.find((group) => group.id === saved.groupId)?.name || "未分组"} · ${saved.quote.days.length} 天 · ${saved.quote.people} 人 · ${saved.quote.items.length} 项`} emptyLabel="在“直接报价”底部点击“保存版本”创建 V1"/></section>
    </div>
  </main>;
}
