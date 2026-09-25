"use client";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

import {
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MessageCircleReply,
  RefreshCw,
  Send,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  igUsername: string;
  profilePictureUrl: string | null;
};

type Comment = {
  id: string;
  igCommentId: string;
  text: string;
  username: string;
  profilePictureUrl: string | null;
  createdAt: string;
};

type Media = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
};

type PostGroup = {
  media: Media;
  comments: Comment[];
};

type ApiResponse = {
  success: boolean;
  account?: {
    id: string;
    username: string;
  };
  posts?: PostGroup[];
  message?: string;
};

export default function UnansweredComments({
  accounts,
}: {
  accounts: Account[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [posts, setPosts] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const totalComments = useMemo(
    () => posts.reduce((sum, post) => sum + post.comments.length, 0),
    [posts],
  );

  async function loadComments() {
    if (!selectedAccountId) {
      setPosts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(selectedAccountId)}`,
        { cache: "no-store" },
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
      }

      setPosts(data.posts ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "دریافت کامنت‌ها ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadComments();
  }, [selectedAccountId]);

  async function reply(commentId: string) {
    const message = drafts[commentId]?.trim();

    if (!message || !selectedAccountId) return;

    setReplyingId(commentId);
    setError("");

    try {
      const response = await fetch("/api/instagram/comments/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          commentId,
          message,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "ارسال پاسخ ناموفق بود.");
      }

      setPosts((current) =>
        current
          .map((post) => ({
            ...post,
            comments: post.comments.filter(
              (comment) => comment.id !== commentId,
            ),
          }))
          .filter((post) => post.comments.length > 0),
      );

      setDrafts((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ارسال پاسخ ناموفق بود.",
      );
    } finally {
      setReplyingId(null);
    }
  }

  if (accounts.length === 0) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f6f7f9] p-5 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <EmptyState
            title="هیچ اکانت متصلی وجود ندارد"
            description="ابتدا یک اکانت Professional اینستاگرام را به SmartDirect متصل کنید."
          />
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f7f9] p-5 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
              INSTAGRAM COMMENTS
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              کامنت‌های پاسخ داده نشده
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              کامنت‌های بدون پاسخ را برای هر پست ببینید و مستقیماً از SmartDirect
              پاسخ دهید.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void loadComments()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium text-foreground transition hover:border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            بروزرسانی
          </Button>
        </header>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-sm font-medium text-muted-foreground">
              اکانت
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:w-72 sm:flex-none">
              <AccountAvatar account={accounts.find((account) => account.id === selectedAccountId) ?? accounts[0]} />
              <Select
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-ring"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    @{account.igUsername}
                  </option>
                ))}
              </Select>
            </div>
          </label>

          <div className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{totalComments}</span>{" "}
            کامنت بدون پاسخ
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && posts.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-[24px] border border-border bg-background">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 size={19} className="animate-spin" />
              در حال دریافت کامنت‌ها...
            </div>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="کامنت پاسخ داده نشده‌ای پیدا نشد"
            description="کامنت‌های جدیدی که از اینستاگرام دریافت شوند در این بخش نمایش داده می‌شوند."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {posts.map((post) => (
              <PostCard
                key={post.media.id}
                post={post}
                drafts={drafts}
                replyingId={replyingId}
                onDraftChange={(commentId, value) =>
                  setDrafts((current) => ({
                    ...current,
                    [commentId]: value,
                  }))
                }
                onReply={(commentId) => void reply(commentId)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AccountAvatar({ account }: { account: Account }) {
  return account.profilePictureUrl ? (
    <img
      src={account.profilePictureUrl}
      alt={account.igUsername}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
      IG
    </div>
  );
}

function PostCard({
  post,
  drafts,
  replyingId,
  onDraftChange,
  onReply,
}: {
  post: PostGroup;
  drafts: Record<string, string>;
  replyingId: string | null;
  onDraftChange: (commentId: string, value: string) => void;
  onReply: (commentId: string) => void;
}) {
  const mediaSrc =
    post.media.mediaType === "VIDEO"
      ? post.media.thumbnailUrl ?? post.media.mediaUrl
      : post.media.mediaUrl ?? post.media.thumbnailUrl;

  return (
    <article className="overflow-hidden rounded-[24px] border border-border bg-background shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="aspect-square bg-muted">
        {mediaSrc ? (
          post.media.mediaType === "VIDEO" ? (
            <div className="relative flex h-full w-full items-center justify-center">
              <img
                src={mediaSrc}
                alt={post.media.caption ?? "Instagram post"}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg">
                  <Video size={21} />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={mediaSrc}
              alt={post.media.caption ?? "Instagram post"}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon size={32} />
          </div>
        )}
      </div>

      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">
              {post.comments.length} کامنت بدون پاسخ
            </p>
            {post.media.timestamp && (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("fa-IR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(post.media.timestamp))}
              </p>
            )}
          </div>

          {post.media.permalink && (
            <a
              href={post.media.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
            >
              مشاهده در Instagram
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {post.media.caption && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {post.media.caption}
          </p>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {post.comments.map((comment) => (
          <div key={comment.id} className="p-5">
            <div className="flex items-start gap-3">
              {comment.profilePictureUrl ? (
                <img
                  src={comment.profilePictureUrl}
                  alt={comment.username}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  IG
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-foreground">
                    @{comment.username}
                  </p>
                  <MessageCircleReply
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {comment.text}
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={drafts[comment.id] ?? ""}
                    onChange={(event) =>
                      onDraftChange(comment.id, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        onReply(comment.id);
                      }
                    }}
                    maxLength={1000}
                    placeholder="پاسخ خود را بنویسید..."
                    className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring"
                  />

                  <Button
                    type="button"
                    onClick={() => onReply(comment.id)}
                    disabled={
                      replyingId === comment.id ||
                      !(drafts[comment.id] ?? "").trim()
                    }
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replyingId === comment.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    پاسخ
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-background px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MessageCircleReply size={25} strokeWidth={1.7} />
      </div>
      <h2 className="mt-5 text-base font-bold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
