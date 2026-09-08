import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { createId } from "../lib/id";
import { LIBRARY_HEADERS, markImportDuplicates, parseLibraryPaste, parseLibraryRows, readLibraryWorkbook, type ImportRow } from "../lib/quoteLibraryImport";
import { PRODUCT_CATEGORIES, PRICING_UNITS, type PriceProduct } from "../types";
type DraftRow = {
    id: string;
    cells: string[];
    included: boolean;
    row: number;
    file: string;
    sheet: string;
    originalSpec: string;
};
const fromImport = (row: ImportRow): DraftRow => ({ id: createId(), cells: Array.from({ length: 8 }, (_, i) => row.cells?.[i] || ""), included: !row.error, row: row.row, file: row.source?.file || "手工录入", sheet: row.source?.sheet || "录入", originalSpec: row.cells?.[2] || "" });
export function CatalogBulkModal({ products, initialCity, onSave, onClose }: {
    products: PriceProduct[];
    initialCity: string;
    onSave: (items: PriceProduct[]) => Promise<void>;
    onClose: () => void;
}) {
    const [city, setCity] = useState(initialCity);
    const [drafts, setDrafts] = useState<DraftRow[]>([]);
    const [paste, setPaste] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const parsed = useMemo(() => drafts.map(d => {
        const result = parseLibraryRows([{ row: 0, cells: LIBRARY_HEADERS }, { row: d.row, cells: d.cells }], city, d.file, d.sheet)[0] || { row: d.row, warnings: [], error: "请填写内容" };
        if (result.product) {
            result.product.id = d.id;
            result.product.library!.source!.originalSpec = d.originalSpec;
        }
        return result;
    }), [drafts, city]);
    const selected = markImportDuplicates(parsed.filter((_, i) => drafts[i].included), products);
    const valid = selected.filter(r => r.product && !r.error && !r.duplicate);
    const selectedErrors = selected.filter(r => r.error).length;
    const duplicateIds = new Set(selected.filter(r => r.duplicate).map(r => r.product?.id));
    const change = (id: string, column: number, value: string) => setDrafts(rows => rows.map(r => r.id === id ? { ...r, cells: r.cells.map((v, i) => i === column ? value : v) } : r));
    const append = (rows: DraftRow[]) => {
        if (drafts.length + rows.length > 500)
            throw new Error("单次最多500条，请先提交或移除部分行");
        setDrafts(current => [...current, ...rows]);
    };
    const load = async (file: File) => {
        setError("");
        setBusy(true);
        try {
            if (file.size > 10 * 1024 * 1024)
                throw new Error("文件最多10MB");
            append((await readLibraryWorkbook(await file.arrayBuffer(), city, file.name)).map(fromImport));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "读取失败，原待录入行已保留");
        }
        finally {
            setBusy(false);
        }
    };
    const save = async () => {
        setBusy(true);
        setError("");
        try {
            await onSave(valid.map(r => r.product!));
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "保存失败，待录入行已保留");
        }
        finally {
            setBusy(false);
        }
    };
    return <Modal wide className="catalog-bulk-modal" title="批量录入与 Excel 导入" onClose={() => { if (!busy)
        onClose(); }} footer={<><span>{valid.length} 条待保存 · {selectedErrors} 条错误 · {duplicateIds.size} 条重复跳过</span><button className="ghost-button" disabled={busy} onClick={onClose}>取消</button><button className="primary-button" disabled={busy || !valid.length || !!selectedErrors} onClick={() => void save()}>{busy ? "处理中…" : `确认保存 ${valid.length} 条`}</button></>}>
    <p className="modal-hint">单次最多500条、文件最多10MB。空价格为待填写；明确的0为零价。公式价格请在 Excel 中先粘贴为数值。勾选行必须校验通过；重复项默认跳过，不覆盖已有商品。</p>
    <div className="catalog-import-controls"><label>默认导入城市<input value={city} disabled={busy} onChange={e => setCity(e.target.value)}/></label><label>选择 Excel 文件<input aria-label="选择报价库XLSX" type="file" accept=".xlsx" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file)
        void load(file); e.target.value = ""; }}/></label><a className="ghost-button" href="./quote-library-template.xlsx" download>下载空白规范模板</a><button className="ghost-button" disabled={busy || drafts.length >= 500} onClick={() => append([{ id: createId(), cells: ["", "", "", "", city, "每次", "", ""], included: true, row: drafts.length + 1, file: "手工录入", sheet: "录入", originalSpec: "" }])}>新增一行</button></div>
    <details><summary>从 Excel 复制多行粘贴（八列，可含表头）</summary><textarea aria-label="批量粘贴报价" rows={4} value={paste} onChange={e => setPaste(e.target.value)} placeholder={LIBRARY_HEADERS.join("\t")}/><button className="ghost-button" disabled={busy || !paste.trim()} onClick={() => { try {
        append(parseLibraryPaste(paste, city).map(r => ({ ...fromImport(r), included: true })));
        setPaste("");
        setError("");
    }
    catch (e) {
        setError(String(e));
    } }}>加入预览表格</button></details>
    {error && <p role="alert" className="library-warning">{error}</p>}
    <p className="modal-hint">北京原表的类别、城市可以为空：门票及导游沿用识别规则；其余类别须手动选择并勾选，原16条用车不会自动导入。当前预览 {drafts.length} 行，已排除 {drafts.filter(d => !d.included).length} 行。</p>
    <div className="catalog-bulk-scroll"><table className="catalog-bulk-table"><thead><tr><th>导入／来源</th>{LIBRARY_HEADERS.map(h => <th key={h}>{h}</th>)}<th>校验与操作</th></tr></thead><tbody>{drafts.map((d, index) => {
            const result = parsed[index];
            return <tr key={d.id} className={!d.included ? "excluded" : result.error ? "invalid" : ""}><td><label><input type="checkbox" aria-label={`导入第${index + 1}行`} checked={d.included} disabled={busy} onChange={e => setDrafts(rows => rows.map(r => r.id === d.id ? { ...r, included: e.target.checked } : r))}/>第{d.row}行</label><small>{d.file} · {d.sheet}</small></td>{d.cells.map((value, column) => <td key={column}>{column === 3 ? <select aria-label={`第${index + 1}行类别`} value={value} disabled={busy} onChange={e => change(d.id, column, e.target.value)}><option value="">门票／导游自动识别</option>{!PRODUCT_CATEGORIES.includes(value as never) && value && <option>{value}</option>}{PRODUCT_CATEGORIES.map(v => <option key={v}>{v}</option>)}</select> : column === 5 ? <select aria-label={`第${index + 1}行单位`} value={value} disabled={busy} onChange={e => change(d.id, column, e.target.value)}><option value="">请选择</option>{[...PRICING_UNITS, "张", "人", "天", "次"].map(v => <option key={v}>{v}</option>)}</select> : <input aria-label={`第${index + 1}行${LIBRARY_HEADERS[column]}`} disabled={busy} value={value} placeholder={column >= 6 ? "待填写" : ""} onChange={e => change(d.id, column, e.target.value)}/>}</td>)}<td><small role={result.error && d.included ? "alert" : undefined}>{result.error || (duplicateIds.has(d.id) ? "重复：跳过" : result.warnings.join("；") || "可保存")}</small><div className="row-actions"><button disabled={busy || drafts.length >= 500} onClick={() => append([{ ...d, id: createId(), cells: [...d.cells] }])}>复制</button><button disabled={busy} onClick={() => setDrafts(rows => rows.filter(r => r.id !== d.id))}>移除</button></div></td></tr>;
        })}</tbody></table></div>
    {!drafts.length && <p className="empty-state">选择 Excel、粘贴多行，或点击“新增一行”开始录入。</p>}
  </Modal>;
}
