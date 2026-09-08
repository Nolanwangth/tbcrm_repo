const MAX_STORAGE_EXTENSION_LENGTH = 16;
export function buildStorageObjectName(originalName: string, id: string) {
    const lastDot = originalName.lastIndexOf(".");
    const rawExtension = lastDot > 0 ? originalName.slice(lastDot + 1) : "";
    const extension = rawExtension
        .replace(/[^a-zA-Z0-9]+/g, "")
        .slice(0, MAX_STORAGE_EXTENSION_LENGTH)
        .toLowerCase();
    return extension ? `${id}.${extension}` : id;
}
