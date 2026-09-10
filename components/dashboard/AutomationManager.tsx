"use client";

import {
    Bot,
    ChevronDown,
    Loader2,
    MessageCircle,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AutomationForm from "./AutomationForm";

type InstagramAccount = {
    id: string;
    igUsername: string;
    igUserId: string;
    isConnected: boolean;
    createdAt: Date;
};

export type Automation = {
    id: string;
    instagramAccountId: string;
    keyword: string;
    commentReplyText: string | null;
    replyText: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

type AutomationManagerProps = {
    accounts: InstagramAccount[];
};

export default function AutomationManager({
    accounts,
}: AutomationManagerProps) {
    const connectedAccounts = useMemo(
        () =>
            accounts.filter(
                (account) => account.isConnected,
            ),
        [accounts],
    );

    const [selectedAccountId, setSelectedAccountId] =
        useState("");

    const [automations, setAutomations] = useState<
        Automation[]
    >([]);

    const [loading, setLoading] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingAutomation, setEditingAutomation] =
        useState<Automation | null>(null);

    const [menuId, setMenuId] = useState<string | null>(
        null,
    );

    const selectedAccount = connectedAccounts.find(
        (account) => account.id === selectedAccountId,
    );


    useEffect(() => {
        let cancelled = false;

        async function fetchAutomations() {
            if (!selectedAccountId) {
                if (!cancelled) {
                    setAutomations([]);
                    setLoading(false);
                }

                return;
            }

            try {
                setLoading(true);

                const response = await fetch(
                    `/api/automations?instagramAccountId=${encodeURIComponent(
                        selectedAccountId,
                    )}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    },
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message ||
                        "دریافت اتوماسیون‌ها ناموفق بود.",
                    );
                }

                if (!cancelled) {
                    setAutomations(result.data ?? []);
                }
            } catch (error) {
                console.error(error);

                if (!cancelled) {
                    setAutomations([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchAutomations();

        return () => {
            cancelled = true;
        };
    }, [selectedAccountId]);

    async function handleToggle(
        automation: Automation,
    ) {
        try {
            const response = await fetch(
                `/api/automations/${automation.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        isActive: !automation.isActive,
                    }),
                },
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    "تغییر وضعیت ناموفق بود.",
                );
            }

            setAutomations((current) =>
                current.map((item) =>
                    item.id === automation.id
                        ? {
                            ...item,
                            isActive: !item.isActive,
                        }
                        : item,
                ),
            );
        } catch (error) {
            console.error(error);
            alert(
                error instanceof Error
                    ? error.message
                    : "تغییر وضعیت ناموفق بود.",
            );
        }
    }

    async function handleDelete(
        automation: Automation,
    ) {
        const confirmed = window.confirm(
            `آیا از حذف اتوماسیون «${automation.keyword}» مطمئن هستید؟`,
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/automations/${automation.id}`,
                {
                    method: "DELETE",
                },
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    "حذف اتوماسیون ناموفق بود.",
                );
            }

            setAutomations((current) =>
                current.filter(
                    (item) => item.id !== automation.id,
                ),
            );

            setMenuId(null);
        } catch (error) {
            console.error(error);

            alert(
                error instanceof Error
                    ? error.message
                    : "حذف اتوماسیون ناموفق بود.",
            );
        }
    }

    function handleCreated(
        automation: Automation,
    ) {
        setAutomations((current) => [
            automation,
            ...current,
        ]);

        setFormOpen(false);
    }

    function handleUpdated(
        automation: Automation,
    ) {
        setAutomations((current) =>
            current.map((item) =>
                item.id === automation.id
                    ? automation
                    : item,
            ),
        );

        setEditingAutomation(null);
    }

    return (
        <div className="rounded-[26px] border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5 sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Bot size={16} />

                            <span className="text-[10px] font-semibold tracking-[0.16em]">
                                AUTOMATION
                            </span>
                        </div>

                        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                            اتوماسیون پاسخ‌گویی
                        </h2>

                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-400">
                            مشخص کنید وقتی کاربر عبارت خاصی را در کامنت
                            وارد کرد، چه پاسخی دریافت کند.
                        </p>
                    </div>

                    {connectedAccounts.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingAutomation(null);
                                setFormOpen(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            <Plus size={17} />
                            ساخت اتوماسیون
                        </button>
                    )}
                </div>

                {connectedAccounts.length > 0 && (
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="text-xs text-slate-400">
                            پیج فعال:
                        </span>

                        <div className="relative w-full sm:w-[280px]">
                            <select
                                value={
                                    selectedAccountId ||
                                    connectedAccounts[0]?.id ||
                                    ""
                                }
                                onChange={(event) =>
                                    setSelectedAccountId(
                                        event.target.value,
                                    )
                                }
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
                            >
                                {connectedAccounts.map((account) => (
                                    <option
                                        key={account.id}
                                        value={account.id}
                                    >
                                        @{account.igUsername}
                                    </option>
                                ))}
                            </select>

                            <ChevronDown
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            {connectedAccounts.length === 0 ? (
                <div className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Bot size={24} />
                    </div>

                    <h3 className="mt-5 text-base font-bold text-slate-800">
                        ابتدا یک پیج متصل کنید
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                        برای ساخت Automation حداقل یک اکانت
                        اینستاگرام باید به SmartDirect متصل باشد.
                    </p>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center px-6 py-20">
                    <Loader2
                        size={24}
                        className="animate-spin text-slate-400"
                    />
                </div>
            ) : automations.length === 0 ? (
                <div className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <MessageCircle size={23} />
                    </div>

                    <h3 className="mt-5 text-base font-bold text-slate-800">
                        هنوز اتوماسیونی ساخته نشده
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                        اولین Automation را بسازید تا SmartDirect
                        به کامنت‌های کاربران به‌صورت خودکار پاسخ دهد.
                    </p>

                    <button
                        type="button"
                        onClick={() => {
                            setEditingAutomation(null);
                            setFormOpen(true);
                        }}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                    >
                        <Plus size={17} />
                        ساخت اولین اتوماسیون
                    </button>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {automations.map((automation) => (
                        <AutomationCard
                            key={automation.id}
                            automation={automation}
                            accountUsername={
                                selectedAccount?.igUsername
                            }
                            menuOpen={menuId === automation.id}
                            onMenuToggle={() =>
                                setMenuId(
                                    menuId === automation.id
                                        ? null
                                        : automation.id,
                                )
                            }
                            onToggle={() =>
                                handleToggle(automation)
                            }
                            onEdit={() => {
                                setMenuId(null);
                                setEditingAutomation(automation);
                                setFormOpen(true);
                            }}
                            onDelete={() =>
                                handleDelete(automation)
                            }
                        />
                    ))}
                </div>
            )}

            {formOpen && selectedAccount && (
                <AutomationForm
                    key={editingAutomation?.id ?? "new"}
                    account={selectedAccount}
                    automation={editingAutomation}
                    onClose={() => {
                        setFormOpen(false);
                        setEditingAutomation(null);
                    }}
                    onCreated={handleCreated}
                    onUpdated={handleUpdated}
                />
            )}
        </div>
    );
}

function AutomationCard({
    automation,
    accountUsername,
    menuOpen,
    onMenuToggle,
    onToggle,
    onEdit,
    onDelete,
}: {
    automation: Automation;
    accountUsername?: string;
    menuOpen: boolean;
    onMenuToggle: () => void;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="group px-5 py-5 transition hover:bg-slate-50/60 sm:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div
                        className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                            automation.isActive
                                ? "bg-slate-950 text-white"
                                : "bg-slate-100 text-slate-400",
                        ].join(" ")}
                    >
                        <Bot size={20} strokeWidth={1.7} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                                اگر کامنت شامل
                            </span>

                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                                {automation.keyword}
                            </span>

                            <span
                                className={[
                                    "rounded-full px-2 py-1 text-[9px] font-semibold",
                                    automation.isActive
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-slate-100 text-slate-400",
                                ].join(" ")}
                            >
                                {automation.isActive
                                    ? "فعال"
                                    : "غیرفعال"}
                            </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-400">
                            @{accountUsername}
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                <div className="mb-1 flex items-center gap-2 text-[10px] font-medium text-slate-400">
                                    <MessageCircle size={13} />
                                    پاسخ عمومی کامنت
                                </div>

                                <p className="line-clamp-2 text-xs leading-6 text-slate-600">
                                    {automation.commentReplyText ||
                                        "بدون پاسخ عمومی"}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                <div className="mb-1 flex items-center gap-2 text-[10px] font-medium text-slate-400">
                                    <MessageCircle size={13} />
                                    پاسخ خصوصی
                                </div>

                                <p className="line-clamp-2 text-xs leading-6 text-slate-600">
                                    {automation.replyText}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 xl:border-0 xl:pt-0">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex items-center gap-2 text-xs font-medium text-slate-500"
                    >
                        <span
                            className={[
                                "relative h-6 w-11 rounded-full transition",
                                automation.isActive
                                    ? "bg-slate-950"
                                    : "bg-slate-200",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                                    automation.isActive
                                        ? "right-1"
                                        : "right-6",
                                ].join(" ")}
                            />
                        </span>

                        {automation.isActive
                            ? "فعال"
                            : "غیرفعال"}
                    </button>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={onMenuToggle}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                            aria-label="گزینه‌ها"
                        >
                            <MoreHorizontal size={19} />
                        </button>

                        {menuOpen && (
                            <>
                                <button
                                    type="button"
                                    className="fixed inset-0 z-10 cursor-default"
                                    onClick={onMenuToggle}
                                    aria-label="بستن"
                                />

                                <div className="absolute left-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                    <button
                                        type="button"
                                        onClick={onEdit}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-slate-600 transition hover:bg-slate-50"
                                    >
                                        <Pencil size={14} />
                                        ویرایش
                                    </button>

                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-red-600 transition hover:bg-red-50"
                                    >
                                        <Trash2 size={14} />
                                        حذف
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}