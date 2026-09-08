import { useEffect, useMemo, useState, useId } from "react";
import { BadgeDollarSign, BedDouble, CarFront, Check, Library, PackagePlus, Plane, RotateCcw, ShieldCheck, Ticket, TrainFront, UserRound } from "lucide-react";
import { isDailyFeePreset, isTravelPreset, isVehiclePreset, QUICK_QUOTE_PRESETS, type QuickQuoteIcon, type QuickQuoteKind, } from "../data/quickQuotePresets";
import { applyTravelServiceFee, buildGuideInvoiceDescription, buildVehicleInvoiceDescription, categoryInvoiceGroup, cityEnglish, } from "../lib/invoiceDescription";
import { createId } from "../lib/id";
import { PRODUCT_CATEGORIES, PRICING_UNITS, type PricingUnit, type GuideLanguage, type PriceProduct, type ProductCategory, type QuoteItem, type VehicleServiceType } from "../types";
import { searchCatalog } from "../lib/catalogSearch";
import { bookingToItems, bookingValid, draftFromProducts, libraryProductKey, type BookingDraft } from "../lib/quoteLibrary";
import { LibraryBookingForm } from "./LibraryBookingForm";
import { Modal } from "./Modal";
interface Props {
    dayId: string;
    dayLabel: string;
    dayCity?: string;
    guideLanguage?: GuideLanguage;
    initialKind?: QuickQuoteKind;
    people: number;
    existingCategories?: ProductCategory[];
    onClose?: () => void;
    onAdd: (item: QuoteItem, saveToLibrary: boolean) => void;
    onCityChange?: (city: string) => void;
    embedded?: boolean;
    products?: PriceProduct[];
    onAddItems?: (items: QuoteItem[]) => void;
}
const ICONS: Record<QuickQuoteIcon, typeof CarFront> = {
    car: CarFront,
    guide: UserRound,
    ticket: Ticket,
    insurance: ShieldCheck,
    "service-fee": BadgeDollarSign,
    hotel: BedDouble,
    flight: Plane,
    rail: TrainFront,
};
const nonNegative = (value: number) => Math.max(0, Math.round(Number(value) || 0));
const vehicleCategory = (serviceType: VehicleServiceType): ProductCategory => ({
    "private-transfer": "市区用车",
    "airport-pickup": "接机",
    "airport-dropoff": "送机",
    "station-pickup": "接站",
    "station-dropoff": "送站",
})[serviceType] as ProductCategory;
export function QuickQuoteModal({ dayId, dayLabel, dayCity = "", guideLanguage = "English", initialKind = "car-5", people, existingCategories = [], onClose, onAdd, onCityChange, embedded = false, products = [], onAddItems, }: Props) {
    const initial = QUICK_QUOTE_PRESETS.find((preset) => preset.id === initialKind) ?? QUICK_QUOTE_PRESETS[0];
    const [selectedKind, setSelectedKind] = useState<QuickQuoteKind>(initial.id);
    const [categoryOverride, setCategoryOverride] = useState<ProductCategory | "">("");
    const [customUnit, setCustomUnit] = useState<PricingUnit>("每次");
    const [nameZh, setNameZh] = useState(initial.nameZh);
    const [nameEn, setNameEn] = useState(initial.nameEn);
    const [descriptionAuto, setDescriptionAuto] = useState(true);
    const [city, setCity] = useState(dayCity);
    const [seats, setSeats] = useState(initial.seats ?? "5");
    const [customVehicle, setCustomVehicle] = useState("");
    const [serviceType, setServiceType] = useState<VehicleServiceType>("private-transfer");
    const [serviceHours, setServiceHours] = useState(initial.id === "guide" ? "8 hrs/day" : "");
    const [quantity, setQuantity] = useState(1);
    const [costPrice, setCostPrice] = useState(initial.defaultCost);
    const [baseQuotePrice, setBaseQuotePrice] = useState(initial.defaultQuote);
    const [travelFeeApplied, setTravelFeeApplied] = useState(true);
    const [saveToLibrary, setSaveToLibrary] = useState(false);
    const [booking, setBooking] = useState<BookingDraft | null>(null);
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [suggestIndex, setSuggestIndex] = useState(-1);
    const [composing, setComposing] = useState(false);
    const listId = useId();
    const selectedPreset = QUICK_QUOTE_PRESETS.find((preset) => preset.id === selectedKind) ?? initial;
    const vehiclePreset = !categoryOverride && isVehiclePreset(selectedPreset);
    const travelPreset = !categoryOverride && isTravelPreset(selectedPreset);
    const selectedCategory = categoryOverride || (vehiclePreset ? vehicleCategory(serviceType) : selectedPreset.category);
    const matches = useMemo(() => {
        return onAddItems ? searchCatalog(products, city, selectedCategory, nameZh) : [];
    }, [products, selectedCategory, city, nameZh, onAddItems]);
    const chooseProduct = (product: PriceProduct) => {
        setBooking(draftFromProducts(products, product, people));
        setNameZh(product.nameZh);
        setSuggestOpen(false);
        setSuggestIndex(-1);
        setSaveToLibrary(false);
    };
    const willUpdate = !categoryOverride && isDailyFeePreset(selectedPreset) && existingCategories.includes(selectedPreset.category);
    const finalQuotePrice = travelPreset ? applyTravelServiceFee(baseQuotePrice, travelFeeApplied) : nonNegative(baseQuotePrice);
    const generatedDescription = useMemo(() => {
        if (categoryOverride)
            return "";
        if (vehiclePreset)
            return buildVehicleInvoiceDescription({ city, seats, customVehicle, serviceType, serviceHours });
        if (selectedKind === "guide")
            return buildGuideInvoiceDescription(city, guideLanguage, serviceHours);
        if (selectedKind === "hotel")
            return `Hotel accommodation in ${cityEnglish(city) || "China"}`;
        if (selectedKind === "flight")
            return "Flight ticket";
        if (selectedKind === "rail")
            return "High-speed rail ticket";
        return selectedPreset.nameEn;
    }, [categoryOverride, city, customVehicle, guideLanguage, seats, selectedKind, selectedPreset.nameEn, serviceHours, serviceType, vehiclePreset]);
    useEffect(() => {
        if (descriptionAuto)
            setNameEn(generatedDescription);
    }, [descriptionAuto, generatedDescription]);
    useEffect(() => {
        setCity(dayCity);
        setBooking(null);
        setSuggestOpen(false);
        setSuggestIndex(-1);
    }, [dayCity]);
    const selectPreset = (kind: QuickQuoteKind) => {
        setCategoryOverride("");
        const preset = QUICK_QUOTE_PRESETS.find((item) => item.id === kind) ?? initial;
        setSelectedKind(kind);
        setNameZh(preset.nameZh);
        setSeats(preset.seats ?? "");
        setCustomVehicle("");
        setServiceType("private-transfer");
        setServiceHours(kind === "guide" ? "8 hrs/day" : "");
        setQuantity(isDailyFeePreset(preset) || preset.category === "景点门票" ? people : 1);
        setCostPrice(preset.defaultCost);
        setBaseQuotePrice(preset.defaultQuote);
        setTravelFeeApplied(true);
        setDescriptionAuto(true);
        setBooking(null);
        setSuggestOpen(false);
        setSuggestIndex(-1);
    };
    const restoreDescription = () => {
        setDescriptionAuto(true);
        setNameEn(generatedDescription);
    };
    const submit = () => {
        if (booking && onAddItems) {
            onAddItems(bookingToItems({ ...booking, nameZh }, dayId));
            return;
        }
        if (!nameZh.trim())
            return;
        const category = selectedCategory;
        onAdd({
            id: createId(),
            sourceKey: `manual:${dayId}:${createId()}`,
            dayId,
            source: "manual",
            category,
            nameZh: nameZh.trim(),
            nameEn: nameEn.trim() || nameZh.trim(),
            invoiceDescriptionEn: nameEn.trim() || nameZh.trim(),
            invoiceDescriptionAuto: descriptionAuto,
            invoiceGroup: categoryInvoiceGroup(category),
            cityEn: cityEnglish(city),
            vehicleSeats: vehiclePreset ? seats : undefined,
            customVehicle: vehiclePreset ? customVehicle.trim() : undefined,
            vehicleServiceType: vehiclePreset ? serviceType : undefined,
            serviceHours: vehiclePreset || selectedKind === "guide" ? serviceHours.trim() : undefined,
            note: travelPreset && travelFeeApplied ? "报价已包含5%服务费" : "",
            quantity: nonNegative(quantity),
            costPrice: nonNegative(costPrice),
            quotePrice: finalQuotePrice,
            baseQuotePrice: travelPreset ? nonNegative(baseQuotePrice) : undefined,
            travelFeeApplied: travelPreset ? travelFeeApplied : undefined,
            unit: categoryOverride ? customUnit : selectedPreset.unit,
            nameEdited: true,
            costEdited: true,
            quoteEdited: true,
            quantityEdited: true,
        }, saveToLibrary);
    };
    const content = (<div className="quick-quote-modal">
        <div className="quick-quote-modal-intro"><div><strong>01 · 选择项目类型</strong><span>城市、车型和服务类型会自动生成英文发票文案</span></div><span>{dayLabel}</span></div>
        <div className="quick-type-grid">
          {QUICK_QUOTE_PRESETS.map((preset) => {
            const Icon = ICONS[preset.icon];
            return <button className={!categoryOverride && selectedKind === preset.id ? "selected" : ""} key={preset.id} onClick={() => selectPreset(preset.id)}><span className="quick-type-icon"><Icon size={17}/></span><span className="quick-type-copy"><strong>{preset.label}</strong><small>{preset.hint}</small></span>{!categoryOverride && selectedKind === preset.id && <Check className="quick-type-check" size={13}/>}</button>;
        })}
        </div>

        {!!onAddItems && <label className="catalog-category-picker">报价库类别<select aria-label="检索报价库类别" value={selectedCategory} onChange={e => {
                const preset = QUICK_QUOTE_PRESETS.find(p => p.category === e.target.value);
                if (preset) {
                    selectPreset(preset.id);
                    return;
                }
                setCategoryOverride(e.target.value as ProductCategory);
                setCustomUnit("每次");
                setBooking(null);
                setNameZh("");
                setNameEn("");
                setQuantity(1);
                setCostPrice(0);
                setBaseQuotePrice(0);
                setDescriptionAuto(false);
                setServiceHours("");
                setSuggestOpen(false);
                setSuggestIndex(-1);
            }}>{PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><small>所有类别均可检索；无匹配项可手动报价</small></label>}
        {categoryOverride && !booking && <label className="catalog-category-picker">手动计价单位<select value={customUnit} onChange={e => setCustomUnit(e.target.value as PricingUnit)}>{PRICING_UNITS.map(unit => <option key={unit}>{unit}</option>)}</select></label>}

        {!booking && !categoryOverride && (vehiclePreset || selectedKind === "guide") && <div className="invoice-template-fields">
          <label>城市<input value={city} onChange={(event) => {
                setCity(event.target.value);
                onCityChange?.(event.target.value);
            }} placeholder="例如：张家界"/></label>
          {vehiclePreset && <label>服务类型<select value={serviceType} onChange={(event) => setServiceType(event.target.value as VehicleServiceType)}><option value="private-transfer">全天/郊区用车</option><option value="airport-pickup">接机</option><option value="airport-dropoff">送机</option><option value="station-pickup">接站</option><option value="station-dropoff">送站</option></select></label>}
          {selectedKind === "car-custom" && <><label>自定义座位数<input value={seats} onChange={(event) => setSeats(event.target.value.replace(/\D/g, ""))} placeholder="例如：18"/></label><label>或完整车型名称<input value={customVehicle} onChange={(event) => setCustomVehicle(event.target.value)} placeholder="例如：Mercedes-Benz Sprinter"/></label></>}
          {selectedKind === "guide" ? <label>导游服务时长<select value={serviceHours || "8 hrs/day"} onChange={event => setServiceHours(event.target.value)}>{[8, 10, 12].map(hours => <option key={hours} value={`${hours} hrs/day`}>{hours} 小时／天</option>)}</select></label> : serviceType === "private-transfer" && <label className="full-span">自定义服务时长 <small>留空使用8小时</small><input value={serviceHours} onChange={(event) => setServiceHours(event.target.value)} placeholder="8 hrs/day 或 Service hours: 10 hrs/day"/></label>}
        </div>}

        <div className="direct-quick-form quick-quote-modal-form"><span className="quick-form-step">02 · 填写项目与价格</span>
          <div className="direct-name-fields">
            <div className="library-combobox" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget))
        setSuggestOpen(false); }}>
              <label className="quote-name-field"><span className="field-label-row">报价名称<small>{city}报价库</small></span><input role="combobox" aria-label="报价名称" aria-autocomplete="list" aria-expanded={suggestOpen && matches.length > 0} aria-controls={listId} aria-activedescendant={suggestOpen && suggestIndex >= 0 ? `${listId}-${suggestIndex}` : undefined} value={nameZh} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onFocus={() => { if (!booking)
        setSuggestOpen(true); }} onChange={event => { setNameZh(event.target.value); setBooking(null); setSuggestOpen(true); setSuggestIndex(-1); }} onKeyDown={event => {
            if (composing || event.nativeEvent.isComposing)
                return;
            if (event.key === "Escape") {
                setSuggestOpen(false);
                return;
            }
            if (["ArrowDown", "ArrowUp"].includes(event.key) && matches.length) {
                event.preventDefault();
                setSuggestOpen(true);
                setSuggestIndex(i => event.key === "ArrowDown" ? (i + 1) % matches.length : (i <= 0 ? matches.length - 1 : i - 1));
            }
            if (event.key === "Enter" && suggestOpen && matches[suggestIndex]) {
                event.preventDefault();
                chooseProduct(matches[suggestIndex]);
            }
        }} placeholder={selectedKind === "ticket" ? "输入“故”等名称，检索当前城市" : "填写报价名称"}/></label>
              {suggestOpen && matches.length > 0 && <div id={listId} role="listbox" className="library-suggestions">{matches.map((p, i) => <button type="button" role="option" aria-selected={i === suggestIndex} id={`${listId}-${i}`} key={p.id} onMouseDown={event => event.preventDefault()} onClick={() => chooseProduct(p)}><strong>{p.nameZh}</strong><small>{p.nameEn}</small><span>{p.city} · {products.filter(v => v.enabled && libraryProductKey(v) === libraryProductKey(p)).length} 种规格</span></button>)}</div>}
              {suggestOpen && !matches.length && nameZh.trim() && <small className="library-source">未找到匹配项，可继续手动填写，不会自动保存到报价库</small>}
            </div>
          </div>
          {booking ? <><div className="library-selected-label"><span>已选报价库产品</span><button className="inline-restore-button" onClick={() => { setBooking(null); setDescriptionAuto(true); }}>改为手动录入</button></div><LibraryBookingForm value={{ ...booking, nameZh }} onChange={setBooking}/></> : <><div className="direct-price-fields">
            <label><span className="price-field-heading">数量</span><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></label>
            <label><span className="price-field-heading">成本价 <small>RMB</small></span><input type="number" min="0" value={costPrice} onChange={(event) => setCostPrice(Number(event.target.value))}/></label>
            <label className="quote-price-field"><span className="price-field-heading">{travelPreset ? "基础报价" : "报价价"} <small>RMB</small></span><input type="number" min="0" value={baseQuotePrice} onChange={(event) => setBaseQuotePrice(Number(event.target.value))}/></label>
          </div>
          <label className="invoice-description-field"><span className="field-label-row">英文发票描述<small>{selectedKind === "guide" ? "特殊时长可在此修改" : "用于 Word PI"}</small></span><textarea rows={2} value={nameEn} onChange={(event) => { setNameEn(event.target.value); setDescriptionAuto(false); }} placeholder="English invoice description"/><button type="button" className="inline-restore-button" onClick={restoreDescription}><RotateCcw size={12}/>恢复自动文案</button></label>
          <div className="quick-line-preview"><span>报价合计</span><strong>{quantity || 0} × {finalQuotePrice.toLocaleString("zh-CN")} = {(quantity * finalQuotePrice).toLocaleString("zh-CN")} RMB</strong></div>
          {travelPreset && <div className="travel-fee-row"><label><input type="checkbox" checked={travelFeeApplied} onChange={(event) => setTravelFeeApplied(event.target.checked)}/><span>自动加入5%服务费（向上取整，不在发票中单独展示）</span></label><strong>最终报价：{finalQuotePrice.toLocaleString("zh-CN")} RMB</strong></div>}
          </>}
        </div>
    </div>);
    const saveChoice = booking ? <small>本次改价不回写报价库</small> : <label className="quick-quote-save-choice"><input type="checkbox" checked={saveToLibrary} onChange={(event) => setSaveToLibrary(event.target.checked)}/><span><Library size={14}/>保存到报价库</span></label>;
    const submitButton = <button className="primary-button" disabled={!nameZh.trim() || !!booking && !bookingValid({ ...booking, nameZh })} onClick={submit}><PackagePlus size={15}/>{willUpdate ? "更新" : "加入"} {dayLabel}</button>;
    if (embedded) {
        return <div className="embedded-quick-quote">{content}<div className="embedded-quick-quote-actions">{saveChoice}{submitButton}</div></div>;
    }
    const close = onClose ?? (() => undefined);
    return <Modal wide title={`新增 ${dayLabel} 报价明细`} onClose={close} footer={<>{saveChoice}<button className="ghost-button" onClick={close}>取消</button>{submitButton}</>}>{content}</Modal>;
}
