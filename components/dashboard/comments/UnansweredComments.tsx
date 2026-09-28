"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ExternalLink, Image as ImageIcon, Loader2, MessageCircle, RefreshCw, Video } from "lucide-react";
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

  const totalComments = useMemo(() => posts.reduce((sum, post) => sum + post.comments.length, 0), [posts]);

  if (accounts.length === 0) {
    return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] p-4 sm:p-8"><div className="mx-auto max-w-7xl"><EmptyState title="هیچ اکانت متصلی وجود ندارد" description="ابتدا یک اکانت Professional اینستاگرام را به SmartDirect متصل کنید." /></div></main>;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] p-3 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">کامنت‌های پاسخ داده نشده</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">پست یا ریلز را انتخاب کنید و کامنت‌های آن را پاسخ دهید.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadPosts()} disabled={loading} className="h-10 shrink-0 gap-2 rounded-xl px-3">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span className="hidden sm:inline">بروزرسانی</span>
          </Button>
        </header>

        <section className="flex items-center justify-between gap-3 rounded-2xl border bg-background p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <AccountAvatar account={accounts.find((account) => account.id === selectedAccountId) ?? accounts[0]} />
            <Select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="h-10 min-w-0 max-w-[210px] rounded-xl border bg-background px-3 text-sm font-medium outline-none">
              {accounts.map((account) => <option key={account.id} value={account.id}>@{account.igUsername}</option>)}
            </Select>
          </div>
          <div className="shrink-0 text-left">
            <div className="text-lg font-bold text-foreground">{totalComments}</div>
            <div className="text-[11px] text-muted-foreground">کامنت بی‌پاسخ</div>
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading && posts.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border bg-background"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <EmptyState title="کامنت پاسخ داده نشده‌ای نیست" description="در حال حاضر برای پست‌ها و ریلزهای این اکانت کامنت بی‌پاسخ ندارید." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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
  const mediaSrc = post.media.mediaType === "VIDEO" ? post.media.thumbnailUrl ?? post.media.mediaUrl : post.media.mediaUrl ?? post.media.thumbnailUrl;
  const isReel = post.media.mediaProductType === "REELS";
  return (
    <button type="button" onClick={onClick} className="group overflow-hidden rounded-2xl border bg-background text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {mediaSrc ? (
          post.media.mediaType === "VIDEO" ? <img src={mediaSrc} alt={post.media.caption ?? ""} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <img src={mediaSrc} alt={post.media.caption ?? ""} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
        ) : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon size={28} /></div>}
        <div className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm">{isReel ? "ریل" : "پست"}</div>
        {post.media.mediaType === "VIDEO" && <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow-sm"><Video size={14} /></div>}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{post.media.caption?.trim() || "بدون کپشن"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
          <MessageCircle size={13} />
          {post.comments.length}
        </div>
      </div>
    </button>
  );
}

function AccountAvatar({ account }: { account: Account }) {
  return account.profilePictureUrl ? <img src={account.profilePictureUrl} alt={account.igUsername} className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">IG</div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed bg-background px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><MessageCircle size={22} /></div><h2 className="mt-4 text-base font-bold text-foreground">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>;
}
