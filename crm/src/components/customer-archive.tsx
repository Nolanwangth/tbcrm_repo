"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FileText, ImageIcon, Pencil, Trash2, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { deleteTravelerAction, saveTravelerAction, uploadCustomerDocumentAction } from "@/app/actions/customer-archive-actions";
import { OperationChangeHistory } from "@/components/operation-change-history";
import { PrivateFileThumbnail } from "@/components/private-file-thumbnail";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
type Row = Record<string, unknown>;
const nested = (value: unknown) => Array.isArray(value) ? value[0] as Row | undefined : value as Row | undefined;
export function CustomerArchive({ customerId, caseId, documents, travelers, proposals }: {
    customerId: string;
    caseId?: string;
    documents: Row[];
    travelers: Row[];
    changes: Row[];
    proposals: Row[];
}) {
    const router = useRouter();
    const pathname = usePathname(), searchParams = useSearchParams();
    const sourceParams = new URLSearchParams(searchParams.toString());
    sourceParams.set("tab", "archive");
    const sourceHref = `${pathname}?${sourceParams}`;
    const toolHref = (kind: string, version?: string) => `/planner/tools/${kind}?${new URLSearchParams({ customerId, returnTo: sourceHref, ...(version ? { versionId: version } : {}) })}`;
    const [pending, startTransition] = useTransition();
    const [editingTraveler, setEditingTraveler] = useState<Row | null>(null);
    const [newTravelerType, setNewTravelerType] = useState("adult");
    const selectedTravelerType = editingTraveler ? String(editingTraveler.traveler_type) : newTravelerType;
    const travelerForm = useRef<HTMLFormElement>(null);
    const active = (type: string) => documents.find((row) => row.document_type === type && !row.replaced_at);
    const counts = { adult: travelers.filter((row) => row.traveler_type === "adult").length, child: travelers.filter((row) => row.traveler_type === "child").length, senior: travelers.filter((row) => row.traveler_type === "senior").length };
    const teamSummary = [`${counts.adult}大`, counts.child ? `${counts.child}小` : "", counts.senior ? `${counts.senior}老人` : ""].filter(Boolean).join(" · ");
    const childSummary = travelers.filter((row) => row.traveler_type === "child").map((row) => `${row.age ?? "?"}岁/${row.height_cm ?? "?"}cm`).join("、");
    const seniorSummary = travelers.filter((row) => row.traveler_type === "senior").map((row) => `${row.age ?? "?"}岁`).join("、");
    function submitDocument(type: "contract" | "proforma_invoice", file?: File) { if (!file)
        return; const form = new FormData(); form.set("customerId", customerId); form.set("documentType", type); form.set("previousLinkId", String(active(type)?.id ?? "")); form.set("file", file); startTransition(async () => { const result = await uploadCustomerDocumentAction(form); if (result.ok)
        toast.success("文件已归档");
    else
        toast.error(result.error); router.refresh(); }); }
    const humanTime = (value: unknown) => new Date(String(value)).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    return <section className="mt-5 space-y-5" id="customer-archive">
    <div className="crm-panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="crm-section-title">成交文件与方案版本</h2><div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link href={toolHref("itinerary")}>行程方案</Link></Button><Button size="sm" asChild><Link href={toolHref("quotation")}>报价方案</Link></Button></div></div><p className="crm-section-description">合同与形式发票保存在私有 Storage，登录后可预览、下载或替换；所有历史文件永久可查。</p><div className="mt-4 grid gap-3 md:grid-cols-2">{[["contract", "合同"], ["proforma_invoice", "形式发票（PI）"]].map(([type, label]) => { const row = active(type); const file = nested(row?.customer_files); const history = documents.filter((entry) => entry.document_type === type); return <div key={type} className="rounded-xl border p-4"><div className="flex items-center justify-between"><b>{label}</b><span className={row ? "text-emerald-700" : "text-amber-700"}>{row ? "已上传" : "未上传"}</span></div>{file && <div className="mt-2 flex gap-2"><FilePreviewDialog id={String(file.id)} name={String(file.name)} mime={String(file.mime_type)} className="rounded-md border px-3 py-1 text-sm">预览</FilePreviewDialog><Button size="sm" variant="outline" asChild><a href={`/api/files/${file.id}/download`}>下载</a></Button></div>}<Label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-primary"><Upload className="size-4"/>{row ? "替换文件" : "上传文件"}<input className="hidden" type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => submitDocument(type as "contract" | "proforma_invoice", event.target.files?.[0])}/></Label>{history.length > 0 && <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">{history.map((entry) => { const historicalFile = nested(entry.customer_files); const creator = nested(entry.crm_users); return <div key={String(entry.id)} className="flex justify-between gap-2 py-1"><a className="truncate text-primary hover:underline" href={`/api/files/${String(historicalFile?.id)}/download?inline=1`} target="_blank">{String(historicalFile?.name ?? "历史文件")}{entry.replaced_at ? "（已替换）" : "（当前）"}</a><span className="shrink-0">{String(creator?.display_name ?? "系统")} · {humanTime(entry.created_at)}</span></div>; })}</div>}</div>; })}</div><div className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold">方案历史</h3>{proposals.length ? proposals.map((proposal) => { const versions = ((proposal.customer_proposal_versions as Row[] | undefined) ?? []).sort((a, b) => Number(b.version_number) - Number(a.version_number)); const kind = String(proposal.tool_type); return <div key={String(proposal.id)} className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><b>{kind === "itinerary" ? "路线" : "报价"}：{String(proposal.title)}</b>{versions.length ? <div className="mt-2 flex flex-wrap gap-2">{versions.map((version) => <Button key={String(version.id)} size="sm" variant="outline" asChild><Link href={toolHref(kind, String(version.id))}>打开 V{String(version.version_number)} / 重导 PDF</Link></Button>)}</div> : <div className="mt-2"><Button size="sm" variant="outline" asChild><Link href={`${toolHref(kind)}&draftId=${String(proposal.id)}`}>继续编辑草稿</Link></Button></div>}</div>; }) : <p className="mt-2 text-sm text-muted-foreground">尚无方案版本。</p>}</div></div>

    {caseId && <div className="crm-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="crm-section-title">团队人数与护照资料</h2><p className="crm-section-description">结构化保存成人、儿童与老人资料，自动生成团队人数摘要。</p></div><div className="rounded-xl bg-primary/5 px-4 py-2 text-right"><p className="text-xs text-primary">团队人数摘要</p><strong className="text-lg text-foreground">{travelers.length ? teamSummary : "尚未录入"}</strong>{childSummary && <p className="text-xs text-muted-foreground">儿童：{childSummary}</p>}{seniorSummary && <p className="text-xs text-muted-foreground">老人：{seniorSummary}</p>}</div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{travelers.map((row) => { const file = nested(row.customer_files); const mime = String(file?.mime_type ?? ""); return <article key={String(row.id)} className="flex gap-4 rounded-xl border bg-white p-3"><FilePreviewDialog id={String(row.passport_file_id ?? "")} name={`${String(row.full_name)}护照`} mime={mime} className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">{row.passport_file_id ? <PrivateFileThumbnail key={String(row.passport_file_id)} id={String(row.passport_file_id)} name={`${String(row.full_name)}护照`}/> : <ImageIcon className="size-7 text-slate-300"/>}</FilePreviewDialog><div className="min-w-0 flex-1 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{String(row.full_name)}</b><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{String(row.traveler_type) === "child" ? "儿童" : String(row.traveler_type) === "senior" ? "老人" : "成人"}</span></div><p className="mt-2 text-xs text-muted-foreground">{[row.age != null ? `${String(row.age)}岁` : "", row.height_cm ? `${String(row.height_cm)}cm` : "", row.nationality ? String(row.nationality) : ""].filter(Boolean).join(" · ") || "基础资料待补充"}</p>{Boolean(row.passport_number) && <p className="mt-1 text-xs">护照号：{String(row.passport_number)}</p>}{Boolean(row.birth_date) && <p className="mt-1 text-xs">出生：{String(row.birth_date)} · 有效期：{String(row.passport_expiry_date ?? "待补充")}</p>}<div className="mt-2 flex flex-wrap gap-1">{Boolean(row.passport_file_id) && <FilePreviewDialog id={String(row.passport_file_id)} name={`${String(row.full_name)}护照`} mime={mime} className="text-xs text-primary underline">放大预览原件</FilePreviewDialog>}<Button size="sm" variant="ghost" onClick={() => setEditingTraveler(row)}><Pencil className="size-3"/>编辑</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm(`确认删除旅客 ${String(row.full_name)}？`))
            startTransition(async () => { const result = await deleteTravelerAction({ customerId, caseId, travelerId: String(row.id), revision: Number(row.revision) }); if (result.ok)
                router.refresh();
            else
                toast.error(result.error); }); }}><Trash2 className="size-3"/>删除</Button></div></div></article>; })}</div>
      <form key={String(editingTraveler?.id ?? "new")} ref={travelerForm} className="mt-5 grid gap-3 border-t pt-4 md:grid-cols-4" action={(form) => startTransition(async () => { form.set("customerId", customerId); form.set("caseId", caseId); if (editingTraveler) {
            form.set("travelerId", String(editingTraveler.id));
            form.set("revision", String(editingTraveler.revision));
        } const result = await saveTravelerAction(form); if (result.ok) {
            toast.success("旅客资料已保存");
            setEditingTraveler(null);
            setNewTravelerType("adult");
            travelerForm.current?.reset();
            router.refresh();
        }
        else
            toast.error(result.error); })}><div><Label>类型</Label><Select name="travelerType" value={selectedTravelerType} onValueChange={value => editingTraveler ? setEditingTraveler({ ...editingTraveler, traveler_type: value }) : setNewTravelerType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adult">成人</SelectItem><SelectItem value="child">儿童</SelectItem><SelectItem value="senior">老人</SelectItem></SelectContent></Select></div><div><Label>姓名 *</Label><Input name="fullName" required defaultValue={String(editingTraveler?.full_name ?? "")}/></div><div><Label>年龄{selectedTravelerType !== 'adult' ? ' *' : ''}</Label><Input required={selectedTravelerType !== 'adult'} name="age" type="number" min={0} max={120} defaultValue={String(editingTraveler?.age ?? "")}/></div><div><Label>身高（cm）{selectedTravelerType === 'child' ? ' *' : ''}</Label><Input required={selectedTravelerType === 'child'} name="heightCm" type="number" min={30} max={250} defaultValue={String(editingTraveler?.height_cm ?? "")}/></div><div><Label>国籍</Label><Input name="nationality" defaultValue={String(editingTraveler?.nationality ?? "")}/></div><div><Label>护照号码</Label><Input name="passportNumber" defaultValue={String(editingTraveler?.passport_number ?? "")}/></div><div><Label>出生日期</Label><Input name="birthDate" type="date" defaultValue={String(editingTraveler?.birth_date ?? "")}/></div><div><Label>有效期</Label><Input name="passportExpiryDate" type="date" defaultValue={String(editingTraveler?.passport_expiry_date ?? "")}/></div><div className="md:col-span-2"><Label>{editingTraveler?.passport_file_id ? "替换护照原图或 PDF（不选则保留）" : "护照原图或 PDF"}</Label><Input name="passportFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf"/></div><div className="flex self-end gap-2">{editingTraveler && <Button type="button" variant="outline" onClick={() => setEditingTraveler(null)}>取消编辑</Button>}<Button disabled={pending}><UsersRound className="size-4"/>{editingTraveler ? "保存修改" : "新增旅客"}</Button></div></form>
    </div>}

    {caseId && <OperationChangeHistory caseId={caseId} customerId={customerId}/>}
    {caseId && <Button asChild variant="outline"><Link href={`/operations/${caseId}`}><FileText className="size-4"/>打开在线服务清单</Link></Button>}
  </section>;
}
