"use client";

import {
    ChevronDown,
    ChevronUp,
    FileText,
    Image as ImageIcon,
    Loader2,
    MessageSquare,
    Plus,
    Save,
    Video,
    Volume2
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState,
} from "react";

import AutomationFlowMessage from "./AutomationFlowMessage";

import type {
    FormItem,
    MessageDraft,
    QuickReplyDraft,
    Showcase,
} from "./automation-form-utils";

import {
    createEmptyMessage,
    createEmptyQuickReply,
    normalizeMessages,
    validateMessages,
} from "./automation-form-utils";

type EntryPointFlowBuilderProps = {
    accountId: string;
    automationId: string | null;
    onAutomationReady: (
        automationId: string,
    ) => void;
};

type ResourceResponse<T> = {
    success?: boolean;
    data?: T;
    error?: string;
};

type AutomationResponse = {
    success?: boolean;
    data?: {
        id: string;
        [key: string]: unknown;
    };
    error?: string;
};

type MessageResponse = {
    success?: boolean;
    data?: {
        id: string;
        [key: string]: unknown;
    };
    error?: string;
};

const MESSAGE_TYPES = [
    "TEXT",
    "IMAGE",
    "VIDEO",
    "AUDIO",
    "SHOWCASE",
    "FORM",
] as const;

function getMessageTypeIcon(
    type: MessageDraft["messageType"],
) {
    switch (type) {
        case "TEXT":
            return MessageSquare;

        case "IMAGE":
            return ImageIcon;

        case "VIDEO":
            return Video;

        case "AUDIO":
            return Volume2;

        case "SHOWCASE":
            return FileText;

        case "FORM":
            return FileText;

        default:
            return MessageSquare;
    }
}

export default function EntryPointFlowBuilder({
    accountId,
    automationId,
    onAutomationReady,
}: EntryPointFlowBuilderProps) {
    const [open, setOpen] =
        useState(false);

    const [messages, setMessages] =
        useState<MessageDraft[]>([]);

    const [showcases, setShowcases] =
        useState<Showcase[]>([]);

    const [forms, setForms] =
        useState<FormItem[]>([]);

    const [loadingResources, setLoadingResources] =
        useState(false);

    const [loadingAutomation, setLoadingAutomation] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [success, setSuccess] =
        useState(false);

    const [loadedAutomationId, setLoadedAutomationId] =
        useState<string | null>(
            null,
        );

    /*
     * ---------------------------------------------------------
     * Load Showcase / Form resources
     * ---------------------------------------------------------
     */

    useEffect(() => {
        let cancelled = false;

        async function loadResources() {
            if (!accountId) {
                return;
            }

            try {
                setLoadingResources(true);

                const [
                    showcasesResponse,
                    formsResponse,
                ] = await Promise.all([
                    fetch(
                        `/api/showcases?instagramAccountId=${encodeURIComponent(
                            accountId,
                        )}`,
                        {
                            cache: "no-store",
                            credentials: "include",
                        },
                    ),

                    fetch(
                        `/api/forms?instagramAccountId=${encodeURIComponent(
                            accountId,
                        )}`,
                        {
                            cache: "no-store",
                            credentials: "include",
                        },
                    ),
                ]);

                const showcasesResult =
                    (await showcasesResponse.json()) as ResourceResponse<
                        Showcase[]
                    >;

                const formsResult =
                    (await formsResponse.json()) as ResourceResponse<
                        FormItem[]
                    >;

                if (cancelled) {
                    return;
                }

                if (
                    showcasesResponse.ok &&
                    showcasesResult.success
                ) {
                    setShowcases(
                        Array.isArray(
                            showcasesResult.data,
                        )
                            ? showcasesResult.data
                            : [],
                    );
                }

                if (
                    formsResponse.ok &&
                    formsResult.success
                ) {
                    setForms(
                        Array.isArray(
                            formsResult.data,
                        )
                            ? formsResult.data
                            : [],
                    );
                }
            } catch (resourceError) {
                console.error(
                    resourceError,
                );
            } finally {
                if (!cancelled) {
                    setLoadingResources(
                        false,
                    );
                }
            }
        }

        void loadResources();

        return () => {
            cancelled = true;
        };
    }, [accountId]);

    /*
     * ---------------------------------------------------------
     * Load existing hidden Automation
     * ---------------------------------------------------------
     */

    useEffect(() => {
        let cancelled = false;

        async function loadAutomation() {
            if (!automationId) {
                setMessages([]);
                setLoadedAutomationId(null);
                return;
            }

            try {
                setLoadingAutomation(true);
                setError(null);

                const response =
                    await fetch(
                        `/api/automations/${encodeURIComponent(
                            automationId,
                        )}`,
                        {
                            cache: "no-store",
                            credentials: "include",
                        },
                    );

                const result =
                    (await response.json()) as {
                        success?: boolean;
                        data?: {
                            messages?: unknown;
                        };
                        error?: string;
                    };

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.error ||
                        "دریافت Flow ناموفق بود.",
                    );
                }

                if (cancelled) {
                    return;
                }

                setMessages(
                    normalizeMessages(
                        result.data?.messages,
                    ),
                );

                setLoadedAutomationId(
                    automationId,
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
                            : "دریافت Flow ناموفق بود.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingAutomation(
                        false,
                    );
                }
            }
        }

        void loadAutomation();

        return () => {
            cancelled = true;
        };
    }, [automationId]);

    /*
     * ---------------------------------------------------------
     * Message options
     * ---------------------------------------------------------
     */

    const messageOptions = useMemo(
        () =>
            messages.map(
                (message, index) => ({
                    id: message.id,
                    label: `پیام ${index + 1}`,
                }),
            ),
        [messages],
    );

    /*
     * ---------------------------------------------------------
     * Message operations
     * ---------------------------------------------------------
     */

    function updateMessage(
        messageId: string,
        patch: Partial<MessageDraft>,
    ) {
        setMessages((current) =>
            current.map((message) =>
                message.id === messageId
                    ? {
                        ...message,
                        ...patch,
                    }
                    : message,
            ),
        );

        setSuccess(false);
    }

    function removeMessage(
        messageId: string,
    ) {
        setMessages((current) => {
            const filtered =
                current.filter(
                    (message) =>
                        message.id !==
                        messageId,
                );

            /*
             * Remove broken Quick Reply
             * destinations after deleting
             * a message.
             */
            return filtered.map(
                (message) => ({
                    ...message,
                    quickReplies:
                        message.quickReplies.map(
                            (quickReply) =>
                                quickReply.nextMessageId ===
                                    messageId
                                    ? {
                                        ...quickReply,
                                        nextMessageId:
                                            null,
                                    }
                                    : quickReply,
                        ),
                }),
            );
        });

        setSuccess(false);
    }

    function moveMessage(
        messageId: string,
        direction: "up" | "down",
    ) {
        setMessages((current) => {
            const index =
                current.findIndex(
                    (message) =>
                        message.id ===
                        messageId,
                );

            if (index === -1) {
                return current;
            }

            const targetIndex =
                direction === "up"
                    ? index - 1
                    : index + 1;

            if (
                targetIndex < 0 ||
                targetIndex >=
                current.length
            ) {
                return current;
            }

            const next = [
                ...current,
            ];

            const temp =
                next[index];

            next[index] =
                next[targetIndex];

            next[targetIndex] =
                temp;

            return next;
        });

        setSuccess(false);
    }

    function addMessage() {
        setMessages((current) => [
            ...current,
            createEmptyMessage(),
        ]);

        setOpen(true);
        setSuccess(false);
    }

    function addQuickReply(
        messageId: string,
    ) {
        setMessages((current) =>
            current.map((message) => {
                if (
                    message.id !==
                    messageId
                ) {
                    return message;
                }

                if (
                    message.quickReplies
                        .length >= 13
                ) {
                    return message;
                }

                return {
                    ...message,
                    quickReplies: [
                        ...message.quickReplies,
                        createEmptyQuickReply(),
                    ],
                };
            }),
        );

        setSuccess(false);
    }

    function updateQuickReply(
        messageId: string,
        quickReplyId: string,
        patch: Partial<QuickReplyDraft>,
    ) {
        setMessages((current) =>
            current.map((message) =>
                message.id === messageId
                    ? {
                        ...message,
                        quickReplies:
                            message.quickReplies.map(
                                (
                                    quickReply,
                                ) =>
                                    quickReply.id ===
                                        quickReplyId
                                        ? {
                                            ...quickReply,
                                            ...patch,
                                        }
                                        : quickReply,
                            ),
                    }
                    : message,
            ),
        );

        setSuccess(false);
    }

    function removeQuickReply(
        messageId: string,
        quickReplyId: string,
    ) {
        setMessages((current) =>
            current.map((message) =>
                message.id === messageId
                    ? {
                        ...message,
                        quickReplies:
                            message.quickReplies.filter(
                                (
                                    quickReply,
                                ) =>
                                    quickReply.id !==
                                    quickReplyId,
                            ),
                    }
                    : message,
            ),
        );

        setSuccess(false);
    }

    /*
     * ---------------------------------------------------------
     * Validation
     * ---------------------------------------------------------
     */

    /*
     * ---------------------------------------------------------
     * Save Automation
     * ---------------------------------------------------------
     */

    async function saveAutomation() {
        try {
            validateMessages(messages);
            setSaving(true);
            setError(null);
            setSuccess(false);

            /*
             * 1. Create or update hidden Automation.
             *
             * This Automation is invisible to the
             * user conceptually. It is only the
             * execution container for this entry point.
             */
            let targetAutomationId =
                automationId;

            let savedAutomation:
                AutomationResponse["data"];

            if (
                targetAutomationId
            ) {
                const response =
                    await fetch(
                        `/api/automations/${encodeURIComponent(
                            targetAutomationId,
                        )}`,
                        {
                            method: "PATCH",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            credentials:
                                "include",
                            body: JSON.stringify(
                                {
                                    instagramAccountId:
                                        accountId,
                                    triggerType:
                                        "DM",
                                    mediaId:
                                        null,
                                    keyword:
                                        null,
                                    commentReplyText:
                                        null,
                                    replyText:
                                        null,
                                    likeComment:
                                        false,
                                    sendDm: true,
                                    likeIncomingDm:
                                        false,
                                    isActive:
                                        true,
                                },
                            ),
                        },
                    );

                const result =
                    (await response.json()) as AutomationResponse;

                if (
                    !response.ok ||
                    !result.success ||
                    !result.data?.id
                ) {
                    throw new Error(
                        result.error ||
                        "ویرایش Automation داخلی ناموفق بود.",
                    );
                }

                savedAutomation =
                    result.data;

                targetAutomationId =
                    result.data.id;
            } else {
                const response =
                    await fetch(
                        "/api/automations",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            credentials:
                                "include",
                            body: JSON.stringify(
                                {
                                    instagramAccountId:
                                        accountId,
                                    triggerType:
                                        "DM",
                                    mediaId:
                                        null,
                                    keyword:
                                        null,
                                    commentReplyText:
                                        null,
                                    replyText:
                                        null,
                                    likeComment:
                                        false,
                                    sendDm: true,
                                    likeIncomingDm:
                                        false,
                                    isActive:
                                        true,
                                },
                            ),
                        },
                    );

                const result =
                    (await response.json()) as AutomationResponse;

                if (
                    !response.ok ||
                    !result.success ||
                    !result.data?.id
                ) {
                    throw new Error(
                        result.error ||
                        "ساخت Automation داخلی ناموفق بود.",
                    );
                }

                savedAutomation =
                    result.data;

                targetAutomationId =
                    result.data.id;
            }

            if (!targetAutomationId) {
                throw new Error(
                    "شناسه Automation داخلی دریافت نشد.",
                );
            }

            /*
             * 2. If editing an existing Automation,
             * remove its previous messages.
             */
            if (
                automationId &&
                loadedAutomationId ===
                automationId
            ) {
                const existingResponse =
                    await fetch(
                        `/api/automations/${encodeURIComponent(
                            targetAutomationId,
                        )}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
                        },
                    );

                const existingResult =
                    (await existingResponse.json()) as {
                        success?: boolean;
                        data?: {
                            messages?: Array<{
                                id: string;
                            }>;
                        };
                    };

                if (
                    existingResponse.ok &&
                    existingResult.success
                ) {
                    const existingMessages =
                        Array.isArray(
                            existingResult.data
                                ?.messages,
                        )
                            ? existingResult.data
                                .messages
                            : [];

                    for (const message of existingMessages) {
                        await fetch(
                            `/api/automations/${encodeURIComponent(
                                targetAutomationId,
                            )}/messages/${encodeURIComponent(
                                message.id,
                            )}`,
                            {
                                method: "DELETE",
                                credentials:
                                    "include",
                            },
                        );
                    }
                }
            }

            /*
             * 3. Create the messages.
             *
             * Important:
             * Local message IDs are temporary.
             * We map them to server IDs so Quick
             * Replies can point to the correct
             * server message.
             */
            const serverMessageIds =
                new Map<
                    string,
                    string
                >();

            for (
                let index = 0;
                index < messages.length;
                index++
            ) {
                const message =
                    messages[index];

                if (!message) {
                    continue;
                }

                const response =
                    await fetch(
                        `/api/automations/${encodeURIComponent(
                            targetAutomationId,
                        )}/messages`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            credentials:
                                "include",
                            body: JSON.stringify(
                                {
                                    messageType:
                                        message.messageType,
                                    text:
                                        message.text.trim() ||
                                        null,
                                    mediaUrl:
                                        message.mediaUrl.trim() ||
                                        null,
                                    mediaId:
                                        message.mediaId.trim() ||
                                        null,
                                    showcaseId:
                                        message.showcaseId ||
                                        null,
                                    formId:
                                        message.formId ||
                                        null,
                                    order: index,
                                },
                            ),
                        },
                    );

                const result =
                    (await response.json()) as MessageResponse;

                if (
                    !response.ok ||
                    !result.success ||
                    !result.data?.id
                ) {
                    throw new Error(
                        result.error ||
                        `ساخت پیام ${index + 1} ناموفق بود.`,
                    );
                }

                serverMessageIds.set(
                    message.id,
                    result.data.id,
                );
            }

            /*
             * 4. Create Quick Replies.
             */
            for (const message of messages) {
                const serverMessageId =
                    serverMessageIds.get(
                        message.id,
                    );

                if (
                    !serverMessageId
                ) {
                    continue;
                }

                for (const quickReply of
                    message.quickReplies) {
                    const destinationId =
                        quickReply.nextMessageId
                            ? serverMessageIds.get(
                                quickReply.nextMessageId,
                            )
                            : null;

                    if (
                        !destinationId
                    ) {
                        throw new Error(
                            `مقصد Quick Reply «${quickReply.title}» پیدا نشد.`,
                        );
                    }

                    const response =
                        await fetch(
                            `/api/automations/${encodeURIComponent(
                                targetAutomationId,
                            )}/messages/${encodeURIComponent(
                                serverMessageId,
                            )}/quick-replies`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },
                                credentials:
                                    "include",
                                body: JSON.stringify(
                                    {
                                        title:
                                            quickReply.title.trim(),
                                        payload:
                                            quickReply.payload ||
                                            crypto.randomUUID(),
                                        nextMessageId:
                                            destinationId,
                                    },
                                ),
                            },
                        );

                    const result =
                        (await response.json()) as {
                            success?: boolean;
                            error?: string;
                        };

                    if (
                        !response.ok ||
                        !result.success
                    ) {
                        throw new Error(
                            result.error ||
                            `ساخت Quick Reply «${quickReply.title}» ناموفق بود.`,
                        );
                    }
                }
            }

            /*
             * 5. Load final Automation.
             *
             * This makes sure the manager receives
             * the real server-side Automation ID.
             */
            const finalResponse =
                await fetch(
                    `/api/automations/${encodeURIComponent(
                        targetAutomationId,
                    )}`,
                    {
                        cache: "no-store",
                        credentials:
                            "include",
                    },
                );

            const finalResult =
                (await finalResponse.json()) as {
                    success?: boolean;
                    data?: {
                        id: string;
                        messages?: unknown;
                    };
                    error?: string;
                };

            if (
                !finalResponse.ok ||
                !finalResult.success ||
                !finalResult.data?.id
            ) {
                throw new Error(
                    finalResult.error ||
                    "دریافت Automation نهایی ناموفق بود.",
                );
            }

            setMessages(
                normalizeMessages(
                    finalResult.data
                        .messages,
                ),
            );

            setLoadedAutomationId(
                finalResult.data.id,
            );

            onAutomationReady(
                finalResult.data.id,
            );

            setSuccess(true);

            return finalResult.data.id;
        } catch (saveError) {
            console.error(
                saveError,
            );

            setError(
                saveError instanceof
                    Error
                    ? saveError.message
                    : "ذخیره Flow ناموفق بود.",
            );

            return null;
        } finally {
            setSaving(false);
        }
    }

    /*
     * ---------------------------------------------------------
     * Render
     * ---------------------------------------------------------
     */

    return (
        <div className="mt-5 border-t border-border pt-5">
            {/* Builder Header */}
            <button
                type="button"
                onClick={() =>
                    setOpen(
                        (current) =>
                            !current,
                    )
                }
                className="flex w-full items-center justify-between gap-4 rounded-xl border bg-card px-4 py-4 text-right transition hover:bg-muted"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                        <MessageSquare
                            size={17}
                        />
                    </div>

                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                            پاسخ و Flow اختصاصی
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {messages.length > 0
                                ? `${messages.length} پیام در این Flow`
                                : "هنوز پاسخی برای این گزینه ساخته نشده است."}
                        </p>
                    </div>
                </div>

                {open ? (
                    <ChevronUp
                        size={18}
                        className="shrink-0 text-muted-foreground"
                    />
                ) : (
                    <ChevronDown
                        size={18}
                        className="shrink-0 text-muted-foreground"
                    />
                )}
            </button>

            {open && (
                <div className="mt-4 rounded-xl border bg-card p-4 sm:p-5">
                    {/* Description */}
                    <div className="mb-5 rounded-xl border border-border/60 bg-muted px-4 py-3">
                        <p className="text-xs leading-6 text-muted-foreground">
                            این Flow مستقل از
                            Automationهای معمولی
                            شماست. پیام‌ها به ترتیب
                            اجرا می‌شوند و Quick Reply
                            می‌تواند کاربر را به پیام
                            دیگری هدایت کند.
                        </p>
                    </div>

                    {/* Loading existing flow */}
                    {loadingAutomation ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2
                                size={20}
                                className="animate-spin text-muted-foreground"
                            />
                        </div>
                    ) : (
                        <>
                            {/* Messages */}
                            {messages.length ===
                                0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-muted/50 px-5 py-10 text-center">
                                    <MessageSquare
                                        size={22}
                                        className="mx-auto text-muted-foreground"
                                    />

                                    <p className="mt-3 text-sm font-semibold text-foreground">
                                        Flow خالی است
                                    </p>

                                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                                        اولین پیام پاسخ را
                                        اضافه کنید.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={
                                            addMessage
                                        }
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-primary/90"
                                    >
                                        <Plus
                                            size={
                                                15
                                            }
                                        />
                                        افزودن پیام
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map(
                                        (
                                            message,
                                            index,
                                        ) => {
                                            const Icon =
                                                getMessageTypeIcon(
                                                    message.messageType,
                                                );

                                            return (
                                                <div
                                                    key={
                                                        message.id
                                                    }
                                                    className="rounded-2xl border border-border bg-muted/50 p-3 sm:p-4"
                                                >
                                                    <div className="mb-3 flex items-center justify-between gap-3">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-border">
                                                                <Icon
                                                                    size={
                                                                        15
                                                                    }
                                                                    className="text-muted-foreground"
                                                                />
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold text-foreground">
                                                                    پیام{" "}
                                                                    {
                                                                        index +
                                                                        1
                                                                    }
                                                                </p>

                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {message.messageType}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="text-[10px] text-muted-foreground">
                                                            {index +
                                                                1}
                                                            /
                                                            {
                                                                messages.length
                                                            }
                                                        </div>
                                                    </div>

                                                    <AutomationFlowMessage
                                                        triggerType="DM"
                                                        message={
                                                            message
                                                        }
                                                        index={
                                                            index
                                                        }
                                                        total={
                                                            messages.length
                                                        }
                                                        messageOptions={
                                                            messageOptions
                                                        }
                                                        showcases={
                                                            showcases
                                                        }
                                                        forms={
                                                            forms
                                                        }
                                                        loadingResources={
                                                            loadingResources
                                                        }
                                                        onUpdate={(
                                                            patch,
                                                        ) =>
                                                            updateMessage(
                                                                message.id,
                                                                patch,
                                                            )
                                                        }
                                                        onRemove={() =>
                                                            removeMessage(
                                                                message.id,
                                                            )
                                                        }
                                                        onMoveUp={() =>
                                                            moveMessage(
                                                                message.id,
                                                                "up",
                                                            )
                                                        }
                                                        onMoveDown={() =>
                                                            moveMessage(
                                                                message.id,
                                                                "down",
                                                            )
                                                        }
                                                        onAddQuickReply={() =>
                                                            addQuickReply(
                                                                message.id,
                                                            )
                                                        }
                                                        onUpdateQuickReply={(
                                                            quickReplyId,
                                                            patch,
                                                        ) =>
                                                            updateQuickReply(
                                                                message.id,
                                                                quickReplyId,
                                                                patch,
                                                            )
                                                        }
                                                        onRemoveQuickReply={(
                                                            quickReplyId,
                                                        ) =>
                                                            removeQuickReply(
                                                                message.id,
                                                                quickReplyId,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            )}

                            {/* Add message */}
                            {messages.length >
                                0 && (
                                    <button
                                        type="button"
                                        onClick={
                                            addMessage
                                        }
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white px-4 py-3 text-xs font-semibold text-muted-foreground transition hover:border-ring hover:bg-muted"
                                    >
                                        <Plus
                                            size={
                                                15
                                            }
                                        />
                                        افزودن پیام
                                    </button>
                                )}

                            {/* Save */}
                            <div className="mt-5 border-t border-border pt-5">
                                <button
                                    type="button"
                                    onClick={
                                        saveAutomation
                                    }
                                    disabled={
                                        saving ||
                                        loadingAutomation
                                    }
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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

                                    {automationId
                                        ? "ذخیره تغییرات Flow"
                                        : "ساخت و ذخیره پاسخ"}
                                </button>
                            </div>

                            {error && (
                                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-700">
                                    Flow با موفقیت ذخیره
                                    شد.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}