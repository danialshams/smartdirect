"use client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import PublishingStoryAutomationSetup from "./publishing/PublishingStoryAutomationSetup";

import {
    createEmptyMessage,
    normalizeMessages,
    validateMessages,
    type FormItem,
    type MessageDraft,
    type QuickReplyDraft,
    type Showcase,
} from "./automation-form-utils";

type EntryPointFlowBuilderProps = {
    accountId: string;
    automationId: string | null;
    onAutomationReady: (
        automationId: string,
    ) => void;
    finalSaveLabel?: string;
    finalSaveLoadingLabel?: string;
    triggerType?: "DM" | "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
    keyword?: string;
    onKeywordChange?: (value: string) => void;
    isActive?: boolean;
    onActiveChange?: (value: boolean) => void;
    dirty?: boolean;
    onDirtyChange?: (value: boolean) => void;
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

export default function EntryPointFlowBuilder({
    accountId,
    automationId,
    onAutomationReady,
    finalSaveLabel = "ساخت پیام شروع گفتگو",
    finalSaveLoadingLabel = "در حال ساخت پیام شروع گفتگو...",
    triggerType = "DM",
    keyword = "",
    onKeywordChange,
    isActive = true,
    onActiveChange,
    dirty = true,
    onDirtyChange,
}: EntryPointFlowBuilderProps) {
    const [messages, setMessages] =
        useState<MessageDraft[]>([]);

    const [showcases, setShowcases] =
        useState<Showcase[]>([]);

    const [forms, setForms] =
        useState<FormItem[]>([]);

    const [loadingResources, setLoadingResources] =
        useState(true);

    const [loadingAutomation, setLoadingAutomation] =
        useState(false);

    const flowLoading = loadingResources || loadingAutomation;

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
     * Validation
     * ---------------------------------------------------------
     */

    /*
     * ---------------------------------------------------------
     * Save Automation
     * ---------------------------------------------------------
     */

    async function saveAutomation(messageOverride?: MessageDraft) {
        const messagesToSave = messageOverride ? [messageOverride] : messages;
        try {
            validateMessages(messagesToSave);
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
                                    triggerType,
                                    keyword:
                                        triggerType === "DM" ? null : keyword.trim(),
                                    isActive,
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
                                    triggerType,
                                    mediaId:
                                        null,
                                    keyword:
                                        triggerType === "DM" ? null : keyword.trim(),
                                    commentReplyText:
                                        null,
                                    replyText:
                                        null,
                                    likeComment:
                                        false,
                                    sendDm: true,
                                    likeIncomingDm:
                                        false,
                                    isActive,
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
                index < messagesToSave.length;
                index++
            ) {
                const message =
                    messagesToSave[index];

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
            for (const message of messagesToSave) {
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
            onDirtyChange?.(false);

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
                    {triggerType !== "DM" && (
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-[#0F172A]">کلمات کلیدی</label>
                            <input
                                value={keyword}
                                onChange={(event) => {
                                    onKeywordChange?.(event.target.value);
                                    onDirtyChange?.(true);
                                }}
                                placeholder="مثلاً قیمت، خرید، سفارش"
                                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white"
                                style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }}
                            />
                            <p className="text-[11px] text-[#64748B]">حداقل یک کلمه کلیدی الزامی است.</p>
                        </div>
                    )}
                    {flowLoading ? (
                        <div className="flex min-h-32 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
                        </div>
                    ) : (
                    <PublishingStoryAutomationSetup
                        message={currentMessage}
                        showcases={showcases}
                        forms={forms}
                        loadingResources={loadingResources}
                        instagramAccountId={accountId}
                        showFinalSave
                        finalSaveLabel={finalSaveLabel}
                        finalSaveLoadingLabel={finalSaveLoadingLabel}
                        keywordValid={triggerType === "DM" || Boolean(keyword.trim())}
                        disabled={saving}
                        finalSaveDisabled={!dirty}
                        onUpdate={updateEntryMessage}
                        onSavedChange={setSuccess}
                        onContinue={(messageOverride) =>
                            saveAutomation(messageOverride)
                        }
                    />
                    )}

                    {error && (
                        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-5 text-[#B91C1C]" role="alert">
                            {error}
                        </div>
                    )}

                </>
            )}
        </div>
    );
}
