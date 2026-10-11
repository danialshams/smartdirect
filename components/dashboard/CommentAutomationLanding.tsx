"use client";

import { MessageCircleReply, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CommentAutomationLanding() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
            <MessageCircleReply size={19} />
          </span>
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">پاسخ خودکار کامنت</h1>
            <p className="mt-1.5 text-xs leading-5 text-[#64748B]">برای ایجاد پاسخ خودکار، یک محتوا انتخاب کنید.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <p className="mt-2 max-w-sm text-xs leading-6 text-[#64748B]">
              یک پست، ریلز یا آلبوم را انتخاب کنید و پاسخ خودکار آن را تنظیم کنید.
            </p>
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
      </div>
    </div>
  );
}
