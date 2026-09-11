
"use client";

import type { FormEvent } from "react";

import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Image as ImageIcon,
    Loader2,
    MessageCircle,
    MessageSquareText,
    Plus,
    Trash2,
    Video,
    Volume2,
    X,
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    Automation,
    AutomationTriggerType,
} from "./AutomationManager";

type InstagramAccount = {
    id: string;
    igUsername: string;
};

type InstagramMedia = {
    id: string;
    caption?: string | null;
    media_type?: string;
    media_product_type?: string;
    media_url?: string | null;
    thumbnail_url?: string | null;
    permalink?: string | null;
    timestamp?: string | null;
};

type Showcase = {
    id: string;
    title: string;
    description?: string | null;
    isActive?: boolean;
    items?: unknown[];
};

type FormItem = {
    id: string;
    title: string;
    description?: string | null;
    isActive?: boolean;
    fields?: unknown[];
};

type MessageType =
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "AUDIO"
    | "SHOWCASE"
    | "FORM";

type QuickReplyDraft = {
    id: string;
    title: string;
    payload: string;
    nextMessageId: string | null;
};

type MessageDraft = {
    id: string;
    messageType: MessageType;
    text: string;
    mediaUrl: string;
    mediaId: string;
    showcaseId: string;
    formId: string;
    quickReplies: QuickReplyDraft[];
};

type Props = {
    account: InstagramAccount;
    automation?: Automation | null;
    onClose: () => void;
    onCreated: (automation: Automation) => void;
    onUpdated: (automation: Automation) => void;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function createLocalId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}`;
}

function createEmptyMessage(): MessageDraft {
    return {
        id: createLocalId("message"),
        messageType: "TEXT",
        text: "",
        mediaUrl: "",
        mediaId: "",
        showcaseId: "",
        formId: "",
        quickReplies: [],
    };
}

function createEmptyQuickReply(): QuickReplyDraft {
    return {
        id: createLocalId("quick"),
        title: "",
        payload: createLocalId("payload"),
        nextMessageId: null,
    };
}

function getDefaultTrigger(
    automation?: Automation | null
): AutomationTriggerType {
    return (
        automation?.triggerType ??
        "COMMENT_KEYWORD"
    );
}

function getMessageTypeLabel(
    messageType: MessageType
) {
    switch (messageType) {
        case "TEXT":
            return "متن";

        case "IMAGE":
            return "عکس";

        case "VIDEO":
            return "ویدیو";

        case "AUDIO":
            return "ویس";

        case "SHOWCASE":
            return "ویترین";

        case "FORM":
            return "فرم";

        default:
            return "پیام";
    }
}

function getMessageIcon(
    messageType: MessageType
) {
    switch (messageType) {
        case "IMAGE":
            return <ImageIcon size={15} />;

        case "VIDEO":
            return <Video size={15} />;

        case "AUDIO":
            return <Volume2 size={15} />;

        case "SHOWCASE":
            return (
                <MessageSquareText size={15} />
            );

        case "FORM":
            return (
                <MessageSquareText size={15} />
            );

        default:
            return (
                <MessageCircle size={15} />
            );
    }
}

function normalizeMessages(
    messages: unknown
): MessageDraft[] {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages
        .map((rawMessage) => {
            if (
                !rawMessage ||
                typeof rawMessage !== "object"
            ) {
                return null;
            }

            const message =
                rawMessage as Record<
                    string,
                    unknown
                >;

            const rawQuickReplies =
                Array.isArray(
                    message.quickReplies
                )
                    ? message.quickReplies
                    : [];

            const quickReplies =
                rawQuickReplies
                    .map((rawQuickReply) => {
                        if (
                            !rawQuickReply ||
                            typeof rawQuickReply !==
                            "object"
                        ) {
                            return null;
                        }

                        const quickReply =
                            rawQuickReply as Record<
                                string,
                                unknown
                            >;

                        return {
                            id:
                                typeof quickReply.id ===
                                    "string"
                                    ? quickReply.id
                                    : createLocalId(
                                        "quick"
                                    ),

                            title:
                                typeof quickReply.title ===
                                    "string"
                                    ? quickReply.title
                                    : "",

                            payload:
                                typeof quickReply.payload ===
                                    "string"
                                    ? quickReply.payload
                                    : createLocalId(
                                        "payload"
                                    ),

                            nextMessageId:
                                typeof quickReply.nextMessageId ===
                                    "string"
                                    ? quickReply.nextMessageId
                                    : null,
                        };
                    })
                    .filter(
                        (
                            item
                        ): item is QuickReplyDraft =>
                            item !== null
                    );

            const rawMessageType =
                message.messageType;

            const messageType: MessageType =
                rawMessageType === "IMAGE" ||
                    rawMessageType === "VIDEO" ||
                    rawMessageType === "AUDIO" ||
                    rawMessageType ===
                    "SHOWCASE" ||
                    rawMessageType === "FORM"
                    ? rawMessageType
                    : "TEXT";

            return {
                id:
                    typeof message.id ===
                        "string"
                        ? message.id
                        : createLocalId(
                            "message"
                        ),

                messageType,

                text:
                    typeof message.text ===
                        "string"
                        ? message.text
                        : "",

                mediaUrl:
                    typeof message.mediaUrl ===
                        "string"
                        ? message.mediaUrl
                        : "",

                mediaId:
                    typeof message.mediaId ===
                        "string"
                        ? message.mediaId
                        : "",

                showcaseId:
                    typeof message.showcaseId ===
                        "string"
                        ? message.showcaseId
                        : "",

                formId:
                    typeof message.formId ===
                        "string"
                        ? message.formId
                        : "",

                quickReplies,
            };
        })
        .filter(
            (
                item
            ): item is MessageDraft =>
                item !== null
        );
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function AutomationForm({
    account,
    automation,
    onClose,
    onCreated,
    onUpdated,
}: Props) {
    const automationId =
        automation?.id ?? null;

    const isEditing =
        automationId !== null;

    const [triggerType, setTriggerType] =
        useState<AutomationTriggerType>(
            getDefaultTrigger(automation)
        );

    const [keyword, setKeyword] = useState(
        automation?.keyword ?? ""
    );

    const [mediaId, setMediaId] = useState(
        automation?.mediaId ?? ""
    );

    const [
        commentReplyText,
        setCommentReplyText,
    ] = useState(
        automation?.commentReplyText ?? ""
    );

    const [replyText, setReplyText] = useState(
        automation?.replyText ?? ""
    );

    const [likeComment, setLikeComment] =
        useState(
            automation?.likeComment ?? false
        );

    const [
        likeIncomingDm,
        setLikeIncomingDm,
    ] = useState(
        automation?.likeIncomingDm ?? false
    );

    const [isActive, setIsActive] =
        useState(
            automation?.isActive ?? true
        );

    const [media, setMedia] = useState<
        InstagramMedia[]
    >([]);

    const [showcases, setShowcases] =
        useState<Showcase[]>([]);

    const [forms, setForms] = useState<
        FormItem[]
    >([]);

    const [messages, setMessages] =
        useState<MessageDraft[]>([]);

    const [loadingMedia, setLoadingMedia] =
        useState(true);

    const [loadingResources, setLoadingResources] =
        useState(false);

    const [loadingMessages, setLoadingMessages] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const isComment =
        triggerType ===
        "COMMENT_KEYWORD";

    const isDm =
        triggerType === "DM";

    const isStory =
        triggerType ===
        "STORY_REPLY_KEYWORD";

    const messageOptions = useMemo(
        () =>
            messages.map(
                (
                    message,
                    index
                ) => ({
                    id: message.id,
                    label: `پیام ${index + 1
                        } — ${getMessageTypeLabel(
                            message.messageType
                        )}`,
                })
            ),
        [messages]
    );

    /* ---------------------------------------------------------------------- */
    /* Load Instagram Media                                                   */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        let cancelled = false;

        async function loadMedia() {
            try {
                setLoadingMedia(true);

                const response =
                    await fetch(
                        `/api/instagram/media?instagramAccountId=${encodeURIComponent(
                            account.id
                        )}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.error ||
                        result.message ||
                        "دریافت Media ها ناموفق بود."
                    );
                }

                if (!cancelled) {
                    setMedia(
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : []
                    );
                }
            } catch (error) {
                console.error(
                    "load instagram media error:",
                    error
                );

                if (!cancelled) {
                    setMedia([]);
                }
            } finally {
                if (!cancelled) {
                    setLoadingMedia(false);
                }
            }
        }

        loadMedia();

        return () => {
            cancelled = true;
        };
    }, [account.id]);

    /* ---------------------------------------------------------------------- */
    /* Load Showcase + Forms                                                  */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        let cancelled = false;

        async function loadResources() {
            try {
                setLoadingResources(true);

                const [
                    showcaseResponse,
                    formResponse,
                ] = await Promise.all([
                    fetch(
                        `/api/showcases?instagramAccountId=${encodeURIComponent(
                            account.id
                        )}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
                        }
                    ),

                    fetch(
                        `/api/forms?instagramAccountId=${encodeURIComponent(
                            account.id
                        )}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
                        }
                    ),
                ]);

                const showcaseResult =
                    await showcaseResponse.json();

                const formResult =
                    await formResponse.json();

                if (cancelled) {
                    return;
                }

                if (
                    showcaseResponse.ok &&
                    showcaseResult.success
                ) {
                    setShowcases(
                        Array.isArray(
                            showcaseResult.data
                        )
                            ? showcaseResult.data
                            : []
                    );
                } else {
                    setShowcases([]);
                }

                if (
                    formResponse.ok &&
                    formResult.success
                ) {
                    setForms(
                        Array.isArray(
                            formResult.data
                        )
                            ? formResult.data
                            : []
                    );
                } else {
                    setForms([]);
                }
            } catch (error) {
                console.error(
                    "load automation resources error:",
                    error
                );

                if (!cancelled) {
                    setShowcases([]);
                    setForms([]);
                }
            } finally {
                if (!cancelled) {
                    setLoadingResources(false);
                }
            }
        }

        loadResources();

        return () => {
            cancelled = true;
        };
    }, [account.id]);

    /* ---------------------------------------------------------------------- */
    /* Load Existing Flow                                                     */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        if (!automationId) {
            return;
        }

        let cancelled = false;

        async function loadAutomation() {
            try {
                setLoadingMessages(true);

                const response =
                    await fetch(
                        `/api/automations/${automationId}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.error ||
                        result.message ||
                        "دریافت Flow ناموفق بود."
                    );
                }

                const loadedMessages =
                    result.data?.messages;

                const normalized =
                    normalizeMessages(
                        loadedMessages
                    );

                if (!cancelled) {
                    setMessages(
                        normalized
                    );
                }
            } catch (error) {
                console.error(
                    "load automation messages error:",
                    error
                );

                if (!cancelled) {
                    setMessages([]);
                }
            } finally {
                if (!cancelled) {
                    setLoadingMessages(false);
                }
            }
        }

        loadAutomation();

        return () => {
            cancelled = true;
        };
    }, [automationId]);

    /* ---------------------------------------------------------------------- */
    /* Trigger                                                                 */
    /* ---------------------------------------------------------------------- */

    function handleTriggerChange(
        value: AutomationTriggerType
    ) {
        setTriggerType(value);
        setError("");

        if (value === "DM") {
            setKeyword("");
            setMediaId("");
            setCommentReplyText("");
            setLikeComment(false);
        }

        if (
            value ===
            "STORY_REPLY_KEYWORD"
        ) {
            setCommentReplyText("");
            setLikeComment(false);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Flow                                                                    */
    /* ---------------------------------------------------------------------- */

    function addMessage() {
        setMessages((current) => [
            ...current,
            createEmptyMessage(),
        ]);
    }

    function removeMessage(
        messageId: string
    ) {
        setMessages((current) => {
            const filtered =
                current.filter(
                    (message) =>
                        message.id !==
                        messageId
                );

            return filtered.map(
                (message) => ({
                    ...message,
                    quickReplies:
                        message.quickReplies.map(
                            (
                                quickReply
                            ) =>
                                quickReply.nextMessageId ===
                                    messageId
                                    ? {
                                        ...quickReply,
                                        nextMessageId:
                                            null,
                                    }
                                    : quickReply
                        ),
                })
            );
        });
    }

    function updateMessage(
        messageId: string,
        patch: Partial<MessageDraft>
    ) {
        setMessages((current) =>
            current.map(
                (message) =>
                    message.id ===
                        messageId
                        ? {
                            ...message,
                            ...patch,
                        }
                        : message
            )
        );
    }

    function moveMessage(
        messageId: string,
        direction: "up" | "down"
    ) {
        setMessages((current) => {
            const index =
                current.findIndex(
                    (message) =>
                        message.id ===
                        messageId
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

            const [
                movedMessage,
            ] = next.splice(
                index,
                1
            );

            next.splice(
                targetIndex,
                0,
                movedMessage
            );

            return next;
        });
    }

    function addQuickReply(
        messageId: string
    ) {
        setMessages((current) =>
            current.map(
                (message) =>
                    message.id ===
                        messageId
                        ? {
                            ...message,
                            quickReplies:
                                [
                                    ...message.quickReplies,
                                    createEmptyQuickReply(),
                                ],
                        }
                        : message
            )
        );
    }

    function updateQuickReply(
        messageId: string,
        quickReplyId: string,
        patch: Partial<QuickReplyDraft>
    ) {
        setMessages((current) =>
            current.map((message) => {
                if (
                    message.id !==
                    messageId
                ) {
                    return message;
                }

                return {
                    ...message,
                    quickReplies:
                        message.quickReplies.map(
                            (
                                quickReply
                            ) =>
                                quickReply.id ===
                                    quickReplyId
                                    ? {
                                        ...quickReply,
                                        ...patch,
                                    }
                                    : quickReply
                        ),
                };
            })
        );
    }

    function removeQuickReply(
        messageId: string,
        quickReplyId: string
    ) {
        setMessages((current) =>
            current.map(
                (message) =>
                    message.id ===
                        messageId
                        ? {
                            ...message,
                            quickReplies:
                                message.quickReplies.filter(
                                    (
                                        quickReply
                                    ) =>
                                        quickReply.id !==
                                        quickReplyId
                                ),
                        }
                        : message
            )
        );
    }

    /* ---------------------------------------------------------------------- */
    /* Validate Flow                                                           */
    /* ---------------------------------------------------------------------- */

    function validateMessages() {
        for (
            let index = 0;
            index < messages.length;
            index++
        ) {
            const message =
                messages[index];

            if (
                message.messageType ===
                "TEXT" &&
                !message.text.trim()
            ) {
                return `متن پیام ${index + 1
                    } را وارد کنید.`;
            }

            if (
                (
                    message.messageType ===
                    "IMAGE" ||
                    message.messageType ===
                    "VIDEO" ||
                    message.messageType ===
                    "AUDIO"
                ) &&
                !message.mediaUrl.trim() &&
                !message.mediaId.trim()
            ) {
                return `برای پیام ${index + 1
                    } آدرس Media یا Media ID را وارد کنید.`;
            }

            if (
                message.messageType ===
                "SHOWCASE" &&
                !message.showcaseId
            ) {
                return `برای پیام ${index + 1
                    } یک ویترین انتخاب کنید.`;
            }

            if (
                message.messageType ===
                "FORM" &&
                !message.formId
            ) {
                return `برای پیام ${index + 1
                    } یک فرم انتخاب کنید.`;
            }

            for (
                const quickReply of
                message.quickReplies
            ) {
                if (
                    !quickReply.title.trim()
                ) {
                    return `عنوان یکی از Quick Reply های پیام ${index + 1
                        } را وارد کنید.`;
                }

                if (
                    quickReply.title
                        .trim()
                        .length > 20
                ) {
                    return `عنوان Quick Reply پیام ${index + 1
                        } نباید بیشتر از ۲۰ کاراکتر باشد.`;
                }

                if (
                    !quickReply.nextMessageId
                ) {
                    return `برای Quick Reply «${quickReply.title}» مقصد پیام را انتخاب کنید.`;
                }

                if (
                    quickReply.nextMessageId ===
                    message.id
                ) {
                    return `Quick Reply «${quickReply.title}» نمی‌تواند به همان پیام برگردد.`;
                }

                const destinationExists =
                    messages.some(
                        (
                            destination
                        ) =>
                            destination.id ===
                            quickReply.nextMessageId
                    );

                if (
                    !destinationExists
                ) {
                    return `مقصد Quick Reply «${quickReply.title}» معتبر نیست.`;
                }
            }
        }

        /* ------------------------------------------------------------------ */
        /* Cycle Detection                                                    */
        /* ------------------------------------------------------------------ */

        const edges = new Map<
            string,
            string[]
        >();

        messages.forEach(
            (message) => {
                edges.set(
                    message.id,
                    message.quickReplies
                        .map(
                            (
                                quickReply
                            ) =>
                                quickReply.nextMessageId
                        )
                        .filter(
                            (
                                id
                            ): id is string =>
                                Boolean(id)
                        )
                );
            }
        );

        function hasCycle(
            start: string,
            current: string,
            visited: Set<string>
        ): boolean {
            if (
                current === start &&
                visited.size > 0
            ) {
                return true;
            }

            if (
                visited.has(current)
            ) {
                return false;
            }

            visited.add(current);

            const destinations =
                edges.get(
                    current
                ) ?? [];

            for (
                const destination of
                destinations
            ) {
                if (
                    hasCycle(
                        start,
                        destination,
                        new Set(
                            visited
                        )
                    )
                ) {
                    return true;
                }
            }

            return false;
        }

        for (
            const message of messages
        ) {
            if (
                hasCycle(
                    message.id,
                    message.id,
                    new Set()
                )
            ) {
                return "در Flow یک چرخه بین پیام‌ها وجود دارد. مقصد Quick Reply ها را اصلاح کنید.";
            }
        }

        return null;
    }

    /* ---------------------------------------------------------------------- */
    /* Sync Messages                                                          */
    /* ---------------------------------------------------------------------- */

    async function syncMessages(
        automationId: string
    ) {
        if (
            messages.length === 0
        ) {
            return;
        }

        /*
         * در حالت ویرایش:
         * Message های قبلی حذف می‌شوند.
         */
        if (isEditing) {
            const existingResponse =
                await fetch(
                    `/api/automations/${automationId}`,
                    {
                        cache: "no-store",
                        credentials:
                            "include",
                    }
                );

            const existingResult =
                await existingResponse.json();

            if (
                !existingResponse.ok ||
                !existingResult.success
            ) {
                throw new Error(
                    existingResult.error ||
                    existingResult.message ||
                    "دریافت Flow قبلی ناموفق بود."
                );
            }

            const existingMessages =
                existingResult.data
                    ?.messages;

            if (
                Array.isArray(
                    existingMessages
                )
            ) {
                for (
                    const existingMessage of
                    existingMessages
                ) {
                    if (
                        !existingMessage ||
                        typeof existingMessage.id !==
                        "string"
                    ) {
                        continue;
                    }

                    const deleteResponse =
                        await fetch(
                            `/api/automations/${automationId}/messages/${existingMessage.id}`,
                            {
                                method: "DELETE",
                                credentials:
                                    "include",
                            }
                        );

                    if (
                        !deleteResponse.ok
                    ) {
                        let deleteResult:
                            Record<
                                string,
                                unknown
                            > = {};

                        try {
                            deleteResult =
                                await deleteResponse.json();
                        } catch {
                            // Ignore invalid JSON.
                        }

                        throw new Error(
                            typeof deleteResult.error ===
                                "string"
                                ? deleteResult.error
                                : typeof deleteResult.message ===
                                    "string"
                                    ? deleteResult.message
                                    : "حذف Flow قبلی ناموفق بود."
                        );
                    }
                }
            }
        }

        /*
         * local message ID -> server message ID
         */
        const serverMessageIds =
            new Map<
                string,
                string
            >();

        /* ------------------------------------------------------------------ */
        /* Step 1: Create Messages                                             */
        /* ------------------------------------------------------------------ */

        for (
            let index = 0;
            index < messages.length;
            index++
        ) {
            const message =
                messages[index];

            const response =
                await fetch(
                    `/api/automations/${automationId}/messages`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        credentials:
                            "include",
                        body: JSON.stringify({
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
                        }),
                    }
                );

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.error ||
                    result.message ||
                    `ذخیره پیام ${index + 1
                    } ناموفق بود.`
                );
            }

            if (
                !result.data?.id ||
                typeof result.data.id !==
                "string"
            ) {
                throw new Error(
                    `شناسه پیام ${index + 1
                    } از سرور دریافت نشد.`
                );
            }

            serverMessageIds.set(
                message.id,
                result.data.id
            );
        }

        /* ------------------------------------------------------------------ */
        /* Step 2: Create Quick Replies                                       */
        /* ------------------------------------------------------------------ */

        for (
            const message of messages
        ) {
            const serverMessageId =
                serverMessageIds.get(
                    message.id
                );

            if (!serverMessageId) {
                continue;
            }

            for (
                const quickReply of
                message.quickReplies
            ) {
                const destinationId =
                    quickReply.nextMessageId
                        ? serverMessageIds.get(
                            quickReply.nextMessageId
                        ) ?? null
                        : null;

                if (!destinationId) {
                    throw new Error(
                        `مقصد Quick Reply «${quickReply.title}» پیدا نشد.`
                    );
                }

                const response =
                    await fetch(
                        `/api/automations/${automationId}/messages/${serverMessageId}/quick-replies`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            credentials:
                                "include",
                            body: JSON.stringify({
                                title:
                                    quickReply.title.trim(),

                                payload:
                                    quickReply.payload,

                                nextMessageId:
                                    destinationId,
                            }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.error ||
                        result.message ||
                        `ذخیره Quick Reply «${quickReply.title}» ناموفق بود.`
                    );
                }
            }
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Submit                                                                  */
    /* ---------------------------------------------------------------------- */

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");

        const requiresKeyword =
            isComment || isStory;

        if (
            requiresKeyword &&
            !keyword.trim()
        ) {
            setError(
                "کلمه کلیدی را وارد کنید."
            );
            return;
        }

        if (
            isComment &&
            !commentReplyText.trim() &&
            !replyText.trim() &&
            !likeComment &&
            messages.length === 0
        ) {
            setError(
                "حداقل یک Action یا Flow برای کامنت انتخاب کنید."
            );
            return;
        }

        if (
            isDm &&
            !replyText.trim() &&
            messages.length === 0
        ) {
            setError(
                "برای Automation دایرکت حداقل یک پیام یا Flow بسازید."
            );
            return;
        }

        if (
            isStory &&
            !replyText.trim() &&
            messages.length === 0
        ) {
            setError(
                "برای پاسخ استوری حداقل یک پیام یا Flow بسازید."
            );
            return;
        }

        const messageValidation =
            validateMessages();

        if (messageValidation) {
            setError(
                messageValidation
            );
            return;
        }

        try {
            setSaving(true);

            const url = isEditing
                ? `/api/automations/${automationId}`
                : "/api/automations";

            const response =
                await fetch(url, {
                    method: isEditing
                        ? "PATCH"
                        : "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    credentials:
                        "include",

                    body: JSON.stringify({
                        instagramAccountId:
                            account.id,

                        triggerType,

                        mediaId:
                            mediaId.trim() ||
                            null,

                        keyword:
                            keyword.trim() ||
                            null,

                        commentReplyText:
                            commentReplyText.trim() ||
                            null,

                        replyText:
                            replyText.trim() ||
                            null,

                        likeComment,

                        sendDm:
                            Boolean(
                                replyText.trim() ||
                                messages.length >
                                0
                            ),

                        likeIncomingDm,

                        isActive,
                    }),
                });

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.error ||
                    result.message ||
                    "ذخیره Automation ناموفق بود."
                );
            }

            const savedAutomation =
                result.data as Automation;

            /*
             * Flow
             */
            if (
                messages.length > 0
            ) {
                await syncMessages(
                    savedAutomation.id
                );
            } else if (
                isEditing
            ) {
                /*
                 * اگر کاربر تمام Flow را پاک
                 * کرده باشد، باید Message های
                 * قبلی هم حذف شوند.
                 */
                const existingResponse =
                    await fetch(
                        `/api/automations/${savedAutomation.id}`,
                        {
                            cache: "no-store",
                            credentials:
                                "include",
                        }
                    );

                const existingResult =
                    await existingResponse.json();

                if (
                    existingResponse.ok &&
                    existingResult.success &&
                    Array.isArray(
                        existingResult.data
                            ?.messages
                    )
                ) {
                    for (
                        const existingMessage of
                        existingResult
                            .data.messages
                    ) {
                        if (
                            !existingMessage?.id
                        ) {
                            continue;
                        }

                        await fetch(
                            `/api/automations/${savedAutomation.id}/messages/${existingMessage.id}`,
                            {
                                method: "DELETE",
                                credentials:
                                    "include",
                            }
                        );
                    }
                }
            }

            /*
             * Automation نهایی را دوباره
             * از API دریافت می‌کنیم.
             */
            const finalResponse =
                await fetch(
                    `/api/automations/${savedAutomation.id}`,
                    {
                        cache: "no-store",
                        credentials:
                            "include",
                    }
                );

            const finalResult =
                await finalResponse.json();

            const finalAutomation =
                finalResponse.ok &&
                    finalResult.success
                    ? (finalResult.data as Automation)
                    : savedAutomation;

            if (isEditing) {
                onUpdated(
                    finalAutomation
                );
            } else {
                onCreated(
                    finalAutomation
                );
            }
        } catch (error) {
            console.error(
                "save automation error:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "خطای ناشناخته رخ داد."
            );
        } finally {
            setSaving(false);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* UI                                                                      */
    /* ---------------------------------------------------------------------- */

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* Header */}

                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {isEditing
                                ? "ویرایش Automation"
                                : "ساخت Automation"}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            @
                            {
                                account.igUsername
                            }
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
                        aria-label="بستن"
                    >
                        <X size={19} />
                    </button>
                </div>

                <form
                    onSubmit={
                        handleSubmit
                    }
                    className="min-h-0 space-y-7 overflow-y-auto p-5 sm:p-6"
                >
                    {/* Trigger */}

                    <section>
                        <label className="mb-3 block text-sm font-medium text-gray-800">
                            نوع Trigger
                        </label>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <TriggerOption
                                active={
                                    isComment
                                }
                                title="کامنت"
                                description="وقتی کاربر یک عبارت را کامنت کند"
                                onClick={() =>
                                    handleTriggerChange(
                                        "COMMENT_KEYWORD"
                                    )
                                }
                            />

                            <TriggerOption
                                active={
                                    isDm
                                }
                                title="دایرکت"
                                description="وقتی کاربر وارد گفتگو شود"
                                onClick={() =>
                                    handleTriggerChange(
                                        "DM"
                                    )
                                }
                            />

                            <TriggerOption
                                active={
                                    isStory
                                }
                                title="پاسخ استوری"
                                description="وقتی کاربر به استوری پاسخ دهد"
                                onClick={() =>
                                    handleTriggerChange(
                                        "STORY_REPLY_KEYWORD"
                                    )
                                }
                            />
                        </div>
                    </section>

                    {/* Media + Keyword */}

                    {(isComment ||
                        isStory) && (
                            <section className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-800">
                                        {isComment
                                            ? "پست مورد نظر"
                                            : "استوری / Media مورد نظر"}
                                    </label>

                                    {loadingMedia ? (
                                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                                            <Loader2
                                                size={
                                                    16
                                                }
                                                className="animate-spin"
                                            />

                                            در حال دریافت
                                            Media ها...
                                        </div>
                                    ) : media.length ===
                                        0 ? (
                                        <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                                            Media ای برای
                                            این اکانت پیدا
                                            نشد.
                                        </div>
                                    ) : (
                                        <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                                            {media.map(
                                                (
                                                    item
                                                ) => {
                                                    const image =
                                                        item.media_type ===
                                                            "VIDEO" ||
                                                            item.media_product_type ===
                                                            "REELS"
                                                            ? item.thumbnail_url
                                                            : item.media_url;

                                                    const selected =
                                                        mediaId ===
                                                        item.id;

                                                    return (
                                                        <button
                                                            key={
                                                                item.id
                                                            }
                                                            type="button"
                                                            onClick={() =>
                                                                setMediaId(
                                                                    selected
                                                                        ? ""
                                                                        : item.id
                                                                )
                                                            }
                                                            className={[
                                                                "overflow-hidden rounded-xl border text-right transition",
                                                                selected
                                                                    ? "border-gray-900 ring-2 ring-gray-900/10"
                                                                    : "border-gray-200 hover:border-gray-400",
                                                            ].join(
                                                                " "
                                                            )}
                                                        >
                                                            <div className="aspect-square bg-gray-100">
                                                                {image ? (
                                                                    <img
                                                                        src={
                                                                            image
                                                                        }
                                                                        alt={
                                                                            item.caption ||
                                                                            "Instagram media"
                                                                        }
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                                                        بدون
                                                                        تصویر
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="p-2">
                                                                <p className="line-clamp-2 text-xs text-gray-600">
                                                                    {item.caption ||
                                                                        "بدون کپشن"}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-800">
                                        کلمه یا عبارت Trigger
                                    </label>

                                    <input
                                        value={
                                            keyword
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setKeyword(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder="مثلاً 1"
                                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
                                    />

                                    <p className="mt-2 text-xs leading-5 text-gray-400">
                                        {isComment
                                            ? "وقتی کاربر این عبارت را در کامنت وارد کند، Automation اجرا می‌شود."
                                            : "وقتی کاربر این عبارت را در پاسخ استوری ارسال کند، Automation اجرا می‌شود."}
                                    </p>
                                </div>
                            </section>
                        )}

                    {/* Comment Actions */}

                    {isComment && (
                        <section className="border-t border-gray-100 pt-6">
                            <h3 className="mb-4 text-sm font-semibold text-gray-900">
                                Actions کامنت
                            </h3>

                            <div className="space-y-4">
                                <label className="block rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(
                                                commentReplyText.trim()
                                            )}
                                            onChange={(
                                                event
                                            ) => {
                                                if (
                                                    event
                                                        .target
                                                        .checked
                                                ) {
                                                    if (
                                                        !commentReplyText.trim()
                                                    ) {
                                                        setCommentReplyText(
                                                            "ممنون از کامنت شما."
                                                        );
                                                    }
                                                } else {
                                                    setCommentReplyText(
                                                        ""
                                                    );
                                                }
                                            }}
                                            className="mt-1"
                                        />

                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">
                                                پاسخ عمومی به کامنت
                                            </div>

                                            <textarea
                                                value={
                                                    commentReplyText
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setCommentReplyText(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="متن پاسخ عمومی..."
                                                className="mt-3 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                                            />
                                        </div>
                                    </div>
                                </label>

                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                    <input
                                        type="checkbox"
                                        checked={
                                            likeComment
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setLikeComment(
                                                event
                                                    .target
                                                    .checked
                                            )
                                        }
                                        className="mt-1"
                                    />

                                    <div>
                                        <div className="text-sm font-medium text-gray-900">
                                            لایک کردن کامنت
                                        </div>

                                        <p className="mt-1 text-xs leading-5 text-gray-500">
                                            بعد از تأیید Permission
                                            و تست API فعال
                                            می‌شود.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </section>
                    )}

                    {/* Direct Reply */}

                    <section className="border-t border-gray-100 pt-6">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-gray-900">
                                پاسخ مستقیم
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-gray-400">
                                برای پاسخ ساده می‌توانید
                                مستقیماً متن وارد کنید.
                                برای پاسخ چندمرحله‌ای از
                                Flow استفاده کنید.
                            </p>
                        </div>

                        <textarea
                            value={replyText}
                            onChange={(
                                event
                            ) =>
                                setReplyText(
                                    event
                                        .target
                                        .value
                                )
                            }
                            placeholder={
                                isDm
                                    ? "مثلاً سلام، چطور می‌تونم کمکتون کنم؟"
                                    : "متن دایرکت..."
                            }
                            className="min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none focus:border-gray-900"
                        />

                        {isDm && (
                            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                <input
                                    type="checkbox"
                                    checked={
                                        likeIncomingDm
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setLikeIncomingDm(
                                            event
                                                .target
                                                .checked
                                        )
                                    }
                                    className="mt-1"
                                />

                                <div>
                                    <div className="text-sm font-medium text-gray-900">
                                        لایک کردن پیام ورودی
                                    </div>

                                    <p className="mt-1 text-xs leading-5 text-gray-500">
                                        این Action فعلاً
                                        فقط ذخیره می‌شود
                                        و بعد از تأیید API
                                        اجرا خواهد شد.
                                    </p>
                                </div>
                            </label>
                        )}
                    </section>

                    {/* Flow Builder */}

                    <section className="border-t border-gray-100 pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">
                                    Flow پیام‌ها
                                </h3>

                                <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-400">
                                    پیام‌ها را بسازید و با
                                    Quick Reply مشخص کنید
                                    هر انتخاب کاربر به کدام
                                    پیام منتقل شود.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    addMessage
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-black"
                            >
                                <Plus
                                    size={
                                        15
                                    }
                                />

                                افزودن پیام
                            </button>
                        </div>

                        {loadingMessages ? (
                            <div className="mt-5 flex items-center justify-center rounded-xl border border-gray-200 p-10 text-sm text-gray-500">
                                <Loader2
                                    size={
                                        18
                                    }
                                    className="ml-2 animate-spin"
                                />

                                در حال دریافت Flow...
                            </div>
                        ) : messages.length ===
                            0 ? (
                            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 px-5 py-10 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
                                    <MessageSquareText
                                        size={
                                            21
                                        }
                                    />
                                </div>

                                <h4 className="mt-4 text-sm font-semibold text-gray-800">
                                    هنوز پیامی به Flow اضافه نشده
                                </h4>

                                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-gray-400">
                                    برای Automation دایرکت،
                                    پیام اول را بسازید و
                                    سپس برای آن Quick Reply
                                    اضافه کنید.
                                </p>

                                <button
                                    type="button"
                                    onClick={
                                        addMessage
                                    }
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-gray-400"
                                >
                                    <Plus
                                        size={
                                            15
                                        }
                                    />

                                    ساخت پیام اول
                                </button>
                            </div>
                        ) : (
                            <div className="mt-5 space-y-4">
                                {messages.map(
                                    (
                                        message,
                                        index
                                    ) => (
                                        <FlowMessageCard
                                            key={
                                                message.id
                                            }
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
                                                patch
                                            ) =>
                                                updateMessage(
                                                    message.id,
                                                    patch
                                                )
                                            }
                                            onRemove={() =>
                                                removeMessage(
                                                    message.id
                                                )
                                            }
                                            onMoveUp={() =>
                                                moveMessage(
                                                    message.id,
                                                    "up"
                                                )
                                            }
                                            onMoveDown={() =>
                                                moveMessage(
                                                    message.id,
                                                    "down"
                                                )
                                            }
                                            onAddQuickReply={() =>
                                                addQuickReply(
                                                    message.id
                                                )
                                            }
                                            onUpdateQuickReply={(
                                                quickReplyId,
                                                patch
                                            ) =>
                                                updateQuickReply(
                                                    message.id,
                                                    quickReplyId,
                                                    patch
                                                )
                                            }
                                            onRemoveQuickReply={(
                                                quickReplyId
                                            ) =>
                                                removeQuickReply(
                                                    message.id,
                                                    quickReplyId
                                                )
                                            }
                                        />
                                    )
                                )}

                                <button
                                    type="button"
                                    onClick={
                                        addMessage
                                    }
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-xs font-medium text-gray-500 transition hover:border-gray-500 hover:text-gray-800"
                                >
                                    <Plus
                                        size={
                                            15
                                        }
                                    />

                                    افزودن پیام بعدی
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Active */}

                    <label className="flex cursor-pointer items-center gap-3 border-t border-gray-100 pt-5">
                        <input
                            type="checkbox"
                            checked={
                                isActive
                            }
                            onChange={(
                                event
                            ) =>
                                setIsActive(
                                    event
                                        .target
                                        .checked
                                )
                            }
                        />

                        <span className="text-sm text-gray-800">
                            Automation فعال باشد
                        </span>
                    </label>

                    {/* Error */}

                    {error && (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Footer */}

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={
                                onClose
                            }
                            disabled={
                                saving
                            }
                            className="rounded-xl border border-gray-200 px-5 py-3 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                            انصراف
                        </button>

                        <button
                            type="submit"
                            disabled={
                                saving
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving && (
                                <Loader2
                                    size={
                                        16
                                    }
                                    className="animate-spin"
                                />
                            )}

                            {saving
                                ? "در حال ذخیره..."
                                : isEditing
                                    ? "ذخیره تغییرات"
                                    : "ساخت Automation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Trigger Option                                                             */
/* -------------------------------------------------------------------------- */

function TriggerOption({
    active,
    title,
    description,
    onClick,
}: {
    active: boolean;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "rounded-xl border p-4 text-right transition",
                active
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400",
            ].join(" ")}
        >
            <div className="text-sm font-semibold">
                {title}
            </div>

            <div
                className={[
                    "mt-1 text-xs leading-5",
                    active
                        ? "text-slate-300"
                        : "text-slate-400",
                ].join(" ")}
            >
                {description}
            </div>
        </button>
    );
}

/* -------------------------------------------------------------------------- */
/* Flow Message Card                                                          */
/* -------------------------------------------------------------------------- */

function FlowMessageCard({
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
}: {
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
}) {
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
                        onClick={
                            onMoveUp
                        }
                        disabled={
                            index === 0
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="انتقال به بالا"
                    >
                        <ArrowUp
                            size={
                                15
                            }
                        />
                    </button>

                    <button
                        type="button"
                        onClick={
                            onMoveDown
                        }
                        disabled={
                            index ===
                            total - 1
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="انتقال به پایین"
                    >
                        <ArrowDown
                            size={
                                15
                            }
                        />
                    </button>

                    <button
                        type="button"
                        onClick={
                            onRemove
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="حذف پیام"
                    >
                        <Trash2
                            size={
                                15
                            }
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
                        ] as MessageType[]
                    ).map(
                        (
                            type
                        ) => (
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
                                    size={
                                        15
                                    }
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
                            ویترین مستقل ذخیره می‌شود و می‌تواند
                            در چند Automation استفاده شود.
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
                                    size={
                                        15
                                    }
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
                            فرم مستقل ذخیره می‌شود و پاسخ‌های
                            مشتری در FormSubmission ثبت خواهند شد.
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
                            messageOptions.length <
                            2
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Plus
                            size={
                                13
                            }
                        />

                        افزودن گزینه
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
                                                        size={
                                                            14
                                                        }
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
