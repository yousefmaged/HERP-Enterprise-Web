import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LucideIcon, Plus } from "lucide-react";
import { ReactNode, useState } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="mb-2 text-xs font-bold tracking-[0.16em] text-cyan-300">{eyebrow}</p><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-400">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}

export function SectionCard({ title, subtitle, children, className, action }: { title?: string; subtitle?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={cn("herp-panel", className)}>{title && <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-slate-100">{title}</h2>{subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}</div>{action}</div>}{children}</section>;
}

export function StatusBadge({ value }: { value: string }) {
  const tone = value === "paid" || value === "active" || value === "approved" || value === "won" || value === "completed" || value === "present" ? "emerald" : value === "overdue" || value === "critical" || value === "rejected" || value === "lost" ? "rose" : value === "pending" || value === "sent" || value === "late" || value === "in_progress" ? "amber" : "slate";
  const labels: Record<string, string> = { active: "نشط", inactive: "غير نشط", on_leave: "في إجازة", paid: "مدفوع", sent: "مرسل", overdue: "متأخر", draft: "مسودة", void: "ملغى", pending: "بانتظار المراجعة", approved: "معتمد", rejected: "مرفوض", qualification: "تأهيل", proposal: "عرض", negotiation: "تفاوض", won: "مكتسبة", lost: "مفقودة", open: "مفتوحة", in_progress: "قيد التنفيذ", completed: "مكتملة", cancelled: "ملغاة", low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة", general_manager: "مدير عام", unit_manager: "مدير وحدة", employee: "موظف", sales: "مبيعات", purchase: "مشتريات" };
  return <Badge className={`border-0 px-2.5 py-1 text-[11px] font-semibold ${tone === "emerald" ? "bg-emerald-400/10 text-emerald-300" : tone === "rose" ? "bg-rose-400/10 text-rose-300" : tone === "amber" ? "bg-amber-300/10 text-amber-200" : "bg-slate-500/10 text-slate-300"}`}>{labels[value] || value}</Badge>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-6 text-center"><div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-cyan-400/[0.08] text-cyan-300"><Icon className="size-5" /></div><h3 className="font-bold text-slate-200">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function CreateDialog({ title, description, triggerLabel = "إضافة", children, onSubmit, submitLabel = "حفظ", disabled = false }: { title: string; description: string; triggerLabel?: string; children: (form: FormData, setForm: React.Dispatch<React.SetStateAction<FormData>>) => ReactNode; onSubmit: (form: FormData) => void; submitLabel?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormData>({});
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm({}); }}><DialogTrigger asChild><Button className="h-10 gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Plus className="size-4" />{triggerLabel}</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#101b2d] text-right text-slate-100 sm:max-w-lg" dir="rtl"><DialogHeader><DialogTitle className="text-right text-xl">{title}</DialogTitle><DialogDescription className="text-right leading-6 text-slate-400">{description}</DialogDescription></DialogHeader><div className="grid gap-4 py-4">{children(form, setForm)}</div><DialogFooter className="gap-2 sm:justify-start"><Button variant="outline" onClick={() => setOpen(false)} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">إلغاء</Button><Button disabled={disabled} onClick={() => { onSubmit(form); setOpen(false); }} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{submitLabel}</Button></DialogFooter></DialogContent></Dialog>;
}

export type FormData = Record<string, string | number | undefined>;

export function FormInput({ form, setForm, name, label, type = "text", placeholder, required = false, min }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>; name: string; label: string; type?: string; placeholder?: string; required?: boolean; min?: number }) {
  return <div className="grid gap-2"><Label htmlFor={name} className="text-sm font-semibold text-slate-300">{label}{required && <span className="mr-1 text-cyan-300">*</span>}</Label><Input id={name} type={type} min={min} value={form[name] ?? ""} placeholder={placeholder} onChange={(event) => setForm((previous) => ({ ...previous, [name]: type === "number" ? Number(event.target.value) : event.target.value }))} className="h-10 border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-400" /></div>;
}

export function FormSelect({ form, setForm, name, label, options }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>; name: string; label: string; options: { value: string; label: string }[] }) {
  return <div className="grid gap-2"><Label htmlFor={name} className="text-sm font-semibold text-slate-300">{label}</Label><select id={name} value={String(form[name] ?? options[0]?.value ?? "")} onChange={(event) => setForm((previous) => ({ ...previous, [name]: event.target.value }))} className="h-10 rounded-md border border-white/10 bg-[#142033] px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
