"use client";
import { Button } from "@/components/dashboard/DashboardUI"

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

import PublishingStoryAutomationSetup from "./publishing/PublishingStoryAutomationSetup";

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
        useState(Boolean(automationId));

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

                if (showcasesResponse.ok) {
                    const showcaseData = Array.isArray(showcasesResult)
                        ? showcasesResult
                        : Array.isArray(showcasesResult?.data)
                            ? showcasesResult.data
                            : [];
                    setShowcases(showcaseData as Showcase[]);
                }

                if (formsResponse.ok) {
                    const formData = Array.isArray(formsResult)
                        ? formsResult
                        : Array.isArray(formsResult?.data)
                            ? formsResult.data
                            : [];
                    setForms(formData as FormItem[]);
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
        setMessages((current) =>
            current.length > 0
                ? current
                : [createEmptyMessage()],
        );

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

    function updateQuickReplyTree(
        messageId: string,
        quickReplyId: string,
        updater: (quickReply: QuickReplyDraft) => QuickReplyDraft,
    ) {
        setMessages((current) =>
            current.map((message) => {
                if (message.id !== messageId) return message;

                const updateTree = (replies: QuickReplyDraft[]): QuickReplyDraft[] =>
                    replies.map((reply) => {
                        if (reply.id === quickReplyId) return updater(reply);
                        if (reply.destinationQuickReplies.length) {
                            return {
                                ...reply,
                                destinationQuickReplies: updateTree(reply.destinationQuickReplies),
                            };
                        }
                        return reply;
                    });

                return {
                    ...message,
                    quickReplies: updateTree(message.quickReplies),
                };
            }),
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
                    /*
                     * Rich destinations (including nested Forms) are stored
                     * inside quickReply.replyText by the Quick Reply API.
                     * They are not server AutomationMessage IDs, so a nested
                     * Form must not be resolved through nextMessageId.
                     */
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
                                        destinationType:
                                            quickReply.destinationType,
                                        destinationText:
                                            quickReply.destinationText,
                                        destinationFormId:
                                            quickReply.destinationFormId,
                                        destinationShowcaseId:
                                            quickReply.destinationShowcaseId,
                                        destinationMediaUrl:
                                            quickReply.destinationMediaUrl,
                                        destinationMediaId:
                                            quickReply.destinationMediaId,
                                        destinationQuestion:
                                            quickReply.destinationQuestion,
                                        destinationQuickReplies:
                                            quickReply.destinationQuickReplies,
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

    const currentMessage = messages[0] ?? createEmptyMessage();

    function updateEntryMessage(patch: Partial<MessageDraft>) {
        setMessages((current) => {
            const base = current[0] ?? createEmptyMessage();
            return [{ ...base, ...patch }];
        });
        setSuccess(false);
    }

    return (
        <div className="space-y-5">
            {loadingAutomation ? (
                <div className="flex min-h-32 items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-[#2563EB]" />
                </div>
            ) : (
                <>
                    <PublishingStoryAutomationSetup
                        message={currentMessage}
                        showcases={showcases}
                        forms={forms}
                        loadingResources={loadingResources}
                        instagramAccountId={accountId}
                        hideVideo
                        keywordValid
                        onUpdate={updateEntryMessage}
                        onSavedChange={setSuccess}
                        onContinue={() => {
                            void saveAutomation();
                        }}
                    />

                    {error && (
                        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-5 text-[#B91C1C]" role="alert">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs font-medium text-[#15803D]">
                            پاسخ با موفقیت ذخیره شد.
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
