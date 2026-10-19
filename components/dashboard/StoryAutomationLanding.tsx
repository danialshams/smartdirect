"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AutoRepliesManager from "@/components/dashboard/AutoRepliesManager";
import { dairaPalette } from "../../lib/design-system/palette";

export default function StoryAutomationLanding() {
  const router = useRouter();
  const [navigatingToCreate, setNavigatingToCreate] = useState(false);

  function openCreationPage() {
    if (navigatingToCreate) return;
    setNavigatingToCreate(true);
    router.push("/dashboard/story-automation/new");
  }

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-4 px-0 pt-1">
          <button
            type="button"
            onClick={openCreationPage}
            disabled={navigatingToCreate}
            aria-busy={navigatingToCreate}
            className="flex min-h-[54px] w-full flex-row-reverse items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-wait"
            style={{ background: dairaPalette.primary.main }}
          >
            {navigatingToCreate ? (
              <>
                <span aria-hidden="true" className="h-5 w-5 animate-pulse rounded-full bg-white/35" />
                <span aria-hidden="true" className="h-4 w-28 animate-pulse rounded-md bg-white/45" />
                <span className="sr-only">در حال آماده‌سازی فرم پاسخ خودکار...</span>
              </>
            ) : (
              <>
                <Plus size={20} />
                <span>ایجاد پاسخ جدید</span>
              </>
            )}
          </button>
          <p className="sr-only" style={{ color: dairaPalette.text.body }}>استوری‌های دارای پاسخ خودکار را مدیریت کنید.</p>
        </section>
        <AutoRepliesManager scope="stories" />
      </div>
    </div>
  );
}
