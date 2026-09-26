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

export type QuickReplyDestinationType = "TEXT" | "FORM" | "SHOWCASE" | "IMAGE" | "VIDEO" | "AUDIO";

export type QuickReplyDraft = {
    id: string;
    title: string;
    payload: string;
    nextMessageId: string | null;
    destinationType: QuickReplyDestinationType | null;
    destinationText: string;
    destinationFormId: string;
    destinationShowcaseId: string;
    destinationMediaUrl: string;
    destinationMediaId: string;
    destinationQuestion: string;
    destinationQuickReplies: QuickReplyDraft[];
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

export function createLocalId(prefix = "local") {
    return `${prefix}_${crypto.randomUUID()}`;
}

export function createEmptyQuickReply(): QuickReplyDraft {
    return { id: createLocalId("quick_reply"), title: "", payload: createLocalId("payload"), nextMessageId: null, destinationType: null, destinationText: "", destinationFormId: "", destinationShowcaseId: "", destinationMediaUrl: "", destinationMediaId: "", destinationQuestion: "", destinationQuickReplies: [] };
}

export function createEmptyMessage(): MessageDraft {
    return { id: createLocalId("message"), messageType: "TEXT", text: "", mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: [] };
}

export function getDefaultTrigger(automation?: { triggerType?: string | null } | null): "COMMENT_KEYWORD" | "DM" | "STORY_REPLY_KEYWORD" {
    const triggerType = automation?.triggerType;
    if (triggerType === "COMMENT_KEYWORD") return "COMMENT_KEYWORD";
    if (triggerType === "STORY_REPLY_KEYWORD") return "STORY_REPLY_KEYWORD";
    return "DM";
}

export function getMessageTypeLabel(type: MessageType) {
    switch (type) {
        case "TEXT": return "متن";
        case "IMAGE": return "تصویر";
        case "VIDEO": return "ویدیو";
        case "AUDIO": return "صوت";
        case "SHOWCASE": return "ویترین";
        case "FORM": return "فرم";
        default: return "پیام";
    }
}

export function getMessageIcon(type: MessageType) {
    switch (type) {
        case "TEXT": return "message";
        case "IMAGE": return "image";
        case "VIDEO": return "video";
        case "AUDIO": return "audio";
        case "SHOWCASE": return "showcase";
        case "FORM": return "form";
        default: return "message";
    }
}

function normalizeQuickReplyDraft(rawQuickReply: unknown): QuickReplyDraft | null {
    if (!rawQuickReply || typeof rawQuickReply !== "object") return null;
    const qr = rawQuickReply as Record<string, unknown>;
    const destinationType = ["TEXT", "FORM", "SHOWCASE", "IMAGE", "VIDEO", "AUDIO"].includes(String(qr.destinationType))
        ? qr.destinationType as QuickReplyDestinationType
        : null;
    return {
        id: typeof qr.id === "string" ? qr.id : createLocalId("quick_reply"),
        title: typeof qr.title === "string" ? qr.title : "",
        payload: typeof qr.payload === "string" ? qr.payload : createLocalId("payload"),
        nextMessageId: typeof qr.nextMessageId === "string" ? qr.nextMessageId : null,
        destinationType,
        destinationText: typeof qr.destinationText === "string" ? qr.destinationText : "",
        destinationFormId: typeof qr.destinationFormId === "string" ? qr.destinationFormId : "",
        destinationShowcaseId: typeof qr.destinationShowcaseId === "string" ? qr.destinationShowcaseId : "",
        destinationMediaUrl: typeof qr.destinationMediaUrl === "string" ? qr.destinationMediaUrl : "",
        destinationMediaId: typeof qr.destinationMediaId === "string" ? qr.destinationMediaId : "",
        destinationQuestion: typeof qr.destinationQuestion === "string" ? qr.destinationQuestion : "",
        destinationQuickReplies: Array.isArray(qr.destinationQuickReplies)
            ? qr.destinationQuickReplies.map((child) => normalizeQuickReplyDraft(child)).filter((item): item is QuickReplyDraft => item !== null)
            : [],
    };
}

export function normalizeMessages(value: unknown): MessageDraft[] {
    if (!Array.isArray(value)) return [];
    return value.map((raw): MessageDraft | null => {
        if (!raw || typeof raw !== "object") return null;
        const item = raw as Record<string, unknown>;
        const rawType = typeof item.messageType === "string" ? item.messageType : "TEXT";
        const messageType: MessageType = MESSAGE_TYPES.includes(rawType as MessageType) ? rawType as MessageType : "TEXT";
        const rawQuickReplies = Array.isArray(item.quickReplies) ? item.quickReplies : [];
        const quickReplies = rawQuickReplies
            .map((rawQuickReply) => normalizeQuickReplyDraft(rawQuickReply))
            .filter((item): item is QuickReplyDraft => item !== null);
        return {
                id: typeof qr.id === "string" ? qr.id : createLocalId("quick_reply"),
                title: typeof qr.title === "string" ? qr.title : "",
                payload: typeof qr.payload === "string" ? qr.payload : createLocalId("payload"),
                nextMessageId: typeof qr.nextMessageId === "string" ? qr.nextMessageId : null,
                destinationType: ["TEXT", "FORM", "SHOWCASE", "IMAGE", "VIDEO", "AUDIO"].includes(String(qr.destinationType)) ? qr.destinationType as QuickReplyDestinationType : null,
                destinationText: typeof qr.destinationText === "string" ? qr.destinationText : "",
                destinationFormId: typeof qr.destinationFormId === "string" ? qr.destinationFormId : "",
                destinationShowcaseId: typeof qr.destinationShowcaseId === "string" ? qr.destinationShowcaseId : "",
                destinationMediaUrl: typeof qr.destinationMediaUrl === "string" ? qr.destinationMediaUrl : "",
                destinationMediaId: typeof qr.destinationMediaId === "string" ? qr.destinationMediaId : "",
                destinationQuestion: typeof qr.destinationQuestion === "string" ? qr.destinationQuestion : "",
                destinationQuickReplies: Array.isArray(qr.destinationQuickReplies) ? qr.destinationQuickReplies.map((child) => normalizeQuickReplyDraft(child)).filter((item): item is QuickReplyDraft => item !== null) : [],
            };
        }).filter((item): item is QuickReplyDraft => item !== null);
        return {
            id: typeof item.id === "string" ? item.id : createLocalId("message"),
            messageType,
            text: typeof item.text === "string" ? item.text : "",
            mediaUrl: typeof item.mediaUrl === "string" ? item.mediaUrl : "",
            mediaId: typeof item.mediaId === "string" ? item.mediaId : "",
            showcaseId: typeof item.showcaseId === "string" ? item.showcaseId : "",
            formId: typeof item.formId === "string" ? item.formId : "",
            quickReplies,
        };
    }).filter((item): item is MessageDraft => item !== null);
}

function validateQuickReplyTree(replies: QuickReplyDraft[], messageNumber: number, path = "") {
    if (replies.length === 0) throw new Error(`برای سؤال فرم پیام ${messageNumber} حداقل یک پاسخ اضافه کنید.`);
    if (replies.length > 13) throw new Error(`هر سؤال حداکثر ۱۳ پاسخ می‌تواند داشته باشد.`);
    for (let index = 0; index < replies.length; index += 1) {
        const quickReply = replies[index];
        if (!quickReply) continue;
        const answerNumber = index + 1;
        if (!quickReply.title.trim()) throw new Error(`متن پاسخ شماره ${answerNumber} در سؤال ${messageNumber} را وارد کنید.`);
        if (quickReply.title.trim().length > 20) throw new Error(`متن پاسخ شماره ${answerNumber} در سؤال ${messageNumber} نباید بیشتر از ۲۰ کاراکتر باشد.`);
        if (!quickReply.destinationType) throw new Error(`مقصد پاسخ «${quickReply.title}» را انتخاب کنید.`);
        switch (quickReply.destinationType) {
            case "TEXT":
                if (!quickReply.destinationText.trim()) throw new Error(`متن مقصد پاسخ «${quickReply.title}» را وارد کنید.`);
                break;
            case "SHOWCASE":
                if (!quickReply.destinationShowcaseId) throw new Error(`ویترین مقصد پاسخ «${quickReply.title}» را انتخاب کنید.`);
                break;
            case "IMAGE":
            case "VIDEO":
            case "AUDIO":
                if (!quickReply.destinationMediaUrl.trim() && !quickReply.destinationMediaId.trim()) throw new Error(`فایل مقصد پاسخ «${quickReply.title}» را انتخاب کنید.`);
                break;
            case "FORM":
                if (!quickReply.destinationQuestion.trim()) throw new Error(`سؤال مقصد پاسخ «${quickReply.title}» را وارد کنید.`);
                validateQuickReplyTree(quickReply.destinationQuickReplies, messageNumber, path + answerNumber + ".");
                break;
        }
    }
}

export function validateMessages(messages: MessageDraft[], triggerType?: "COMMENT_KEYWORD" | "DM" | "STORY_REPLY_KEYWORD") {
    if (messages.length === 0) throw new Error("حداقل یک پیام اضافه کنید.");
    if (triggerType === "COMMENT_KEYWORD" && messages.some((message) => message.messageType !== "TEXT")) {
        throw new Error("در Automation کامنت فقط پیام متنی به‌عنوان Private Reply قابل استفاده است.");
    }
    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (!message) continue;
        const messageNumber = index + 1;
        switch (message.messageType) {
            case "TEXT":
                if (!message.text.trim()) throw new Error(`متن پیام ${messageNumber} را وارد کنید.`);
                break;
            case "IMAGE":
            case "VIDEO":
            case "AUDIO":
                if (!message.mediaUrl.trim() && !message.mediaId.trim()) throw new Error(`برای پیام ${messageNumber}، فایل را انتخاب کنید.`);
                break;
            case "SHOWCASE":
                if (!message.showcaseId) throw new Error(`برای پیام ${messageNumber} یک ویترین انتخاب کنید.`);
                break;
            case "FORM":
                if (!message.quickReplies.length) throw new Error(`برای سؤال فرم پیام ${messageNumber} حداقل یک جواب اضافه کنید.`);
                validateQuickReplyTree(message.quickReplies, messageNumber);
                break;
        }
        if (message.quickReplies.length > 13) throw new Error(`پیام ${messageNumber} نمی‌تواند بیشتر از ۱۳ پاسخ داشته باشد.`);
    }
    return true;
}

export const MESSAGE_TYPES: MessageType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "SHOWCASE", "FORM"];
