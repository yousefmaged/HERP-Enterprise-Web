import { Button } from "@/components/ui/button";
import { EmptyState, PageHeading, SectionCard } from "@/components/herp/HerpUI";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing, Check } from "lucide-react";
import { toast } from "sonner";

const date = (value: Date | string | null) => value ? new Date(value).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }) : "—";
const types = { task: "مهمة", invoice: "فاتورة", inventory: "مخزون", leave: "إجازة", system: "النظام" };

export default function Notifications() {
  const utils = trpc.useUtils();
  const notifications = trpc.herp.notifications.list.useQuery();
  const markRead = trpc.herp.notifications.markRead.useMutation({ onSuccess: () => { utils.herp.notifications.list.invalidate(); toast.success("تم تعليم التنبيه كمقروء."); }, onError: (error) => toast.error(error.message) });
  return <div className="animate-herp-in"><PageHeading eyebrow="ACTIVITY CENTER" title="التنبيهات الداخلية" description="مركز التنبيهات للمهام، والمخزون، والفواتير، وطلبات الإجازة." /><SectionCard title="آخر التنبيهات" subtitle="تُنشأ التنبيهات من سير العمل داخل HERP">{notifications.isLoading ? <div className="herp-loading">جارٍ تحميل التنبيهات…</div> : notifications.data?.length ? <div className="space-y-3">{notifications.data.map((notification) => <div key={notification.id} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${notification.isRead ? "border-white/[0.06] bg-white/[0.015]" : "border-cyan-300/15 bg-cyan-300/[0.045]"}`}><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${notification.isRead ? "bg-white/[0.05] text-slate-400" : "bg-cyan-400/10 text-cyan-300"}`}><BellRing className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold text-slate-200">{notification.title}</p><span className="text-xs text-slate-500">{types[notification.type]}</span></div><p className="mt-1 text-sm leading-6 text-slate-500">{notification.body || "لا توجد تفاصيل إضافية."}</p><p className="mt-2 text-xs text-slate-600">{date(notification.createdAt)}</p></div>{!notification.isRead && <Button variant="outline" size="sm" onClick={() => markRead.mutate({ id: notification.id })} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"><Check className="ml-1 size-3.5" />تمت القراءة</Button>}</div>)}</div> : <EmptyState icon={Bell} title="لا توجد تنبيهات" description="ستظهر هنا الحالات التشغيلية التي تحتاج إلى اطلاعك أو إجراء منك." />}</SectionCard></div>;
}
