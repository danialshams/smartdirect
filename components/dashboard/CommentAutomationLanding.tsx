"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import AutoRepliesManager from "@/components/dashboard/AutoRepliesManager";
import { dairaPalette } from "../../lib/design-system/palette";

export default function CommentAutomationLanding() {
  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-4 px-0 pt-1">
          <Link
            href="/dashboard/comment-automation/new"
            className="daira-leading-action flex min-h-[54px] w-full flex-row items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-sm transition hover:brightness-95"
            style={{ background: dairaPalette.primary.main }}
          >
            <Plus size={20} />
            <span>ایجاد پاسخ جدید</span>
          </Link>
          <p className="sr-only" style={{ color: dairaPalette.text.body }}>پست، آلبوم یا ریلز دارای پاسخ خودکار را مدیریت کنید.</p>
        </section>
        <AutoRepliesManager scope="comments" />
      </div>
    </div>
  );
}
