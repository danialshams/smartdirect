"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardAccountId, useDashboardAccounts } from "@/components/dashboard/DashboardAccountContext";
import Link from "next/link";
import { toast } from "sonner";
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
  const dashboardAccounts = useDashboardAccounts();
  const activeAccount = dashboardAccounts.find(account => account.id === initialAccountId && account.isConnected)
    ?? dashboardAccounts.find(account => account.isConnected);
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
    const controller = new AbortController();

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

        const account = activeAccount;
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
          fetch(`/api/automations${accountQuery}&view=list`, { cache: "no-store", credentials: "include", signal: controller.signal }),
          scope !== "stories" ? fetch(`/api/instagram/media${accountQuery}`, { cache: "no-store", credentials: "include", signal: controller.signal }).catch(() => null) : Promise.resolve(null),
          scope === "all" ? fetch(`/api/instagram/stories${accountQuery}`, { cache: "no-store", credentials: "include", signal: controller.signal }).catch(() => null) : Promise.resolve(null),
          scope !== "stories" ? fetch(`/api/instagram/publishing${accountQuery}&view=automation-cards`, { cache: "no-store", credentials: "include", signal: controller.signal }).catch(() => null) : Promise.resolve(null),
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
          if (automation.mediaId === "__smartdirect_live_comments_v1__") continue;
          if (automation.triggerType === "STORY_REPLY_KEYWORD" && automation.mediaId?.startsWith("pending:")) continue;
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
          // Every story reply rule applies to this account, not to a single story.
          if (isStory) {
            nextItems.push({
              id: automation.id,
              key: "automation:" + automation.id,
              mediaId: null,
              type: "STORY",
              date: automation.updatedAt || automation.createdAt,
              sortAt: automation.updatedAt || automation.createdAt,
              previewUrl: null,
              previewKind: null,
              title: "پاسخ خودکار استوری",
              subtitle: displayKeyword,
              keyword: displayKeyword,
              href: "/dashboard/story-automation/" + automation.id,
              isActive: automation.isActive,
            });
            continue;
          }
          // Comment replies retain their media-specific configuration.
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
          // Account-wide story rules already appear once in the automation list.
          if (job.type === "STORY") continue;
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
      // Route exits and account switches should not leave four expensive
      // API requests running in the background after their result is stale.
      controller.abort();
    };
  }, [initialAccountId, activeAccount?.id, scope]);

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

  async function toggleStoryRule(item: ReplyItem) {
    const active = item.isActive !== false;
    try {
      const response = await fetch("/api/automations/" + encodeURIComponent(item.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ isActive: !active }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تغییر وضعیت پاسخ ناموفق بود.");
      toast.success(active ? "پاسخ استوری غیرفعال شد." : "پاسخ استوری فعال شد.");
      setItems(current => {
        const next = current.map(entry => entry.title === "پاسخ خودکار استوری" && !entry.key.startsWith("publish:")
          ? { ...entry, isActive: entry.id === item.id ? !active : (!active ? false : entry.isActive) }
          : entry);
        itemsRef.current = next;
        return next;
      });
    } catch (error) {
      const msg=error instanceof Error ? error.message : "تغییر وضعیت پاسخ ناموفق بود.";
      setError(msg);toast.error(msg);
    }
  }

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
      const isStoryRule = deleteTarget.title === "پاسخ خودکار استوری" && !isPublishedItem;
      if (!isPublishedItem && !deleteTarget.mediaId && !isStoryRule) throw new Error("شناسه محتوای موردنظر پیدا نشد.");
      const endpoint = isPublishedItem
        ? "/api/instagram/publishing/" + encodeURIComponent(deleteTarget.id) +
          "/automation?triggerType=" + (deleteTarget.title === "پاسخ خودکار استوری" ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD")
        : isStoryRule ? "/api/automations/" + encodeURIComponent(deleteTarget.id)
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
      // The authenticated dashboard context already resolved the selected
      // account. Do not block delete completion on another accounts API call
      // or accidentally update the cache of a different connected account.
      if (activeAccount) writeAutoRepliesCache(activeAccount.id, nextItems);
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
              <label className="daira-search-field flex h-11 items-center gap-2.5 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 text-[var(--daira-text-secondary)] transition ">
                <Search size={17} className="shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="جستجو براساس کلمه کلیدی..."
                  aria-label="جستجو براساس کلمه کلیدی"
                  className="daira-search-input h-full min-w-0 flex-1 bg-transparent text-base text-[var(--daira-heading)] outline-none placeholder:text-[var(--daira-text-disabled)] sm:text-sm"
                />
              </label>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium text-[var(--daira-error-text)]">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="daira-empty-state flex min-h-28 items-center justify-center rounded-xl border border-[var(--daira-border)] px-4 text-center text-xs font-medium text-[var(--daira-text-disabled)]">
              هنوز پاسخ خودکاری برای نمایش وجود ندارد.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item) => (
                <div key={item.key} className={"daira-automation-list-card relative flex min-h-[84px] gap-3 rounded-[22px] border border-[var(--daira-border)] bg-[var(--daira-surface)] px-3 pb-3 pt-9 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-4 " + (scope === "stories" ? "flex-col items-stretch" : "items-center justify-between")}>
                  <time className="absolute left-3 top-3 text-[11px] font-medium text-[var(--daira-text-secondary)]"
                    dateTime={item.date || undefined}>{formatDate(item.date)}</time>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)]">
                      {item.previewUrl && item.previewKind === "video" ? (
                        <video src={item.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label="پیش‌نمایش ویدیو" />
                      ) : item.previewUrl ? (
                        <img src={item.previewUrl} alt="پیش‌نمایش محتوا" loading="lazy" className="h-full w-full object-cover" />
                      ) : <ImageIcon size={20} className="text-[var(--daira-text-disabled)]" />}
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
                    </div>
                  </div>

                  <div className={"flex shrink-0 items-center gap-2 " + (scope === "stories" ? "justify-between border-t border-[var(--daira-glass-rim)] pt-3" : "")}>
                    {scope === "stories" && item.title === "پاسخ خودکار استوری" && !item.key.startsWith("publish:") &&
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--daira-glass-rim)] bg-[var(--daira-glass-raised)] px-2.5 text-xs font-semibold">
                        <input role="switch" type="checkbox" className="daira-form-switch shrink-0 -scale-x-100"
                          aria-label={"فعال‌سازی پاسخ استوری "+(item.keyword||"")}
                          checked={item.isActive !== false} onChange={()=>void toggleStoryRule(item)}/>
                        <span>{item.isActive !== false ? "فعال" : "غیرفعال"}</span>
                      </label>}
                    <div className="flex items-center gap-2">
                    <Link
                      href={item.href}
                      className="daira-reply-list-edit"
                    >
                      <span>ویرایش</span>
                      <Pencil size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setDeleteError(""); setDeleteTarget(item); }}
                      aria-label={`حذف پاسخ این محتوا برای ${item.keyword}`}
                      className="daira-reply-list-delete"
                    >
                      <span>حذف</span>
                      <Trash2 size={14} />
                    </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {deleteTarget ? (
        <div
          className={`daira-glass-overlay fixed inset-0 z-[9998] flex items-center justify-center px-4 py-6 backdrop-blur-md transition-[opacity,background-color] duration-300 ease-out motion-reduce:transition-none ${closingDelete || !deleteModalVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
          style={{ backgroundColor: closingDelete || !deleteModalVisible ? "rgba(24, 35, 60, 0)" : "rgba(24, 35, 60, 0.36)" }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteModal(); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-reply-title"
            className={`daira-glass-dialog daira-glass-dialog--danger w-full max-w-sm rounded-[24px] p-5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${closingDelete || !deleteModalVisible ? "translate-y-2 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}
            style={{ zIndex: 9999 }}
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
                className="inline-flex h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
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
