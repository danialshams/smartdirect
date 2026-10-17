"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import AutoRepliesManager from "@/components/dashboard/AutoRepliesManager";
import { dairaPalette } from "@/lib/design-system/palette";

export default function StoryAutomationLanding() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-4 rounded-[28px] border p-4 sm:p-5" style={{ background: dairaPalette.background.surface, borderColor: dairaPalette.border, boxShadow: "0 8px 28px rgba(15,23,42,.035)" }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard/story-automation/new")}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white transition hover:brightness-95"
            style={{ background: dairaPalette.primary.main }}
          >
            <Plus size={20} />
            <span>ایجاد پاسخ جدید</span>
          </button>
          <p className="mt-3 text-center text-xs leading-6" style={{ color: dairaPalette.text.body }}>استوری‌های دارای پاسخ خودکار را مدیریت کنید.</p>
        </section>
        <AutoRepliesManager scope="stories" />
      </div>
    </div>
  );
}
