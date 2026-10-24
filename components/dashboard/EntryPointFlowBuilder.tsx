"use client";
import { DashboardLoading } from "@/components/dashboard/DashboardUI";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import PublishingStoryAutomationSetup from "./publishing/PublishingStoryAutomationSetup";
import { responseFingerprint } from "./automation-response-compare";

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
    ) => void | Promise<void>;
    finalSaveLabel?: string;
    finalSaveLoadingLabel?: string;
    responseTypeTitle?: string;
    responseTypeDescription?: string;
    textPlaceholder?: string;
    hideVideo?: boolean;
    modernResponseFlow?: boolean;
    canSave?: boolean;
    onResponseDirtyChange?: (dirty: boolean) => void;
    triggerType?: "DM" | "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
    keyword?: string;
    onKeywordChange?: (value: string) => void;
    isActive?: boolean;
    onActiveChange?: (value: boolean) => void;
    dirty?: boolean;
    onDirtyChange?: (value: boolean) => void;
    textOnly?: boolean;
    optionalSettings?: ReactNode;
    finalActions?: ReactNode;
    fullPageLoading?: boolean;
    keywordLabel?: string;
    keywordDescription?: string;
    keywordExtraContent?: ReactNode;
    hideLoadingSpinner?: boolean;
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


function ModernResponseSkeleton() {
    return (
        <div role="status" aria-label="در حال دریافت تنظیمات پاسخ" className="space-y-4">
            <span className="sr-only">در حال دریافت نوع پاسخ و تنظیمات...</span>
            <div className="space-y-2">
                <div className="daira-skeleton__bar h-3.5 w-28" />
                <div className="daira-skeleton__bar h-3 w-52 max-w-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className="flex h-20 items-center gap-2 rounded-xl border border-[var(--daira-border)] p-3">
                        <div className="daira-skeleton__bar h-10 w-10 shrink-0 rounded-xl" />
                        <div className="daira-skeleton__bar h-3 min-w-0 flex-1" />
                    </div>
                ))}
            </div>
            <div className="daira-skeleton__bar h-28 w-full rounded-xl" />
            <div className="daira-skeleton__bar h-11 w-full rounded-xl" />
        </div>
    );
}

export default function EntryPointFlowBuilder({
    accountId,
    automationId,
    onAutomationReady,
    finalSaveLabel = "ساخت پیام شروع گفتگو",
    finalSaveLoadingLabel = "در حال ساخت پیام شروع گفتگو...",
    responseTypeTitle = "نوع پاسخ خودکار",
    responseTypeDescription = "نوع پاسخی را که می‌خواهید برای این محتوا ارسال شود انتخاب کنید.",
    textPlaceholder = "متنی که به‌عنوان پاسخ پیام شروع گفتگو برای کاربر ارسال می‌شود...",
    hideVideo = false,
    modernResponseFlow = false,
    canSave = true,
    onResponseDirtyChange,
    triggerType = "DM",
    keyword = "",
    onKeywordChange,
    isActive = true,
    onActiveChange,
    dirty = true,
    onDirtyChange,
    textOnly = false,
    optionalSettings,
    finalActions,
    fullPageLoading = false,
    keywordLabel,
    keywordDescription,
    keywordExtraContent,
    hideLoadingSpinner = false,
}: EntryPointFlowBuilderProps) {
    const [messages, setMessages] =
        useState<MessageDraft[]>([]);
    const [responseName, setResponseName] = useState("");
    const originalResponseRef = useRef<string | null>(null);
    const [showcaseDraftChanged, setShowcaseDraftChanged] = useState(false);
    const [keywordDraft, setKeywordDraft] = useState("");

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
                originalResponseRef.current = null;
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
                            replyText?: string | null;
                        };
                        error?: string;
                    };

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.error ||
                        "دریافت تنظیمات پاسخ ناموفق بود.",
                    );
                }

                if (cancelled) {
                    return;
                }

                const loadedMessages = normalizeMessages(result.data?.messages);
                const originalMessage = loadedMessages[0] ??
                    (result.data?.replyText?.trim()
                        ? { ...createEmptyMessage(), text: result.data.replyText }
                        : createEmptyMessage());
                originalResponseRef.current = responseFingerprint(originalMessage);
                setShowcaseDraftChanged(false);
                setMessages(loadedMessages.length > 0 || result.data?.replyText?.trim()
                    ? [originalMessage]
                    : []);

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
                            : "دریافت تنظیمات پاسخ ناموفق بود.",
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
        const messagesToSave = (messageOverride ? [messageOverride] : messages).map((message) => textOnly ? { ...message, messageType: "TEXT" as const, mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: [] } : message);
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
                                    ...(responseName.trim() ? { title: responseName.trim() } : {}),
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
                                    title: responseName.trim() || null,
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
            setLoadedAutomationId(
                finalResult.data.id,
            );

            await onAutomationReady(
                finalResult.data.id,
            );
            onDirtyChange?.(false);

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

    // The menu edit button is enabled only when the loaded response actually
    // differs from its original content (including nested form branches).
    useEffect(() => {
        if (!onResponseDirtyChange || !automationId ||
            loadedAutomationId !== automationId || originalResponseRef.current === null) return;
        const changed = responseFingerprint(messages[0] ?? createEmptyMessage()) !== originalResponseRef.current
            || showcaseDraftChanged;
        onResponseDirtyChange(changed);
    }, [automationId, loadedAutomationId, messages, showcaseDraftChanged, onResponseDirtyChange]);

    const currentMessage = messages[0] ?? createEmptyMessage();
    const keywordItems = keyword.split(/[\\n,،;؛]+/).map((item) => item.trim()).filter(Boolean).filter((item, index, list) => list.findIndex((value) => value.toLocaleLowerCase() === item.toLocaleLowerCase()) === index);

    function addKeyword() {
        const value = keywordDraft.trim();
        if (!value || keywordItems.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
            setKeywordDraft("");
            return;
        }
        onKeywordChange?.([...keywordItems, value].join(", "));
        onDirtyChange?.(true);
        setKeywordDraft("");
    }

    function updateEntryMessage(patch: Partial<MessageDraft>) {
        setMessages((current) => {
            const base = current[0] ?? createEmptyMessage();
            return [{ ...base, ...patch }];
        });
        onDirtyChange?.(true);
        setSuccess(false);
    }

    return (
        <div className="space-y-5">
            {loadingAutomation ? (
                modernResponseFlow ? (
                    <ModernResponseSkeleton />
                ) : fullPageLoading ? (
                    <div dir="rtl" role="status" aria-live="polite" className="fixed inset-0 z-40 flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--daira-surface-hover)] px-4 text-center">
                        <Loader2 size={30} strokeWidth={1.8} className="animate-spin text-[var(--daira-primary)]" />
                        <p className="text-sm leading-6 text-[var(--daira-text-secondary)]">در حال دریافت تنظیمات پاسخ خودکار...</p>
                    </div>
                ) : hideLoadingSpinner ? (
                    <div role="status" aria-live="polite" className="py-8 text-center text-sm leading-6 text-[var(--daira-text-secondary)]">در حال دریافت تنظیمات پاسخ خودکار...</div>
                ) : (
                    <DashboardLoading label="در حال دریافت تنظیمات پاسخ خودکار..." className="min-h-32" />
                )
            ) : (
                <>
                    {triggerType !== "DM" && (
                        <div className="space-y-3">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">{keywordLabel || "کلمات کلیدی"}</label>
                                <p className="mb-3 text-xs leading-5 text-[var(--daira-text-secondary)]">
                                    {keywordDescription || (triggerType === "COMMENT_KEYWORD" ? "با وارد شدن این کلمات در کامنت، پاسخ خودکار فعال می‌شود." : "با وارد شدن این کلمات در Reply استوری، پاسخ خودکار فعال می‌شود.")}
                                </p>
                                {keywordItems.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {keywordItems.map((item) => (
                                            <span key={item} className="daira-keyword-chip inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]">
                                                <span>{item}</span>
                                                <button type="button" onClick={() => { onKeywordChange?.(keywordItems.filter((value) => value !== item).join(",")); onDirtyChange?.(true); }} aria-label={"حذف " + item} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white"><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="daira-keyword-field flex items-center gap-2">
                                    <input id="edit-publishing-keyword" value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword(); } }} placeholder="مثلاً قیمت، اطلاعات" inputMode="text" className="daira-keyword-input min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 !text-base leading-5 text-[var(--daira-heading)] outline-none placeholder:text-xs placeholder:text-[var(--daira-text-disabled)] focus:border-[var(--daira-primary)] focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                                    <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim() || keywordItems.some((item) => item.toLocaleLowerCase() === keywordDraft.trim().toLocaleLowerCase())} className="min-h-11 shrink-0 rounded-lg !bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white hover:!bg-[var(--daira-primary-hover)] disabled:!bg-[var(--daira-border)] disabled:!text-[var(--daira-text-disabled)]">افزودن</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {keywordExtraContent}
                    {flowLoading ? (
                        modernResponseFlow ? (
                            <ModernResponseSkeleton />
                        ) : fullPageLoading ? (
                            <div dir="rtl" role="status" aria-live="polite" className="fixed inset-0 z-40 flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--daira-surface-hover)] px-4 text-center">
                                <Loader2 size={30} strokeWidth={1.8} className="animate-spin text-[var(--daira-primary)]" />
                                <p className="text-sm leading-6 text-[var(--daira-text-secondary)]">در حال دریافت اطلاعات فرم‌ها و ویترین‌ها...</p>
                            </div>
                        ) : hideLoadingSpinner ? (
                            <div role="status" aria-live="polite" className="py-8 text-center text-sm leading-6 text-[var(--daira-text-secondary)]">در حال دریافت اطلاعات فرم‌ها و ویترین‌ها...</div>
                        ) : (
                            <DashboardLoading label="در حال دریافت پاسخ..." className="min-h-32" />
                        )
                    ) : (
                    <PublishingStoryAutomationSetup
                        message={currentMessage}
                        showcases={showcases}
                        forms={forms}
                        loadingResources={loadingResources}
                        instagramAccountId={accountId}
                        showFinalSave
                        hideVideo={hideVideo}
                        storyCreateMode={modernResponseFlow}
                        storyEditMode={modernResponseFlow && Boolean(automationId)}
                        onDraftChange={modernResponseFlow && Boolean(automationId) ? setShowcaseDraftChanged : undefined}
                        textOnly={textOnly}
                        extraSettings={optionalSettings}
                        finalActions={finalActions}
                        responseTypeTitle={responseTypeTitle}
                        responseTypeDescription={responseTypeDescription}
                        textPlaceholder={textPlaceholder}
                        finalSaveLabel={finalSaveLabel}
                        usePublishingSaveLabel={false}
                        finalSaveLoadingLabel={finalSaveLoadingLabel}
                        keywordValid={triggerType === "DM" || Boolean(keyword.trim())}
                        disabled={saving}
                        finalSaveDisabled={!dirty || !canSave}
                        onUpdate={updateEntryMessage}
                        onSavedChange={setSuccess}
                        onResponseNameChange={setResponseName}
                        onContinue={(messageOverride) =>
                            saveAutomation(messageOverride)
                        }
                    />
                    )}

                    {error && (
                        <div className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--daira-error-text)]" role="alert">
                            {error}
                        </div>
                    )}

                </>
            )}
        </div>
    );
}
