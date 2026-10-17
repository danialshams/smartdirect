"use client";

import { useEffect, useMemo, useState } from "react";
import DairaSkeleton from "@/components/ui/DairaSkeleton";
import Link from "next/link";
import { Camera, Image, Pencil, Search, Video } from "lucide-react";

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
  updatedAt?: string;
  publishedAt: string | null;
  instagramMediaId?: string | null;
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
  sortAt: string | null;
  previewUrl: string | null;
  previewKind: "image" | "video" | null;
  title: string;
  subtitle: string;
  keyword: string;
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

export default function AutoRepliesManager({ scope = "all" }: { scope?: "all" | "comments" | "stories" }) {
  const [items, setItems] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

        const activeStoryIds = new Set<string>(
          (Array.isArray(storiesResult?.data) ? storiesResult.data : []).map((story: Story) => story.id),
        );
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
        // Only show content that can be verified as existing on Instagram.
        // A local publishing job marked PUBLISHED is not sufficient on its own.
        const visiblePublishedJobs = publishedJobs.filter((job) => {
          if (!job.instagramMediaId || !mediaById.has(job.instagramMediaId)) return false;
          if (job.type === "STORY") return activeStoryIds.has(job.instagramMediaId);
          return true;
        });
        const linkedAutomationIds = new Set(
          visiblePublishedJobs.flatMap((job) => [job.commentAutomationId, job.storyReplyAutomationId].filter(Boolean) as string[]),
        );
        const publishedMediaIds = new Set(
          visiblePublishedJobs.map((job) => job.instagramMediaId).filter(Boolean) as string[],
        );
        const seenPublishedItems = new Set<string>();

        const nextItems: ReplyItem[] = [];
        for (const automation of (Array.isArray(automationsResult.data) ? automationsResult.data : []) as Automation[]) {
          if (
            (automation.triggerType !== "COMMENT_KEYWORD" && automation.triggerType !== "STORY_REPLY_KEYWORD") ||
            !automation.mediaId ||
            linkedAutomationIds.has(automation.id) ||
            publishedMediaIds.has(automation.mediaId) ||
            !mediaById.has(automation.mediaId) ||
            (automation.triggerType === "STORY_REPLY_KEYWORD" && !activeStoryIds.has(automation.mediaId))
          ) continue;

          const media = mediaById.get(automation.mediaId);
          if (!media) continue;
          const isStory = automation.triggerType === "STORY_REPLY_KEYWORD";
          nextItems.push({
            id: automation.id,
            key: `automation:${automation.id}`,
            type: media?.type ?? (isStory ? "STORY" : "UNKNOWN"),
            date: media?.date ?? automation.createdAt,
            sortAt: automation.createdAt,
            previewUrl: media?.previewUrl ?? null,
            previewKind: media?.previewKind ?? null,
            title: isStory ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت",
            subtitle: normalizeKeywordList(automation.keyword) || "بدون کلمه کلیدی",
            keyword: normalizeKeywordList(automation.keyword),
            href: isStory
              ? `/dashboard/story-automation/${automation.id}`
              : `/dashboard/comment-automation/${automation.id}`,
            isActive: automation.isActive,
          });
        }

        for (const job of visiblePublishedJobs) {
          const isStory = Boolean(job.storyReplyAutomationId || job.storyReplyTriggerKeywords?.trim());
          const publishedItemKey = `${job.type}:${job.instagramMediaId || job.commentAutomationId || job.storyReplyAutomationId || job.id}`;
          if (seenPublishedItems.has(publishedItemKey)) continue;
          seenPublishedItems.add(publishedItemKey);
          nextItems.push({
            id: job.id,
            key: `publish:${job.id}`,
            type: job.type,
            date: job.publishedAt ?? job.createdAt,
            sortAt: job.updatedAt ?? job.createdAt,
            previewUrl: job.media[0]?.publicUrl ?? null,
            previewKind: job.media[0]?.type === "VIDEO" ? "video" : job.media[0]?.type === "IMAGE" ? "image" : null,
            title: isStory ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت",
            subtitle: normalizeKeywordList(isStory ? job.storyReplyTriggerKeywords : job.commentTriggerKeywords) ||
              (job.caption?.trim() || "پاسخ خودکار محتوای منتشرشده"),
            keyword: normalizeKeywordList(isStory ? job.storyReplyTriggerKeywords : job.commentTriggerKeywords),
            href: `/dashboard/publishing/${job.id}`,
          });
        }

        nextItems.sort((a, b) => {
          const aDate = a.sortAt ? new Date(a.sortAt).getTime() : 0;
          const bDate = b.sortAt ? new Date(b.sortAt).getTime() : 0;
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

  const scopedItems = useMemo(() => items.filter((item) => {
    if (scope === "comments") return item.title === "پاسخ خودکار کامنت" && ["POST", "CAROUSEL", "REEL"].includes(item.type);
    if (scope === "stories") return item.title === "پاسخ خودکار استوری" && item.type === "STORY";
    return true;
  }), [items, scope]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fa-IR");
    if (!query) return scopedItems;
    return scopedItems.filter((item) => item.keyword.toLocaleLowerCase("fa-IR").includes(query));
  }, [scopedItems, searchQuery]);

  if (loading) {
    return <DairaSkeleton variant="page" label="در حال دریافت پاسخ‌های خودکار..." />;
  }

  return (
    <div dir="rtl" className="min-h-full px-1 py-2 sm:px-2 sm:py-3">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-[28px] bg-transparent">


          {!error && scopedItems.length > 0 ? (
            <div className="mb-4 px-1">
              <label className="flex h-11 items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-[#64748B] transition focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/10">
                <Search size={17} className="shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="جستجو براساس کلمه کلیدی..."
                  aria-label="جستجو براساس کلمه کلیدی"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
              </label>
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
            <div className="space-y-2.5">
              {filteredItems.map((item) => (
                <div key={item.key} className="flex min-h-[100px] items-center justify-between gap-2.5 rounded-[22px] border border-[#E8EDF5] bg-white px-2.5 py-2.5 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {item.previewUrl ? (
                      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] sm:h-[84px] sm:w-[84px]">
                        {item.previewKind === "video" ? (
                          <video src={item.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.previewUrl} alt={typeLabels[item.type]} className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </div>
                    ) : (
                      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] sm:h-[84px] sm:w-[84px]">
                        {item.type === "STORY" ? <Camera size={18} /> : item.type === "REEL" ? <Video size={18} /> : <Image size={18} />}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold leading-5 text-[#0F172A]">{item.title}</span>
                        <span className="text-[11px] font-medium text-[#64748B]">{formatDate(item.date)}</span>
                        {item.isActive === false ? (
                          <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">غیرفعال</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={item.href}
                    className="inline-flex h-8 shrink-0 flex-row-reverse items-center justify-center gap-1 rounded-[22px] border border-[#A8C5F8] bg-white px-2 text-[11px] font-semibold text-[#2563EB] no-underline transition hover:bg-[#EFF6FF] sm:px-2.5 sm:text-xs"
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
