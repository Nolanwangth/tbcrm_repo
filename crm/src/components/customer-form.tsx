"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FileText, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createCustomerAction } from "@/app/actions/customer-actions";
import { ensureInitialCustomerFilesFolderAction, uploadFileAction } from "@/app/actions/file-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultilineInput } from "@/components/ui/multiline-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOMESTIC_TRANSPORT_STATUSES, FLIGHT_STATUSES, HOTEL_STATUSES, PRIORITIES, PROFILES, SERVICE_TYPES, SOURCES, WHATSAPP_STATUSES, amountRangeFromValue, } from "@/lib/constants";
import { businessDateTimeInputValue } from "@/lib/business-time";
import { customerFormSchema, type CustomerFormValues } from "@/lib/validators";
const selectClassName = "w-full";
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const INITIAL_UPLOAD_FAILURES_KEY_PREFIX = "tripbook-initial-upload-failures:";
function fileKey(file: File) {
    return `${file.name}:${file.size}:${file.lastModified}`;
}
function fileSize(size: number) {
    if (size < 1024 * 1024)
        return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function ControlledSelect({ control, name, label, options, required, placeholder = "请选择", }: {
    control: ReturnType<typeof useForm<CustomerFormValues>>["control"];
    name: keyof CustomerFormValues;
    label: string;
    options: readonly string[];
    required?: boolean;
    placeholder?: string;
}) {
    return (<div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <Controller control={control} name={name} render={({ field }) => (<Select value={field.value == null ? "" : String(field.value)} onValueChange={field.onChange}>
            <SelectTrigger className={selectClassName}>
              <SelectValue placeholder={placeholder}/>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (<SelectItem key={option} value={option}>
                  {option}
                </SelectItem>))}
            </SelectContent>
          </Select>)}/>
    </div>);
}
function Field({ label, required, error, htmlFor, children, }: {
    label: string;
    required?: boolean;
    error?: string;
    htmlFor?: string;
    children: React.ReactNode;
}) {
    return (<div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-[11px] text-destructive">{error}</p>}
    </div>);
}
export function CustomerForm() {
    const router = useRouter();
    const initialFileInput = useRef<HTMLInputElement>(null);
    const [initialFiles, setInitialFiles] = useState<File[]>([]);
    const [isPending, startTransition] = useTransition();
    const { control, register, handleSubmit, setValue, formState: { errors }, } = useForm<CustomerFormValues>({
        resolver: zodResolver(customerFormSchema),
        defaultValues: {
            name: "",
            source: undefined,
            firstInquiryAt: businessDateTimeInputValue(),
            profile: "未确定",
            priority: "中",
            whatsappStatus: "未添加",
            expectedAmount: "",
            assigneeUserId: "",
            serviceAssignmentMode: "round_robin",
        },
    });
    const values = useWatch({ control }) as CustomerFormValues;
    const expectedAmount = values.expectedAmount === "" ? null : Number(values.expectedAmount);
    const effectiveRange = expectedAmount != null ? amountRangeFromValue(expectedAmount) : values.amountRange;
    function addInitialFiles(files: FileList | File[]) {
        const incoming = Array.from(files);
        const oversized = incoming.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
        const accepted = incoming.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
        if (oversized.length) {
            toast.error(`${oversized.length} 个文件超过 100 MB`, {
                description: oversized.slice(0, 3).map((file) => file.name).join("、"),
            });
        }
        setInitialFiles((current) => {
            const known = new Set(current.map(fileKey));
            return [...current, ...accepted.filter((file) => !known.has(fileKey(file)))];
        });
        if (initialFileInput.current)
            initialFileInput.current.value = "";
    }
    function submit(data: CustomerFormValues) {
        const payload = { ...data, amountRange: effectiveRange ?? undefined };
        startTransition(async () => {
            const result = await createCustomerAction(payload);
            if (!result.ok) {
                toast.error(result.error);
            }
            else if (result.id) {
                const failures: {
                    name: string;
                    error: string;
                }[] = [];
                let uploadedCount = 0;
                if (result.warning)
                    toast.warning(result.warning);
                if (initialFiles.length) {
                    try {
                        const folderResult = await ensureInitialCustomerFilesFolderAction(result.id);
                        if (!folderResult.ok || !folderResult.id) {
                            const error = folderResult.ok ? "无法创建客户初始资料文件夹" : folderResult.error;
                            failures.push(...initialFiles.map((file) => ({ name: file.name, error })));
                        }
                        else {
                            for (const file of initialFiles) {
                                try {
                                    const formData = new FormData();
                                    formData.set("customerId", result.id);
                                    formData.set("folderId", folderResult.id);
                                    formData.set("file", file);
                                    const uploadResult = await uploadFileAction(formData);
                                    if (uploadResult.ok)
                                        uploadedCount += 1;
                                    else
                                        failures.push({ name: file.name, error: uploadResult.error });
                                }
                                catch {
                                    failures.push({ name: file.name, error: "网络或服务器异常，请重新上传" });
                                }
                            }
                        }
                    }
                    catch {
                        failures.push(...initialFiles.map((file) => ({
                            name: file.name,
                            error: "无法创建文件夹或连接文件服务，请重新上传",
                        })));
                    }
                }
                if (failures.length) {
                    try {
                        sessionStorage.setItem(`${INITIAL_UPLOAD_FAILURES_KEY_PREFIX}${result.id}`, JSON.stringify(failures));
                    }
                    catch {
                    }
                    toast.error(`客户已创建，${failures.length} 个文件上传失败`, {
                        description: "进入客户文件页后可以重新选择并上传。",
                    });
                }
                else if (uploadedCount) {
                    toast.success(`客户已创建，已上传 ${uploadedCount} 个文件`);
                }
                else {
                    toast.success("客户已创建");
                }
                router.push(`/customers/${result.id}${initialFiles.length ? "?tab=files" : ""}`);
                router.refresh();
            }
        });
    }
    return (<form onSubmit={handleSubmit(submit)} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
      <div className="space-y-5">
        <Card>
          <CardHeader className="border-b border-slate-200/70 pb-4">
            <CardTitle className="text-[15px]">客户基本信息</CardTitle>
            <CardDescription className="text-[11px]">记录客户来源、画像和预计订单金额。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="客户名称" required error={errors.name?.message}>
              <MultilineInput placeholder="请输入客户名称" {...register("name")}/>
            </Field>
            <ControlledSelect control={control} name="source" label="来源渠道" options={SOURCES} required/>
            <Field label="首次询单时间" required error={errors.firstInquiryAt?.message}>
              <Input type="datetime-local" {...register("firstInquiryAt")}/>
            </Field>

            {(values.source === "转介绍" || values.source === "B2B") && (<>
                <Field label="介绍人名称">
                  <MultilineInput placeholder="选填" {...register("referrerName")}/>
                </Field>
                <Field label="合作方名称">
                  <MultilineInput placeholder="选填" {...register("partnerName")}/>
                </Field>
              </>)}
            {values.source === "其他" && (<Field label="具体来源">
                <MultilineInput placeholder="请填写具体来源" {...register("sourceDetail")}/>
              </Field>)}
            <Field label="国籍">
              <MultilineInput placeholder="请输入客户国籍" {...register("nationality")}/>
            </Field>
            <ControlledSelect control={control} name="profile" label="客户画像" options={PROFILES}/>
            <ControlledSelect control={control} name="priority" label="优先级" options={PRIORITIES}/>
            <Field label="分配方式" required error={errors.serviceAssignmentMode?.message}>
              <Controller control={control} name="serviceAssignmentMode" render={({ field }) => (<Select value={field.value} onValueChange={(value) => {
                field.onChange(value);
                if (value === "round_robin")
                    setValue("exclusiveServiceWorkbench", undefined);
            }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin">公共轮转（规划师A → B → C → D → E）</SelectItem>
                      <SelectItem value="exclusive">专属规划师</SelectItem>
                    </SelectContent>
                  </Select>)}/>
              <p className="text-[11px] text-muted-foreground">公共客户保存后立即按连续轮转顺序分配。</p>
            </Field>
            {values.serviceAssignmentMode === "exclusive" && (<Field label="专属规划师工作台" required error={errors.exclusiveServiceWorkbench?.message}>
                <Controller control={control} name="exclusiveServiceWorkbench" render={({ field }) => (<Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="请选择规划师工作台"/></SelectTrigger>
                      <SelectContent>
                        {(["A", "B", "C", "D", "E"] as const).map((slot) => <SelectItem key={slot} value={slot}>规划师{slot}工作台</SelectItem>)}
                      </SelectContent>
                    </Select>)}/>
              </Field>)}
            <Field label="预计具体金额（人民币）" htmlFor="expectedAmount" required error={errors.expectedAmount?.message}>
              <Input id="expectedAmount" type="number" min={1} max={999999999999} step={1} inputMode="numeric" aria-invalid={Boolean(errors.expectedAmount)} aria-describedby={errors.expectedAmount ? "expectedAmount-error" : undefined} placeholder="必填，填写后自动匹配金额区间" {...register("expectedAmount", {
        setValueAs: (value) => (value === "" ? "" : Number(value)),
    })}/>
              {expectedAmount != null && effectiveRange && (<p className="text-[11px] text-primary">已自动匹配：{effectiveRange}</p>)}
            </Field>
            <Field label="客户联系方式">
              <MultilineInput placeholder="手机号、微信、邮箱或其他联系方式" autoComplete="tel" {...register("contact")}/>
            </Field>
            <ControlledSelect control={control} name="whatsappStatus" label="沟通方式" options={WHATSAPP_STATUSES}/>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-200/70 pb-4">
            <CardTitle className="text-[15px]">客户初始文件</CardTitle>
            <CardDescription className="text-[11px]">
              可添加客户发来的图片或文档；客户保存成功后会自动上传至“客户初始资料”文件夹。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={initialFileInput} type="file" multiple className="hidden" onChange={(event) => event.target.files && addInitialFiles(event.target.files)}/>
            <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-6 text-center transition-colors hover:border-primary/50 hover:bg-blue-50/35" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            addInitialFiles(event.dataTransfer.files);
        }}>
              <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-primary ring-1 ring-blue-100">
                <Upload className="size-4"/>
              </span>
              <p className="mt-3 text-[13px] font-medium">拖放文件到这里，或从电脑中选择</p>
              <p className="mt-1 text-[11px] text-muted-foreground">支持多文件；每个文件最大 100 MB。</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => initialFileInput.current?.click()} disabled={isPending}>
                选择文件
              </Button>
            </div>

            {initialFiles.length ? (<div className="overflow-hidden rounded-lg border border-slate-200/70">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                  <span className="text-[11px] font-medium">已选择 {initialFiles.length} 个文件</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setInitialFiles([])} disabled={isPending}>
                    清空
                  </Button>
                </div>
                <div className="divide-y divide-slate-100">
                  {initialFiles.map((file) => (<div key={fileKey(file)} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-primary"/>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{fileSize(file.size)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`移除文件 ${file.name}`} onClick={() => setInitialFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))} disabled={isPending}>
                        <X className="size-4"/>
                      </Button>
                    </div>))}
                </div>
              </div>) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-200/70 pb-4">
            <CardTitle className="text-[15px]">本次旅行需求</CardTitle>
            <CardDescription className="text-[11px]">补充本次出行时间、人员、目的地与服务安排。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="预计出行开始日期">
              <Input type="date" {...register("expectedStartDate")}/>
            </Field>
            <Field label="预计出行结束日期">
              <Input type="date" {...register("expectedEndDate")}/>
            </Field>
            <Field label="模糊出行时间">
              <MultilineInput placeholder="如：10月中旬、明年春天" {...register("fuzzyTravelTime")}/>
            </Field>
            <Field label="出行人数">
              <MultilineInput placeholder="如：2位成人加1名儿童" {...register("travelerCount")}/>
            </Field>
            <Field label="旅行天数">
              <MultilineInput placeholder="如：10至15天" {...register("travelDays")}/>
            </Field>
            <Field label="目的地">
              <MultilineInput placeholder="自由填写多个目的地" {...register("destinations")}/>
            </Field>
            <ControlledSelect control={control} name="flightStatus" label="国际机票情况" options={FLIGHT_STATUSES}/>
            <ControlledSelect control={control} name="hotelStatus" label="酒店安排情况" options={HOTEL_STATUSES}/>
            <ControlledSelect control={control} name="serviceType" label="服务类型" options={SERVICE_TYPES}/>
            <ControlledSelect control={control} name="domesticTransportStatus" label="国内交通预订情况" options={DOMESTIC_TRANSPORT_STATUSES}/>

            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="特殊需求或补充说明">
                <Textarea rows={4} placeholder="填写饮食、住宿、节奏、无障碍需求或具体服务内容" {...register("specialRequirements")}/>
              </Field>
            </div>
          </CardContent>
        </Card>

      </div>

      <aside className="space-y-4 xl:sticky xl:top-7 xl:self-start">
        <Card>
          <CardHeader className="border-b border-blue-100 bg-blue-50/45 pb-4">
            <CardTitle className="text-[15px]">保存客户</CardTitle>
            <CardDescription className="text-[11px]">系统会按所选分配方式关联规划师工作台；历史等级数据仍在后台保留。</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              <Save className="size-4"/>
              {isPending
            ? initialFiles.length
                ? "保存并上传中…"
                : "保存中…"
            : "保存客户并进入工作台"}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </form>);
}
