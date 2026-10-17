"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import AutoRepliesManager from "@/components/dashboard/AutoRepliesManager";
import { dairaPalette } from "../../lib/design-system/palette";

export default function CommentAutomationLanding() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-6 px-0 pt-1">
          <button
            type="button"
            onClick={() => router.push("/dashboard/comment-automation/new")}
            className="flex min-h-[82px] w-full items-center justify-center gap-2 rounded-full px-5 text-lg font-bold text-white shadow-[0_8px_20px_rgba(47,97,253,.14)] transition hover:brightness-95"
            style={{ background: `linear-gradient(100deg, ${dairaPalette.primary.main}, #4385F4)` }}
          >
            <Plus size={20} />
            <span>ایجاد پاسخ جدید</span>
          </button>
          <p className="sr-only" style={{ color: dairaPalette.text.body }}>پست، آلبوم یا ریلز دارای پاسخ خودکار را مدیریت کنید.</p>
        </section>
        <AutoRepliesManager scope="comments" />
      </div>
    </div>
  );
}
