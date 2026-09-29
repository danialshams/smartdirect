"use client";

import { Button } from "@/components/ui/button";
import {
  Bot,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AutomationForm from "./AutomationForm";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

export type AutomationTriggerType =
  | "COMMENT_KEYWORD"
  | "DM"
  | "STORY_REPLY_KEYWORD";

export type Automation = {
  id: string;
  instagramAccountId: string;
  triggerType: AutomationTriggerType;
  mediaId: string | null;
  keyword: string | null;
  commentReplyText: string | null;
  replyText: string | null;
  likeComment: boolean;
  sendDm: boolean;
  likeIncomingDm: boolean;
  likeStoryReply: boolean;
  requireFollow: boolean;
  followGateText: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: unknown[];
};

type MediaPreview = {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "UNKNOWN";
};

type AutomationGroup = {
  key: string;
  mediaId: string | null;
  automations: Automation[];
  ids: string[];
  keywords: string[];
};

function getKeywords(automation: Automation) {
  return (automation.keyword || "")
    .split(/[,،;؛\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getKeywordsForSearch(automation: Automation) {
  return getKeywords(automation).map((item) => item.toLowerCase());
}

export default function AutomationManager({
  accounts,
  onlyTab,
}: {
  accounts: InstagramAccount[];
  onlyTab?: "comments" | "stories";
}) {
  const router = useRouter();
  const connectedAccounts = useMemo(
    () => accounts.filter((account) => account.isConnected),
    [accounts],
  );
  const selectedAccount = connectedAccounts[0] ?? null;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, MediaPreview>>({});
  const [mediaLoading, setMediaLoading] = useState<Record<string, boolean>>({});
  const [mediaFailed, setMediaFailed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AutomationGroup | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const triggerType = onlyTab === "stories" ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selectedAccount) {
        setAutomations([]);
        return;
      }

      try {
        setLoading(true);
        setActionError("");
        const response = await fetch(
          `/api/automations?instagramAccountId=${encodeURIComponent(selectedAccount.id)}`,
          { cache: "no-store", credentials: "include" },
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || result.message || "دریافت پاسخ‌های خودکار ناموفق بود.");
        }
        if (!cancelled) {
          setAutomations(
            (Array.isArray(result.data) ? result.data : []).filter(
              (item: Automation) => item.triggerType === triggerType,
            ),
          );
          setSelectedIds([]);
        }
      } catch (error) {
        if (!cancelled) {
          setAutomations([]);
          setActionError(
            error instanceof Error
              ? error.message
              : "دریافت پاسخ‌های خودکار ناموفق بود.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedAccount?.id, triggerType]);

  useEffect(() => {
    if (!selectedAccount || automations.length === 0) {
      setMediaPreviews({});
      setMediaLoading({});
      setMediaFailed({});
      return;
    }

    let cancelled = false;
    const mediaIds = [...new Set(automations.map((item) => item.mediaId).filter(Boolean) as string[])];

    setMediaLoading(Object.fromEntries(mediaIds.map((id) => [id, true])));
    setMediaFailed({});

    async function loadPreviews() {
      const entries = await Promise.all(
        mediaIds.map(async (mediaId) => {
          try {
            const response = await fetch(
              `/api/automations/media-preview?instagramAccountId=${encodeURIComponent(
                selectedAccount!.id,
              )}&mediaId=${encodeURIComponent(mediaId)}`,
              { cache: "no-store", credentials: "include" },
            );
            if (!response.ok) return null;
            const result = await response.json();
            if (!result.success) return null;
            return [mediaId, result.data as MediaPreview] as const;
          } catch {
            return null;
          }
        }),
      );

      if (!cancelled) {
        setMediaPreviews(
          Object.fromEntries(entries.filter(Boolean) as Array<[string, MediaPreview]>),
        );
        setMediaLoading(Object.fromEntries(mediaIds.map((id) => [id, false])));
      }
    }

    void loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [automations, selectedAccount?.id]);

  const automationGroups = useMemo<AutomationGroup[]>(() => {
    const groups = new Map<string, AutomationGroup>();

    for (const automation of automations) {
      const key = automation.mediaId
        ? `media:${automation.mediaId}`
        : `automation:${automation.id}`;
      const existing = groups.get(key);

      if (existing) {
        existing.automations.push(automation);
        existing.ids.push(automation.id);
        for (const keyword of getKeywords(automation)) {
          if (!existing.keywords.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
            existing.keywords.push(keyword);
          }
        }
      } else {
        groups.set(key, {
          key,
          mediaId: automation.mediaId,
          automations: [automation],
          ids: [automation.id],
          keywords: getKeywords(automation),
        });
      }
    }

    return [...groups.values()];
  }, [automations]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return automationGroups;

    return automationGroups.filter((group) =>
      group.keywords.some((keyword) => keyword.toLowerCase().includes(query)),
    );
  }, [automationGroups, search]);

  const allFilteredSelected =
    filteredGroups.length > 0 &&
    filteredGroups.every((group) => group.ids.every((id) => selectedIds.includes(id)));

  const selectedGroupCount = filteredGroups.filter((group) =>
    group.ids.every((id) => selectedIds.includes(id)),
  ).length;

  function toggleSelected(ids: string[]) {
    setSelectedIds((current) => {
      const allSelected = ids.every((id) => current.includes(id));
      return allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])];
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allFilteredSelected) {
        const visibleIds = new Set(filteredAutomations.map((item) => item.id));
        return current.filter((id) => !visibleIds.has(id));
      }

      const next = new Set(current);
      filteredAutomations.forEach((item) => next.add(item.id));
      return [...next];
    });
  }

  function openCreate() {
    if (!selectedAccount) return;

    setEditingAutomation({
      id: "",
      instagramAccountId: selectedAccount.id,
      triggerType,
      mediaId: null,
      keyword: null,
      commentReplyText: null,
      replyText: null,
      likeComment: false,
      sendDm: false,
      likeIncomingDm: false,
      likeStoryReply: false,
      requireFollow: false,
      followGateText: null,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingAutomation(null);
  }

  function handleCreated(automation: Automation) {
    if (automation.triggerType === triggerType) {
      setAutomations((current) => [automation, ...current]);
    }
    closeForm();
  }

  function handleUpdated(automation: Automation) {
    setAutomations((current) =>
      current.map((item) => (item.id === automation.id ? automation : item)),
    );
    closeForm();
  }

  async function deleteIds(ids: string[]) {
    if (!ids.length) return;

    setDeleting(true);
    setActionError("");

    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/automations/${id}`, {
            method: "DELETE",
            credentials: "include",
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || result.message || "حذف پاسخ خودکار ناموفق بود.");
          }
          return id;
        }),
      );

      setAutomations((current) => current.filter((item) => !results.includes(item.id)));
      setSelectedIds((current) => current.filter((id) => !results.includes(id)));
      setDeleteTarget(null);
      setBulkDeleteOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "حذف پاسخ خودکار ناموفق بود.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        <section className="rounded-3xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  {onlyTab === "stories" ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت"}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {onlyTab === "stories" ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {onlyTab === "stories"
                    ? "استوری‌هایی که برای آن‌ها پاسخ خودکار ساخته‌اید."
                    : "پست‌ها و ریلزهایی که برای آن‌ها پاسخ خودکار کامنت ساخته‌اید."}
                </p>
              </div>

              <Button
                type="button"
                onClick={openCreate}
                disabled={!selectedAccount}
                className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
              >
                <Plus size={16} />
                پاسخ جدید
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="جستجو بر اساس کلمه کلیدی..."
                  className="h-11 w-full rounded-xl border border-border bg-background pr-10 pl-4 text-sm outline-none transition focus:border-primary"
                />
              </div>

              {selectedGroupCount > 1 && (
                <Button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
                >
                  پاک کردن {selectedGroupCount} مورد
                </Button>
              )}
            </div>

            {automations.length > 0 && (
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex min-h-9 items-center gap-2 text-xs font-semibold text-foreground"
                >
                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-md border transition",
                      allFilteredSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background",
                    ].join(" ")}
                  >
                    {allFilteredSelected && <Check size={13} strokeWidth={3} />}
                  </span>
                  انتخاب همه
                </button>

                <span className="text-xs text-muted-foreground">
                  {filteredGroups.length} پاسخ
                </span>
              </div>
            )}
          </div>
        </section>

        {actionError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {actionError}
          </div>
        )}

        {!selectedAccount ? (
          <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Bot className="mx-auto text-muted-foreground" size={24} />
            <h2 className="mt-4 text-base font-bold">ابتدا یک پیج اینستاگرام متصل کنید</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              برای ساخت و مدیریت پاسخ‌های خودکار، حداقل یک پیج متصل لازم است.
            </p>
          </section>
        ) : loading ? (
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm">
            <div className="divide-y divide-border/70">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-3 p-3 sm:gap-4 sm:p-4">
                  <div className="h-5 w-5 shrink-0 rounded-md bg-muted" />
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-muted sm:h-20 sm:w-20" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-32 rounded-md bg-muted sm:w-44" />
                    <div className="h-3 w-48 max-w-full rounded-md bg-muted" />
                  </div>
                  <div className="h-9 w-16 shrink-0 rounded-lg bg-muted sm:w-24" />
                </div>
              ))}
            </div>
          </section>
        ) : filteredGroups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Bot size={21} />
            </div>
            <h2 className="mt-4 text-sm font-bold text-foreground">
              {search ? "پاسخی با این کلمه کلیدی پیدا نشد" : "هنوز پاسخ خودکاری ندارید"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
              {search
                ? "کلمه کلیدی دیگری را امتحان کنید."
                : "با «پاسخ جدید» اولین اتوماسیون این بخش را بسازید."}
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm">
            <div className="divide-y divide-border/70">
              {filteredGroups.map((group) => {
                const automation = group.automations[0];
                const preview = group.mediaId ? mediaPreviews[group.mediaId] : undefined;
                const imageUrl = preview?.thumbnailUrl || preview?.mediaUrl || null;
                const imageLoading = group.mediaId ? mediaLoading[group.mediaId] !== false : false;
                const selected = group.ids.every((id) => selectedIds.includes(id));

                return (
                  <div
                    key={group.key}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(
                        `/dashboard/${
                          triggerType === "COMMENT_KEYWORD"
                            ? "comment-automation"
                            : "story-automation"
                        }/${automation.id}`,
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(
                          `/dashboard/${
                            triggerType === "COMMENT_KEYWORD"
                              ? "comment-automation"
                              : "story-automation"
                          }/${automation.id}`,
                        );
                      }
                    }}
                    className="group flex cursor-pointer items-center gap-3 p-3 transition hover:bg-muted/30 sm:gap-4 sm:p-4"
                  >
                    <button
                      type="button"
                      aria-label={selected ? "لغو انتخاب" : "انتخاب"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelected(group.ids);
                      }}
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      ].join(" ")}
                    >
                      {selected && <Check size={13} strokeWidth={3} />}
                    </button>

                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                      {imageUrl && !mediaFailed[group.mediaId || ""] ? (
                        <>
                          {imageLoading && (
                            <div className="absolute inset-0 z-10 animate-pulse bg-muted" />
                          )}
                          <img
                            src={imageUrl}
                            alt=""
                            className={`h-full w-full object-cover transition-opacity ${imageLoading ? "opacity-0" : "opacity-100"}`}
                            loading="lazy"
                            onLoad={() => {
                              if (group.mediaId) {
                                setMediaLoading((current) => ({
                                  ...current,
                                  [group.mediaId!]: false,
                                }));
                              }
                            }}
                            onError={() => {
                              if (group.mediaId) {
                                setMediaLoading((current) => ({
                                  ...current,
                                  [group.mediaId!]: false,
                                }));
                                setMediaFailed((current) => ({
                                  ...current,
                                  [group.mediaId!]: true,
                                }));
                              }
                            }}
                          />
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          {preview?.mediaType === "VIDEO" ? (
                            <Video size={21} />
                          ) : (
                            <ImageIcon size={21} />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MessageCircle size={15} className="shrink-0 text-muted-foreground" />
                        <p className="truncate text-sm font-bold text-foreground sm:text-[15px]">
                          {group.keywords.length ? group.keywords.join(", ") : "بدون کلمه کلیدی"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(group);
                      }}
                      className="min-h-9 shrink-0 rounded-lg border border-red-200 bg-background px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <span>پاک کردن</span>
                    </Button>
                  </div>
                );
              })}}
            </div>
          </section>
        )}
      </div>

      {formOpen && selectedAccount && editingAutomation && (
        <AutomationForm
          key={editingAutomation.id || `new-${editingAutomation.triggerType}`}
          account={selectedAccount}
          automation={editingAutomation}
          onClose={closeForm}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
        />
      )}

      {(deleteTarget || bulkDeleteOpen) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null);
              setBulkDeleteOpen(false);
            }
          }}
        >
          <div className="w-full max-w-[380px] overflow-hidden rounded-[28px] border border-border/80 bg-background shadow-2xl">
            <div className="px-6 pb-1 pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <span className="text-lg font-bold">!</span>
              </div>
            </div>
            <div className="px-6">
            <h3 className="text-base font-bold text-foreground">
              {bulkDeleteOpen
                ? `پاک کردن ${selectedGroupCount} پاسخ خودکار؟`
                : "پاک کردن پاسخ خودکار؟"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              این پاسخ و Flow متصل به آن حذف می‌شود و قابل بازگشت نیست.
            </p>
            </div>
            <div className="flex gap-2 px-6 pb-6 pt-6">
              <Button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setBulkDeleteOpen(false);
                }}
                className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm"
              >
                انصراف
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={() =>
                  void deleteIds(
                    bulkDeleteOpen
                      ? selectedIds
                      : deleteTarget
                        ? deleteTarget.ids
                        : [],
                  )
                }
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                {deleting ? <Loader2 className="animate-spin" size={16} /> : null}
                پاک کردن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
