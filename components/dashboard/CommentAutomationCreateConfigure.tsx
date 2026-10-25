"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDashboardAccountSelection } from "./DashboardAccountContext";
import AutomationCreationFlow from "./AutomationCreationFlow";
import AutomationCreationSkeleton from "./AutomationCreationSkeleton";

export default function CommentAutomationCreateConfigure() {
  const params = useSearchParams();
  const mediaId = params.get("mediaId");
  // The authenticated dashboard layout already verified and fetched these
  // accounts. Avoid an extra /api/instagram/accounts round-trip before the editor.
  const { accounts, accountId, isReady } = useDashboardAccountSelection();
  const account = accounts.find((item) => item.id === accountId && item.isConnected)
    ?? accounts.find((item) => item.isConnected)
    ?? null;

  // A deep-linked mediaId still needs its previous account/media validation.
  // Guard late results when the user changes account or navigates away.
  const validationKey = account && mediaId ? account.id + ":" + mediaId : null;
  const [mediaValidation, setMediaValidation] = useState<{
    key: string; valid: boolean; error: string;
  } | null>(null);

  useEffect(() => {
    if (!account || !mediaId) return;
    const key = account.id + ":" + mediaId;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          "/api/instagram/media?instagramAccountId=" + encodeURIComponent(account.id),
          { cache: "no-store", credentials: "include", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || result.error || "دریافت محتوا ناموفق بود.");
        }
        const found = (Array.isArray(result.data) ? result.data : [])
          .some((item: { id?: string }) => item.id === mediaId);
        if (!found) throw new Error("این محتوا دیگر در پیج پیدا نشد.");
        if (!controller.signal.aborted) setMediaValidation({ key, valid: true, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setMediaValidation({
          key, valid: false,
          error: error instanceof Error ? error.message : "دریافت اطلاعات ناموفق بود.",
        });
      }
    })();
    return () => controller.abort();
  }, [account?.id, mediaId]);

  if (!isReady || (validationKey && mediaValidation?.key !== validationKey)) {
    return <AutomationCreationSkeleton triggerType="COMMENT_KEYWORD" />;
  }
  if (!account || (validationKey && mediaValidation?.valid === false)) {
    return (
      <div dir="rtl" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-7 text-red-700">
        {mediaValidation?.error || "پیج اینستاگرام متصل نیست."}
      </div>
    );
  }

  return (
    <AutomationCreationFlow
      key={account.id}
      account={account}
      mediaId={mediaId ?? ""}
      triggerType="COMMENT_KEYWORD"
      title="ایجاد پاسخ خودکار کامنت"
      description="پست‌ها و ریلزها را انتخاب کن، روش ساخت را مشخص کن و پاسخ خودکار را در همین صفحه تنظیم کن."
    />
  );
}
