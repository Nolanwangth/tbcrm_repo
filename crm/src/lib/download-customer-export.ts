"use client";
export async function downloadCustomerExport(customerIds: string[]) {
    const response = await fetch("/api/customers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds }),
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(body?.error ?? "导出失败，请稍后重试");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? "tripbook-crm-customers.xlsx";
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
