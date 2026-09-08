import { useEffect, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { downloadBlob, generateItineraryDocx } from "../lib/docxGenerator";
import { DEFAULT_ITINERARY_DOCUMENT_DRAFT, ITINERARY_DOCUMENT_DRAFT_KEY, ItineraryDocumentParseError, parseItineraryDocument, type ItineraryDocumentDraft, } from "../lib/itineraryDocument";
interface Props {
    notify: (message: string) => void;
    embedded?: boolean;
    value?: ItineraryDocumentDraft;
    onChange?: (draft: ItineraryDocumentDraft) => void;
    readOnly?: boolean;
}
function loadDraft(): ItineraryDocumentDraft {
    try {
        const saved = localStorage.getItem(ITINERARY_DOCUMENT_DRAFT_KEY);
        if (!saved)
            return DEFAULT_ITINERARY_DOCUMENT_DRAFT;
        return { ...DEFAULT_ITINERARY_DOCUMENT_DRAFT, ...JSON.parse(saved) as Partial<ItineraryDocumentDraft> };
    }
    catch {
        return DEFAULT_ITINERARY_DOCUMENT_DRAFT;
    }
}
export function AutoDocumentPage({ notify, embedded = false, value, onChange, readOnly = false }: Props) {
    const [localDraft, setLocalDraft] = useState<ItineraryDocumentDraft>(() => value ?? loadDraft());
    const draft = value ?? localDraft;
    const [generating, setGenerating] = useState(false);
    useEffect(() => {
        if (!value)
            localStorage.setItem(ITINERARY_DOCUMENT_DRAFT_KEY, JSON.stringify(draft));
    }, [draft, value]);
    const update = <Key extends keyof ItineraryDocumentDraft>(key: Key, value: ItineraryDocumentDraft[Key]) => {
        if (readOnly)
            return;
        const next = { ...draft, [key]: value };
        if (onChange)
            onChange(next);
        else
            setLocalDraft(next);
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
      </header>

      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}><section className="auto-document-card client-document-card">
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
      </section></fieldset>
    </main>);
}
