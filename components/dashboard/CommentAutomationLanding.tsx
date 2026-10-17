"use client";

import { MessageCircleReply, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import AutoRepliesManager from "@/components/dashboard/AutoRepliesManager";

export default function CommentAutomationLanding() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-2xl">
        <section className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <MessageCircleReply size={19} />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#0F172A]">پاسخ خودکار کامنت</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">برای ایجاد پاسخ خودکار، یک محتوا انتخاب کنید.</p>
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="max-w-sm text-xs leading-6 text-[#64748B]">پست، آلبوم یا ریلز دارای پاسخ خودکار را مدیریت کنید.</p>
            <button
              type="button"
              onClick={() => router.push("/dashboard/comment-automation/new")}
              dir="ltr"
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1D4ED8]"
            >
              <Plus size={17} />
              <span dir="rtl">ایجاد پاسخ جدید</span>
            </button>
          </div>
        </section>
        <AutoRepliesManager scope="comments" />
      </div>
    </div>
  );
}
