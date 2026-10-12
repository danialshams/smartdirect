"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLoading } from "@/components/dashboard/DashboardUI";
import Link from "next/link";
import { Camera, Image, Images, MessageCircleReply, Pencil, Video } from "lucide-react";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY" | "UNKNOWN";
type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";

type Automation = {
  id: string;
  instagramAccountId: string;
  triggerType: TriggerType | string;
  mediaId: string | null;
  keyword: string | null;
  createdAt: string;
  isActive: boolean;
};

type InstagramMedia = {
  id: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  timestamp?: string | null;
};

type Story = {
  id: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  timestamp?: string | null;
};

type PublishJob = {
  id: string;
  type: PublishType;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  caption: string | null;
  media: Array<{ type: "IMAGE" | "VIDEO"; publicUrl: string | null }>;
  commentAutomationId?: string | null;
  storyReplyAutomationId?: string | null;
  commentTriggerKeywords?: string | null;
  storyReplyTriggerKeywords?: string | null;
};

type ReplyItem = {
  id: string;
  key: string;
  type: PublishType;
  date: string | null;
  previewUrl: string | null;
  previewKind: "image" | "video" | null;
  title: string;
  subtitle: string;
  href: string;
  isActive?: boolean;
};

const typeLabels: Record<PublishType, string> = {
  POST: "پست",
  CAROUSEL: "آلبوم",
  REEL: "ریلز",
  STORY: "استوری",
  UNKNOWN: "محتوا",
};

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
}

function getMediaType(item: InstagramMedia): PublishType {
  if (item.media_product_type === "REELS") return "REEL";
  if (item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (item.media_product_type === "STORY") return "STORY";
  if (item.media_type === "IMAGE" || item.media_type === "VIDEO") return "POST";
  return "UNKNOWN";
}

function normalizeKeywordList(value: string | null | undefined) {
  return (value || "").split(/[,،;؛\n]+/).map((item) => item.trim()).filter(Boolean).join("، ");
}

export default function AutoRepliesManager() {
  const [items, setItems] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | Exclude<PublishType, "UNKNOWN">>("ALL");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const accountsResponse = await fetch("/api/instagram/accounts", {
          cache: "no-store",
          credentials: "include",
        });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) {
          throw new Error(accountsResult.error || "دریافت پیج اینستاگرام ناموفق بود.");
        }

        const account = (Array.isArray(accountsResult.accounts) ? accountsResult.accounts : [])
          .find((item: { isConnected: boolean }) => item.isConnected);
        if (!account) {
          if (!cancelled) {
            setItems([]);
            setError("پیج اینستاگرام متصل نیست.");
          }
          return;
        }

        const accountQuery = `?instagramAccountId=${encodeURIComponent(account.id)}`;
        const [automationsResponse, mediaResponse, storiesResponse, jobsResponse] = await Promise.all([
          fetch(`/api/automations${accountQuery}`, { cache: "no-store", credentials: "include" }),
          fetch(`/api/instagram/media${accountQuery}`, { cache: "no-store", credentials: "include" }).catch(() => null),
          fetch(`/api/instagram/stories${accountQuery}`, { cache: "no-store", credentials: "include" }).catch(() => null),
          fetch(`/api/instagram/publishing${accountQuery}`, { cache: "no-store", credentials: "include" }).catch(() => null),
        ]);

        const automationsResult = await automationsResponse.json();
        if (!automationsResponse.ok || !automationsResult.success) {
          throw new Error(automationsResult.error || automationsResult.message || "دریافت پاسخ‌های خودکار ناموفق بود.");
        }

        const mediaResult = mediaResponse?.ok ? await mediaResponse.json().catch(() => null) : null;
        const storiesResult = storiesResponse?.ok ? await storiesResponse.json().catch(() => null) : null;
        const jobsResult = jobsResponse?.ok ? await jobsResponse.json().catch(() => null) : null;

        const mediaById = new Map<string, { type: PublishType; date: string | null; previewUrl: string | null; previewKind: "image" | "video" | null }>();
        for (const media of (Array.isArray(mediaResult?.data) ? mediaResult.data : []) as InstagramMedia[]) {
          mediaById.set(media.id, {
            type: getMediaType(media),
            date: media.timestamp ?? null,
            previewUrl: media.thumbnail_url || media.media_url || null,
            previewKind: media.thumbnail_url || media.media_type !== "VIDEO" ? "image" : "video",
          });
        }
        for (const story of (Array.isArray(storiesResult?.data) ? storiesResult.data : []) as Story[]) {
          mediaById.set(story.id, {
            type: "STORY",
            date: story.timestamp ?? null,
            previewUrl: story.thumbnailUrl || story.mediaUrl || null,
            previewKind: story.thumbnailUrl || story.mediaType !== "VIDEO" ? "image" : "video",
          });
        }

        const jobs = (Array.isArray(jobsResult?.data) ? jobsResult.data : []) as PublishJob[];
        const publishedJobs = jobs.filter((job) =>
          job.status === "PUBLISHED" &&
          (Boolean(job.commentAutomationId) || Boolean(job.storyReplyAutomationId) ||
            Boolean(job.commentTriggerKeywords?.trim() || job.storyReplyTriggerKeywords?.trim())),
        );
        const linkedAutomationIds = new Set(
          publishedJobs.flatMap((job) => [job.commentAutomationId, job.storyReplyAutomationId].filter(Boolean) as string[]),
        );

        const nextItems: ReplyItem[] = [];
        for (const automation of (Array.isArray(automationsResult.data) ? automationsResult.data : []) as Automation[]) {
          if (
            (automation.triggerType !== "COMMENT_KEYWORD" && automation.triggerType !== "STORY_REPLY_KEYWORD") ||
            !automation.mediaId ||
            linkedAutomationIds.has(automation.id)
          ) continue;

          const media = mediaById.get(automation.mediaId);
          const isStory = automation.triggerType === "STORY_REPLY_KEYWORD";
          nextItems.push({
            id: automation.id,
            key: `automation:${automation.id}`,
            type: media?.type ?? (isStory ? "STORY" : "UNKNOWN"),
            date: media?.date ?? automation.createdAt,
            previewUrl: media?.previewUrl ?? null,
            previewKind: media?.previewKind ?? null,
            title: isStory ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت",
            subtitle: normalizeKeywordList(automation.keyword) || "بدون کلمه کلیدی",
            href: isStory
              ? `/dashboard/story-automation/${automation.id}`
              : `/dashboard/comment-automation/${automation.id}`,
            isActive: automation.isActive,
          });
        }

        for (const job of publishedJobs) {
          const isStory = Boolean(job.storyReplyAutomationId || job.storyReplyTriggerKeywords?.trim());
          nextItems.push({
            id: job.id,
            key: `publish:${job.id}`,
            type: job.type,
            date: job.publishedAt ?? job.createdAt,
            previewUrl: job.media[0]?.publicUrl ?? null,
            previewKind: job.media[0]?.type === "VIDEO" ? "video" : job.media[0]?.type === "IMAGE" ? "image" : null,
            title: isStory ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت",
            subtitle: normalizeKeywordList(isStory ? job.storyReplyTriggerKeywords : job.commentTriggerKeywords) ||
              (job.caption?.trim() || "پاسخ خودکار محتوای منتشرشده"),
            href: `/dashboard/publishing/${job.id}`,
          });
        }

        nextItems.sort((a, b) => {
          const aDate = a.date ? new Date(a.date).getTime() : 0;
          const bDate = b.date ? new Date(b.date).getTime() : 0;
          return bDate - aDate;
        });

        if (!cancelled) setItems(nextItems);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "خطا در دریافت پاسخ‌های خودکار.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(
    () => (filter === "ALL" ? items : items.filter((item) => item.type === filter)),
    [filter, items],
  );

  const filters = [
    { key: "ALL" as const, label: "همه", icon: MessageCircleReply },
    { key: "POST" as const, label: "پست", icon: Image },
    { key: "CAROUSEL" as const, label: "آلبوم", icon: Images },
    { key: "REEL" as const, label: "ریلز", icon: Video },
    { key: "STORY" as const, label: "استوری", icon: Camera },
  ];

  if (loading) {
    return <DashboardLoading label="در حال دریافت پاسخ‌های خودکار..." className="dashboard-loading--page dashboard-loading--centered" />;
  }

  return (
    <div dir="rtl" className="min-h-full bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <MessageCircleReply size={19} />
            </span>
            <div>
              <h1 className="text-base font-bold text-[#0F172A]">ویرایش پاسخ های خودکار</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                پاسخ‌های خودکار کامنت و استوری را از اینجا مدیریت و ویرایش کنید.
              </p>
            </div>
          </div>

          {!error && items.length > 0 ? (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {filters.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${filter === key ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"}`}
                >
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium text-[#B91C1C]">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-center text-xs font-medium text-[#94A3B8]">
              هنوز پاسخ خودکاری برای نمایش وجود ندارد.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0]">
              {filteredItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 px-3.5 py-3.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {item.previewUrl ? (
                      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
                        {item.previewKind === "video" ? (
                          <video src={item.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.previewUrl} alt={typeLabels[item.type]} className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </div>
                    ) : (
                      <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]">
                        {item.type === "STORY" ? <Camera size={18} /> : item.type === "REEL" ? <Video size={18} /> : <Image size={18} />}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#0F172A]">{item.title}</span>
                        <span className="text-[11px] font-medium text-[#64748B]">{formatDate(item.date)}</span>
                        {item.isActive === false ? (
                          <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">غیرفعال</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[#64748B]">{typeLabels[item.type]} · {item.subtitle}</p>
                    </div>
                  </div>

                  <Link
                    href={item.href}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-white px-2.5 text-xs font-semibold text-[#2563EB] no-underline hover:bg-[#EFF6FF]"
                  >
                    <Pencil size={14} />
                    <span>ویرایش</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
