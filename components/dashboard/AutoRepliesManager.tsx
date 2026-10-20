"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardAccountId } from "@/components/dashboard/DashboardAccountContext";
import Link from "next/link";
import AutoRepliesSkeleton from "@/components/dashboard/AutoRepliesSkeleton";
import { AlertTriangle, Image as ImageIcon, LoaderCircle, Pencil, Search, Trash2 } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY" | "UNKNOWN";
type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";

type Automation = {
  id: string;
  instagramAccountId: string;
  triggerType: TriggerType | string;
  mediaId: string | null;
  mediaIds?: string | null;
  keyword: string | null;
  keywordMatchMode?: string | null;
  createdAt: string;
  updatedAt?: string;
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
  mediaId?: string | null;
  isActive?: boolean;
};



function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("fa-IR-u-ca-persian", {
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

const AUTO_REPLIES_CACHE_VERSION = 7;
const AUTO_REPLIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readAutoRepliesCache(accountId: string): ReplyItem[] | null {
  try {
    const key = `smartdirect:auto-replies:v${AUTO_REPLIES_CACHE_VERSION}:${accountId}`;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { savedAt?: number; items?: ReplyItem[] };
    if (
      typeof cached.savedAt !== "number" ||
      Date.now() - cached.savedAt > AUTO_REPLIES_CACHE_TTL_MS ||
      !Array.isArray(cached.items)
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return cached.items;
  } catch {
    return null;
  }
}

function writeAutoRepliesCache(accountId: string, items: ReplyItem[]) {
  try {
    const key = `smartdirect:auto-replies:v${AUTO_REPLIES_CACHE_VERSION}:${accountId}`;
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // Storage can be unavailable or full; rendering must continue without it.
  }
}

export default function AutoRepliesManager({ scope = "all" }: { scope?: "all" | "comments" | "stories" }) {
  const initialAccountId = useDashboardAccountId();
  const [items, setItems] = useState<ReplyItem[]>([]);
  const itemsRef = useRef<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ReplyItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [closingDelete, setClosingDelete] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useEffect(() => {
    if (!deleteTarget) {
      setDeleteModalVisible(false);
      return;
    }

    // Mount the modal in its hidden state first, then animate it into view.
    // Two animation frames ensure the browser paints the initial styles before
    // switching to the visible styles.
    setDeleteModalVisible(false);
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setDeleteModalVisible(true));
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [deleteTarget]);

  useEffect(() => {
    let cancelled = false;

    // Restore only the account identified by the authenticated shared layout,
    // then revalidate the cached content in the background.
    if (initialAccountId) {
      const warmItems = readAutoRepliesCache(initialAccountId);
      if (warmItems) {
        itemsRef.current = warmItems;
        setItems(warmItems);
        setLoading(false);
      }
    }

    async function load() {
      try {
        // Keep the current page visible during background refreshes. On a hard
        // reload, restore cached items only after the authenticated account is verified.
        if (itemsRef.current.length === 0) setLoading(true);
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
            itemsRef.current = [];
            setItems([]);
            setError("پیج اینستاگرام متصل نیست.");
          }
          return;
        }

        const cachedItems = readAutoRepliesCache(account.id);
        if (!cancelled && cachedItems) {
          itemsRef.current = cachedItems;
          setItems(cachedItems);
          setLoading(false);
        } else if (!cancelled) {
          itemsRef.current = [];
          setItems([]);
          setLoading(true);
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
          Boolean(
            normalizeKeywordList(job.commentTriggerKeywords) ||
            normalizeKeywordList(job.storyReplyTriggerKeywords),
          ),
        );
        // Only show content that can be verified as existing on Instagram.
        // A local publishing job marked PUBLISHED is not sufficient on its own.
        const visiblePublishedJobs = publishedJobs.filter((job) => {
          if (!job.instagramMediaId || !mediaById.has(job.instagramMediaId)) return false;
          if (job.type === "STORY") return activeStoryIds.has(job.instagramMediaId);
          return true;
        });
        const allAutomations = ((Array.isArray(automationsResult.data) ? automationsResult.data : []) as Automation[])
          .slice()
          .sort((a, b) => {
            const aTimestamp = Date.parse(a.updatedAt || a.createdAt);
            const bTimestamp = Date.parse(b.updatedAt || b.createdAt);
            return (Number.isFinite(bTimestamp) ? bTimestamp : 0) - (Number.isFinite(aTimestamp) ? aTimestamp : 0);
          });
        const automationById = new Map(allAutomations.map((automation) => [automation.id, automation] as const));
        const publishedMediaIds = new Set(
          visiblePublishedJobs.map((job) => job.instagramMediaId).filter(Boolean) as string[],
        );
        const seenPublishedItems = new Set<string>();

        const nextItems: ReplyItem[] = [];
        for (const automation of allAutomations) {
          const automationMediaIds = Array.from(new Set([
            ...(automation.mediaId ? [automation.mediaId] : []),
            ...(typeof automation.mediaIds === "string" ? automation.mediaIds.split(",").map((id) => id.trim()).filter(Boolean) : []),
          ]));
          const availableAutomationMediaIds = automationMediaIds.filter((id) => mediaById.has(id));
          const normalizedAutomationKeyword = normalizeKeywordList(automation.keyword);
          const isAnyCommentAutomation =
            automation.triggerType === "COMMENT_KEYWORD" && automation.keywordMatchMode === "CONTAINS_ANY";
          if (
            (automation.triggerType !== "COMMENT_KEYWORD" && automation.triggerType !== "STORY_REPLY_KEYWORD") ||
            (!normalizedAutomationKeyword && !isAnyCommentAutomation)
          ) continue;

          const isStory = automation.triggerType === "STORY_REPLY_KEYWORD";
          const displayKeyword = normalizedAutomationKeyword || (isAnyCommentAutomation ? "شامل هر کلمه" : "بدون کلمه کلیدی");
          // One row represents exactly one Instagram media connection. A shared
          // response can be edited as a whole, but deletion unlinks only this row.
          for (const displayMediaId of availableAutomationMediaIds) {
            if (publishedMediaIds.has(displayMediaId)) continue;
            if (isStory && !activeStoryIds.has(displayMediaId)) continue;
            const media = mediaById.get(displayMediaId);
            if (!media) continue;
            nextItems.push({
              id: automation.id,
              key: `automation:${automation.id}:${displayMediaId}`,
              mediaId: displayMediaId,
              type: media.type,
              date: automation.updatedAt || automation.createdAt,
              sortAt: automation.updatedAt || automation.createdAt,
              previewUrl: media.previewUrl,
              previewKind: media.previewKind,
              title: isStory ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت",
              subtitle: displayKeyword,
              keyword: displayKeyword,
              href: isStory
                ? `/dashboard/story-automation/${automation.id}`
                : `/dashboard/comment-automation/${automation.id}?mediaId=${encodeURIComponent(displayMediaId)}`,
              isActive: automation.isActive,
            });
          }
        }

        for (const job of visiblePublishedJobs) {
          const storyKeywords = normalizeKeywordList(job.storyReplyTriggerKeywords);
          const commentKeywords = normalizeKeywordList(job.commentTriggerKeywords);
          const isStory = Boolean(storyKeywords) || (!commentKeywords && Boolean(job.storyReplyAutomationId));
          const jobKeyword = isStory ? storyKeywords : commentKeywords;
          if (!jobKeyword && !(isStory ? job.storyReplyAutomationId : job.commentAutomationId)) continue;
          const publishedItemKey = `${job.type}:${job.instagramMediaId || job.commentAutomationId || job.storyReplyAutomationId || job.id}`;
          if (seenPublishedItems.has(publishedItemKey)) continue;
          seenPublishedItems.add(publishedItemKey);
          const linkedAutomationId = isStory ? job.storyReplyAutomationId : job.commentAutomationId;
          const directlyLinkedAutomation = linkedAutomationId ? automationById.get(linkedAutomationId) : undefined;
          const targetMediaId = job.instagramMediaId || "";
          // Prefer the newest matching automation for this media/trigger so a new
          // response isn't masked by an older automation still linked to the job.
          const mediaMatchedAutomation = allAutomations.find((automation) => {
            const automationMatchesMedia = automation.mediaId === targetMediaId ||
              Boolean(automation.mediaIds?.split(",").some((id) => id.trim() === targetMediaId));
            return automation.triggerType === (isStory ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD") && automationMatchesMedia;
          });
          // If a standalone automation is already listed for this media, don't add a
          // duplicate publishing-job row. Directly linked jobs remain represented here.
          if (!linkedAutomationId && mediaMatchedAutomation) continue;
          const directActivityAt = directlyLinkedAutomation ? Date.parse(directlyLinkedAutomation.updatedAt || directlyLinkedAutomation.createdAt) : Number.NEGATIVE_INFINITY;
          const mediaActivityAt = mediaMatchedAutomation ? Date.parse(mediaMatchedAutomation.updatedAt || mediaMatchedAutomation.createdAt) : Number.NEGATIVE_INFINITY;
          const linkedAutomation = directActivityAt > mediaActivityAt
            ? directlyLinkedAutomation
            : mediaMatchedAutomation ?? directlyLinkedAutomation;
          const itemCreatedAt = linkedAutomation?.updatedAt || linkedAutomation?.createdAt || job.createdAt;
          // Publishing metadata can be older than an edited automation. Always
          // reflect the current reply for this specific media in the list.
          const keyword = linkedAutomation
            ? normalizeKeywordList(linkedAutomation.keyword) ||
                (linkedAutomation.triggerType === "COMMENT_KEYWORD" && linkedAutomation.keywordMatchMode === "CONTAINS_ANY"
                  ? "شامل هر کلمه" : jobKeyword)
            : jobKeyword;
          nextItems.push({
            id: job.id,
            key: `publish:${job.id}`,
            mediaId: job.instagramMediaId,
            type: job.type,
            date: itemCreatedAt,
            sortAt: itemCreatedAt,
            previewUrl: job.media[0]?.publicUrl ?? null,
            previewKind: job.media[0]?.type === "VIDEO" ? "video" : job.media[0]?.type === "IMAGE" ? "image" : null,
            title: isStory ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت",
            subtitle: keyword,
            keyword,
            href: linkedAutomation
              ? (isStory
                ? `/dashboard/story-automation/${linkedAutomation.id}`
                : `/dashboard/comment-automation/${linkedAutomation.id}?mediaId=${encodeURIComponent(targetMediaId)}`)
              : `/dashboard/publishing/${job.id}`,
          });
        }

        // The list represents the latest automation activity (including reusing a saved response),
        // not when its associated Instagram post/story was originally published.
        nextItems.sort((a, b) => {
          const parsedA = a.sortAt ? Date.parse(a.sortAt) : Number.NaN;
          const parsedB = b.sortAt ? Date.parse(b.sortAt) : Number.NaN;
          const aDate = Number.isFinite(parsedA) ? parsedA : 0;
          const bDate = Number.isFinite(parsedB) ? parsedB : 0;
          return bDate - aDate;
        });

        if (!cancelled) {
          itemsRef.current = nextItems;
          setItems(nextItems);
          setError("");
          writeAutoRepliesCache(account.id, nextItems);
        }
      } catch (e) {
        if (!cancelled) {
          // A refresh failure should not hide a previously loaded, usable list.
          setError(itemsRef.current.length > 0 ? "" : e instanceof Error ? e.message : "خطا در دریافت پاسخ‌های خودکار.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialAccountId]);

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

  function closeDeleteModal() {
    if (deleting || closingDelete) return;
    setClosingDelete(true);
    window.setTimeout(() => {
      setDeleteTarget(null);
      setClosingDelete(false);
    }, 280);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const isPublishedItem = deleteTarget.key.startsWith("publish:");
      if (!isPublishedItem && !deleteTarget.mediaId) throw new Error("شناسه محتوای موردنظر پیدا نشد.");
      const endpoint = isPublishedItem
        ? "/api/instagram/publishing/" + encodeURIComponent(deleteTarget.id) +
          "/automation?triggerType=" + (deleteTarget.title === "پاسخ خودکار استوری" ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD")
        : "/api/automations/" + encodeURIComponent(deleteTarget.id) +
          "/media?mediaId=" + encodeURIComponent(deleteTarget.mediaId || "");
      const response = await fetch(endpoint, { method: "DELETE", cache: "no-store", credentials: "include" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || result?.message || "حذف پاسخ خودکار انجام نشد.");
      }
      const nextItems = itemsRef.current.filter((item) => item.key !== deleteTarget.key);
      itemsRef.current = nextItems;
      setItems(nextItems);
      try {
        const accountResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountResult = await accountResponse.json();
        const account = (Array.isArray(accountResult?.accounts) ? accountResult.accounts : []).find((item: { isConnected: boolean }) => item.isConnected);
        if (account) writeAutoRepliesCache(account.id, nextItems);
      } catch {
        // The list remains updated in memory even if cache refresh fails.
      }
      setDeleting(false);
      setClosingDelete(true);
      window.setTimeout(() => {
        setDeleteTarget(null);
        setClosingDelete(false);
      }, 280);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "حذف پاسخ خودکار انجام نشد.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <AutoRepliesSkeleton />;
  }

  return (
    <div dir="rtl" className="min-h-full px-1 py-2 sm:px-2 sm:py-3">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-[28px] bg-transparent">


          {!error && scopedItems.length > 0 ? (
            <div className="mb-4 px-1">
              <label className="flex h-11 items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-[#64748B] transition focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/10">
                <Search size={17} className="shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="جستجو براساس کلمه کلیدی..."
                  aria-label="جستجو براساس کلمه کلیدی"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#94A3B8] sm:text-sm"
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
                <div key={item.key} className="flex min-h-[84px] items-center justify-between gap-3 rounded-[22px] border border-[#E8EDF5] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8EDF5] bg-[#F8FAFC]">
                      {item.previewUrl && item.previewKind === "video" ? (
                        <video src={item.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label="پیش‌نمایش ویدیو" />
                      ) : item.previewUrl ? (
                        <img src={item.previewUrl} alt="پیش‌نمایش محتوا" loading="lazy" className="h-full w-full object-cover" />
                      ) : <ImageIcon size={20} className="text-[#94A3B8]" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    <div
                      className="max-w-full rounded-xl px-3 py-2 text-[13px] font-bold leading-6"
                      style={{
                        color: dairaPalette.primary.main,
                        backgroundColor: dairaPalette.secondary.hoverBackground,
                        border: `1px solid ${dairaPalette.secondary.activeBackground}`,
                      }}
                    >
                      <span className="break-words">{item.keyword || "بدون کلمه کلیدی"}</span>
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: dairaPalette.text.muted }}>{formatDate(item.date)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={item.href}
                      className="inline-flex h-8 flex-row-reverse items-center justify-center gap-1 rounded-[8px] px-2 text-[11px] font-semibold no-underline transition sm:px-2.5 sm:text-xs"
                      style={{ color: dairaPalette.primary.main, border: `1px solid ${dairaPalette.secondary.outline}`, backgroundColor: dairaPalette.background.surface }}
                    >
                      <Pencil size={14} />
                      <span>ویرایش</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setDeleteError(""); setDeleteTarget(item); }}
                      aria-label={`حذف پاسخ این محتوا برای ${item.keyword}`}
                      className="inline-flex h-8 flex-row-reverse items-center justify-center gap-1 rounded-[8px] px-2 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs"
                      style={{ color: dairaPalette.status.error, border: `1px solid ${dairaPalette.status.error}55`, backgroundColor: dairaPalette.background.surface }}
                    >
                      <Trash2 size={14} />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {deleteTarget ? (
        <div
          className={`fixed inset-0 z-[9998] flex items-center justify-center px-4 py-6 backdrop-blur-md transition-[opacity,background-color] duration-300 ease-out motion-reduce:transition-none ${closingDelete || !deleteModalVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
          style={{ backgroundColor: closingDelete || !deleteModalVisible ? "rgba(24, 35, 60, 0)" : "rgba(24, 35, 60, 0.36)" }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteModal(); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-reply-title"
            className={`w-full max-w-sm rounded-[24px] p-5 shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${closingDelete || !deleteModalVisible ? "translate-y-2 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}
            style={{ backgroundColor: dairaPalette.background.surface, border: `1px solid ${dairaPalette.border}`, zIndex: 9999 }}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: dairaPalette.status.error, backgroundColor: `${dairaPalette.status.error}12` }}>
                <AlertTriangle size={21} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="delete-reply-title" className="text-base font-bold" style={{ color: dairaPalette.text.heading }}>از حذف این پاسخ خودکار مطمئنی؟</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: dairaPalette.text.body }}>
                  اتصال پاسخ خودکار به همین محتوا حذف می‌شود. پیام‌های پاسخ و اتصال سایر محتواها محفوظ می‌مانند.
                </p>
                {deleteTarget.key.startsWith("publish:") ? (
                  <p className="mt-2 text-xs leading-5" style={{ color: dairaPalette.text.muted }}>خود پست یا استوری منتشرشده در اینستاگرام حذف نمی‌شود.</p>
                ) : null}
              </div>
            </div>
            {deleteError ? (
              <p role="alert" className="mb-3 rounded-xl px-3 py-2 text-xs leading-5" style={{ color: dairaPalette.status.error, backgroundColor: `${dairaPalette.status.error}12` }}>{deleteError}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteModal}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                style={{ color: dairaPalette.text.body, backgroundColor: dairaPalette.background.surfaceHover, border: `1px solid ${dairaPalette.border}` }}
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="inline-flex h-10 flex-1 flex-row-reverse items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: dairaPalette.background.surface, backgroundColor: dairaPalette.status.error }}
              >
                {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? "در حال حذف..." : "بله، حذف کن"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
