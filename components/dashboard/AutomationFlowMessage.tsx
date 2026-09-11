"use client";

import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Image as ImageIcon,
    MessageSquare,
    Plus,
    Trash2,
    Video,
    Volume2,
    X,
} from "lucide-react";

import type {
    FormItem,
    MessageDraft,
    QuickReplyDraft,
    Showcase,
} from "./automation-form-utils";

import {
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
        patch: Partial<MessageDraft>,
    ) => void;

    onRemove: () => void;

    onMoveUp: () => void;
    onMoveDown: () => void;

    onAddQuickReply: () => void;

    onUpdateQuickReply: (
        quickReplyId: string,
        patch: Partial<QuickReplyDraft>,
    ) => void;

    onRemoveQuickReply: (
        quickReplyId: string,
    ) => void;
};

function MessageIcon({
    type,
}: {
    type: MessageDraft["messageType"];
}) {
    const className =
        "text-slate-500";

    switch (type) {
        case "IMAGE":
            return (
                <ImageIcon
                    size={16}
                    className={
                        className
                    }
                />
            );

        case "VIDEO":
            return (
                <Video
                    size={16}
                    className={
                        className
                    }
                />
            );

        case "AUDIO":
            return (
                <Volume2
                    size={16}
                    className={
                        className
                    }
                />
            );

        default:
            return (
                <MessageSquare
                    size={16}
                    className={
                        className
                    }
                />
            );
    }
}

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
    return (
        <div className="space-y-4">
            {/* ----------------------------------------------------- */}
            {/* Message type */}
            {/* ----------------------------------------------------- */}

            <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                    نوع پیام
                </label>

                <div className="relative">
                    <select
                        value={
                            message.messageType
                        }
                        onChange={(
                            event,
                        ) =>
                            onUpdate({
                                messageType:
                                    event
                                        .target
                                        .value as MessageDraft["messageType"],
                                text: "",
                                mediaUrl:
                                    "",
                                mediaId: "",
                                showcaseId:
                                    "",
                                formId: "",
                            })
                        }
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                    >
                        <option value="TEXT">
                            متن
                        </option>

                        <option value="IMAGE">
                            تصویر
                        </option>

                        <option value="VIDEO">
                            ویدیو
                        </option>

                        <option value="AUDIO">
                            صوت
                        </option>

                        <option value="SHOWCASE">
                            Showcase
                        </option>

                        <option value="FORM">
                            Form
                        </option>
                    </select>

                    <ChevronDown
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                </div>
            </div>

            {/* ----------------------------------------------------- */}
            {/* Content */}
            {/* ----------------------------------------------------- */}

            {message.messageType ===
                "TEXT" && (
                    <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-600">
                            متن پیام
                        </label>

                        <textarea
                            value={
                                message.text
                            }
                            onChange={(
                                event,
                            ) =>
                                onUpdate({
                                    text:
                                        event
                                            .target
                                            .value,
                                })
                            }
                            rows={4}
                            placeholder="متن پاسخ را وارد کنید..."
                            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-slate-400"
                        />
                    </div>
                )}

            {(message.messageType ===
                "IMAGE" ||
                message.messageType ===
                "VIDEO" ||
                message.messageType ===
                "AUDIO") && (
                    <div className="space-y-3">
                        <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-600">
                                Media URL
                            </label>

                            <input
                                value={
                                    message.mediaUrl
                                }
                                onChange={(
                                    event,
                                ) =>
                                    onUpdate({
                                        mediaUrl:
                                            event
                                                .target
                                                .value,
                                    })
                                }
                                placeholder="https://..."
                                dir="ltr"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                            />
                        </div>

                        <div className="text-center text-[10px] text-slate-400">
                            یا
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-600">
                                Media ID
                            </label>

                            <input
                                value={
                                    message.mediaId
                                }
                                onChange={(
                                    event,
                                ) =>
                                    onUpdate({
                                        mediaId:
                                            event
                                                .target
                                                .value,
                                    })
                                }
                                placeholder="Instagram Media ID"
                                dir="ltr"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                            />
                        </div>
                    </div>
                )}

            {message.messageType ===
                "SHOWCASE" && (
                    <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-600">
                            Showcase
                        </label>

                        <div className="relative">
                            <select
                                value={
                                    message.showcaseId
                                }
                                onChange={(
                                    event,
                                ) =>
                                    onUpdate({
                                        showcaseId:
                                            event
                                                .target
                                                .value,
                                    })
                                }
                                disabled={
                                    loadingResources
                                }
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:opacity-50"
                            >
                                <option value="">
                                    {loadingResources
                                        ? "در حال دریافت..."
                                        : "انتخاب Showcase"}
                                </option>

                                {showcases.map(
                                    (
                                        showcase,
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
                                    ),
                                )}
                            </select>

                            <ChevronDown
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                        </div>

                        {!loadingResources &&
                            showcases.length ===
                            0 && (
                                <p className="mt-2 text-[11px] text-slate-400">
                                    هنوز Showcase فعالی
                                    برای این پیج وجود ندارد.
                                </p>
                            )}
                    </div>
                )}

            {message.messageType ===
                "FORM" && (
                    <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-600">
                            Form
                        </label>

                        <div className="relative">
                            <select
                                value={
                                    message.formId
                                }
                                onChange={(
                                    event,
                                ) =>
                                    onUpdate({
                                        formId:
                                            event
                                                .target
                                                .value,
                                    })
                                }
                                disabled={
                                    loadingResources
                                }
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:opacity-50"
                            >
                                <option value="">
                                    {loadingResources
                                        ? "در حال دریافت..."
                                        : "انتخاب Form"}
                                </option>

                                {forms.map(
                                    (
                                        form,
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
                                    ),
                                )}
                            </select>

                            <ChevronDown
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                        </div>

                        {!loadingResources &&
                            forms.length ===
                            0 && (
                                <p className="mt-2 text-[11px] text-slate-400">
                                    هنوز Form فعالی برای این
                                    پیج وجود ندارد.
                                </p>
                            )}
                    </div>
                )}

            {/* ----------------------------------------------------- */}
            {/* Quick Replies */}
            {/* ----------------------------------------------------- */}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-slate-700">
                            Quick Replies
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-slate-400">
                            کاربر با انتخاب پاسخ سریع
                            به پیام مقصد منتقل می‌شود.
                        </p>
                    </div>

                    <span className="text-[10px] text-slate-400">
                        {
                            message
                                .quickReplies
                                .length
                        }
                        /13
                    </span>
                </div>

                {message.quickReplies
                    .length > 0 && (
                        <div className="mt-4 space-y-3">
                            {message.quickReplies.map(
                                (
                                    quickReply,
                                    qrIndex,
                                ) => (
                                    <div
                                        key={
                                            quickReply.id
                                        }
                                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-[10px] font-semibold text-slate-500">
                                                پاسخ سریع{" "}
                                                {qrIndex +
                                                    1}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onRemoveQuickReply(
                                                        quickReply.id,
                                                    )
                                                }
                                                className="text-slate-400 transition hover:text-red-600"
                                                aria-label="حذف Quick Reply"
                                            >
                                                <X
                                                    size={
                                                        15
                                                    }
                                                />
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="mb-1.5 block text-[10px] font-semibold text-slate-500">
                                                    عنوان
                                                </label>

                                                <input
                                                    value={
                                                        quickReply.title
                                                    }
                                                    maxLength={
                                                        20
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        onUpdateQuickReply(
                                                            quickReply.id,
                                                            {
                                                                title:
                                                                    event
                                                                        .target
                                                                        .value,
                                                            },
                                                        )
                                                    }
                                                    placeholder="مثلاً: بله، نمایش بده"
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-slate-400"
                                                />

                                                <div className="mt-1 text-left text-[9px] text-slate-400">
                                                    {
                                                        quickReply
                                                            .title
                                                            .length
                                                    }
                                                    /20
                                                </div>
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-[10px] font-semibold text-slate-500">
                                                    رفتن به
                                                </label>

                                                <div className="relative">
                                                    <select
                                                        value={
                                                            quickReply.nextMessageId ??
                                                            ""
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            onUpdateQuickReply(
                                                                quickReply.id,
                                                                {
                                                                    nextMessageId:
                                                                        event
                                                                            .target
                                                                            .value ||
                                                                        null,
                                                                },
                                                            )
                                                        }
                                                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pl-8 text-xs outline-none focus:border-slate-400"
                                                    >
                                                        <option value="">
                                                            انتخاب پیام مقصد
                                                        </option>

                                                        {messageOptions
                                                            .filter(
                                                                (
                                                                    option,
                                                                ) =>
                                                                    option.id !==
                                                                    message.id,
                                                            )
                                                            .map(
                                                                (
                                                                    option,
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
                                                                ),
                                                            )}
                                                    </select>

                                                    <ChevronDown
                                                        size={
                                                            14
                                                        }
                                                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    )}

                {message.quickReplies
                    .length <
                    13 && (
                        <button
                            type="button"
                            onClick={
                                onAddQuickReply
                            }
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                            <Plus
                                size={14}
                            />
                            افزودن Quick Reply
                        </button>
                    )}
            </div>

            {/* ----------------------------------------------------- */}
            {/* Message controls */}
            {/* ----------------------------------------------------- */}

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={
                            index === 0
                        }
                        onClick={
                            onMoveUp
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="انتقال به بالا"
                    >
                        <ArrowUp
                            size={14}
                        />
                    </button>

                    <button
                        type="button"
                        disabled={
                            index ===
                            total - 1
                        }
                        onClick={
                            onMoveDown
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="انتقال به پایین"
                    >
                        <ArrowDown
                            size={14}
                        />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">
                        {getMessageTypeLabel(
                            message.messageType,
                        )}
                    </span>

                    <button
                        type="button"
                        onClick={
                            onRemove
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        aria-label="حذف پیام"
                    >
                        <Trash2
                            size={14}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}