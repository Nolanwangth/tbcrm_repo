export function shouldGuardQuoteLink(link: Pick<HTMLAnchorElement, "href" | "origin" | "protocol" | "target"> & {
    hasAttribute(name: string): boolean;
}, current: Pick<Location, "href" | "origin">) {
    return !link.hasAttribute("download") && (link.protocol === "http:" || link.protocol === "https:") && link.target !== "_blank" && link.origin === current.origin && link.href !== current.href;
}
