"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RadioTower, MessageCircle, ArrowLeft } from "lucide-react";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";
import { dairaPalette } from "@/lib/design-system/palette";

type Account = { id: string; isConnected: boolean; igUsername: string };
type Rule = {
  id: string; keyword: string | null; keywordMatchMode: string; liveReplyMode: string;
  replyText: string | null; liveReplyKeyword: string | null; requireFollow: boolean;
  messages: Array<{ id: string; messageType: string }>;
};
export default function LiveAutomationList() {
  const router = useRouter();
  const [rules,setRules] = useState<Rule[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [deleteId,setDeleteId] = useState<string | null>(null);
  const [deleting,setDeleting] = useState(false);
  const [deleteError,setDeleteError] = useState("");
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/instagram/accounts", { cache:"no-store",credentials:"include",signal });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "دریافت پیج ناموفق بود.");
      const account = (Array.isArray(data.accounts) ? data.accounts : []).find((item: Account) => item.isConnected);
      if (!account) throw new Error("برای استفاده از پاسخ خودکار لایو، ابتدا پیج اینستاگرام را متصل کنید.");
      const next = await fetch("/api/live-automation?instagramAccountId=" + encodeURIComponent(account.id), { cache:"no-store",credentials:"include",signal });
      const json = await next.json();
      if (!next.ok || !json?.success) throw new Error(json?.error || "دریافت پاسخ‌های لایو ناموفق بود.");
      if (!signal?.aborted) setRules(Array.isArray(json.data) ? json.data : []);
    } catch(e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "خطا در دریافت پاسخ‌های لایو");
    } finally { if (!signal?.aborted) setLoading(false); }
  },[]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  },[fetchData]);
  async function deleteRule() {
    if (!deleteId || deleting) return;
    setDeleting(true);setDeleteError("");
    try {
      const response = await fetch("/api/live-automation/" + encodeURIComponent(deleteId), { method:"DELETE",credentials:"include" });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || "حذف پاسخ ناموفق بود.");
      setRules((prev) => prev.filter((item)=>item.id !== deleteId));
      setDeleteId(null);
    } catch(e) { setDeleteError(e instanceof Error ? e.message : "حذف ناموفق بود."); }
    finally { setDeleting(false); }
  }
  if (loading) return <LiveAutomationSkeleton />;
  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 pb-10">
      <button type="button" onClick={()=>router.push("/dashboard/live-automation/new")}
        className="flex min-h-[54px] w-full flex-row-reverse items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-sm transition hover:brightness-95"
        style={{background:dairaPalette.primary.main}}>
        <Plus size={20} /><span>ایجاد پاسخ جدید</span>
      </button>
      {error && <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}
        <button type="button" onClick={()=>void fetchData()} className="mr-3 font-bold underline">تلاش دوباره</button></div>}
      {!error && !rules.length && <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-4 py-12 text-center">
        <RadioTower size={36} className="text-[#64748B]" />
        <h2 className="text-base font-bold text-[#0F172A]">هنوز پاسخی برای لایو ساخته نشده</h2>
        <p className="max-w-md text-xs leading-6 text-[#64748B]">با نوشتن یک کلمه در چت لایو، پاسخ متنی به دایرکت بیننده فرستاده می‌شود.</p>
      </div>}
      {rules.map((rule) => (
        <article key={rule.id} className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,.025)] sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <RadioTower size={17} className="shrink-0 text-[#2563EB]" />
                <h2 className="text-sm font-bold text-[#0F172A]">پاسخ خودکار لایو</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">{(rule.keyword||"").split(",").filter(Boolean).map((key)=>(
                <span key={key} className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">{key}</span>
              ))}</div>
            </div>
            <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1.5 text-[11px] font-medium text-[#475569]">
              {rule.liveReplyMode === "FOLLOWUP" ? "چندمرحله‌ای" : "متنی"}
            </span>
          </div>
          <p className="line-clamp-2 text-xs leading-6 text-[#64748B]">{rule.replyText || ""}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            {rule.requireFollow && <span className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">اجبار به فالو</span>}
            {rule.liveReplyMode === "FOLLOWUP" && <span className="inline-flex items-center gap-1"><MessageCircle size={13}/> ادامه با «{rule.liveReplyKeyword}»</span>}
          </div>
          <div className="flex gap-2 border-t border-[#EDF1F6] pt-3">
            <button type="button" onClick={()=>router.push("/dashboard/live-automation/"+rule.id)}
              className="sd-neutral-button flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#C4D1E1] bg-white px-4 text-xs font-bold text-[#2563EB] hover:bg-[#EFF6FF]">
              <Pencil size={15}/> ویرایش
            </button>
            <button type="button" aria-label="حذف پاسخ خودکار لایو" onClick={()=>{setDeleteId(rule.id);setDeleteError("");}}
              className="sd-destructive-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 text-xs font-bold text-red-600 hover:bg-red-100">
              <Trash2 size={15}/> حذف
            </button>
          </div>
        </article>
      ))}
      {deleteId && (
        <div role="presentation" className="fixed inset-0 z-[2300] flex items-center justify-center bg-black/40 px-4" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!deleting)setDeleteId(null);}}>
          <section role="dialog" aria-modal="true" aria-labelledby="live-delete-heading" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="live-delete-heading" className="text-base font-bold text-[#0F172A]">پاسخ خودکار لایو حذف شود؟</h2>
            <p className="text-xs leading-6 text-[#64748B]">این پاسخ دیگر برای پیام‌های جدید لایو اجرا نخواهد شد.</p>
            {deleteError && <p role="alert" className="text-xs text-red-600">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={deleting} onClick={()=>setDeleteId(null)} className="sd-neutral-button min-h-11 rounded-xl border border-[#CBD5E1] text-sm font-semibold">انصراف</button>
              <button type="button" disabled={deleting} onClick={()=>void deleteRule()} className="sd-destructive-button min-h-11 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-60">{deleting?"در حال حذف...":"حذف"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
