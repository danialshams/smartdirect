"use client";
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

import {
    ChevronDown,
    HelpCircle,
    Loader2,
    Plus,
    Save,
    Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import EntryPointFlowBuilder from "./EntryPointFlowBuilder";

type InstagramAccount = {
    id: string;
    igUsername: string;
    igUserId: string;
    isConnected: boolean;
    createdAt: Date;
};

type IceBreakerItem = {
    id: string;
    question: string;
    payload: string;
    automationId: string;
    order: number;
};

type IceBreakerDraft = {
    id?: string;
    question: string;
    automationId: string | null;
};

type IceBreakerManagerProps = {
    accounts: InstagramAccount[];
};

export default function IceBreakerManager({
    accounts,
}: IceBreakerManagerProps) {
    const connectedAccounts = useMemo(
        () =>
            accounts.filter(
                (account) => account.isConnected,
            ),
        [accounts],
    );

    const [selectedAccountId, setSelectedAccountId] =
        useState("");

    const [items, setItems] = useState<
        IceBreakerDraft[]
    >([]);

    const [loading, setLoading] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [success, setSuccess] =
        useState(false);

    /*
     * Select first connected Instagram account.
     */
    useEffect(() => {
        if (
            connectedAccounts.length > 0 &&
            !selectedAccountId
        ) {
            setSelectedAccountId(
                connectedAccounts[0].id,
            );
        }

        if (
            selectedAccountId &&
            !connectedAccounts.some(
                (account) =>
                    account.id ===
                    selectedAccountId,
            )
        ) {
            setSelectedAccountId(
                connectedAccounts[0]?.id ?? "",
            );
        }
    }, [
        connectedAccounts,
        selectedAccountId,
    ]);

    /*
     * Load Ice Breakers.
     *
     * We no longer load /api/automations here.
     * Each Ice Breaker owns its own internal
     * Automation and its Flow is edited inline.
     */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!selectedAccountId) {
                setItems([]);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setSuccess(false);

                const response =
                    await fetch(
                        `/api/instagram/ice-breakers?instagramAccountId=${encodeURIComponent(
                            selectedAccountId,
                        )}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
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
                        "دریافت Ice Breakerها ناموفق بود.",
                    );
                }

                if (cancelled) {
                    return;
                }

                const serverItems =
                    Array.isArray(
                        result.data,
                    )
                        ? result.data
                        : [];

                setItems(
                    serverItems.map(
                        (
                            item: IceBreakerItem,
                        ) => ({
                            id: item.id,
                            question:
                                item.question,
                            automationId:
                                item.automationId ??
                                null,
                        }),
                    ),
                );
            } catch (loadError) {
                console.error(
                    loadError,
                );

                if (!cancelled) {
                    setError(
                        loadError instanceof
                            Error
                            ? loadError.message
                            : "دریافت اطلاعات ناموفق بود.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [selectedAccountId]);

    /*
     * Add a new Ice Breaker.
     *
     * automationId starts as null.
     * EntryPointFlowBuilder will create the
     * internal Automation when its Flow is saved.
     */
    function addItem() {
        if (items.length >= 4) {
            return;
        }

        setItems((current) => [
            ...current,
            {
                question: "",
                automationId: null,
            },
        ]);
    }

    function removeItem(index: number) {
        setItems((current) =>
            current.filter(
                (_, itemIndex) =>
                    itemIndex !== index,
            ),
        );
    }

    function updateQuestion(
        index: number,
        value: string,
    ) {
        setItems((current) =>
            current.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                            ...item,
                            question: value,
                        }
                        : item,
            ),
        );
    }

    function updateAutomationId(
        index: number,
        automationId: string,
    ) {
        setItems((current) =>
            current.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                            ...item,
                            automationId,
                        }
                        : item,
            ),
        );
    }

    async function handleSave() {
        if (!selectedAccountId) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            if (items.length > 4) {
                throw new Error(
                    "حداکثر ۴ Ice Breaker می‌توانید داشته باشید.",
                );
            }

            for (
                let index = 0;
                index < items.length;
                index++
            ) {
                const item = items[index];

                if (!item) {
                    continue;
                }

                if (!item.question.trim()) {
                    throw new Error(
                        `متن سوال ${index + 1
                        } را وارد کنید.`,
                    );
                }

                if (
                    item.question.trim()
                        .length > 80
                ) {
                    throw new Error(
                        `متن سوال ${index + 1
                        } نباید بیشتر از ۸۰ کاراکتر باشد.`,
                    );
                }

                if (!item.automationId) {
                    throw new Error(
                        `برای سوال ${index + 1
                        } ابتدا پاسخ سفارشی آن را ذخیره کنید.`,
                    );
                }
            }

            const response =
                await fetch(
                    "/api/instagram/ice-breakers",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        credentials:
                            "include",
                        body: JSON.stringify({
                            instagramAccountId:
                                selectedAccountId,
                            items: items.map(
                                (item) => ({
                                    question:
                                        item.question.trim(),
                                    automationId:
                                        item.automationId,
                                }),
                            ),
                        }),
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
                    "ذخیره Ice Breakerها ناموفق بود.",
                );
            }

            const savedItems =
                Array.isArray(
                    result.data,
                )
                    ? result.data
                    : [];

            setItems(
                savedItems.map(
                    (
                        item: IceBreakerItem,
                    ) => ({
                        id: item.id,
                        question:
                            item.question,
                        automationId:
                            item.automationId ??
                            null,
                    }),
                ),
            );

            setSuccess(true);
        } catch (saveError) {
            console.error(
                saveError,
            );

            setError(
                saveError instanceof
                    Error
                    ? saveError.message
                    : "ذخیره ناموفق بود.",
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleDisable() {
        if (!selectedAccountId) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            const response =
                await fetch(
                    `/api/instagram/ice-breakers?instagramAccountId=${encodeURIComponent(
                        selectedAccountId,
                    )}`,
                    {
                        method: "DELETE",
                        credentials:
                            "include",
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
                    "غیرفعال‌سازی ناموفق بود.",
                );
            }

            setItems([]);
            setSuccess(true);
        } catch (disableError) {
            console.error(
                disableError,
            );

            setError(
                disableError instanceof
                    Error
                    ? disableError.message
                    : "غیرفعال‌سازی ناموفق بود.",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <section
            id="ice-breakers"
            className="scroll-mt-24 rounded-xl border bg-card"
        >
            {/* --------------------------------------------------------- */}
            {/* Header                                                    */}
            {/* --------------------------------------------------------- */}

            <div className="border-b border-border/60 p-5 sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <HelpCircle
                                size={16}
                            />

                            <span className="text-[10px] font-semibold tracking-[0.16em]">
                                ICE BREAKERS
                            </span>
                        </div>

                        <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                            سوال‌های شروع گفتگو
                        </h2>

                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
                            کاربر این سوال‌ها را
                            هنگام شروع گفتگو
                            می‌بیند. برای هر سوال
                            می‌توانید پاسخ و Flow
                            اختصاصی خودتان را
                            مستقیماً همین‌جا بسازید.
                        </p>
                    </div>

                    {connectedAccounts.length >
                        0 && (
                            <div className="relative w-full sm:w-[280px]">
                                <Select
                                    value={
                                        selectedAccountId
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setSelectedAccountId(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    className="w-full appearance-none rounded-lg border bg-muted/30 px-4 py-3 pl-10 text-sm font-medium text-foreground outline-none focus:border-ring"
                                >
                                    {connectedAccounts.map(
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
                                                    account.igUsername
                                                }
                                            </option>
                                        ),
                                    )}
                                </Select>

                                <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>
                        )}
                </div>
            </div>

            {/* --------------------------------------------------------- */}
            {/* Content                                                   */}
            {/* --------------------------------------------------------- */}

            {connectedAccounts.length ===
                0 ? (
                <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                    ابتدا یک پیج اینستاگرام متصل کنید.
                </div>
            ) : loading ? (
                <div className="flex justify-center px-6 py-20">
                    <Loader2
                        size={24}
                        className="animate-spin text-muted-foreground"
                    />
                </div>
            ) : (
                <div className="p-5 sm:p-7">
                    {/* ------------------------------------------------- */}
                    {/* Explanation                                       */}
                    {/* ------------------------------------------------- */}

                    <div className="mb-6 rounded-2xl border border-border bg-muted p-4">
                        <p className="text-sm font-semibold text-foreground">
                            پاسخ هر سوال را همین‌جا بسازید
                        </p>

                        <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            دیگر لازم نیست یک
                            Automation را انتخاب
                            کنید. برای هر سوال،
                            Flow مخصوص خودش را
                            بسازید؛ شامل چند پیام،
                            عکس، ویدیو، صوت،
                            Showcase، Form و
                            Quick Reply.
                        </p>
                    </div>

                    {/* ------------------------------------------------- */}
                    {/* Items                                             */}
                    {/* ------------------------------------------------- */}

                    {items.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center">
                            <HelpCircle
                                size={22}
                                className="mx-auto text-muted-foreground"
                            />

                            <p className="mt-3 text-sm font-semibold text-foreground">
                                هنوز سوالی اضافه نشده است.
                            </p>

                            <p className="mt-1 text-xs leading-6 text-muted-foreground">
                                اولین سوال را اضافه
                                کنید و پاسخ
                                اختصاصی آن را بسازید.
                            </p>

                            <button
                                type="button"
                                onClick={
                                    addItem
                                }
                                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                            >
                                <Plus
                                    size={16}
                                />
                                افزودن سوال
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {items.map(
                                (
                                    item,
                                    index,
                                ) => (
                                    <div
                                        key={
                                            item.id ??
                                            `new-${index}`
                                        }
                                        className="rounded-[22px] border border-border bg-muted/20 p-4 sm:p-5"
                                    >
                                        {/* Question header */}
                                        <div className="flex items-start gap-3">
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <label className="block text-xs font-semibold text-muted-foreground">
                                                        سوال{" "}
                                                        {
                                                            index +
                                                            1
                                                        }
                                                    </label>

                                                    <span className="text-[10px] font-medium text-muted-foreground">
                                                        {
                                                            item
                                                                .question
                                                                .length
                                                        }
                                                        /80
                                                    </span>
                                                </div>

                                                <Input
                                                    value={
                                                        item.question
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        updateQuestion(
                                                            index,
                                                            event
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    maxLength={
                                                        80
                                                    }
                                                    placeholder="مثلاً: محصولات شما را ببینم"
                                                    className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition focus:border-ring"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(
                                                        index,
                                                    )
                                                }
                                                className="mt-6 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                                aria-label="حذف سوال"
                                            >
                                                <Trash2
                                                    size={
                                                        17
                                                    }
                                                />
                                            </button>
                                        </div>

                                        {/* Inline Flow Builder */}
                                        {selectedAccountId && (
                                            <EntryPointFlowBuilder
                                                accountId={
                                                    selectedAccountId
                                                }
                                                automationId={
                                                    item.automationId
                                                }
                                                onAutomationReady={(
                                                    automationId,
                                                ) =>
                                                    updateAutomationId(
                                                        index,
                                                        automationId,
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    )}

                    {/* ------------------------------------------------- */}
                    {/* Bottom actions                                     */}
                    {/* ------------------------------------------------- */}

                    {items.length > 0 && (
                        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row">
                            <button
                                type="button"
                                onClick={
                                    addItem
                                }
                                disabled={
                                    items.length >=
                                    4
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Plus
                                    size={16}
                                />
                                افزودن سوال
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleDisable
                                }
                                disabled={
                                    saving
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                            >
                                غیرفعال کردن
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleSave
                                }
                                disabled={
                                    saving
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50 sm:mr-auto"
                            >
                                {saving ? (
                                    <Loader2
                                        size={
                                            16
                                        }
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Save
                                        size={
                                            16
                                        }
                                    />
                                )}

                                ذخیره Ice Breakerها
                            </button>
                        </div>
                    )}

                    {/* ------------------------------------------------- */}
                    {/* Error / Success                                   */}
                    {/* ------------------------------------------------- */}

                    {error && (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-700">
                            تنظیمات Ice Breaker با
                            موفقیت ذخیره شد.
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}