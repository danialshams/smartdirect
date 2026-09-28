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
            className="flex w-full items-center justify-start gap-2 sm:w-auto"
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
                  "h-9 min-w-[72px] rounded-full border px-5 text-xs font-medium transition-all sm:min-w-0",
                  filter === value
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
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
                  className={[
                    "aspect-square animate-pulse rounded-2xl bg-muted",
                    index % 5 === 1 ? "col-span-1 sm:col-span-2 lg:col-span-1" : "",
                    index % 5 === 2 ? "col-span-2 sm:col-span-1 lg:col-span-1" : "",
                  ].join(" ")}
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
              {filteredPosts.map((post, index) => (
                <PostTile
                  key={post.media.id}
                  post={post}
                  index={index}
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
  index,
  onClick,
}: {
  post: PostGroup;
  index: number;
  onClick: () => void;
}) {
  const router = useRouter();
  const mediaSrc =
    post.media.mediaType === "VIDEO"
      ? post.media.thumbnailUrl ?? post.media.mediaUrl
      : post.media.mediaUrl ?? post.media.thumbnailUrl;

  const isReel = post.media.mediaProductType === "REELS";
  const bentoLayout =
    index % 5 === 1
      ? "col-span-1 sm:col-span-2 lg:col-span-1"
      : index % 5 === 2
        ? "col-span-2 sm:col-span-1 lg:col-span-1"
        : "col-span-1";

  const latestCommenters = post.comments
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 3);

  const publishedDate = post.media.timestamp
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(post.media.timestamp))
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        router.prefetch(
          `/dashboard/comments/${encodeURIComponent(post.media.id)}`,
        );
      }}
      onPointerDown={() => {
        router.prefetch(
          `/dashboard/comments/${encodeURIComponent(post.media.id)}`,
        );
      }}
      className={[
        "group text-right outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
        bentoLayout,
        "overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm",
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5",
        "lg:rounded-xl lg:border-0 lg:bg-transparent lg:shadow-none lg:hover:translate-y-0 lg:hover:shadow-none",
      ].join(" ")}
    >
      <div className="relative aspect-square overflow-hidden bg-muted lg:rounded-xl">
        {mediaSrc ? (
          <img
            src={mediaSrc}
            alt={post.media.caption ?? ""}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon size={26} strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur-md">
          {isReel ? "ریل" : "پست"}
          {post.media.mediaType === "VIDEO" && <Video size={10} />}
        </div>

        <div className="absolute bottom-3 left-3 flex h-8 items-center gap-1.5 rounded-full bg-white px-2.5 text-foreground shadow-md">
          <MessageCircle size={13} strokeWidth={2} />
          <span className="text-[11px] font-bold">
            {post.comments.length.toLocaleString("fa-IR")}
          </span>
        </div>
      </div>

      <div className="bg-background px-3.5 pb-3.5 pt-3 text-right lg:rounded-b-xl lg:px-0 lg:pt-3">
        <p
          className="min-h-[2.5rem] overflow-hidden text-xs leading-5 text-foreground"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {post.media.caption?.trim() || "بدون کپشن"}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 -space-x-2 space-x-reverse" dir="ltr">
            {latestCommenters.map((commenter) =>
              commenter.profilePictureUrl ? (
                <img
                  key={commenter.id}
                  src={commenter.profilePictureUrl}
                  alt=""
                  className="h-7 w-7 rounded-full border-2 border-background object-cover"
                />
              ) : (
                <div
                  key={commenter.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-medium text-muted-foreground"
                >
                  {commenter.username.slice(0, 1).toUpperCase()}
                </div>
              ),
            )}
          </div>

          {publishedDate && (
            <time
              dateTime={post.media.timestamp ?? undefined}
              className="shrink-0 text-[10px] font-medium text-muted-foreground"
            >
              {publishedDate}
            </time>
          )}
        </div>
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
