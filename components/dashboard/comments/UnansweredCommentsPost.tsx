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
    <main dir="rtl" className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight size={15} />
          بازگشت
        </button>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        ) : !post ? (
          <div className="py-24 text-center">
            <MessageCircle
              className="mx-auto text-muted-foreground"
              size={22}
              strokeWidth={1.5}
            />
            <h1 className="mt-3 text-sm font-medium text-foreground">
              کامنت بی‌پاسخی باقی نمانده
            </h1>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(280px,400px)_1fr] lg:items-start">
            <section className="lg:sticky lg:top-6">
              <div className="overflow-hidden rounded-xl bg-muted">
                <div className="relative aspect-square">
                  {mediaSrc ? (
                    post.media.mediaType === "VIDEO" ? (
                      <div className="relative h-full w-full">
                        <img
                          src={mediaSrc}
                          alt={post.media.caption ?? ""}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm">
                            <Video size={17} />
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
                      <ImageIcon size={28} strokeWidth={1.5} />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {post.media.mediaProductType === "REELS" ? "ریل" : "پست"} ·{" "}
                    <span dir="ltr">@{account.igUsername}</span>
                  </span>
                  <span className="font-medium text-foreground">
                    {post.comments.length.toLocaleString("fa-IR")}
                  </span>
                </div>

                {post.media.caption && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {post.media.caption}
                  </p>
                )}

                {post.media.permalink && (
                  <a
                    href={post.media.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    مشاهده در Instagram
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </section>

            <section className="min-w-0">
              <div className="mb-1">
                <h1 className="text-base font-semibold text-foreground">
                  کامنت‌های بی‌پاسخ
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  پاسخ هر کامنت را مستقیم ارسال کنید.
                </p>
              </div>

              <div className="mt-5 divide-y border-t border-border">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="py-5">
                    <div className="flex items-start gap-3">
                      {comment.profilePictureUrl ? (
                        <img
                          src={comment.profilePictureUrl}
                          alt={comment.username}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                          IG
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            dir="ltr"
                            className="truncate text-xs font-medium text-foreground"
                          >
                            @{comment.username}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Intl.DateTimeFormat("fa-IR", {
                              dateStyle: "medium",
                            }).format(new Date(comment.createdAt))}
                          </span>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {comment.text}
                        </p>

                        <div className="mt-3 flex gap-2">
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
                            placeholder="پاسخ..."
                            className="h-9 min-w-0 flex-1 rounded-lg text-xs"
                          />
                          <Button
                            type="button"
                            onClick={() => void reply(comment.id)}
                            disabled={
                              replyingId === comment.id ||
                              !(drafts[comment.id] ?? "").trim()
                            }
                            className="h-9 w-9 shrink-0 rounded-lg p-0"
                            aria-label="ارسال پاسخ"
                          >
                            {replyingId === comment.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
