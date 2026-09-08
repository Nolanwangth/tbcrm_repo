import { useEffect, useState } from "react";
import { Download, LoaderCircle, Printer, X } from "lucide-react";
import { downloadBlob, generateItineraryDocx } from "../lib/docxGenerator";
import { DEFAULT_ITINERARY_DOCUMENT_DRAFT, ITINERARY_DOCUMENT_DRAFT_KEY, ItineraryDocumentParseError, parseItineraryDocument, type ItineraryDocumentDraft, } from "../lib/itineraryDocument";
interface Props {
    notify: (message: string) => void;
    embedded?: boolean;
    customerName?: string;
    adults?: number;
    childCount?: number;
    seniors?: number;
    storageKey?: string;
    publishing?: boolean;
    onPublish?: (draft: ItineraryDocumentDraft) => Promise<void>;
    initialDraft?: ItineraryDocumentDraft;
}
function loadDraft(storageKey: string, defaults: ItineraryDocumentDraft): ItineraryDocumentDraft {
    try {
        const saved = localStorage.getItem(storageKey);
        if (!saved)
            return defaults;
        return { ...defaults, ...JSON.parse(saved) as Partial<ItineraryDocumentDraft> };
    }
    catch {
        return defaults;
    }
}
export function AutoDocumentPage({ notify, embedded = false, customerName = "", adults = 0, childCount = 0, seniors = 0, storageKey = ITINERARY_DOCUMENT_DRAFT_KEY, publishing = false, onPublish, initialDraft }: Props) {
    const defaults = { ...DEFAULT_ITINERARY_DOCUMENT_DRAFT, clientName: customerName, adults, children: childCount, seniors };
    const [draft, setDraft] = useState<ItineraryDocumentDraft>(() => initialDraft ?? loadDraft(storageKey, defaults));
    const [generating, setGenerating] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(draft));
    }, [draft, storageKey]);
    const update = <Key extends keyof ItineraryDocumentDraft>(key: Key, value: ItineraryDocumentDraft[Key]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };
    const generate = async () => {
        setGenerating(true);
        try {
            const parsed = parseItineraryDocument(draft);
            const { blob, filename } = await generateItineraryDocx(parsed);
            downloadBlob(blob, filename);
            notify("Word 行程书已生成");
        }
        catch (error) {
            notify(error instanceof ItineraryDocumentParseError ? error.message : error instanceof Error ? error.message : "文档生成失败");
        }
        finally {
            setGenerating(false);
        }
    };
    const publish = async () => {
        if (!onPublish)
            return;
        setGenerating(true);
        try {
            parseItineraryDocument(draft);
            await onPublish(draft);
        }
        catch (error) {
            notify(error instanceof ItineraryDocumentParseError ? error.message : error instanceof Error ? error.message : "保存正式版本失败");
        }
        finally {
            setGenerating(false);
        }
    };
    const preview = () => {
        try {
            parseItineraryDocument(draft);
            setPreviewing(true);
        }
        catch (error) {
            notify(error instanceof Error ? error.message : "行程格式无法预览");
        }
    };
    return (<main className={`auto-document-page ${embedded ? "embedded-document-page" : ""}`}>
      <header className="auto-document-heading">
        <div>
          <span className="section-kicker">TRIPBOOK DOCUMENT AUTOMATION</span>
          <h1>英文行程 Word 导出</h1>
          <p>粘贴英文行程，直接生成 TripBook Word 行程书。</p>
        </div>
        <button className="primary-button auto-document-download" disabled={generating} onClick={generate}>
          {generating ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>}
          {generating ? "正在生成…" : "生成 Word 行程书"}
        </button>
        <button className="primary-button auto-document-download" disabled={generating} onClick={preview}><Printer size={17}/>行程预览 / PDF</button>
        {onPublish && <button className="primary-button auto-document-download" disabled={generating || publishing} onClick={publish}>
          {publishing ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>}
          {publishing ? "正在归档…" : "保存正式版本"}
        </button>}
      </header>

      <section className="auto-document-card client-document-card">
        <div className="auto-document-client-grid">
          <label className="client-name-field">英文行程客户姓名<input placeholder="默认可填写 Client" value={draft.clientName} onChange={(event) => update("clientName", event.target.value)}/></label>
          <label>成人<input type="number" min={0} value={draft.adults} onChange={(event) => update("adults", Number(event.target.value))}/></label>
          <label>儿童<input type="number" min={0} value={draft.children} onChange={(event) => update("children", Number(event.target.value))}/></label>
          <label>老人<input type="number" min={0} value={draft.seniors} onChange={(event) => update("seniors", Number(event.target.value))}/></label>
        </div>
      </section>

      <section className="auto-document-card auto-document-input itinerary-input-card original-itinerary-input">
        <textarea rows={14} spellCheck={false} value={draft.itineraryText} onChange={(event) => update("itineraryText", event.target.value)} placeholder="把翻译好的英文行程粘贴到这里，格式保持 Day 1 ｜ August 6 ｜ Kunming / Private Transfer / Guide / Morning / Afternoon / Evening / Remarks；没有的段落可以不写"/>
        <p className="original-itinerary-hint">粘贴英文行程后，按行程模板生成 Word。</p>
      </section>
      {previewing && <ItineraryPrintPreview draft={draft} onClose={() => setPreviewing(false)}/>}
    </main>);
}
function ItineraryPrintPreview({ draft, onClose }: {
    draft: ItineraryDocumentDraft;
    onClose: () => void;
}) {
    const parsed = parseItineraryDocument(draft);
    useEffect(() => { const title = document.title; document.title = `${parsed.clientName} Tripbook Itinerary`; return () => { document.title = title; }; }, [parsed.clientName]);
    return <div className="print-preview-layer"><div className="print-toolbar"><div><strong>英文行程打印预览</strong><span>A4 · 与已冻结版本内容一致</span></div><div><button className="ghost-button" onClick={onClose}><X size={16}/>关闭</button><button className="primary-button" onClick={() => window.print()}><Printer size={16}/>打印 / 保存 PDF</button></div></div><article className="print-sheet itinerary-print-sheet"><header className="proposal-header"><div className="proposal-title"><span className="proposal-brand-name">Tripbook</span><h1>PRIVATE TOUR ITINERARY</h1></div><div className="proposal-meta"><span>Client</span><strong>{parsed.clientName}</strong></div></header><p className="itinerary-guest-line">Guests: {parsed.adults} Adult(s){parsed.children ? ` · ${parsed.children} Child(ren)` : ""}{parsed.seniors ? ` · ${parsed.seniors} Senior(s)` : ""}</p>{parsed.days.map((day) => <section key={day.dayNumber} className="direct-print-day"><header><div><strong>Day {String(day.dayNumber).padStart(2, "0")}</strong><span>{day.date || "Date TBD"}</span></div><strong>{day.city}</strong></header><div className="itinerary-print-body">{[day.transfer, day.guide, day.start].filter(Boolean).map((line) => <p key={line}>{line}</p>)}{[day.fullDay, day.morning, day.afternoon, day.evening, day.remarks].filter((part) => part.title || part.body).map((part, index) => <div key={`${part.title}-${index}`}><b>{part.title}</b><p>{part.body}</p></div>)}</div></section>)}</article></div>;
}
