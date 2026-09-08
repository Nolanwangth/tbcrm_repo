import { useEffect, useMemo, useState } from "react";
import { FolderKanban, History, Search, X } from "lucide-react";
import { SavedVersionsPanel } from "./SavedVersionsPanel";
import type { DirectQuoteGroup, SavedDirectQuote } from "../types";
interface Props {
    savedDirectQuotes: SavedDirectQuote[];
    groups: DirectQuoteGroup[];
    initialGroupId?: string;
    onClose: () => void;
    onLoad: (proposal: SavedDirectQuote) => void;
    onDeleteVersion: (id: string) => void;
    onDuplicate: (proposal: SavedDirectQuote) => void;
    onEditNote: (proposal: SavedDirectQuote) => void;
    onRenameCustomer: (customerName: string) => void;
    onRenameProposal: (customerName: string, proposalName: string) => void;
}
export function DirectQuoteHistoryDrawer({ savedDirectQuotes, groups, initialGroupId, onClose, onLoad, onDeleteVersion, onDuplicate, onEditNote, onRenameCustomer, onRenameProposal, }: Props) {
    const [query, setQuery] = useState("");
    const [groupId, setGroupId] = useState(initialGroupId || "all");
    const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
    const filteredQuotes = useMemo(() => {
        const keyword = query.trim().toLocaleLowerCase();
        return savedDirectQuotes.filter((saved) => (groupId === "all" || saved.groupId === groupId) &&
            (!keyword || [
                saved.customerName,
                saved.proposalName,
                saved.versionNote || "",
                saved.groupId ? groupNames.get(saved.groupId) || "" : "",
            ].some((value) => value.toLocaleLowerCase().includes(keyword))));
    }, [groupId, groupNames, query, savedDirectQuotes]);
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);
    return (<div className="history-drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="history-drawer" role="dialog" aria-modal="true" aria-label="直接报价历史版本">
        <header className="history-drawer-header">
          <div><span><History size={18}/></span><div><h2>直接报价历史版本</h2><p>{savedDirectQuotes.length} 个已保存版本</p></div></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭历史版本"><X size={19}/></button>
        </header>
        <div className="history-search">
          <Search size={16}/>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户或方案名称" aria-label="搜索客户或方案名称"/>
          {query && <button onClick={() => setQuery("")}>清除</button>}
        </div>
        <label className="history-group-filter">
          <FolderKanban size={16}/>
          <span>分组</span>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="all">全部分组</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <div className="history-drawer-content">
          {filteredQuotes.length > 0 || (!query.trim() && groupId === "all")
            ? <SavedVersionsPanel savedProposals={filteredQuotes} onLoad={onLoad} onDeleteVersion={onDeleteVersion} onDuplicate={onDuplicate} onEditNote={onEditNote} onRenameCustomer={onRenameCustomer} onRenameProposal={onRenameProposal} getMetadata={(saved) => `${saved.groupId ? groupNames.get(saved.groupId) || "未命名分组" : "未分组"} · ${saved.quote.days.length} 天 · ${saved.quote.people} 人 · ${saved.quote.items.length} 项`} emptyLabel="保存直接报价后，版本会显示在这里"/>
            : <div className="empty-state history-search-empty"><Search size={27}/><strong>没有匹配的历史版本</strong><span>请尝试其他客户、方案名称或分组</span></div>}
        </div>
        <footer className="history-drawer-footer">删除整个方案或客户，请前往“设置 → 直接报价存档”。</footer>
      </aside>
    </div>);
}
