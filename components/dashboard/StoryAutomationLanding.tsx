"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StoryAutomationLanding() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[900px] items-center justify-center px-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/story-automation/new")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95"
        >
          <Plus size={18} />
          <span>ایجاد پاسخ جدید</span>
        </button>
      </div>
    </div>
  );
}
