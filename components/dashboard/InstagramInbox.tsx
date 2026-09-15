
"use client";

import {
    Check,
    CheckCheck,
    FileImage,
    MessageCircle,
    Paperclip,
    RefreshCw,
    Reply,
    Send,
    UserRound,
    UserRoundCheck,
    X,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { FormEvent } from "react";

type Account = {
    id: string;
    igUsername: string;
    igUserId: string;
    isConnected: boolean;
};

type Message = {
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    messageType: string;
    text: string | null;
    mediaUrl: string | null;
    mediaId: string | null;
    igMessageId: string | null;
    readAt: string | null;
    seenAt: string | null;
    createdAt: string;
};

type Handoff = {
    conversationId: string;
    active: boolean;
    assignedToUserId: string | null;
    handedOffAt: string;
    handedBackAt: string | null;
};

type Conversation = {
    id: string;
    participantId: string;
    participantUsername: string | null;
    participantName: string | null;
    participantProfilePicture: string | null;
    isActive: boolean;
    humanMode?: boolean;
    handoff?: Handoff | null;
    lastMessageAt: string | null;
    updatedAt: string;
    messages: Message[];
    unreadCount?: number;
    _count?: {
        messages: number;
    };
};

const dateFormatter = new Intl.DateTimeFormat(
    "fa-IR",
    {
        dateStyle: "medium",
        timeStyle: "short",
    },
);

const timeFormatter = new Intl.DateTimeFormat(
    "fa-IR",
    {
        hour: "2-digit",
        minute: "2-digit",
    },
);

function formatDate(value: string | null) {
    return value
        ? dateFormatter.format(new Date(value))
        : "بدون پیام";
}

function formatTime(value: string) {
    return timeFormatter.format(
        new Date(value),
    );
}

function displayName(
    conversation?: Conversation | null,
) {
    if (!conversation) {
        return "کاربر Instagram";
    }

    return conversation.participantUsername
        ? `@${conversation.participantUsername}`
        : conversation.participantName ||
        "کاربر Instagram";
}

function preview(message?: Message) {
    if (!message) {
        return "هنوز پیامی ثبت نشده است";
    }

    if (message.text) {
        return message.text;
    }

    if (message.messageType === "IMAGE") {
        return "عکس";
    }

    if (message.messageType === "VIDEO") {
        return "ویدیو";
    }

    if (message.messageType === "AUDIO") {
        return "پیام صوتی";
    }

    if (message.messageType === "STICKER") {
        return "استیکر";
    }

    if (message.messageType === "REACTION") {
        return "واکنش";
    }

    return "پیام Instagram";
}

export default function InstagramInbox({
    accounts,
}: {
    accounts: Account[];
}) {
    const connectedAccounts = useMemo(
        () =>
            accounts.filter(
                (account) => account.isConnected,
            ),
        [accounts],
    );

    const [accountId, setAccountId] = useState(
        connectedAccounts[0]?.id || "",
    );

    const [conversations, setConversations] =
        useState<Conversation[]>([]);

    const [selectedId, setSelectedId] =
        useState("");

    const [messages, setMessages] =
        useState<Message[]>([]);

    const [loading, setLoading] =
        useState(false);

    const [messagesLoading, setMessagesLoading] =
        useState(false);

    const [sending, setSending] =
        useState(false);

    const [handoffLoading, setHandoffLoading] =
        useState(false);

    const [text, setText] = useState("");
    const [search, setSearch] = useState("");

    const [replyTo, setReplyTo] =
        useState<Message | null>(null);

    const [selectedFile, setSelectedFile] =
        useState<File | null>(null);

    const [error, setError] = useState("");

    const messagesEndRef =
        useRef<HTMLDivElement>(null);

    const fileInputRef =
        useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (
            !accountId ||
            !connectedAccounts.some(
                (account) =>
                    account.id === accountId,
            )
        ) {
            setAccountId(
                connectedAccounts[0]?.id || "",
            );
        }
    }, [
        accountId,
        connectedAccounts,
    ]);

    const loadConversations =
        useCallback(async () => {
            if (!accountId) {
                setConversations([]);
                setSelectedId("");
                setMessages([]);
                setReplyTo(null);
                return;
            }

            try {
                setLoading(true);

                const response = await fetch(
                    `/ api / instagram / inbox ? accountId = ${encodeURIComponent(
                        accountId,
                    )
                    }`,
                    {
                        cache: "no-store",
                    },
                );

                const result =
                    (await response.json()) as {
                        success?: boolean;
                        conversations?: Conversation[];
                        error?: string;
                    };

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.error ||
                        "خطا در دریافت گفتگوها",
                    );
                }

                const next =
                    result.conversations || [];

                setConversations(next);

                setSelectedId((current) => {
                    if (
                        current &&
                        next.some(
                            (item) =>
                                item.id === current,
                        )
                    ) {
                        return current;
                    }

                    setReplyTo(null);
                    setMessages([]);

                    return next[0]?.id || "";
                });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "خطا در دریافت گفتگوها",
                );
            } finally {
                setLoading(false);
            }
        }, [accountId]);

    const loadMessages =
        useCallback(async () => {
            if (!accountId || !selectedId) {
                setMessages([]);
                setReplyTo(null);
                return;
            }

            try {
                setMessagesLoading(true);

                const response = await fetch(
                    `/ api / instagram / inbox ? accountId = ${encodeURIComponent(
                        accountId,
                    )
                    }& conversationId=${encodeURIComponent(
                        selectedId,
                    )
                    }`,
                    {
                        cache: "no-store",
                    },
                );

                const result =
                    (await response.json()) as {
                        success?: boolean;
                        conversation?: Conversation;
                        error?: string;
                    };

                if (
                    !response.ok ||
                    !result.success ||
                    !result.conversation
                ) {
                    throw new Error(
                        result.error ||
                        "خطا در دریافت پیام‌ها",
                    );
                }

                setMessages(
                    result.conversation.messages || [],
                );

                setConversations(
                    (current) =>
                        current.map((item) =>
                            item.id === selectedId
                                ? {
                                    ...item,
                                    ...result.conversation,
                                    unreadCount: 0,
                                }
                                : item,
                        ),
                );

                /*
                 * A Reply target must always belong to
                 * the currently opened conversation.
                 */
                setReplyTo((current) => {
                    if (!current) {
                        return null;
                    }

                    const exists =
                        (result.conversation?.messages ||
                            []
                        ).some(
                            (message) =>
                                message.id === current.id,
                        );

                    return exists ? current : null;
                });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "خطا در دریافت پیام‌ها",
                );
            } finally {
                setMessagesLoading(false);
            }
        }, [accountId, selectedId]);

    useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        void loadMessages();
    }, [loadMessages]);

    useEffect(() => {
        const interval =
            window.setInterval(() => {
                void loadConversations();

                if (selectedId) {
                    void loadMessages();
                }
            }, 10000);

        return () =>
            window.clearInterval(interval);
    }, [
        loadConversations,
        loadMessages,
        selectedId,
    ]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
    }, [messages.length, selectedId]);

    async function setHumanMode(
        action: "transfer" | "resume",
    ) {
        if (
            !accountId ||
            !selectedId ||
            handoffLoading
        ) {
            return;
        }

        try {
            setHandoffLoading(true);
            setError("");

            const response = await fetch(
                "/api/instagram/inbox/handoff",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        accountId,
                        conversationId: selectedId,
                        action,
                    }),
                },
            );

            const result =
                (await response.json()) as {
                    success?: boolean;
                    humanMode?: boolean;
                    error?: string;
                };

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.error ||
                    "تغییر وضعیت گفتگو ناموفق بود",
                );
            }

            setConversations(
                (current) =>
                    current.map((item) =>
                        item.id === selectedId
                            ? {
                                ...item,
                                humanMode:
                                    Boolean(
                                        result.humanMode,
                                    ),
                            }
                            : item,
                    ),
            );

            await loadMessages();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "تغییر وضعیت گفتگو ناموفق بود",
            );
        } finally {
            setHandoffLoading(false);
        }
    }

    async function sendMessage(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (
            (!text.trim() && !selectedFile) ||
            !accountId ||
            !selectedId ||
            sending
        ) {
            return;
        }

        const replyMessage = replyTo;

        /*
         * Clear only after the request succeeds.
         * This prevents losing the selected Reply target
         * if Meta rejects the message.
         */
        try {
            setSending(true);
            setError("");

            const form = new FormData();

            form.append(
                "accountId",
                accountId,
            );

            form.append(
                "conversationId",
                selectedId,
            );

            if (text.trim()) {
                form.append(
                    "text",
                    text.trim(),
                );
            }

            if (replyMessage?.id) {
                form.append(
                    "replyToMessageId",
                    replyMessage.id,
                );
            }

            if (selectedFile) {
                form.append(
                    "file",
                    selectedFile,
                );
            }

            const response = await fetch(
                "/api/instagram/inbox",
                {
                    method: "POST",
                    body: form,
                },
            );

            const result =
                (await response.json()) as {
                    success?: boolean;
                    message?: Message;
                    error?: string;
                };

            if (
                !response.ok ||
                !result.success ||
                !result.message
            ) {
                throw new Error(
                    result.error ||
                    "ارسال پیام ناموفق بود",
                );
            }

            setMessages((current) => [
                ...current,
                result.message as Message,
            ]);

            setText("");
            setSelectedFile(null);
            setReplyTo(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            await loadConversations();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "ارسال پیام ناموفق بود",
            );
        } finally {
            setSending(false);
        }
    }

    function selectConversation(
        conversationId: string,
    ) {
        if (conversationId === selectedId) {
            return;
        }

        setSelectedId(conversationId);
        setMessages([]);
        setReplyTo(null);
        setText("");
        setSelectedFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function selectAccount(
        nextAccountId: string,
    ) {
        setAccountId(nextAccountId);
        setSelectedId("");
        setMessages([]);
        setReplyTo(null);
        setText("");
        setSelectedFile(null);
        setError("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    const filteredConversations =
        conversations.filter(
            (conversation) => {
                const query =
                    search.trim().toLowerCase();

                if (!query) {
                    return true;
                }

                return (
                    displayName(
                        conversation,
                    )
                        .toLowerCase()
                        .includes(query) ||
                    conversation.participantId
                        .toLowerCase()
                        .includes(query) ||
                    preview(
                        conversation.messages[0],
                    )
                        .toLowerCase()
                        .includes(query)
                );
            },
        );

    const selectedConversation =
        conversations.find(
            (conversation) =>
                conversation.id === selectedId,
        );

    if (!connectedAccounts.length) {
        return (
            <section
                id="messages"
                dir="rtl"
                className="scroll-mt-24 rounded-[26px] border border-slate-200 bg-white p-6 sm:p-8"
            >
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                        <MessageCircle size={21} />
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Inbox حرفه‌ای Instagram
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            برای استفاده از Inbox ابتدا
                            یک اکانت Instagram متصل کنید.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section
            id="messages"
            dir="rtl"
            className="scroll-mt-24 space-y-4"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400">
                        <MessageCircle size={14} />
                        INSTAGRAM INBOX
                    </div>

                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                        Inbox حرفه‌ای
                    </h2>

                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                        مدیریت گفتگوها، پاسخ مستقیم،
                        Reply و ارسال فایل از داخل
                        SmartDirect.
                    </p>
                </div>

                <div className="flex gap-2">
                    <select
                        value={accountId}
                        onChange={(event) =>
                            selectAccount(
                                event.target.value,
                            )
                        }
                        className="min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
                        aria-label="انتخاب اکانت Instagram"
                    >
                        {connectedAccounts.map(
                            (account) => (
                                <option
                                    key={account.id}
                                    value={account.id}
                                >
                                    @{account.igUsername}
                                </option>
                            ),
                        )}
                    </select>

                    <button
                        type="button"
                        onClick={() => {
                            void loadConversations();
                            void loadMessages();
                        }}
                        disabled={
                            loading ||
                            messagesLoading
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw
                            size={15}
                            className={
                                loading
                                    ? "animate-spin"
                                    : ""
                            }
                        />
                        بروزرسانی
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() =>
                            setError("")
                        }
                        className="font-medium hover:underline"
                    >
                        بستن
                    </button>
                </div>
            )}

            <div className="grid h-[700px] min-h-0 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)] lg:grid-cols-[350px_minmax(0,1fr)]">
                <aside className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-slate-50/60">
                    <div className="shrink-0 border-b border-slate-200 p-4">
                        <input
                            value={search}
                            onChange={(event) =>
                                setSearch(
                                    event.target.value,
                                )
                            }
                            placeholder="جستجو در گفتگوها..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300"
                        />

                        <p className="mt-3 text-xs text-slate-400">
                            {conversations.length.toLocaleString(
                                "fa-IR",
                            )}{" "}
                            گفتگو
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {loading &&
                            !conversations.length ? (
                            <div className="px-5 py-12 text-center text-sm text-slate-400">
                                در حال دریافت گفتگوها...
                            </div>
                        ) : filteredConversations.length ? (
                            filteredConversations.map(
                                (conversation) => {
                                    const last =
                                        conversation.messages[0];

                                    const active =
                                        conversation.id ===
                                        selectedId;

                                    const unread =
                                        (conversation.unreadCount ||
                                            0) > 0;

                                    return (
                                        <button
                                            key={
                                                conversation.id
                                            }
                                            type="button"
                                            onClick={() =>
                                                selectConversation(
                                                    conversation.id,
                                                )
                                            }
                                            className={`w - full border - b border - slate - 100 px - 4 py - 4 text - right transition ${active
                                                    ? "bg-white"
                                                    : "hover:bg-white"
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {conversation.participantProfilePicture ? (
                                                    <img
                                                        src={
                                                            conversation.participantProfilePicture
                                                        }
                                                        alt=""
                                                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                                                        <UserRound
                                                            size={17}
                                                        />
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p
                                                            className={`truncate text - sm ${unread
                                                                    ? "font-bold text-slate-950"
                                                                    : "font-semibold text-slate-700"
                                                                }`}
                                                        >
                                                            {displayName(
                                                                conversation,
                                                            )}
                                                        </p>

                                                        {last && (
                                                            <span className="shrink-0 text-[9px] text-slate-400">
                                                                {formatDate(
                                                                    last.createdAt,
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="mt-1 truncate text-[10px] text-slate-400">
                                                        {conversation.participantName ||
                                                            conversation.participantId}
                                                    </p>

                                                    <div className="mt-2 flex items-center gap-2">
                                                        <p
                                                            className={`min - w - 0 flex - 1 truncate text - xs ${unread
                                                                    ? "font-semibold text-slate-700"
                                                                    : "text-slate-500"
                                                                }`}
                                                        >
                                                            {preview(last)}
                                                        </p>

                                                        {conversation.humanMode && (
                                                            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                                                                اپراتور
                                                            </span>
                                                        )}

                                                        {unread && (
                                                            <span
                                                                className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500"
                                                                title="پیام خوانده نشده"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                },
                            )
                        ) : (
                            <div className="px-5 py-14 text-center">
                                <MessageCircle
                                    size={25}
                                    className="mx-auto text-slate-300"
                                />

                                <p className="mt-3 text-sm font-medium text-slate-500">
                                    هنوز گفتگویی ثبت نشده است
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                    بعد از دریافت اولین DM،
                                    گفتگو اینجا نمایش داده
                                    می‌شود.
                                </p>
                            </div>
                        )}
                    </div>
                </aside>

                <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
                    {selectedConversation ? (
                        <>
                            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    {selectedConversation.participantProfilePicture ? (
                                        <img
                                            src={
                                                selectedConversation.participantProfilePicture
                                            }
                                            alt=""
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white">
                                            <UserRound size={16} />
                                        </div>
                                    )}

                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-bold text-slate-900">
                                            {displayName(
                                                selectedConversation,
                                            )}
                                        </h3>

                                        <p className="mt-1 truncate text-[10px] text-slate-400">
                                            {selectedConversation.participantName ||
                                                selectedConversation.participantId}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span
                                        className={`rounded - full px - 2.5 py - 1 text - [10px] font - medium ${selectedConversation.humanMode
                                                ? "bg-amber-50 text-amber-700"
                                                : selectedConversation.isActive
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-slate-100 text-slate-500"
                                            }`}
                                    >
                                        {selectedConversation.humanMode
                                            ? "اپراتور فعال"
                                            : selectedConversation.isActive
                                                ? "فعال"
                                                : "غیرفعال"}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            void setHumanMode(
                                                selectedConversation.humanMode
                                                    ? "resume"
                                                    : "transfer",
                                            )
                                        }
                                        disabled={handoffLoading}
                                        className={`inline - flex items - center gap - 2 rounded - xl border px - 3 py - 2 text - xs font - semibold transition disabled: opacity - 50 ${selectedConversation.humanMode
                                                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                            }`}
                                        title={
                                            selectedConversation.humanMode
                                                ? "بازگرداندن گفتگو به ربات"
                                                : "انتقال گفتگو به اپراتور"
                                        }
                                    >
                                        <UserRoundCheck
                                            size={14}
                                        />

                                        {handoffLoading
                                            ? "در حال تغییر..."
                                            : selectedConversation.humanMode
                                                ? "بازگشت به ربات"
                                                : "انتقال به اپراتور"}
                                    </button>
                                </div>
                            </header>

                            {selectedConversation.humanMode && (
                                <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-xs font-medium text-amber-800 sm:px-6">
                                    این گفتگو در حالت اپراتور است؛
                                    اجرای اتوماسیون برای آن متوقف
                                    شده و پاسخ‌های شما دستی ارسال
                                    می‌شوند.
                                </div>
                            )}

                            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 p-5 sm:p-6">
                                {messagesLoading &&
                                    !messages.length ? (
                                    <div className="py-20 text-center text-sm text-slate-400">
                                        در حال دریافت پیام‌ها...
                                    </div>
                                ) : messages.length ? (
                                    <div className="space-y-3">
                                        {messages.map(
                                            (message) => {
                                                const outbound =
                                                    message.direction ===
                                                    "OUTBOUND";

                                                const isImage =
                                                    message.messageType ===
                                                    "IMAGE" &&
                                                    message.mediaUrl;

                                                const isVideo =
                                                    message.messageType ===
                                                    "VIDEO" &&
                                                    message.mediaUrl;

                                                const isAudio =
                                                    message.messageType ===
                                                    "AUDIO" &&
                                                    message.mediaUrl;

                                                return (
                                                    <div
                                                        key={message.id}
                                                        className={`group flex ${outbound
                                                                ? "justify-start"
                                                                : "justify-end"
                                                            }`}
                                                    >
                                                        <div className="relative flex max-w-[82%] flex-col sm:max-w-[70%]">
                                                            <div
                                                                className={`overflow - hidden rounded - 2xl ${outbound
                                                                        ? "rounded-bl-md bg-slate-950 text-white"
                                                                        : "rounded-br-md border border-slate-200 bg-white text-slate-800"
                                                                    }`}
                                                            >
                                                                {isImage ? (
                                                                    <img
                                                                        src={
                                                                            message.mediaUrl!
                                                                        }
                                                                        alt="Instagram attachment"
                                                                        className="max-h-[320px] w-auto max-w-full object-cover"
                                                                    />
                                                                ) : isVideo ? (
                                                                    <video
                                                                        src={
                                                                            message.mediaUrl!
                                                                        }
                                                                        controls
                                                                        className="max-h-[320px] w-full max-w-[420px]"
                                                                    />
                                                                ) : isAudio ? (
                                                                    <audio
                                                                        src={
                                                                            message.mediaUrl!
                                                                        }
                                                                        controls
                                                                        className="max-w-[280px]"
                                                                    />
                                                                ) : null}

                                                                {(message.text ||
                                                                    (!isImage &&
                                                                        !isVideo &&
                                                                        !isAudio)) && (
                                                                        <div className="px-4 py-3">
                                                                            {message.text ? (
                                                                                <p className="whitespace-pre-wrap text-sm leading-6">
                                                                                    {message.text}
                                                                                </p>
                                                                            ) : (
                                                                                <p className="text-sm">
                                                                                    {preview(
                                                                                        message,
                                                                                    )}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                            </div>

                                                            <div className="mt-1 flex items-center gap-1.5 px-1 text-[9px] text-slate-400">
                                                                <span>
                                                                    {formatTime(
                                                                        message.createdAt,
                                                                    )}
                                                                </span>

                                                                {outbound &&
                                                                    (message.seenAt ? (
                                                                        <>
                                                                            <CheckCheck
                                                                                size={12}
                                                                                className="text-blue-500"
                                                                            />
                                                                            <span>
                                                                                Seen
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Check
                                                                                size={12}
                                                                            />
                                                                            <span>
                                                                                ارسال شد
                                                                            </span>
                                                                        </>
                                                                    ))}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (
                                                                        !message.igMessageId
                                                                    ) {
                                                                        setError(
                                                                            "این پیام شناسه Instagram ندارد و امکان Reply به آن وجود ندارد.",
                                                                        );
                                                                        return;
                                                                    }

                                                                    setReplyTo(
                                                                        message,
                                                                    );
                                                                    setError("");
                                                                }}
                                                                className={`absolute - top - 2 rounded - full border border - slate - 200 bg - white p - 1.5 text - slate - 500 opacity - 0 shadow - sm transition group - hover: opacity - 100 ${outbound
                                                                        ? "-left-9"
                                                                        : "-right-9"
                                                                    }`}
                                                                title="Reply"
                                                            >
                                                                <Reply size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}

                                        <div
                                            ref={messagesEndRef}
                                        />
                                    </div>
                                ) : (
                                    <div className="py-20 text-center text-sm text-slate-400">
                                        این گفتگو هنوز پیامی
                                        ندارد.
                                    </div>
                                )}
                            </div>

                            <form
                                onSubmit={sendMessage}
                                className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4"
                            >
                                {replyTo && (
                                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                                                <Reply size={12} />

                                                پاسخ به{" "}
                                                {replyTo.direction ===
                                                    "OUTBOUND"
                                                    ? "پیام شما"
                                                    : displayName(
                                                        selectedConversation,
                                                    )}
                                            </div>

                                            <p className="mt-1 truncate text-xs text-slate-700">
                                                {preview(replyTo)}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setReplyTo(null)
                                            }
                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                )}

                                {selectedFile && (
                                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <FileImage
                                                size={16}
                                                className="shrink-0 text-slate-500"
                                            />

                                            <span className="truncate text-xs font-medium text-slate-700">
                                                {selectedFile.name}
                                            </span>

                                            <span className="shrink-0 text-[10px] text-slate-400">
                                                {Math.round(
                                                    selectedFile.size /
                                                    1024,
                                                )}{" "}
                                                KB
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedFile(
                                                    null,
                                                );

                                                if (
                                                    fileInputRef.current
                                                ) {
                                                    fileInputRef.current.value =
                                                        "";
                                                }
                                            }}
                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-end gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,video/*,audio/*"
                                        className="hidden"
                                        onChange={(event) =>
                                            setSelectedFile(
                                                event.target
                                                    .files?.[0] ||
                                                null,
                                            )
                                        }
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="flex h-[54px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                                        title="ارسال عکس، ویدیو یا صوت"
                                    >
                                        <Paperclip size={18} />
                                    </button>

                                    <textarea
                                        value={text}
                                        onChange={(event) =>
                                            setText(
                                                event.target.value,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key ===
                                                "Enter" &&
                                                !event.shiftKey
                                            ) {
                                                event.preventDefault();
                                                event.currentTarget.form?.requestSubmit();
                                            }
                                        }}
                                        rows={2}
                                        maxLength={1000}
                                        placeholder={
                                            selectedFile
                                                ? "توضیح اختیاری را بنویسید..."
                                                : "پیام خود را بنویسید..."
                                        }
                                        className="min-h-[54px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                                    />

                                    <button
                                        type="submit"
                                        disabled={
                                            (!text.trim() &&
                                                !selectedFile) ||
                                            sending
                                        }
                                        className="inline-flex h-[54px] shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Send size={16} />
                                        {sending
                                            ? "در حال ارسال..."
                                            : "ارسال"}
                                    </button>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                                    <span>
                                        Enter برای ارسال · Shift +
                                        Enter برای خط جدید · Reply
                                        با دکمه کنار پیام
                                    </span>

                                    <span>
                                        {text.length.toLocaleString(
                                            "fa-IR",
                                        )}{" "}
                                        / ۱۰۰۰
                                    </span>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex h-full items-center justify-center p-8 text-center">
                            <div>
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                    <MessageCircle
                                        size={24}
                                    />
                                </div>

                                <h3 className="mt-4 font-bold text-slate-800">
                                    یک گفتگو را انتخاب کنید
                                </h3>

                                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                                    از ستون گفتگوها یک
                                    conversation را انتخاب کنید
                                    تا تاریخچه پیام‌ها و ابزارهای
                                    پاسخ نمایش داده شود.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

