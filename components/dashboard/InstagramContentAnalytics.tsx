
import { Select } from "@/components/ui/select"
"use client";

import {
    BarChart3,
    Bookmark,
    ChevronDown,
    Eye,
    Heart,
    MessageCircle,
    RefreshCw,
    Share2,
    TrendingUp,
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

type FilterType =
    | "all"
    | "IMAGE"
    | "VIDEO"
    | "CAROUSEL_ALBUM";

type SortType =
    | "interactions"
    | "reach"
    | "views"
    | "latest";

type Account = {
    id: string;
    igUserId: string;
    username: string;
    isConnected: boolean;
};

type Insights = {
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    saved: number | null;
    shares: number | null;
    totalInteractions: number | null;
    engagementRate: number | null;
};

type ContentItem = {
    id: string;
    type: string | null;
    productType: string | null;
    caption: string | null;
    mediaUrl: string | null;
    thumbnailUrl: string | null;
    permalink: string | null;
    timestamp: string | null;
    insights: Insights;
};

type AnalyticsData = {
    success: boolean;

    account: Account;

    summary: {
        contentCount: number;
        reach: number;
        views: number;
        likes: number;
        comments: number;
        saved: number;
        shares: number;
        totalInteractions: number;
        engagementRate: number | null;
    };

    bestContent: ContentItem[];

    content: ContentItem[];
};

const nf = new Intl.NumberFormat(
    "fa-IR",
);

const pf = new Intl.NumberFormat(
    "fa-IR",
    {
        maximumFractionDigits: 2,
    },
);

function number(
    value: number | null | undefined,
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    return nf.format(value);
}

function percent(
    value: number | null | undefined,
) {
    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return `${pf.format(value)}٪`;
}

function date(
    value: string | null,
) {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "fa-IR",
        {
            dateStyle: "medium",
        },
    ).format(parsed);
}

function shortCaption(
    value: string | null,
) {
    if (!value) {
        return "بدون کپشن";
    }

    const clean = value
        .replace(/\s+/g, " ")
        .trim();

    if (clean.length <= 90) {
        return clean;
    }

    return `${clean.slice(0, 90)}...`;
}

function mediaLabel(
    item: ContentItem,
) {
    if (
        item.productType ===
        "REELS"
    ) {
        return "Reel";
    }

    if (
        item.type ===
        "VIDEO"
    ) {
        return "Video";
    }

    if (
        item.type ===
        "CAROUSEL_ALBUM"
    ) {
        return "Carousel";
    }

    return "Post";
}

function mediaImage(
    item: ContentItem,
) {
    return (
        item.thumbnailUrl ||
        item.mediaUrl ||
        ""
    );
}

function Kpi({
    title,
    value,
    icon: Icon,
}: {
    title: string;
    value: string;
    icon: typeof Eye;
}) {
    return (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                    <Icon
                        size={18}
                        strokeWidth={1.8}
                    />
                </div>

                <TrendingUp
                    size={15}
                    className="text-muted-foreground"
                />
            </div>

            <p className="mt-5 text-2xl font-bold tracking-tight text-foreground">
                {value}
            </p>

            <p className="mt-1 text-sm font-medium text-muted-foreground">
                {title}
            </p>
        </div>
    );
}

function ContentCard({
    item,
}: {
    item: ContentItem;
}) {
    const image = mediaImage(item);

    return (
        <article className="overflow-hidden rounded-[24px] border border-border/80 bg-background shadow-[0_8px_30px_rgba(15,23,42,0.03)] transition duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {image ? (
                    <img
                        src={image}
                        alt={
                            item.caption ||
                            "Instagram content"
                        }
                        className="h-full w-full object-cover transition duration-500 hover:scale-[1.025]"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <BarChart3
                            size={30}
                            strokeWidth={1.5}
                        />
                    </div>
                )}

                <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-primary/75 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur">
                    {mediaLabel(item)}
                </div>

                {item.insights.engagementRate !==
                    null && (
                        <div className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1.5 text-[10px] font-bold text-foreground shadow-sm backdrop-blur">
                            {percent(
                                item.insights
                                    .engagementRate,
                            )}{" "}
                            تعامل
                        </div>
                    )}
            </div>

            <div className="p-5">
                <div className="min-h-[66px]">
                    <p className="text-sm leading-6 text-foreground">
                        {shortCaption(
                            item.caption,
                        )}
                    </p>

                    <p className="mt-2 text-[11px] text-muted-foreground">
                        {date(
                            item.timestamp,
                        )}
                    </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                    <Metric
                        icon={Eye}
                        label="بازدید"
                        value={number(
                            item.insights
                                .views,
                        )}
                    />

                    <Metric
                        icon={TrendingUp}
                        label="Reach"
                        value={number(
                            item.insights
                                .reach,
                        )}
                    />

                    <Metric
                        icon={Heart}
                        label="لایک"
                        value={number(
                            item.insights
                                .likes,
                        )}
                    />

                    <Metric
                        icon={MessageCircle}
                        label="کامنت"
                        value={number(
                            item.insights
                                .comments,
                        )}
                    />

                    <Metric
                        icon={Bookmark}
                        label="ذخیره"
                        value={number(
                            item.insights
                                .saved,
                        )}
                    />

                    <Metric
                        icon={Share2}
                        label="اشتراک"
                        value={number(
                            item.insights
                                .shares,
                        )}
                    />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                    <div>
                        <p className="text-[10px] text-muted-foreground">
                            تعاملات
                        </p>

                        <p className="mt-1 text-sm font-bold text-foreground">
                            {number(
                                item.insights
                                    .totalInteractions,
                            )}
                        </p>
                    </div>

                    {item.permalink && (
                        <a
                            href={
                                item.permalink
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground"
                        >
                            مشاهده محتوا

                            <ChevronDown
                                size={13}
                                className="rotate-90"
                            />
                        </a>
                    )}
                </div>
            </div>
        </article>
    );
}

function Metric({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Eye;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Icon
                    size={13}
                    strokeWidth={1.8}
                />

                <span className="text-[10px]">
                    {label}
                </span>
            </div>

            <span className="text-[11px] font-semibold text-foreground">
                {value}
            </span>
        </div>
    );
}

export default function InstagramContentAnalytics() {
    const [
        accounts,
        setAccounts,
    ] = useState<Account[]>([]);

    const [
        accountId,
        setAccountId,
    ] = useState("");

    const [
        data,
        setData,
    ] = useState<AnalyticsData | null>(
        null,
    );

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        loadingAccounts,
        setLoadingAccounts,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState("");

    const [
        filter,
        setFilter,
    ] = useState<FilterType>("all");

    const [
        sort,
        setSort,
    ] = useState<SortType>(
        "interactions",
    );

    const loadAccounts =
        useCallback(
            async () => {
                try {
                    setLoadingAccounts(
                        true,
                    );

                    setError("");

                    const response =
                        await fetch(
                            "/api/instagram/accounts",
                            {
                                cache: "no-store",
                            },
                        );

                    const result =
                        await response.json();

                    if (
                        !response.ok ||
                        !result.success
                    ) {
                        throw new Error(
                            result.error ||
                            result.message ||
                            "خطا در دریافت اکانت‌ها",
                        );
                    }

                    const list =
                        Array.isArray(
                            result.accounts,
                        )
                            ? (result.accounts as Account[])
                            : [];

                    setAccounts(list);

                    const connected =
                        list.find(
                            (
                                item,
                            ) =>
                                item.isConnected,
                        );

                    setAccountId(
                        connected?.id ||
                        list[0]?.id ||
                        "",
                    );
                } catch (error) {
                    setAccounts([]);

                    setAccountId("");

                    setError(
                        error instanceof Error
                            ? error.message
                            : "خطا در دریافت اکانت‌ها",
                    );
                } finally {
                    setLoadingAccounts(
                        false,
                    );
                }
            },
            [],
        );

    const load =
        useCallback(
            async (
                selectedAccountId: string,
            ) => {
                if (
                    !selectedAccountId
                ) {
                    return;
                }

                try {
                    setLoading(true);

                    setError("");

                    const response =
                        await fetch(
                            `/api/instagram/content-analytics?instagramAccountId=${encodeURIComponent(
                                selectedAccountId,
                            )}`,
                            {
                                cache: "no-store",
                            },
                        );

                    const result =
                        await response.json();

                    if (
                        !response.ok ||
                        !result.success
                    ) {
                        throw new Error(
                            result.error ||
                            result.message ||
                            "خطا در دریافت عملکرد محتوا",
                        );
                    }

                    setData(
                        result as AnalyticsData,
                    );
                } catch (error) {
                    setData(null);

                    setError(
                        error instanceof Error
                            ? error.message
                            : "خطا در دریافت عملکرد محتوا",
                    );
                } finally {
                    setLoading(false);
                }
            },
            [],
        );

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadAccounts();
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [loadAccounts]);

    useEffect(() => {
        if (!accountId) {
            return;
        }

        const timer = window.setTimeout(() => {
            void load(accountId);
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        accountId,
        load,
    ]);

    const filteredContent =
        useMemo(() => {
            if (!data) {
                return [];
            }

            let result = [
                ...data.content,
            ];

            if (
                filter !== "all"
            ) {
                result =
                    result.filter(
                        (
                            item,
                        ) =>
                            item.type ===
                            filter,
                    );
            }

            result.sort(
                (
                    a,
                    b,
                ) => {
                    if (
                        sort ===
                        "reach"
                    ) {
                        return (
                            (b.insights
                                .reach ??
                                0) -
                            (a.insights
                                .reach ??
                                0)
                        );
                    }

                    if (
                        sort ===
                        "views"
                    ) {
                        return (
                            (b.insights
                                .views ??
                                0) -
                            (a.insights
                                .views ??
                                0)
                        );
                    }

                    if (
                        sort ===
                        "latest"
                    ) {
                        return (
                            new Date(
                                b.timestamp ||
                                0,
                            ).getTime() -
                            new Date(
                                a.timestamp ||
                                0,
                            ).getTime()
                        );
                    }

                    return (
                        (b.insights
                            .totalInteractions ??
                            0) -
                        (a.insights
                            .totalInteractions ??
                            0)
                    );
                },
            );

            return result;
        }, [
            data,
            filter,
            sort,
        ]);

    const summary =
        data?.summary;

    return (
        <section
            id="content-analytics"
            dir="rtl"
            className="scroll-mt-24 space-y-5"
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
                        <BarChart3
                            size={14}
                        />

                        CONTENT ANALYTICS
                    </div>

                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        عملکرد محتوا
                    </h2>

                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        عملکرد تک‌تک پست‌ها و Reels را بررسی کنید و محتوای موفق‌تر را پیدا کنید.
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex items-center rounded-xl border bg-card px-3 py-2 shadow-[0_6px_24px_rgba(15,23,42,0.03)]">
                        <Select
                            value={
                                accountId
                            }
                            onChange={(
                                event,
                            ) =>
                                setAccountId(
                                    event
                                        .target
                                        .value,
                                )
                            }
                            disabled={
                                loadingAccounts ||
                                !accounts.length
                            }
                            className="min-w-[180px] bg-transparent text-sm font-semibold text-foreground outline-none"
                            aria-label="انتخاب پیج Instagram"
                        >
                            {accounts.map(
                                (
                                    account,
                                ) => (
                                    <option
                                        key={
                                            account.id
                                        }
                                        value={
                                            account.id
                                        }
                                    >
                                        @
                                        {
                                            account.username
                                        }
                                    </option>
                                ),
                            )}
                        </Select>
                    </div>

                    <div className="flex rounded-xl border bg-card p-1 shadow-[0_6px_24px_rgba(15,23,42,0.03)]">
                        {[
                            {
                                key: "all",
                                label: "همه",
                            },
                            {
                                key: "IMAGE",
                                label: "Post",
                            },
                            {
                                key: "VIDEO",
                                label: "Video",
                            },
                            {
                                key: "CAROUSEL_ALBUM",
                                label: "Carousel",
                            },
                        ].map(
                            (
                                item,
                            ) => (
                                <button
                                    key={
                                        item.key
                                    }
                                    type="button"
                                    onClick={() =>
                                        setFilter(
                                            item.key as FilterType,
                                        )
                                    }
                                    className={`rounded-xl px-3 py-2 text-[11px] font-medium transition ${filter ===
                                        item.key
                                        ? "bg-primary text-white"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                >
                                    {
                                        item.label
                                    }
                                </button>
                            ),
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>
                        {error}
                    </span>

                    <button
                        type="button"
                        onClick={() => {
                            if (
                                accountId
                            ) {
                                void load(
                                    accountId,
                                );
                            }
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 font-medium hover:underline"
                    >
                        <RefreshCw
                            size={14}
                        />

                        تلاش مجدد
                    </button>
                </div>
            )}

            {loading &&
                !data && (
                    <div className="rounded-xl border bg-card px-6 py-20 text-center text-sm text-muted-foreground">
                        در حال دریافت عملکرد محتوا...
                    </div>
                )}

            {!loadingAccounts &&
                !accounts.length && (
                    <div className="rounded-[26px] border border-dashed border-border bg-background px-6 py-14 text-center">
                        <BarChart3
                            size={28}
                            className="mx-auto text-muted-foreground"
                        />

                        <h3 className="mt-4 font-bold text-foreground">
                            هنوز پیجی متصل نشده است
                        </h3>

                        <p className="mt-2 text-sm text-muted-foreground">
                            ابتدا یک پیج Instagram متصل کنید.
                        </p>
                    </div>
                )}

            {data &&
                summary && (
                    <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            <Kpi title="محتوای بررسی‌شده" value={number(summary.contentCount)} icon={BarChart3} />
                            <Kpi title="لایک" value={number(summary.likes)} icon={Heart} />
                            <Kpi title="کامنت" value={number(summary.comments)} icon={MessageCircle} />
                            <Kpi title="ذخیره" value={number(summary.saved)} icon={Bookmark} />
                            <Kpi title="اشتراک" value={number(summary.shares)} icon={Share2} />
                        </div>

                        <div className="flex flex-col gap-3 rounded-[24px] border border-border/80 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold text-foreground">
                                    محتوای برتر
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    محتوا بر اساس معیار انتخاب‌شده مرتب می‌شود.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {[
                                    {
                                        key: "interactions",
                                        label: "تعامل",
                                    },
                                    {
                                        key: "reach",
                                        label: "Reach",
                                    },
                                    {
                                        key: "views",
                                        label: "Views",
                                    },
                                    {
                                        key: "latest",
                                        label: "جدیدترین",
                                    },
                                ].map(
                                    (
                                        item,
                                    ) => (
                                        <button
                                            key={
                                                item.key
                                            }
                                            type="button"
                                            onClick={() =>
                                                setSort(
                                                    item.key as SortType,
                                                )
                                            }
                                            className={`rounded-xl px-3 py-2 text-[11px] font-medium transition ${sort ===
                                                item.key
                                                ? "bg-primary text-white"
                                                : "border border-border text-muted-foreground hover:bg-muted"
                                                }`}
                                        >
                                            {
                                                item.label
                                            }
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>

                        {filteredContent.length ===
                            0 ? (
                            <div className="rounded-[26px] border border-dashed border-border bg-background px-6 py-16 text-center">
                                <BarChart3
                                    size={28}
                                    className="mx-auto text-muted-foreground"
                                />

                                <h3 className="mt-4 font-bold text-foreground">
                                    محتوایی برای نمایش وجود ندارد
                                </h3>

                                <p className="mt-2 text-sm text-muted-foreground">
                                    در این فیلتر هنوز محتوایی پیدا نشد.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {filteredContent.map(
                                    (
                                        item,
                                    ) => (
                                        <ContentCard
                                            key={
                                                item.id
                                            }
                                            item={
                                                item
                                            }
                                        />
                                    ),
                                )}
                            </div>
                        )}
                    </>
                )}
        </section>
    );
}

