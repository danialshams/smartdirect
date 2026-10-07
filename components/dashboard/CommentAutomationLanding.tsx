"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CommentAutomationLanding() {
  const router = useRouter();
  const isComment = "Comment" === "Comment";

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5">
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            {isComment ? "پاسخ خودکار کامنت" : "پاسخ خودکار استوری"}
          </h1>
          <p className="mt-2 text-xs leading-5 text-[#64748B] sm:text-sm">
            {isComment ? "برای ایجاد پاسخ خودکار، یک محتوا انتخاب کنید." : "برای ایجاد پاسخ خودکار، یک استوری فعال انتخاب کنید."}
          </p>
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <Plus size={22} strokeWidth={2.1} />
            </div>
            <h2 className="text-sm font-bold text-[#0F172A]">ایجاد پاسخ جدید</h2>
            <p className="mt-2 max-w-sm text-xs leading-6 text-[#64748B]">
              {isComment ? "یک پست، ریلز یا آلبوم را انتخاب کنید و پاسخ خودکار آن را تنظیم کنید." : "یک استوری فعال را انتخاب کنید و پاسخ خودکار آن را تنظیم کنید."}
            </p>
            <button
              type="button"
              onClick={() => router.push(isComment ? "/dashboard/comment-automation/new" : "/dashboard/story-automation/new")}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1D4ED8]"
            >
              <Plus size={17} />
              ایجاد پاسخ جدید
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
