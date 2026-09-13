export type InstagramAccount = {
    id: string;
    igUsername: string;
};

export type InstagramMedia = {
    id: string;
    caption?: string | null;
    media_type?: string;
    media_product_type?: string;
    media_url?: string | null;
    thumbnail_url?: string | null;
    permalink?: string | null;
    timestamp?: string | null;
};

export type Showcase = {
    id: string;
    title: string;
    description?: string | null;
    isActive?: boolean;
    items?: unknown[];
};

export type FormItem = {
    id: string;
    title: string;
    description?: string | null;
    isActive?: boolean;
    fields?: unknown[];
};

export type MessageType =
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "AUDIO"
    | "SHOWCASE"
    | "FORM";

export type QuickReplyDraft = {
    id: string;
    title: string;
    payload: string;
    nextMessageId: string | null;
};

export type MessageDraft = {
    id: string;
    messageType: MessageType;
    text: string;
    mediaUrl: string;
    mediaId: string;
    showcaseId: string;
    formId: string;
    quickReplies: QuickReplyDraft[];
};

export type Automation = {
    id: string;
    instagramAccountId: string;
    triggerType: string;
    keyword?: string | null;
    mediaId?: string | null;
    commentReplyText?: string | null;
    replyText?: string | null;
    likeComment?: boolean;
    sendDm?: boolean;
    likeIncomingDm?: boolean;
    likeStoryReply?: boolean;
    isActive?: boolean;
    messages?: unknown;
    [key: string]: unknown;
};

export type AutomationFormProps = {
    account: InstagramAccount;
    automation?: Automation | null;
    onClose: () => void;
    onCreated: (automation: Automation) => void;
    onUpdated: (automation: Automation) => void;
};

/* ---------------------------------------------------------
 * Local IDs
 * --------------------------------------------------------- */

export function createLocalId(
    prefix = "local",
) {
    return `${prefix}_${crypto.randomUUID()}`;
}

/* ---------------------------------------------------------
 * Empty drafts
 * --------------------------------------------------------- */

export function createEmptyQuickReply(): QuickReplyDraft {
    return {
        id: createLocalId("quick_reply"),
        title: "",
        payload: createLocalId("payload"),
        nextMessageId: null,
    };
}

export function createEmptyMessage(): MessageDraft {
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

/* ---------------------------------------------------------
 * Trigger
 * --------------------------------------------------------- */

export function getDefaultTrigger(
    automation?: {
        triggerType?: string | null;
    } | null,
): "COMMENT_KEYWORD" | "DM" | "STORY_REPLY_KEYWORD" {
    const triggerType =
        automation?.triggerType;

    if (
        triggerType ===
        "COMMENT_KEYWORD"
    ) {
        return "COMMENT_KEYWORD";
    }

    if (
        triggerType ===
        "STORY_REPLY_KEYWORD"
    ) {
        return "STORY_REPLY_KEYWORD";
    }

    return "DM";
}

/* ---------------------------------------------------------
 * Message labels
 * --------------------------------------------------------- */

export function getMessageTypeLabel(
    type: MessageType,
) {
    switch (type) {
        case "TEXT":
            return "متن";

        case "IMAGE":
            return "تصویر";

        case "VIDEO":
            return "ویدیو";

        case "AUDIO":
            return "صوت";

        case "SHOWCASE":
            return "Showcase";

        case "FORM":
            return "فرم";

        default:
            return "پیام";
    }
}

/* ---------------------------------------------------------
 * Message icons
 * --------------------------------------------------------- */

export function getMessageIcon(
    type: MessageType,
) {
    switch (type) {
        case "TEXT":
            return "message";

        case "IMAGE":
            return "image";

        case "VIDEO":
            return "video";

        case "AUDIO":
            return "audio";

        case "SHOWCASE":
            return "showcase";

        case "FORM":
            return "form";

        default:
            return "message";
    }
}

/* ---------------------------------------------------------
 * Normalize messages returned by API
 * --------------------------------------------------------- */

export function normalizeMessages(
    value: unknown,
): MessageDraft[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((raw): MessageDraft | null => {
            if (
                !raw ||
                typeof raw !== "object"
            ) {
                return null;
            }

            const item =
                raw as Record<
                    string,
                    unknown
                >;

            const rawType =
                typeof item.messageType ===
                    "string"
                    ? item.messageType
                    : "TEXT";

            const messageType: MessageType =
                MESSAGE_TYPES.includes(
                    rawType as MessageType,
                )
                    ? (rawType as MessageType)
                    : "TEXT";

            const rawQuickReplies =
                Array.isArray(
                    item.quickReplies,
                )
                    ? item.quickReplies
                    : [];

            const quickReplies =
                rawQuickReplies
                    .map(
                        (
                            rawQuickReply,
                        ): QuickReplyDraft | null => {
                            if (
                                !rawQuickReply ||
                                typeof rawQuickReply !==
                                "object"
                            ) {
                                return null;
                            }

                            const qr =
                                rawQuickReply as Record<
                                    string,
                                    unknown
                                >;

                            return {
                                id:
                                    typeof qr.id ===
                                        "string"
                                        ? qr.id
                                        : createLocalId(
                                            "quick_reply",
                                        ),

                                title:
                                    typeof qr.title ===
                                        "string"
                                        ? qr.title
                                        : "",

                                payload:
                                    typeof qr.payload ===
                                        "string"
                                        ? qr.payload
                                        : createLocalId(
                                            "payload",
                                        ),

                                nextMessageId:
                                    typeof qr.nextMessageId ===
                                        "string"
                                        ? qr.nextMessageId
                                        : null,
                            };
                        },
                    )
                    .filter(
                        (
                            item,
                        ): item is QuickReplyDraft =>
                            item !== null,
                    );

            return {
                id:
                    typeof item.id ===
                        "string"
                        ? item.id
                        : createLocalId(
                            "message",
                        ),

                messageType,

                text:
                    typeof item.text ===
                        "string"
                        ? item.text
                        : "",

                mediaUrl:
                    typeof item.mediaUrl ===
                        "string"
                        ? item.mediaUrl
                        : "",

                mediaId:
                    typeof item.mediaId ===
                        "string"
                        ? item.mediaId
                        : "",

                showcaseId:
                    typeof item.showcaseId ===
                        "string"
                        ? item.showcaseId
                        : "",

                formId:
                    typeof item.formId ===
                        "string"
                        ? item.formId
                        : "",

                quickReplies,
            };
        })
        .filter(
            (
                item,
            ): item is MessageDraft =>
                item !== null,
        );
}

/* ---------------------------------------------------------
 * Flow validation
 * --------------------------------------------------------- */

export function validateMessages(
    messages: MessageDraft[],
) {
    if (messages.length === 0) {
        throw new Error(
            "حداقل یک پیام اضافه کنید.",
        );
    }

    const messageIds =
        new Set(
            messages.map(
                (message) =>
                    message.id,
            ),
        );

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

        const messageNumber =
            index + 1;

        switch (
        message.messageType
        ) {
            case "TEXT":
                if (
                    !message.text.trim()
                ) {
                    throw new Error(
                        `متن پیام ${messageNumber} را وارد کنید.`,
                    );
                }
                break;

            case "IMAGE":
            case "VIDEO":
            case "AUDIO":
                if (
                    !message.mediaUrl.trim() &&
                    !message.mediaId.trim()
                ) {
                    throw new Error(
                        `برای پیام ${messageNumber}، Media URL یا Media ID را وارد کنید.`,
                    );
                }
                break;

            case "SHOWCASE":
                if (
                    !message.showcaseId
                ) {
                    throw new Error(
                        `برای پیام ${messageNumber} یک Showcase انتخاب کنید.`,
                    );
                }
                break;

            case "FORM":
                if (!message.formId) {
                    throw new Error(
                        `برای پیام ${messageNumber} یک Form انتخاب کنید.`,
                    );
                }
                break;
        }

        if (
            message.quickReplies.length >
            13
        ) {
            throw new Error(
                `پیام ${messageNumber} نمی‌تواند بیشتر از ۱۳ Quick Reply داشته باشد.`,
            );
        }

        for (
            let qrIndex = 0;
            qrIndex <
            message.quickReplies.length;
            qrIndex++
        ) {
            const quickReply =
                message.quickReplies[
                qrIndex
                ];

            if (!quickReply) {
                continue;
            }

            if (
                !quickReply.title.trim()
            ) {
                throw new Error(
                    `عنوان Quick Reply شماره ${qrIndex + 1
                    } در پیام ${messageNumber} را وارد کنید.`,
                );
            }

            if (
                quickReply.title.trim()
                    .length > 20
            ) {
                throw new Error(
                    `عنوان Quick Reply شماره ${qrIndex + 1
                    } در پیام ${messageNumber} نباید بیشتر از ۲۰ کاراکتر باشد.`,
                );
            }

            if (
                !quickReply.nextMessageId
            ) {
                throw new Error(
                    `مقصد Quick Reply شماره ${qrIndex + 1
                    } در پیام ${messageNumber} را انتخاب کنید.`,
                );
            }

            if (
                !messageIds.has(
                    quickReply.nextMessageId,
                )
            ) {
                throw new Error(
                    `مقصد Quick Reply شماره ${qrIndex + 1
                    } در پیام ${messageNumber} معتبر نیست.`,
                );
            }

            if (
                quickReply.nextMessageId ===
                message.id
            ) {
                throw new Error(
                    `Quick Reply شماره ${qrIndex + 1
                    } نمی‌تواند به خودش متصل شود.`,
                );
            }
        }
    }

    /*
     * Detect cycles.
     */
    const graph =
        new Map<
            string,
            string[]
        >();

    for (const message of messages) {
        graph.set(
            message.id,
            message.quickReplies
                .map(
                    (
                        quickReply,
                    ) =>
                        quickReply.nextMessageId,
                )
                .filter(
                    (
                        id,
                    ): id is string =>
                        Boolean(id),
                ),
        );
    }

    const visiting =
        new Set<string>();

    const visited =
        new Set<string>();

    function visit(
        messageId: string,
    ): boolean {
        if (
            visiting.has(
                messageId,
            )
        ) {
            return true;
        }

        if (
            visited.has(
                messageId,
            )
        ) {
            return false;
        }

        visiting.add(messageId);

        for (const nextId of
            graph.get(
                messageId,
            ) ?? []) {
            if (visit(nextId)) {
                return true;
            }
        }

        visiting.delete(messageId);
        visited.add(messageId);

        return false;
    }

    for (const message of messages) {
        if (visit(message.id)) {
            throw new Error(
                "در مسیر Quick Reply یک حلقه ایجاد شده است.",
            );
        }
    }

    return true;
}

export const MESSAGE_TYPES: MessageType[] =
    [
        "TEXT",
        "IMAGE",
        "VIDEO",
        "AUDIO",
        "SHOWCASE",
        "FORM",
    ];