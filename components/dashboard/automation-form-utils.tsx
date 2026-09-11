import {
    Image as ImageIcon,
    MessageCircle,
    MessageSquareText,
    Video,
    Volume2,
} from "lucide-react";

import type {
    Automation,
    AutomationTriggerType,
} from "./AutomationManager";

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

export type AutomationFormProps = {
    account: InstagramAccount;
    automation?: Automation | null;
    onClose: () => void;
    onCreated: (automation: Automation) => void;
    onUpdated: (automation: Automation) => void;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function createLocalId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}`;
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

export function createEmptyQuickReply(): QuickReplyDraft {
    return {
        id: createLocalId("quick"),
        title: "",
        payload: createLocalId("payload"),
        nextMessageId: null,
    };
}

export function getDefaultTrigger(
    automation?: Automation | null
): AutomationTriggerType {
    return (
        automation?.triggerType ??
        "COMMENT_KEYWORD"
    );
}

export function getMessageTypeLabel(
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

export function getMessageIcon(
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

export function normalizeMessages(
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