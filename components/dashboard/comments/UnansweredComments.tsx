"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Image as ImageIcon, Loader2, MessageCircle, RefreshCw, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; igUsername: string; profilePictureUrl: string | null };
type Media = { id: string; caption: string | null; mediaType: string | null; mediaProductType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; permalink: string | null; timestamp: string | null };
type Comment = { id: string; igCommentId: string; text: string; username: string; profilePictureUrl: string | null; createdAt: string };
type PostGroup = { media: Media; comments: Comment[] };
type ApiResponse = { success: boolean; posts?: PostGroup[]; message?: string };

export default function UnansweredComments({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [posts, setPosts] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPosts() {
    if (!selectedAccountId) { setPosts([]); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(selectedAccountId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
      setPosts(data.posts ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "دریافت کامنت‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPosts(); }, [selectedAccountId]);

  const totalComments = useMemo(
    () => posts.reduce((sum, post) => sum + post.comments.length, 0),
    [posts],
  );

  if (accounts.length === 0) {
    return (
      <main dir="rtl" className="min-h-screen bg-background p-4 sm:p-6">
        <EmptyState title="اکانت متصلی وجود ندارد" description="ابتدا یک اکانت Professional اینستاگرام را به SmartDirect متصل کنید." />
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              کامنت‌های پاسخ داده نشده
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              محتوا را انتخاب کنید و کامنت‌های همان پست یا ریلز را پاسخ دهید.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadPosts()}
            disabled={loading}
            className="h-9 w-9 shrink-0 rounded-lg p-0 sm:w-auto sm:px-3"
            aria-label="بروزرسانی"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span className="mr-2 hidden text-xs sm:inline">بروزرسانی</span>
          </Button>
        </header>

        <div className="mb-5 flex items-center justify-between gap-3 border-b pb-4">
          <div className="flex min-w-0 items-center gap-2">
            <AccountAvatar account={accounts.find((account) => account.id === selectedAccountId) ?? accounts[0]} />
            <Select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="h-9 min-w-0 max-w-[190px] rounded-lg border-0 bg-muted/60 px-3 text-xs font-medium outline-none focus:ring-0"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>@{account.igUsername}</option>
              ))}
            </Select>
          </div>
          <div className="text-left leading-none">
            <span className="text-base font-semibold text-foreground">{totalComments}</span>
            <span className="mr-1 text-[11px] text-muted-foreground">پاسخ داده نشده</span>
          </div>
        </div>

        {error && <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div>}

        {loading && posts.length === 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState title="همه‌چیز پاسخ داده شده" description="در حال حاضر کامنت پاسخ داده نشده‌ای برای این اکانت وجود ندارد." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {posts.map((post) => (
              <PostTile
                key={post.media.id}
                post={post}
                onClick={() => router.push(`/dashboard/comments/${encodeURIComponent(post.media.id)}?account=${encodeURIComponent(selectedAccountId)}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PostTile({ post, onClick }: { post: PostGroup; onClick: () => void }) {
  const mediaSrc = post.media.mediaType === "VIDEO"
    ? post.media.thumbnailUrl ?? post.media.mediaUrl
    : post.media.mediaUrl ?? post.media.thumbnailUrl;
  const isReel = post.media.mediaProductType === "REELS";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl bg-muted text-right outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {mediaSrc ? (
        <img
          src={mediaSrc}
          alt={post.media.caption ?? ""}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageIcon size={28} strokeWidth={1.5} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
        {isReel ? "ریل" : "پست"}
        {post.media.mediaType === "VIDEO" && <Video size={11} />}
      </div>

      <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 text-white">
        <span className="text-[11px] font-medium opacity-90">
          {post.comments.length} کامنت بی‌پاسخ
        </span>
        <span className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-full bg-white px-2 text-xs font-bold text-foreground shadow-sm">
          <MessageCircle size={12} />
          {post.comments.length}
        </span>
      </div>
    </button>
  );
}

function AccountAvatar({ account }: { account: Account }) {
  return account.profilePictureUrl
    ? <img src={account.profilePictureUrl} alt={account.igUsername} className="h-8 w-8 shrink-0 rounded-full object-cover" />
    : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">IG</div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MessageCircle size={21} strokeWidth={1.6} />
      </div>
      <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
