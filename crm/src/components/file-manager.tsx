"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { AlertCircle, ArrowLeft, Check, ChevronDown, ChevronRight, Download, File, Folder, FolderPlus, History, MoreHorizontal, Move, Pencil, Trash2, Upload, } from "lucide-react";
import { toast } from "sonner";
import { createFolderAction, deleteFileNodeAction, ensureInitialCustomerFilesFolderAction, moveFileNodeAction, renameFileNodeAction, updateFolderReviewStatusAction, updateFolderStatusAction, uploadFileAction, } from "@/app/actions/file-actions";
import { FolderReviewStatusBadge, FolderStatusBadge } from "@/components/customer-badges";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { MultilineInput } from "@/components/ui/multiline-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FOLDER_REVIEW_STATUSES, FOLDER_STATUSES } from "@/lib/constants";
import type { Customer, FolderReviewStatus, FolderStatus } from "@/lib/types";
export function FileManager({ customer }: {
    customer: Customer;
}) {
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [folderOpen, setFolderOpen] = useState(false);
    const [folderName, setFolderName] = useState("");
    const [folderParentId, setFolderParentId] = useState("root");
    const [renameTarget, setRenameTarget] = useState<{
        kind: "file" | "folder";
        id: string;
        currentName: string;
    } | null>(null);
    const [renameName, setRenameName] = useState("");
    const [historyFolderId, setHistoryFolderId] = useState<string | null>(null);
    const [pendingSendFolder, setPendingSendFolder] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        kind: "file" | "folder";
        id: string;
        name: string;
    } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [initialUploadFailures, setInitialUploadFailures] = useState<{
        name: string;
        error: string;
    }[]>([]);
    const [isPending, startTransition] = useTransition();
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadToInitialFolder = useRef(false);
    useEffect(() => {
        const key = `tripbook-initial-upload-failures:${customer.id}`;
        let failures: {
            name: string;
            error: string;
        }[] = [];
        try {
            const stored = sessionStorage.getItem(key);
            if (!stored)
                return;
            const parsed = JSON.parse(stored) as unknown;
            if (Array.isArray(parsed)) {
                failures = parsed.filter((item): item is {
                    name: string;
                    error: string;
                } => Boolean(item &&
                    typeof item === "object" &&
                    "name" in item &&
                    typeof item.name === "string" &&
                    "error" in item &&
                    typeof item.error === "string"));
            }
            sessionStorage.removeItem(key);
        }
        catch {
            return;
        }
        const timeout = window.setTimeout(() => setInitialUploadFailures(failures), 0);
        return () => window.clearTimeout(timeout);
    }, [customer.id]);
    function createFolder() {
        startTransition(async () => {
            const result = await createFolderAction({
                customerId: customer.id,
                name: folderName,
                parentId: folderParentId === "root" ? null : folderParentId,
            });
            if (result.ok) {
                toast.success("文件夹已创建");
                setFolderName("");
                setFolderParentId("root");
                setFolderOpen(false);
            }
            else
                toast.error(result.error);
        });
    }
    function openCreateFolder() {
        setFolderParentId(activeFolderId ?? "root");
        setFolderOpen(true);
    }
    function openFilePicker(initialFolder = false) {
        uploadToInitialFolder.current = initialFolder;
        fileInput.current?.click();
    }
    function upload(selectedFiles?: FileList | null, initialFolder = false) {
        const filesToUpload = Array.from(selectedFiles ?? []);
        if (!filesToUpload.length)
            return;
        setIsUploading(true);
        startTransition(async () => {
            const failedUploads: {
                name: string;
                error: string;
            }[] = [];
            let uploadedCount = 0;
            try {
                let destinationFolderId = activeFolderId;
                if (initialFolder) {
                    const folderResult = await ensureInitialCustomerFilesFolderAction(customer.id);
                    if (!folderResult.ok || !folderResult.id) {
                        const error = folderResult.ok ? "无法创建客户初始资料文件夹" : folderResult.error;
                        failedUploads.push(...filesToUpload.map((file) => ({ name: file.name, error })));
                    }
                    else {
                        destinationFolderId = folderResult.id;
                    }
                }
                if (failedUploads.length)
                    return;
                for (const file of filesToUpload) {
                    const form = new FormData();
                    form.set("customerId", customer.id);
                    form.set("folderId", destinationFolderId ?? "");
                    form.set("file", file);
                    const result = await uploadFileAction(form);
                    if (result.ok)
                        uploadedCount += 1;
                    else
                        failedUploads.push({ name: file.name, error: result.error });
                }
            }
            finally {
                if (uploadedCount) {
                    toast.success(`已上传 ${uploadedCount} 个文件`);
                }
                if (failedUploads.length) {
                    toast.error(`${failedUploads.length} 个文件上传失败`, {
                        description: failedUploads.slice(0, 3).map((item) => `${item.name}：${item.error}`).join("；"),
                    });
                }
                if (initialFolder)
                    setInitialUploadFailures(failedUploads);
                setIsUploading(false);
                if (fileInput.current)
                    fileInput.current.value = "";
                uploadToInitialFolder.current = false;
            }
        });
    }
    function openRename(kind: "file" | "folder", id: string, currentName: string) {
        setRenameTarget({ kind, id, currentName });
        setRenameName(currentName);
    }
    function rename() {
        if (!renameTarget || !renameName.trim() || renameName.trim() === renameTarget.currentName)
            return;
        startTransition(async () => {
            const result = await renameFileNodeAction({
                customerId: customer.id,
                kind: renameTarget.kind,
                id: renameTarget.id,
                name: renameName,
            });
            if (result.ok) {
                toast.success("名称已更新");
                setRenameTarget(null);
            }
            else
                toast.error(result.error);
        });
    }
    function remove() {
        if (!deleteTarget)
            return;
        startTransition(async () => {
            const result = await deleteFileNodeAction({
                customerId: customer.id,
                kind: deleteTarget.kind,
                id: deleteTarget.id,
            });
            if (result.ok) {
                toast.success("已删除");
                setDeleteTarget(null);
            }
            else
                toast.error(result.error);
        });
    }
    function move(kind: "file" | "folder", id: string, targetFolderId: string | null) {
        startTransition(async () => {
            const result = await moveFileNodeAction({ customerId: customer.id, kind, id, targetFolderId });
            if (result.ok)
                toast.success("已移动");
            else
                toast.error(result.error);
        });
    }
    function updateFolderStatus(folderId: string, status: FolderStatus, confirmPendingReview = false) {
        startTransition(async () => {
            const result = await updateFolderStatusAction({
                customerId: customer.id,
                folderId,
                status,
                confirmPendingReview,
            });
            if (result.ok) {
                toast.success(`文件夹状态已更新为“${status}”`);
                setPendingSendFolder(null);
            }
            else
                toast.error(result.error);
        });
    }
    function updateFolderReviewStatus(folderId: string, status: FolderReviewStatus) {
        startTransition(async () => {
            const result = await updateFolderReviewStatusAction({
                customerId: customer.id,
                folderId,
                status,
            });
            if (result.ok)
                toast.success(`审核状态已更新为“${status}”`);
            else
                toast.error(result.error);
        });
    }
    const folders = customer.folders ?? [];
    const files = customer.files ?? [];
    const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;
    const activeFolderId = currentFolder?.id ?? null;
    const visibleFolders = folders.filter((folder) => folder.parentId === activeFolderId);
    const visibleFiles = files.filter((file) => file.folderId === activeFolderId);
    const breadcrumbs = [];
    const visitedFolderIds = new Set<string>();
    let breadcrumbFolder = currentFolder;
    while (breadcrumbFolder && !visitedFolderIds.has(breadcrumbFolder.id)) {
        breadcrumbs.unshift(breadcrumbFolder);
        visitedFolderIds.add(breadcrumbFolder.id);
        breadcrumbFolder = folders.find((folder) => folder.id === breadcrumbFolder?.parentId) ?? null;
    }
    const historyFolder = folders.find((folder) => folder.id === historyFolderId) ?? null;
    return (<div className="space-y-4">
      {initialUploadFailures.length ? (<div className="flex flex-wrap items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600"/>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium">
              客户已保存，但有 {initialUploadFailures.length} 个初始文件上传失败
            </p>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-red-800">
              {initialUploadFailures.map((item, index) => (<li key={`${item.name}:${index}`}>
                  <span className="font-medium">{item.name}</span>：{item.error}
                </li>))}
            </ul>
            <p className="mt-1 text-[11px] text-red-700">请重新选择这些文件上传，客户资料不会重复创建。</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => openFilePicker(true)} disabled={isPending || isUploading}>
              重新选择文件
            </Button>
            <Button variant="ghost" size="sm" className="text-red-800 hover:bg-red-100 hover:text-red-900" onClick={() => setInitialUploadFailures([])}>
              关闭
            </Button>
          </div>
        </div>) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="crm-section-title">客户文件</h3>
          <p className="crm-section-description">
            文件存储在私有 Supabase Storage Bucket 中，单个文件最大 100 MB。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openCreateFolder}>
            <FolderPlus className="size-4"/>
            新建文件夹
          </Button>
          <Button size="sm" onClick={() => openFilePicker(false)} disabled={isPending || isUploading}>
            <Upload className="size-4"/>
            {isUploading ? "正在上传…" : "上传文件"}
          </Button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => upload(event.target.files, uploadToInitialFolder.current)}/>
        </div>
      </div>

      <div className="flex min-h-9 items-center gap-1 overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-50/60 px-2 py-1">
        {currentFolder ? (<Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => setCurrentFolderId(currentFolder.parentId)} aria-label="返回上一级文件夹">
            <ArrowLeft className="size-4"/>
          </Button>) : null}
        <nav className="flex min-w-0 items-center gap-0.5 text-xs" aria-label="文件夹路径">
          <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => setCurrentFolderId(null)} disabled={!currentFolder}>
            全部文件
          </Button>
          {breadcrumbs.map((folder) => (<span key={folder.id} className="flex min-w-0 items-center">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60"/>
              <Button variant="ghost" size="sm" className="h-7 max-w-44 truncate px-2 text-xs" onClick={() => setCurrentFolderId(folder.id)} disabled={folder.id === currentFolder?.id}>
                {folder.name}
              </Button>
            </span>))}
        </nav>
        <span className="ml-auto shrink-0 px-2 text-[10px] text-muted-foreground">
          {visibleFolders.length + visibleFiles.length} 个项目
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
        {visibleFolders.length || visibleFiles.length ? (<div className="divide-y divide-slate-100">
            {visibleFolders.map((folder) => (<div key={folder.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/70">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setCurrentFolderId(folder.id)} aria-label={`打开文件夹 ${folder.name}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                    <Folder className="size-4"/>
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50"/>
                </button>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  {folder.workflowStatusEnabled !== false ? (<>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 px-1.5" aria-label={`更改文件夹 ${folder.name} 的审核状态`} disabled={isPending}>
                            <FolderReviewStatusBadge status={folder.reviewStatus}/>
                            <ChevronDown className="size-3.5 text-muted-foreground"/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>审核状态</DropdownMenuLabel>
                          {FOLDER_REVIEW_STATUSES.map((status) => (<DropdownMenuItem key={status} onClick={() => updateFolderReviewStatus(folder.id, status)} disabled={status === folder.reviewStatus}>
                              <FolderReviewStatusBadge status={status}/>
                              {status === folder.reviewStatus && <Check className="ml-auto size-4 text-primary"/>}
                            </DropdownMenuItem>))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 px-1.5" aria-label={`更改文件夹 ${folder.name} 的状态`} disabled={isPending}>
                            <FolderStatusBadge status={folder.status}/>
                            <ChevronDown className="size-3.5 text-muted-foreground"/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>文件夹状态</DropdownMenuLabel>
                          {FOLDER_STATUSES.map((status) => (<DropdownMenuItem key={status} onClick={() => {
                            if (status === "已发送" && folder.reviewStatus === "待审核") {
                                setPendingSendFolder({ id: folder.id, name: folder.name });
                                return;
                            }
                            updateFolderStatus(folder.id, status);
                        }} disabled={status === folder.status}>
                              <FolderStatusBadge status={status}/>
                              {status === folder.status && <Check className="ml-auto size-4 text-primary"/>}
                            </DropdownMenuItem>))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setHistoryFolderId(folder.id)}>
                            <History className="size-4"/>
                            查看状态历史
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>) : null}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {folders.filter((item) => item.parentId === folder.id).length +
                    files.filter((file) => file.folderId === folder.id).length}{" "}
                  个项目
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`管理文件夹 ${folder.name}`}>
                      <MoreHorizontal className="size-4"/>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openRename("folder", folder.id, folder.name)}>
                      <Pencil className="size-4"/>
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Move className="size-4"/>
                        移动到
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => move("folder", folder.id, null)}>根目录</DropdownMenuItem>
                        {folders.filter((target) => target.id !== folder.id).map((target) => (<DropdownMenuItem key={target.id} onClick={() => move("folder", folder.id, target.id)}>
                            {target.name}
                          </DropdownMenuItem>))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name })}>
                      <Trash2 className="size-4"/>
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>))}
            {visibleFiles.map((item) => (<div key={item.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/70">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <File className="size-4"/>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(item.sizeBytes / 1024).toFixed(1)} KB · {item.mimeType ?? "未知类型"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/api/files/${item.id}/download`}>
                    <Download className="size-4"/>
                    下载
                  </a>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`管理文件 ${item.name}`}>
                      <MoreHorizontal className="size-4"/>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openRename("file", item.id, item.name)}>
                      <Pencil className="size-4"/>
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Move className="size-4"/>
                        移动到
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => move("file", item.id, null)}>根目录</DropdownMenuItem>
                        {folders.map((target) => (<DropdownMenuItem key={target.id} onClick={() => move("file", item.id, target.id)}>
                            {target.name}
                          </DropdownMenuItem>))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ kind: "file", id: item.id, name: item.name })}>
                      <Trash2 className="size-4"/>
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>))}
          </div>) : (<div className="crm-empty m-4">
            <div>
              <Folder className="mx-auto mb-3 size-8 text-muted-foreground/40"/>
              <p className="font-medium">此文件夹为空</p>
              <p className="mt-1 text-[11px] text-muted-foreground">新建子文件夹，或一次选择多个文件上传。</p>
            </div>
          </div>)}
      </div>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>为当前客户建立资料目录，也可以选择一个已有上级文件夹。</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>文件夹名称</Label>
            <MultilineInput value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="文件夹名称"/>
          </div>
          <div className="space-y-1.5">
            <Label>上级文件夹</Label>
            <Select value={folderParentId} onValueChange={setFolderParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">根目录</SelectItem>
                {folders.map((folder) => (<SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              取消
            </Button>
            <Button onClick={createFolder} disabled={!folderName.trim() || isPending}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名{renameTarget?.kind === "folder" ? "文件夹" : "文件"}</DialogTitle>
            <DialogDescription>名称更新不会改变文件内容或所在目录。</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>新名称</Label>
            <MultilineInput value={renameName} onChange={(event) => setRenameName(event.target.value)} placeholder="请输入新名称"/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button onClick={rename} disabled={!renameName.trim() || renameName.trim() === renameTarget?.currentName || isPending}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyFolder)} onOpenChange={(open) => !open && setHistoryFolderId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>文件夹状态历史</DialogTitle>
            <DialogDescription>
              “{historyFolder?.name}”的每次状态修改都会保留修改时间、修改前内容和修改后内容。
            </DialogDescription>
          </DialogHeader>
          {historyFolder?.statusHistory.length ? (<div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {historyFolder.statusHistory.map((item) => (<div key={item.id} className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
                  <time className="font-mono text-[10px] text-muted-foreground">
                    {format(new Date(item.changedAt), "yyyy-MM-dd HH:mm:ss")}
                  </time>
                  <div className="mt-2 flex items-center gap-2">
                    <FolderStatusBadge status={item.oldStatus}/>
                    <span className="text-muted-foreground">→</span>
                    <FolderStatusBadge status={item.newStatus}/>
                  </div>
                </div>))}
            </div>) : (<div className="crm-empty min-h-36">
              <div>
                <History className="mx-auto mb-3 size-8 text-muted-foreground/40"/>
                <p className="font-medium">暂无状态修改记录</p>
                <p className="mt-1 text-[11px] text-muted-foreground">首次修改状态后，记录会显示在这里。</p>
              </div>
            </div>)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryFolderId(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除“{deleteTarget?.name}”？文件删除后无法恢复，非空文件夹不能删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={isPending}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingSendFolder)} onOpenChange={(open) => !open && setPendingSendFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>文件夹尚未审核</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingSendFolder?.name}”当前仍是“待审核”。仍要将发送状态改为“已发送”吗？审核状态不会因此自动改变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            if (pendingSendFolder)
                updateFolderStatus(pendingSendFolder.id, "已发送", true);
        }} disabled={isPending}>
              确认标记为已发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
