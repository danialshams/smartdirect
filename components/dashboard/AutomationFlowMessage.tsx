"use client";

import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Loader2,
    Plus,
    Trash2,
} from "lucide-react";

import type {
    FormItem,
    MessageDraft,
    QuickReplyDraft,
    Showcase,
} from "./automation-form-utils";

import {
    getMessageIcon,
    getMessageTypeLabel,
} from "./automation-form-utils";

type AutomationFlowMessageProps = {
    message: MessageDraft;
    index: number;
    total: number;
    messageOptions: {
        id: string;
        label: string;
    }[];
    showcases: Showcase[];
    forms: FormItem[];
    loadingResources: boolean;
    onUpdate: (
        patch: Partial<MessageDraft>
    ) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onAddQuickReply: () => void;
    onUpdateQuickReply: (
        quickReplyId: string,
        patch: Partial<QuickReplyDraft>
    ) => void;
    onRemoveQuickReply: (
        quickReplyId: string
    ) => void;
};

export default function AutomationFlowMessage({
    message,
    index,
    total,
    messageOptions,
    showcases,
    forms,
    loadingResources,
    onUpdate,
    onRemove,
    onMoveUp,
    onMoveDown,
    onAddQuickReply,
    onUpdateQuickReply,
    onRemoveQuickReply,
}: AutomationFlowMessageProps) {
    const canAddQuickReply =
        messageOptions.length >= 2 &&
        message.quickReplies.length < 13;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            {/* Header */}

            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
                        {index + 1}
                    </div>

                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                            پیام{" "}
                            {index + 1}
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                            {getMessageIcon(
                                message.messageType
                            )}

                            {getMessageTypeLabel(
                                message.messageType
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="انتقال به بالا"
                    >
                        <ArrowUp
                            size={15}
                        />
                    </button>

                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={
                            index ===
                            total - 1
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="انتقال به پایین"
                    >
                        <ArrowDown
                            size={15}
                        />
                    </button>

                    <button
                        type="button"
                        onClick={onRemove}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="حذف پیام"
                    >
                        <Trash2
                            size={15}
                        />
                    </button>
                </div>
            </div>

            {/* Message Type */}

            <div className="mt-5">
                <label className="mb-2 block text-xs font-medium text-gray-700">
                    نوع پیام
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(
                        [
                            "TEXT",
                            "IMAGE",
                            "VIDEO",
                            "AUDIO",
                            "SHOWCASE",
                            "FORM",
                        ] as const
                    ).map(
                        (type) => (
                            <button
                                key={
                                    type
                                }
                                type="button"
                                onClick={() =>
                                    onUpdate(
                                        {
                                            messageType:
                                                type,
                                        }
                                    )
                                }
                                className={[
                                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition",
                                    message.messageType ===
                                        type
                                        ? "border-slate-900 bg-slate-950 text-white"
                                        : "border-gray-200 text-gray-600 hover:border-gray-400",
                                ].join(
                                    " "
                                )}
                            >
                                {getMessageIcon(
                                    type
                                )}

                                {getMessageTypeLabel(
                                    type
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Text */}

            {message.messageType ===
                "TEXT" && (
                    <div className="mt-5">
                        <label className="mb-2 block text-xs font-medium text-gray-700">
                            متن پیام
                        </label>

                        <textarea
                            value={
                                message.text
                            }
                            onChange={(
                                event
                            ) =>
                                onUpdate(
                                    {
                                        text: event
                                            .target
                                            .value,
                                    }
                                )
                            }
                            placeholder="متن پیامی که برای مشتری ارسال می‌شود..."
                            className="min-h-28 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-gray-900"
                        />
                    </div>
                )}

            {/* Media */}

            {(message.messageType ===
                "IMAGE" ||
                message.messageType ===
                "VIDEO" ||
                message.messageType ===
                "AUDIO") && (
                    <div className="mt-5 space-y-3">
                        <div>
                            <label className="mb-2 block text-xs font-medium text-gray-700">
                                Media URL
                            </label>

                            <input
                                value={
                                    message.mediaUrl
                                }
                                onChange={(
                                    event
                                ) =>
                                    onUpdate(
                                        {
                                            mediaUrl:
                                                event
                                                    .target
                                                    .value,
                                        }
                                    )
                                }
                                placeholder="https://..."
                                dir="ltr"
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                            />
                        </div>

                        <div className="text-center text-[11px] text-gray-400">
                            یا
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium text-gray-700">
                                Media ID
                            </label>

                            <input
                                value={
                                    message.mediaId
                                }
                                onChange={(
                                    event
                                ) =>
                                    onUpdate(
                                        {
                                            mediaId:
                                                event
                                                    .target
                                                    .value,
                                        }
                                    )
                                }
                                placeholder="Instagram Media ID"
                                dir="ltr"
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                            />
                        </div>

                        <p className="text-[11px] leading-5 text-gray-400">
                            هنگام ارسال، یکی از URL یا
                            Media ID استفاده خواهد شد.
                        </p>
                    </div>
                )}

            {/* Showcase */}

            {message.messageType ===
                "SHOWCASE" && (
                    <div className="mt-5">
                        <label className="mb-2 block text-xs font-medium text-gray-700">
                            انتخاب ویترین
                        </label>

                        {loadingResources ? (
                            <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-4 text-xs text-gray-500">
                                <Loader2
                                    size={15}
                                    className="animate-spin"
                                />

                                در حال دریافت ویترین‌ها...
                            </div>
                        ) : showcases.length ===
                            0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
                                هنوز ویترینی برای این
                                پیج ساخته نشده است.
                            </div>
                        ) : (
                            <select
                                value={
                                    message.showcaseId
                                }
                                onChange={(
                                    event
                                ) =>
                                    onUpdate(
                                        {
                                            showcaseId:
                                                event
                                                    .target
                                                    .value,
                                        }
                                    )
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900"
                            >
                                <option value="">
                                    انتخاب ویترین
                                </option>

                                {showcases.map(
                                    (
                                        showcase
                                    ) => (
                                        <option
                                            key={
                                                showcase.id
                                            }
                                            value={
                                                showcase.id
                                            }
                                        >
                                            {
                                                showcase.title
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        )}

                        <p className="mt-2 text-[11px] leading-5 text-gray-400">
                            ویترین مستقل ذخیره می‌شود. ارسال مستقیم
                            ویترین به Instagram در Sender فعلی هنوز
                            پیاده‌سازی نشده است.
                        </p>
                    </div>
                )}

            {/* Form */}

            {message.messageType ===
                "FORM" && (
                    <div className="mt-5">
                        <label className="mb-2 block text-xs font-medium text-gray-700">
                            انتخاب فرم
                        </label>

                        {loadingResources ? (
                            <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-4 text-xs text-gray-500">
                                <Loader2
                                    size={15}
                                    className="animate-spin"
                                />

                                در حال دریافت فرم‌ها...
                            </div>
                        ) : forms.length ===
                            0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
                                هنوز فرمی برای این پیج ساخته
                                نشده است.
                            </div>
                        ) : (
                            <select
                                value={
                                    message.formId
                                }
                                onChange={(
                                    event
                                ) =>
                                    onUpdate(
                                        {
                                            formId:
                                                event
                                                    .target
                                                    .value,
                                        }
                                    )
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900"
                            >
                                <option value="">
                                    انتخاب فرم
                                </option>

                                {forms.map(
                                    (
                                        form
                                    ) => (
                                        <option
                                            key={
                                                form.id
                                            }
                                            value={
                                                form.id
                                            }
                                        >
                                            {
                                                form.title
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        )}

                        <p className="mt-2 text-[11px] leading-5 text-gray-400">
                            فرم مستقل ذخیره می‌شود و پاسخ‌های مشتری
                            در FormSubmission ثبت خواهند شد. ارسال
                            مستقیم فرم به Instagram در Sender فعلی
                            هنوز پیاده‌سازی نشده است.
                        </p>
                    </div>
                )}

            {/* Quick Replies */}

            <div className="mt-6 border-t border-gray-100 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900">
                            Quick Reply
                        </h4>

                        <p className="mt-1 text-[11px] leading-5 text-gray-400">
                            هر گزینه باید مشتری را به یک
                            پیام دیگر در همین Flow هدایت کند.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            onAddQuickReply
                        }
                        disabled={
                            !canAddQuickReply
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Plus
                            size={13}
                        />

                        {message.quickReplies.length >=
                            13
                            ? "حداکثر ۱۳ گزینه"
                            : "افزودن گزینه"}
                    </button>
                </div>

                {message.quickReplies
                    .length > 0 && (
                        <div className="mt-4 space-y-3">
                            {message.quickReplies.map(
                                (
                                    quickReply
                                ) => (
                                    <div
                                        key={
                                            quickReply.id
                                        }
                                        className="rounded-xl border border-gray-200 bg-gray-50/60 p-3"
                                    >
                                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                            <div>
                                                <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                                                    عنوان گزینه
                                                </label>

                                                <input
                                                    value={
                                                        quickReply.title
                                                    }
                                                    maxLength={
                                                        20
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        onUpdateQuickReply(
                                                            quickReply.id,
                                                            {
                                                                title: event
                                                                    .target
                                                                    .value,
                                                            }
                                                        )
                                                    }
                                                    placeholder="مثلاً قیمت محصولات"
                                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-gray-900"
                                                />

                                                <p className="mt-1 text-[10px] text-gray-400">
                                                    حداکثر ۲۰
                                                    کاراکتر
                                                </p>
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                                                    پیام مقصد
                                                </label>

                                                <div className="relative">
                                                    <select
                                                        value={
                                                            quickReply.nextMessageId ??
                                                            ""
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            onUpdateQuickReply(
                                                                quickReply.id,
                                                                {
                                                                    nextMessageId:
                                                                        event
                                                                            .target
                                                                            .value ||
                                                                        null,
                                                                }
                                                            )
                                                        }
                                                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 pl-8 text-xs outline-none focus:border-gray-900"
                                                    >
                                                        <option value="">
                                                            انتخاب پیام
                                                        </option>

                                                        {messageOptions
                                                            .filter(
                                                                (
                                                                    option
                                                                ) =>
                                                                    option.id !==
                                                                    message.id
                                                            )
                                                            .map(
                                                                (
                                                                    option
                                                                ) => (
                                                                    <option
                                                                        key={
                                                                            option.id
                                                                        }
                                                                        value={
                                                                            option.id
                                                                        }
                                                                    >
                                                                        {
                                                                            option.label
                                                                        }
                                                                    </option>
                                                                )
                                                            )}
                                                    </select>

                                                    <ChevronDown
                                                        size={14}
                                                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onRemoveQuickReply(
                                                            quickReply.id
                                                        )
                                                    }
                                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                                    aria-label="حذف Quick Reply"
                                                >
                                                    <Trash2
                                                        size={
                                                            15
                                                        }
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}