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

type InstagramAccount = {
    id: string;
    igUsername: string;
    igUserId: string;
    isConnected: boolean;
    createdAt: Date;
};

type Automation = {
    id: string;
    triggerType:
    | "COMMENT_KEYWORD"
    | "DM"
    | "STORY_REPLY_KEYWORD";
    keyword: string | null;
    isActive: boolean;
};

type PersistentMenuItem = {
    id: string;
    title: string;
    payload: string;
    automationId: string | null;
    order: number;
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

    const [automations, setAutomations] =
        useState<Automation[]>([]);

    const [items, setItems] = useState<
        Array<{
            title: string;
            automationId: string;
        }>
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

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!selectedAccountId) {
                setAutomations([]);
                setItems([]);
                setEnabled(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setSuccess(false);

                const [
                    automationResponse,
                    menuResponse,
                ] = await Promise.all([
                    fetch(
                        `/api/automations?instagramAccountId=${encodeURIComponent(
                            selectedAccountId,
                        )}`,
                        {
                            cache: "no-store",
                        },
                    ),
                    fetch(
                        `/api/instagram/persistent-menu?instagramAccountId=${encodeURIComponent(
                            selectedAccountId,
                        )}`,
                        {
                            cache: "no-store",
                        },
                    ),
                ]);

                const automationResult =
                    await automationResponse.json();

                const menuResult =
                    await menuResponse.json();

                if (
                    !automationResponse.ok ||
                    !automationResult.success
                ) {
                    throw new Error(
                        automationResult.error ||
                        "دریافت Automationها ناموفق بود.",
                    );
                }

                if (
                    !menuResponse.ok ||
                    !menuResult.success
                ) {
                    throw new Error(
                        menuResult.error ||
                        "دریافت Persistent Menu ناموفق بود.",
                    );
                }

                if (cancelled) return;

                setAutomations(
                    (
                        automationResult.data ??
                        []
                    ).filter(
                        (
                            automation: Automation,
                        ) =>
                            automation.isActive,
                    ),
                );

                const menu =
                    menuResult.data;

                setEnabled(
                    Boolean(
                        menu?.enabled,
                    ),
                );

                setItems(
                    (
                        menu?.items ??
                        []
                    ).map(
                        (
                            item: PersistentMenuItem,
                        ) => ({
                            title:
                                item.title,
                            automationId:
                                item.automationId ??
                                "",
                        }),
                    ),
                );
            } catch (loadError) {
                console.error(loadError);

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

        load();

        return () => {
            cancelled = true;
        };
    }, [selectedAccountId]);

    function addItem() {
        if (items.length >= 3) return;

        setItems((current) => [
            ...current,
            {
                title: "",
                automationId:
                    automations[0]?.id ?? "",
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

    function updateItem(
        index: number,
        field:
            | "title"
            | "automationId",
        value: string,
    ) {
        setItems((current) =>
            current.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                            ...item,
                            [field]:
                                value,
                        }
                        : item,
            ),
        );
    }

    async function handleSave() {
        if (!selectedAccountId) return;

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

            for (const item of items) {
                if (!item.title.trim()) {
                    throw new Error(
                        "عنوان همه آیتم‌ها را وارد کنید.",
                    );
                }

                if (!item.automationId) {
                    throw new Error(
                        "برای همه آیتم‌ها Automation انتخاب کنید.",
                    );
                }

                if (
                    item.title.trim()
                        .length > 30
                ) {
                    throw new Error(
                        "عنوان آیتم نباید بیشتر از ۳۰ کاراکتر باشد.",
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
                            items,
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

            setItems(
                (
                    savedMenu?.items ??
                    []
                ).map(
                    (
                        item: PersistentMenuItem,
                    ) => ({
                        title:
                            item.title,
                        automationId:
                            item.automationId ??
                            "",
                    }),
                ),
            );

            setSuccess(true);
        } catch (saveError) {
            console.error(saveError);

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
        if (!selectedAccountId) return;

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
            console.error(disableError);

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
            <div className="border-b border-slate-100 p-5 sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Menu size={16} />

                            <span className="text-[10px] font-semibold tracking-[0.16em]">
                                PERSISTENT MENU
                            </span>
                        </div>

                        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                            منوی ثابت دایرکت
                        </h2>

                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-400">
                            هر گزینه به یک Automation
                            متصل می‌شود و با انتخاب آن،
                            Flow مربوطه اجرا خواهد شد.
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
            ) : automations.length ===
                0 ? (
                <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                        ابتدا حداقل یک Automation بسازید.
                    </p>

                    <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-400">
                        هر گزینه باید به یک Automation
                        فعال متصل شود.
                    </p>
                </div>
            ) : (
                <div className="p-5 sm:p-7">
                    <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                فعال بودن منو
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                                منو در چت اینستاگرام نمایش داده شود.
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

                    <div className="space-y-3">
                        {items.map(
                            (
                                item,
                                index,
                            ) => (
                                <div
                                    key={
                                        index
                                    }
                                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                        <div className="flex-1">
                                            <label className="mb-2 block text-xs font-medium text-slate-500">
                                                عنوان گزینه
                                            </label>

                                            <input
                                                value={
                                                    item.title
                                                }
                                                onChange={(
                                                    event,
                                                ) =>
                                                    updateItem(
                                                        index,
                                                        "title",
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                                }
                                                maxLength={
                                                    30
                                                }
                                                placeholder="مثلاً: مشاهده محصولات"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                                            />

                                            <div className="mt-1 text-left text-[10px] text-slate-400">
                                                {
                                                    item
                                                        .title
                                                        .length
                                                }
                                                /30
                                            </div>
                                        </div>

                                        <div className="w-full lg:w-[310px]">
                                            <label className="mb-2 block text-xs font-medium text-slate-500">
                                                Automation
                                            </label>

                                            <select
                                                value={
                                                    item.automationId
                                                }
                                                onChange={(
                                                    event,
                                                ) =>
                                                    updateItem(
                                                        index,
                                                        "automationId",
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                                            >
                                                <option value="">
                                                    انتخاب Automation
                                                </option>

                                                {automations.map(
                                                    (
                                                        automation,
                                                    ) => (
                                                        <option
                                                            key={
                                                                automation.id
                                                            }
                                                            value={
                                                                automation.id
                                                            }
                                                        >
                                                            {automation.triggerType ===
                                                                "DM"
                                                                ? "دایرکت"
                                                                : automation.triggerType ===
                                                                    "COMMENT_KEYWORD"
                                                                    ? `کامنت: ${automation.keyword ?? ""}`
                                                                    : `استوری: ${automation.keyword ?? ""}`}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeItem(
                                                    index,
                                                )
                                            }
                                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                            aria-label="حذف"
                                        >
                                            <Trash2
                                                size={
                                                    17
                                                }
                                            />
                                        </button>
                                    </div>
                                </div>
                            ),
                        )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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

                        {items.length >
                            0 && (
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
                            )}

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

                    {error && (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-700">
                            تنظیمات Persistent Menu با موفقیت ذخیره شد.
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}