"use client";

import {
    ChevronDown,
    Loader2,
    Menu,
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

type PersistentMenuItem = {
    id: string;
    title: string;
    payload: string;
    automationId: string | null;
    order: number;
};

type PersistentMenuDraft = {
    id?: string;
    title: string;
    automationId: string | null;
};

type PersistentMenuManagerProps = {
    accounts: InstagramAccount[];
};

export default function PersistentMenuManager({
    accounts,
}: PersistentMenuManagerProps) {
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
        PersistentMenuDraft[]
    >([]);

    const [enabled, setEnabled] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [success, setSuccess] =
        useState(false);

    /*
     * Select first connected account.
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
     * Load Persistent Menu.
     *
     * We no longer load /api/automations.
     * The Automation behind each item is
     * managed automatically by the Flow Builder.
     */
    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!selectedAccountId) {
                setItems([]);
                setEnabled(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setSuccess(false);

                const response =
                    await fetch(
                        `/api/instagram/persistent-menu?instagramAccountId=${encodeURIComponent(
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
                        "دریافت Persistent Menu ناموفق بود.",
                    );
                }

                if (cancelled) {
                    return;
                }

                const menu =
                    result.data;

                setEnabled(
                    Boolean(
                        menu?.enabled,
                    ),
                );

                const serverItems =
                    Array.isArray(
                        menu?.items,
                    )
                        ? menu.items
                        : [];

                setItems(
                    serverItems.map(
                        (
                            item: PersistentMenuItem,
                        ) => ({
                            id: item.id,
                            title:
                                item.title,
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
     * Add a new menu item.
     */
    function addItem() {
        if (items.length >= 3) {
            return;
        }

        setItems((current) => [
            ...current,
            {
                title: "",
                automationId: null,
            },
        ]);

        setEnabled(true);
    }

    function removeItem(index: number) {
        setItems((current) =>
            current.filter(
                (_, itemIndex) =>
                    itemIndex !== index,
            ),
        );
    }

    function updateTitle(
        index: number,
        value: string,
    ) {
        setItems((current) =>
            current.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                            ...item,
                            title: value,
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

            if (
                enabled &&
                items.length === 0
            ) {
                throw new Error(
                    "برای فعال کردن Persistent Menu حداقل یک آیتم اضافه کنید.",
                );
            }

            if (items.length > 3) {
                throw new Error(
                    "حداکثر ۳ گزینه برای Persistent Menu مجاز است.",
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

                if (!item.title.trim()) {
                    throw new Error(
                        `عنوان گزینه ${index + 1
                        } را وارد کنید.`,
                    );
                }

                if (
                    item.title.trim()
                        .length > 30
                ) {
                    throw new Error(
                        `عنوان گزینه ${index + 1
                        } نباید بیشتر از ۳۰ کاراکتر باشد.`,
                    );
                }

                if (!item.automationId) {
                    throw new Error(
                        `برای گزینه ${index + 1
                        } ابتدا پاسخ سفارشی آن را ذخیره کنید.`,
                    );
                }
            }

            const response =
                await fetch(
                    "/api/instagram/persistent-menu",
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
                            enabled:
                                enabled &&
                                items.length >
                                0,
                            items: items.map(
                                (item) => ({
                                    title:
                                        item.title.trim(),
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
                    "ذخیره Persistent Menu ناموفق بود.",
                );
            }

            const savedMenu =
                result.data;

            setEnabled(
                Boolean(
                    savedMenu?.enabled,
                ),
            );

            const savedItems =
                Array.isArray(
                    savedMenu?.items,
                )
                    ? savedMenu.items
                    : [];

            setItems(
                savedItems.map(
                    (
                        item: PersistentMenuItem,
                    ) => ({
                        id: item.id,
                        title:
                            item.title,
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
                    `/api/instagram/persistent-menu?instagramAccountId=${encodeURIComponent(
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

            setEnabled(false);
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
            id="persistent-menu"
            className="scroll-mt-24 rounded-[26px] border border-slate-200 bg-white"
        >
            {/* --------------------------------------------------------- */}
            {/* Header                                                    */}
            {/* --------------------------------------------------------- */}

            <div className="border-b border-slate-100 p-5 sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Menu
                                size={16}
                            />

                            <span className="text-[10px] font-semibold tracking-[0.16em]">
                                PERSISTENT MENU
                            </span>
                        </div>

                        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                            منوی ثابت دایرکت
                        </h2>

                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-400">
                            برای هر گزینه منو،
                            پاسخ و Flow اختصاصی
                            خودتان را مستقیماً
                            داخل همان گزینه بسازید.
                        </p>
                    </div>

                    {connectedAccounts.length >
                        0 && (
                            <div className="relative w-full sm:w-[280px]">
                                <select
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
                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
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
                                </select>

                                <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                <div className="px-6 py-16 text-center text-sm text-slate-400">
                    ابتدا یک پیج اینستاگرام متصل کنید.
                </div>
            ) : loading ? (
                <div className="flex justify-center px-6 py-20">
                    <Loader2
                        size={24}
                        className="animate-spin text-slate-400"
                    />
                </div>
            ) : (
                <div className="p-5 sm:p-7">
                    {/* ------------------------------------------------- */}
                    {/* Enabled                                            */}
                    {/* ------------------------------------------------- */}

                    <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                فعال بودن منو
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                                منو در چت اینستاگرام
                                نمایش داده شود.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setEnabled(
                                    (
                                        current,
                                    ) =>
                                        !current,
                                )
                            }
                            className={[
                                "relative h-6 w-11 rounded-full transition",
                                enabled
                                    ? "bg-slate-950"
                                    : "bg-slate-200",
                            ].join(" ")}
                            aria-label="فعال یا غیرفعال کردن"
                        >
                            <span
                                className={[
                                    "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                                    enabled
                                        ? "right-1"
                                        : "right-6",
                                ].join(" ")}
                            />
                        </button>
                    </div>

                    {/* ------------------------------------------------- */}
                    {/* Explanation                                       */}
                    {/* ------------------------------------------------- */}

                    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-800">
                            پاسخ هر گزینه را همین‌جا بسازید
                        </p>

                        <p className="mt-1 text-xs leading-6 text-slate-500">
                            دیگر لازم نیست برای
                            گزینه منو یک Automation
                            انتخاب کنید. برای هر
                            گزینه یک Flow اختصاصی
                            بسازید؛ شامل چند پیام،
                            Media، Showcase، Form و
                            Quick Reply.
                        </p>
                    </div>

                    {/* ------------------------------------------------- */}
                    {/* Empty state                                       */}
                    {/* ------------------------------------------------- */}

                    {items.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
                            <Menu
                                size={22}
                                className="mx-auto text-slate-300"
                            />

                            <p className="mt-3 text-sm font-semibold text-slate-700">
                                هنوز گزینه‌ای برای منو اضافه نشده است.
                            </p>

                            <p className="mt-1 text-xs leading-6 text-slate-400">
                                اولین گزینه را اضافه
                                کنید و پاسخ
                                اختصاصی آن را بسازید.
                            </p>

                            <button
                                type="button"
                                onClick={
                                    addItem
                                }
                                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                                <Plus
                                    size={16}
                                />
                                افزودن گزینه
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
                                        className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
                                    >
                                        {/* Menu title */}
                                        <div className="flex items-start gap-3">
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <label className="block text-xs font-semibold text-slate-600">
                                                        عنوان گزینه{" "}
                                                        {
                                                            index +
                                                            1
                                                        }
                                                    </label>

                                                    <span className="text-[10px] font-medium text-slate-400">
                                                        {
                                                            item
                                                                .title
                                                                .length
                                                        }
                                                        /30
                                                    </span>
                                                </div>

                                                <input
                                                    value={
                                                        item.title
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        updateTitle(
                                                            index,
                                                            event
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    maxLength={
                                                        30
                                                    }
                                                    placeholder="مثلاً: مشاهده محصولات"
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(
                                                        index,
                                                    )
                                                }
                                                className="mt-6 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                                aria-label="حذف گزینه"
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
                        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                            <button
                                type="button"
                                onClick={
                                    addItem
                                }
                                disabled={
                                    items.length >=
                                    3
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Plus
                                    size={16}
                                />
                                افزودن گزینه
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleDisable
                                }
                                disabled={
                                    saving
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
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
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:mr-auto"
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

                                ذخیره منو
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
                            تنظیمات Persistent Menu
                            با موفقیت ذخیره شد.
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}