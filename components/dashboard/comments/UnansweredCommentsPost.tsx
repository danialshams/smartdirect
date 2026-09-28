"use client";

import {
  ArrowRight,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Account = { id: string; igUsername: string; profilePictureUrl: string | null };
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
type Comment = {
  id: string;
  igCommentId: string;
  text: string;
  username: string;
  profilePictureUrl: string | null;
  createdAt: string;
};
type PostGroup = { media: Media; comments: Comment[] };
type ApiResponse = { success: boolean; posts?: PostGroup[]; message?: string };

export default function UnansweredCommentsPost({
  account,
  mediaId,
}: {
  account: Account;
  mediaId: string;
}) {
  const router = useRouter();
  const [post, setPost] = useState<PostGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function loadPost() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(account.id)}&mediaId=${encodeURIComponent(mediaId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
      }

      setPost(data.posts?.[0] ?? null);
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
    void loadPost();
  }, [account.id, mediaId]);

  async function reply(commentId: string) {
    const message = drafts[commentId]?.trim();
    if (!message) return;

    setReplyingId(commentId);
    setError("");

    try {
      const response = await fetch("/api/instagram/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: account.id,
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

      setPost((current) => {
        if (!current) return current;

        const comments = current.comments.filter(
          (comment) => comment.id !== commentId,
        );

        return comments.length ? { ...current, comments } : null;
      });

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

  const mediaSrc =
    post?.media.mediaType === "VIDEO"
      ? post.media.thumbnailUrl ?? post.media.mediaUrl
      : post?.media.mediaUrl ?? post?.media.thumbnailUrl;

  return (
    <main dir="rtl" className="h-[100dvh] overflow-hidden bg-background">
      {loading ? (
        <PostDetailSkeleton />
      ) : error ? (
        <div className="flex h-full items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        </div>
      ) : !post ? (
        <div className="flex h-full items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background py-24 text-center">
            <MessageCircle
              className="mx-auto text-muted-foreground"
              size={24}
              strokeWidth={1.5}
            />
            <h1 className="mt-3 text-sm font-medium text-foreground">
              کامنت بی‌پاسخی باقی نمانده
            </h1>
          </div>
        </div>
      ) : (
        <article className="relative flex h-full w-full flex-col overflow-hidden bg-black">
          <section className="relative min-h-0 flex-1 bg-black">
            <div className="relative h-full w-full">
                {mediaSrc ? (
                  post.media.mediaType === "VIDEO" ? (
                    <div className="relative h-full w-full">
                      <img
                        src={mediaSrc}
                        alt={post.media.caption ?? ""}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
                          <Video size={19} />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={mediaSrc}
                      alt={post.media.caption ?? ""}
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon size={32} strokeWidth={1.5} />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="absolute right-4 top-4 z-10 flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-3.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-black/60"
                >
                  <ArrowRight size={15} />
                  بازگشت
                </button>

                <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-white backdrop-blur-md">
                  {account.profilePictureUrl ? (
                    <img
                      src={account.profilePictureUrl}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[8px] font-semibold">
                      IG
                    </span>
                  )}
                  <span dir="ltr" className="text-[10px] font-semibold">
                    @{account.igUsername}
                  </span>
                </div>

                <div className="absolute bottom-5 inset-x-4 z-10 text-white sm:inset-x-6">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md">
                      {post.media.mediaProductType === "REELS" ? "ریل" : "پست"}
                    </span>
                    <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[10px] backdrop-blur-md">
                      <MessageCircle size={13} />
                      <span>{post.comments.length.toLocaleString("fa-IR")} بی‌پاسخ</span>
                    </div>
                  </div>
                  {post.media.caption && (
                    <p className="whitespace-pre-wrap text-sm font-medium leading-6 drop-shadow-sm">
                      {post.media.caption}
                    </p>
                  )}
                  {post.media.timestamp && (
                    <p className="mt-1 text-[10px] text-white/70">
                      {new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date(post.media.timestamp))}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="relative z-20 -mt-5 min-h-0 flex-1 overflow-y-auto rounded-t-[24px] bg-background px-4 pb-8 pt-5 shadow-[0_-12px_30px_rgba(0,0,0,0.08)] sm:px-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/20" />
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h1 className="text-base font-semibold text-foreground">
                    کامنت‌های بی‌پاسخ
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    برای هر کامنت، پاسخ را مستقیم ارسال کنید.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {post.comments.length.toLocaleString("fa-IR")}
                </span>
              </div>

              <div className="mt-4 divide-y border-t border-border">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="py-5">
                    <div className="flex items-start gap-3">
                      {comment.profilePictureUrl ? (
                        <img
                          src={comment.profilePictureUrl}
                          alt={comment.username}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                          IG
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span
                            dir="ltr"
                            className="truncate text-xs font-semibold text-foreground"
                          >
                            @{comment.username}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Intl.DateTimeFormat("fa-IR", {
                              dateStyle: "medium",
                            }).format(new Date(comment.createdAt))}
                          </span>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                          {comment.text}
                        </p>

                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-1.5">
                          <Input
                            value={drafts[comment.id] ?? ""}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [comment.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                              ) {
                                event.preventDefault();
                                void reply(comment.id);
                              }
                            }}
                            maxLength={1000}
                            placeholder="پاسخ به کامنت..."
                            className="h-9 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            onClick={() => void reply(comment.id)}
                            disabled={
                              replyingId === comment.id ||
                              !(drafts[comment.id] ?? "").trim()
                            }
                            className="h-9 shrink-0 rounded-lg px-3 text-xs"
                            aria-label="ارسال پاسخ"
                          >
                            {replyingId === comment.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                ارسال
                                <Send size={13} className="mr-1.5" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
        </article>
      )}
    </main>
  );
}

function PostDetailSkeleton() {
  return (
    <div className="h-[100dvh] overflow-hidden bg-background">
      <div className="relative h-full bg-muted animate-pulse">
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-[24px] bg-background px-4 pb-8 pt-5 sm:px-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
          <div className="h-5 w-40 rounded-full bg-muted" />
          <div className="mt-2 h-3 w-64 rounded-full bg-muted" />
          <div className="mt-5 space-y-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-24 rounded-full bg-muted" />
                  <div className="mt-3 h-3 w-full rounded-full bg-muted" />
                  <div className="mt-2 h-3 w-2/3 rounded-full bg-muted" />
                  <div className="mt-4 h-9 w-full rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
