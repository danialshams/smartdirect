"use client";

import { Image as ImageIcon, MessageCircle, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
type MediaFilter = "ALL" | "POST" | "REEL";

export default function UnansweredComments({
  account,
}: {
  account: Account;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("ALL");

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(account.id)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
        }

        if (!cancelled) setPosts(data.posts ?? []);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "دریافت کامنت‌ها ناموفق بود.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const filteredPosts = useMemo(() => {
    if (filter === "ALL") return posts;

    return posts.filter((post) =>
      filter === "REEL"
        ? post.media.mediaProductType === "REELS"
        : post.media.mediaProductType !== "REELS",
    );
  }, [filter, posts]);

  const totalComments = useMemo(
    () => filteredPosts.reduce((sum, post) => sum + post.comments.length, 0),
    [filteredPosts],
  );

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              کامنت‌ها
            </h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span dir="ltr">@{account.igUsername}</span>
              <span aria-hidden="true">·</span>
              <span>{totalComments.toLocaleString("fa-IR")} بی‌پاسخ</span>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="فیلتر محتوا"
            className="inline-flex w-full rounded-lg bg-muted/60 p-1 sm:w-auto"
          >
            {(
              [
                ["ALL", "همه"],
                ["POST", "پست"],
                ["REEL", "ریل"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={[
                  "h-8 flex-1 rounded-md px-4 text-xs font-medium transition-colors sm:flex-none",
                  filter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-7">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <EmptyState
              title={
                filter === "ALL"
                  ? "کامنت بی‌پاسخی وجود ندارد"
                  : filter === "POST"
                    ? "پست بدون کامنت بی‌پاسخ وجود ندارد"
                    : "ریل بدون کامنت بی‌پاسخ وجود ندارد"
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filteredPosts.map((post) => (
                <PostTile
                  key={post.media.id}
                  post={post}
                  onClick={() =>
                    router.push(
                      `/dashboard/comments/${encodeURIComponent(post.media.id)}`,
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function PostTile({
  post,
  onClick,
}: {
  post: PostGroup;
  onClick: () => void;
}) {
  const mediaSrc =
    post.media.mediaType === "VIDEO"
      ? post.media.thumbnailUrl ?? post.media.mediaUrl
      : post.media.mediaUrl ?? post.media.thumbnailUrl;

  const isReel = post.media.mediaProductType === "REELS";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl bg-muted text-right outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {mediaSrc ? (
        <img
          src={mediaSrc}
          alt={post.media.caption ?? ""}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageIcon size={26} strokeWidth={1.5} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />

      <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
        {isReel ? "ریل" : "پست"}
        {post.media.mediaType === "VIDEO" && <Video size={10} />}
      </div>

      <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 text-white">
        <span className="text-[11px] font-medium">
          {post.comments.length.toLocaleString("fa-IR")} کامنت بی‌پاسخ
        </span>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/95 px-1.5 text-[10px] font-semibold text-foreground">
          <MessageCircle size={11} />
        </span>
      </div>
    </button>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="py-24 text-center">
      <MessageCircle
        className="mx-auto text-muted-foreground"
        size={22}
        strokeWidth={1.5}
      />
      <h2 className="mt-3 text-sm font-medium text-foreground">{title}</h2>
    </div>
  );
}
