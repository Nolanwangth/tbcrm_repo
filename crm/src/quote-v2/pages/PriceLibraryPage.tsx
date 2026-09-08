import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { PriceProductEditModal } from "../components/PriceProductEditModal";
import { CatalogBulkModal } from "../components/CatalogBulkModal";
import { createId } from "../lib/id";
import { libraryProductKey, librarySpecKey } from "../lib/quoteLibrary";
import { validateLibraryProduct } from "../lib/quoteLibraryImport";
import { PRODUCT_CATEGORIES, type PriceProduct } from "../types";
interface Props {
    products: PriceProduct[];
    setProducts: Dispatch<SetStateAction<PriceProduct[]>>;
    persistProducts: (next: PriceProduct[]) => Promise<void>;
    notify: (message: string) => void;
}
const emptyProduct = (city: string): PriceProduct => ({ id: createId(), city, category: "景点门票", nameZh: "", nameEn: "", costPrice: 0, quotePrice: 0, unit: "每人", enabled: true, userAdded: true, library: { kind: "ticket", specZh: "", ticketType: "standard", costPending: true, quotePending: true } });
export function PriceLibraryPage({ products, setProducts, persistProducts, notify }: Props) {
    const [search, setSearch] = useState("");
    const [city, setCity] = useState("全部城市");
    const [category, setCategory] = useState("");
    const [editing, setEditing] = useState<PriceProduct | null>(null);
    const [editGroup, setEditGroup] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [deleting, setDeleting] = useState<PriceProduct[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const cities = Array.from(new Set(products.map(p => p.city))).sort();
    const groups = useMemo(() => {
        const result = new Map<string, PriceProduct[]>();
        products.filter(p => (city === "全部城市" || p.city === city) && (!category || p.category === category) && (p.nameZh + " " + p.nameEn + " " + (p.library?.specZh || "")).toLowerCase().includes(search.trim().toLowerCase())).forEach(p => {
            const key = libraryProductKey(p);
            result.set(key, [...(result.get(key) || []), p]);
        });
        return Array.from(result.entries());
    }, [products, city, category, search]);
    const commit = async (next: PriceProduct[]) => {
        setBusy(true);
        setError("");
        try {
            await persistProducts(next);
            setProducts(next);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "保存失败，请重试");
            throw e;
        }
        finally {
            setBusy(false);
        }
    };
    const apply = (next: PriceProduct[]) => { void commit(next).catch(() => undefined); };
    const save = async (product: PriceProduct) => {
        product = { ...product, city: product.city.trim(), nameZh: product.nameZh.trim(), nameEn: product.nameEn.trim() };
        const invalid = validateLibraryProduct(product);
        if (invalid) {
            setError(invalid);
            return;
        }
        if (editGroup && libraryProductKey(product) !== editGroup && products.some(p => libraryProductKey(p) === libraryProductKey(product))) {
            setError("目标城市已有同名产品，不会自动合并或覆盖");
            return;
        }
        if (products.some(p => p.id !== product.id && librarySpecKey(p) === librarySpecKey(product))) {
            setError("已有相同城市、类别、名称和规格，请编辑已有规格");
            return;
        }
        const next = products.some(p => p.id === product.id) ? products.map(p => p.id === product.id ? product : editGroup && libraryProductKey(p) === editGroup ? { ...p, city: product.city, nameZh: product.nameZh, nameEn: product.nameEn } : p) : [...products, product];
        try {
            await commit(next);
            setEditing(null);
            setEditGroup(null);
            notify("报价库已保存，仅影响以后选择的商品");
        }
        catch { }
    };
    const closeEdit = () => { if (!busy) {
        setEditing(null);
        setEditGroup(null);
        setError("");
    } };
    return <main className="library-page">
    <section className="library-heading"><div><span className="section-kicker">QUOTE LIBRARY · 2.0</span><h1>报价库</h1><p>按城市、类别、产品与规格维护。独立于原版／新版报价库；已有报价继续使用快照。</p></div><div className="database-heading-actions"><button className="ghost-button" disabled={busy} onClick={() => setImportOpen(true)}><FileUp size={16}/>批量录入 / Excel 导入</button><button className="primary-button" disabled={busy} onClick={() => { setEditing(emptyProduct(city === "全部城市" ? "北京" : city)); setEditGroup(null); setError(""); }}><Plus size={17}/>新建产品</button></div></section>
    <section className="library-toolbar"><label className="search-box"><Search size={16}/><input placeholder="搜索产品、英文或规格" value={search} onChange={e => setSearch(e.target.value)}/></label><select aria-label="报价库城市" value={city} onChange={e => setCity(e.target.value)}><option>全部城市</option>{cities.map(c => <option key={c}>{c}</option>)}</select><select aria-label="报价库分类" value={category} onChange={e => setCategory(e.target.value)}><option value="">全部类别</option>{PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><span>{groups.length} 个产品</span></section>
    {error && !editing && !importOpen && <p role="alert" className="library-warning">{error}</p>}
    <div className="catalog-groups">{groups.map(([key, variants]) => {
            const first = variants[0];
            const all = products.filter(p => libraryProductKey(p) === key);
            return <section className="catalog-product" key={key}>
        <header><div><small>{first.city} · {first.category}</small><h2>{first.nameZh}</h2><p>{first.nameEn}</p></div><div className="row-actions">
          <button className="ghost-button" disabled={busy} onClick={() => { setEditing(first); setEditGroup(key); setError(""); }}><Pencil size={14}/>编辑产品</button>
          <button className="ghost-button" disabled={busy} onClick={() => { setEditing({ ...first, id: createId(), library: { ...(first.library || { kind: "standard" }), specZh: "", source: undefined, warnings: [], costPending: true, quotePending: true } }); setEditGroup(null); setError(""); }}><Plus size={14}/>新增规格</button>
          <button className="ghost-button" disabled={busy} onClick={() => apply(products.map(p => libraryProductKey(p) === key ? { ...p, enabled: !all.some(v => v.enabled) } : p))}>{all.some(v => v.enabled) ? "停用产品" : "启用产品"}</button>
          <button className="icon-button danger" disabled={busy} aria-label={"删除产品" + first.nameZh} onClick={() => setDeleting(all)}><Trash2 size={15}/></button>
        </div></header>
        <div className="catalog-variants">{variants.map(p => <div className="catalog-variant" key={p.id}>
          <div><strong>{p.library?.specZh || "默认规格"}</strong><small>{p.library?.source ? p.library.source.file + " · 第" + p.library.source.row + "行" : p.unit}</small>{!!p.library?.warnings?.length && <small className="library-warning">{p.library.warnings.join("；")}</small>}</div>
          <span><small>成本</small><strong>{p.library?.costPending ? "待填写" : "¥" + p.costPrice}</strong></span><span><small>报价</small><strong>{p.library?.quotePending ? "待填写" : "¥" + p.quotePrice}</strong></span>
          <button disabled={busy} className={"status-toggle " + (p.enabled ? "enabled" : "")} onClick={() => apply(products.map(v => v.id === p.id ? { ...v, enabled: !v.enabled } : v))}>{p.enabled ? "已启用" : "已停用"}</button>
          <div className="row-actions"><button disabled={busy} className="icon-button" aria-label={"编辑规格" + (p.library?.specZh || p.nameZh)} onClick={() => { setEditing(p); setEditGroup(null); setError(""); }}><Pencil size={15}/></button><button disabled={busy} className="icon-button danger" aria-label={"删除规格" + (p.library?.specZh || p.nameZh)} onClick={() => setDeleting([p])}><Trash2 size={15}/></button></div>
        </div>)}</div>
      </section>;
        })}</div>
    {editing && !editGroup && <PriceProductEditModal key={editing.id} product={editing} error={error} busy={busy} onClose={closeEdit} onSave={p => void save(p)}/>}
    {editing && editGroup && <Modal title="编辑产品公共信息" onClose={closeEdit} footer={<><button className="ghost-button" disabled={busy} onClick={closeEdit}>取消</button><button className="primary-button" disabled={busy || !editing.nameZh.trim() || !editing.nameEn.trim() || !editing.city.trim()} onClick={() => void save(editing)}>保存产品信息</button></>}><div className="form-grid">
      <label>城市<input value={editing.city} onChange={e => setEditing({ ...editing, city: e.target.value })}/></label><label>产品名称<input value={editing.nameZh} onChange={e => setEditing({ ...editing, nameZh: e.target.value })}/></label><label className="full-span">英文正文<textarea rows={3} value={editing.nameEn} onChange={e => setEditing({ ...editing, nameEn: e.target.value })}/></label><p className="full-span modal-hint">同步全部规格公共信息，不改变价格、票种、时长、启用状态或已有报价。</p>{error && <p role="alert" className="full-span library-warning">{error}</p>}
    </div></Modal>}
    {!!deleting.length && <Modal title="确认删除报价库内容" onClose={() => { if (!busy)
        setDeleting([]); }} footer={<><button disabled={busy} onClick={() => setDeleting([])}>取消</button><button className="primary-button" disabled={busy} onClick={async () => { try {
        await commit(products.filter(p => !deleting.some(d => d.id === p.id)));
        setDeleting([]);
        notify("已删除，已有报价快照不变");
    }
    catch { } }}>确认删除</button></>}><p>删除 {deleting[0].nameZh} 的 {deleting.length} 条规格？不会改变已加入的报价。</p>{error && <p role="alert">{error}</p>}</Modal>}
    {importOpen && <CatalogBulkModal products={products} initialCity={city === "全部城市" ? "北京" : city} onClose={() => setImportOpen(false)} onSave={async (items) => {
                const keys = new Set(products.map(librarySpecKey));
                const fresh = items.filter(p => { const key = librarySpecKey(p); if (keys.has(key))
                    return false; keys.add(key); return true; });
                const invalid = fresh.map(validateLibraryProduct).find(Boolean);
                if (invalid)
                    throw new Error(invalid);
                if (fresh.length)
                    await commit([...products, ...fresh]);
                notify("已保存" + fresh.length + "条，重复规格未覆盖");
            }}/>}
  </main>;
}
