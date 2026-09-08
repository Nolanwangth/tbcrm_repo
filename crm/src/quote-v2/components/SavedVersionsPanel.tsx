import { ArchiveRestore, Copy, FilePenLine, Pencil, Trash2 } from "lucide-react";
import type { SavedDirectQuote, SavedProposal } from "../types";
type SavedVersion = SavedProposal | SavedDirectQuote;
interface Props<T extends SavedVersion> {
    savedProposals: T[];
    onLoad: (proposal: T) => void;
    onDuplicate: (proposal: T) => void;
    onEditNote: (proposal: T) => void;
    onDeleteVersion: (id: string) => void;
    onRenameCustomer: (customerName: string) => void;
    onRenameProposal: (customerName: string, proposalName: string) => void;
    onDeleteCustomer?: (customerName: string) => void;
    onDeleteProposal?: (customerName: string, proposalName: string) => void;
    getMetadata: (proposal: T) => string;
    emptyLabel: string;
}
export function SavedVersionsPanel<T extends SavedVersion>({ savedProposals, onLoad, onDuplicate, onEditNote, onDeleteVersion, onRenameCustomer, onRenameProposal, onDeleteCustomer, onDeleteProposal, getMetadata, emptyLabel, }: Props<T>) {
    if (savedProposals.length === 0) {
        return <div className="empty-state small"><ArchiveRestore size={26}/><strong>还没有保存的版本</strong><span>{emptyLabel}</span></div>;
    }
    const customers = Array.from(new Set(savedProposals.map((saved) => saved.customerName)));
    return <div className="saved-customer-list">
    {customers.map((customerName) => {
            const customerItems = savedProposals.filter((saved) => saved.customerName === customerName);
            const proposals = Array.from(new Set(customerItems.map((saved) => saved.proposalName)));
            return <section className="saved-customer" key={customerName}>
        <header>
          <div><strong>{customerName}</strong><span>{proposals.length} 个方案 · {customerItems.length} 个版本</span></div>
          <div className="saved-heading-actions">
            <button className="saved-icon-action" onClick={() => onRenameCustomer(customerName)} title="重命名客户"><Pencil size={14}/></button>
            {onDeleteCustomer && <button className="saved-icon-action danger" onClick={() => onDeleteCustomer(customerName)} title="删除客户及全部版本"><Trash2 size={14}/></button>}
          </div>
        </header>
        <div className="saved-proposal-list">
          {proposals.map((proposalName) => {
                    const versions = customerItems
                        .filter((saved) => saved.proposalName === proposalName)
                        .sort((a, b) => b.version - a.version);
                    return <section className="saved-proposal" key={`${customerName}-${proposalName}`}>
              <header>
                <div><strong>{proposalName}</strong><span>最新 V{versions[0]?.version ?? 1}</span></div>
                <div className="saved-heading-actions">
                  <button className="saved-text-action" onClick={() => onRenameProposal(customerName, proposalName)}><Pencil size={12}/>重命名方案</button>
                  {onDeleteProposal && <button className="saved-text-action danger" onClick={() => onDeleteProposal(customerName, proposalName)}><Trash2 size={12}/>删除方案</button>}
                </div>
              </header>
              <div className="saved-version-list">
                {versions.map((saved) => <article className="saved-version-row" key={saved.id}>
                  <span className="version-badge">V{saved.version}</span>
                  <div className="saved-version-copy">
                    <strong>{saved.versionNote || "无版本备注"}</strong>
                    <span>{new Date(saved.savedAt).toLocaleString("zh-CN")} · {getMetadata(saved)}</span>
                  </div>
                  <div className="saved-version-actions">
                    <button onClick={() => onLoad(saved)}><ArchiveRestore size={13}/>加载</button>
                    <button onClick={() => onDuplicate(saved)}><Copy size={13}/>复制为新版本</button>
                    <button onClick={() => onEditNote(saved)}><FilePenLine size={13}/>备注</button>
                    <button className="danger" onClick={() => onDeleteVersion(saved.id)}><Trash2 size={13}/>删除</button>
                  </div>
                </article>)}
              </div>
            </section>;
                })}
        </div>
      </section>;
        })}
  </div>;
}
