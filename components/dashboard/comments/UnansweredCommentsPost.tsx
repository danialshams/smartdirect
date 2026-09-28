"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ExternalLink, Image as ImageIcon, Loader2, MessageCircle, Send, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; igUsername: string; profilePictureUrl: string | null };
type Media = { id: string; caption: string | null; mediaType: string | null; mediaProductType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; permalink: string | null; timestamp: string | null };
type Comment = { id: string; igCommentId: string; text: string; username: string; profilePictureUrl: string | null; createdAt: string };
type PostGroup = { media: Media; comments: Comment[] };
type ApiResponse = { success: boolean; posts?: PostGroup[]; message?: string };

export default function UnansweredCommentsPost({ account, mediaId }: { account: Account; mediaId: string }) {
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
      if (!response.ok || !data.success) throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
      setPost(data.posts?.[0] ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "دریافت کامنت‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPost(); }, [account.id, mediaId]);

  async function reply(commentId: string) {
    const message = drafts[commentId]?.trim();
    if (!message) return;
    setReplyingId(commentId);
    setError("");
    try {
      const response = await fetch("/api/instagram/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId: account.id, commentId, message }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message ?? "ارسال پاسخ ناموفق بود.");

      setPost((current) => {
        if (!current) return current;
        const comments = current.comments.filter((comment) => comment.id !== commentId);
        return comments.length ? { ...current, comments } : null;
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ارسال پاسخ ناموفق بود.");
    } finally {
      setReplyingId(null);
    }
  }

  const mediaSrc = post?.media.mediaType === "VIDEO" ? post.media.thumbnailUrl ?? post.media.mediaUrl : post?.media.mediaUrl ?? post?.media.thumbnailUrl;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowRight size={17} />
          بازگشت به کامنت‌ها
        </button>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-2xl border bg-background"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">{error}</div>
        ) : !post ? (
          <div className="rounded-2xl border bg-background px-6 py-16 text-center">
            <MessageCircle className="mx-auto text-muted-foreground" size={26} />
            <h1 className="mt-4 font-bold">این پست دیگر کامنت بی‌پاسخ ندارد</h1>
            <p className="mt-2 text-sm text-muted-foreground">همه کامنت‌های بدون پاسخ این محتوا پاسخ داده شده‌اند.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
            <section className="overflow-hidden rounded-2xl border bg-background">
              <div className="relative aspect-square bg-muted">
                {mediaSrc ? (
                  post.media.mediaType === "VIDEO" ? (
                    <div className="relative h-full w-full">
                      <img src={mediaSrc} alt={post.media.caption ?? ""} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow"><Video size={20} /></div></div>
                    </div>
                  ) : <img src={mediaSrc} alt={post.media.caption ?? ""} className="h-full w-full object-cover" />
                ) : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon size={34} /></div>}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{post.media.mediaProductType === "REELS" ? "ریل" : "پست"}</span>
                  <span className="text-sm font-bold text-primary">{post.comments.length} کامنت بی‌پاسخ</span>
                </div>
                {post.media.caption && <p className="text-sm leading-6 text-muted-foreground">{post.media.caption}</p>}
                {post.media.permalink && <a href={post.media.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">مشاهده در Instagram <ExternalLink size={13} /></a>}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border bg-background">
              <div className="border-b px-4 py-4 sm:px-5">
                <h1 className="text-lg font-bold">کامنت‌های پاسخ داده نشده</h1>
                <p className="mt-1 text-xs text-muted-foreground">@{account.igUsername}</p>
              </div>
              <div className="divide-y">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      {comment.profilePictureUrl ? <img src={comment.profilePictureUrl} alt={comment.username} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">IG</div>}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">@{comment.username}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{comment.text}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</p>
                        <div className="mt-4 flex gap-2">
                          <Input value={drafts[comment.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void reply(comment.id); } }} maxLength={1000} placeholder="پاسخ خود را بنویسید..." className="h-11 min-w-0 flex-1 rounded-xl" />
                          <Button type="button" onClick={() => void reply(comment.id)} disabled={replyingId === comment.id || !(drafts[comment.id] ?? "").trim()} className="h-11 shrink-0 gap-2 rounded-xl px-4">
                            {replyingId === comment.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            <span className="hidden sm:inline">پاسخ</span>
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
