import type { PriceProduct, ProductCategory } from "../types";
import { libraryProductKey } from "./quoteLibrary";
export function searchCatalog(products: PriceProduct[], city: string, category: ProductCategory, query: string): PriceProduct[] {
    if (!query.trim())
        return [];
    const seen = new Set<string>();
    return products.filter(p => {
        const key = libraryProductKey(p);
        if (!p.enabled || p.city.trim() !== city.trim() || p.category !== category || !`${p.nameZh} ${p.nameEn}`.toLowerCase().includes(query.trim().toLowerCase()) || seen.has(key))
            return false;
        seen.add(key);
        return true;
    }).slice(0, 30);
}
