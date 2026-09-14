"use client";

import {
    MessageCircle,
    RefreshCw,
    Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    createdAt: string;
};

type Conversation = {
    id: string;
    participantId: string;
    isActive: boolean;
    lastMessageAt: string | null;
    updatedAt: string;
    messages: Message[];
    _count?: { messages: number };
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
});

function formatDate(value: string | null) {
    if (!value) return "بدون پیام";
    return dateFormatter.format(new Date(value));
}

function preview(message?: Message) {
    if (!message) return "هنوز پیامی ثبت نشده است";
    if (message.text) return message.text;
    if (message.messageType === "IMAGE") return "پیام تصویری";
    if (message.messageType === "VIDEO") return "پیام ویدیویی";
    if (message.messageType === "AUDIO") return "پیام صوتی";
    if (message.messageType === "STICKER") return "استیکر";
    if (message.messageType === "REACTION") return "واکنش";
    return "پیام Instagram";
}

export default function InstagramInbox({ accounts }: { accounts: Account[] }) {
    const connectedAccounts = useMemo(
        () => accounts.filter((account) => account.isConnected),
        [accounts],
    );

    const [accountId, setAccountId] = useState(connectedAccounts[0]?.id || "");
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [text, setText] = useState("");
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!accountId || !connectedAccounts.some((account) => account.id === accountId)) {
            setAccountId(connectedAccounts[0]?.id || "");
        }
    }, [accountId, connectedAccounts]);

    const loadConversations = useCallback(async () => {
        if (!accountId) {
            setConversations([]);
            setSelectedId("");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `/api/instagram/inbox?accountId=${encodeURIComponent(accountId)}`,
                { cache: "no-store" },
            );
            const result = (await response.json()) as {
                success?: boolean;
                conversations?: Conversation[];
                error?: string;
            };

            if (!response.ok || !result.success) {
                throw new Error(result.error || "خطا در دریافت گفتگوها");
            }

            const nextConversations = result.conversations || [];
            setConversations(nextConversations);

            setSelectedId((current) => {
                if (current && nextConversations.some((item) => item.id === current)) {
                    return current;
                }
                return nextConversations[0]?.id || "";
            });
        } catch (err) {
            setConversations([]);
            setSelectedId("");
            setError(err instanceof Error ? err.message : "خطا در دریافت گفتگوها");
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    const loadMessages = useCallback(async () => {
        if (!accountId || !selectedId) {
            setMessages([]);
            return;
        }

        try {
            setMessagesLoading(true);
            const response = await fetch(
                `/api/instagram/inbox?accountId=${encodeURIComponent(accountId)}&conversationId=${encodeURIComponent(selectedId)}`,
                { cache: "no-store" },
            );
            const result = (await response.json()) as {
                success?: boolean;
                conversation?: Conversation;
                error?: string;
            };

            if (!response.ok || !result.success || !result.conversation) {
                throw new Error(result.error || "خطا در دریافت پیام‌ها");
            }

            setMessages(result.conversation.messages || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "خطا در دریافت پیام‌ها");
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
        const interval = window.setInterval(() => {
            void loadConversations();
            if (selectedId) void loadMessages();
        }, 12000);

        return () => window.clearInterval(interval);
    }, [loadConversations, loadMessages, selectedId]);

    async function sendMessage(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = text.trim();

        if (!value || !accountId || !selectedId || sending) return;

        try {
            setSending(true);
            setError("");

            const response = await fetch("/api/instagram/inbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId, conversationId: selectedId, text: value }),
            });

            const result = (await response.json()) as {
                success?: boolean;
                message?: Message;
                error?: string;
            };

            if (!response.ok || !result.success || !result.message) {
                throw new Error(result.error || "ارسال پیام ناموفق بود");
            }

            setMessages((current) => [...current, result.message as Message]);
            setText("");
            await loadConversations();
        } catch (err) {
            setError(err instanceof Error ? err.message : "ارسال پیام ناموفق بود");
        } finally {
            setSending(false);
        }
    }

    const filteredConversations = conversations.filter((conversation) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
            conversation.participantId.toLowerCase().includes(query) ||
            preview(conversation.messages[0]).toLowerCase().includes(query)
        );
    });

    const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

    if (!connectedAccounts.length) {
        return (
            <section id="messages" dir="rtl" className="scroll-mt-24 rounded-[26px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><MessageCircle size={21} /></div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Inbox حرفه‌ای Instagram</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">برای استفاده از Inbox ابتدا یک اکانت Instagram متصل کنید.</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="messages" dir="rtl" className="scroll-mt-24 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400"><MessageCircle size={14} />INSTAGRAM INBOX</div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Inbox حرفه‌ای</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">گفتگوهای واقعی Instagram را ببینید و از داخل SmartDirect پاسخ دهید.</p>
                </div>

                <div className="flex gap-2">
                    <select value={accountId} onChange={(event) => { setAccountId(event.target.value); setSelectedId(""); setMessages([]); }} className="min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none" aria-label="انتخاب اکانت Instagram">
                        {connectedAccounts.map((account) => <option key={account.id} value={account.id}>@{account.igUsername}</option>)}
                    </select>
                    <button type="button" onClick={() => { void loadConversations(); void loadMessages(); }} disabled={loading || messagesLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />بروزرسانی
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span><button type="button" onClick={() => setError("")} className="font-medium hover:underline">بستن</button>
                </div>
            )}

            <div className="grid min-h-[620px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)] lg:grid-cols-[330px_minmax(0,1fr)]">
                <aside className="border-l border-slate-200 bg-slate-50/60">
                    <div className="border-b border-slate-200 p-4">
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در گفتگوها..." className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300" />
                        <p className="mt-3 text-xs text-slate-400">{conversations.length.toLocaleString("fa-IR")} گفتگو</p>
                    </div>

                    <div className="max-h-[550px] overflow-y-auto">
                        {loading && !conversations.length ? (
                            <div className="px-5 py-12 text-center text-sm text-slate-400">در حال دریافت گفتگوها...</div>
                        ) : filteredConversations.length ? (
                            filteredConversations.map((conversation) => {
                                const last = conversation.messages[0];
                                const active = conversation.id === selectedId;
                                return (
                                    <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-slate-100 px-4 py-4 text-right transition ${active ? "bg-white" : "hover:bg-white"}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold text-white">IG</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="truncate text-sm font-bold text-slate-800">کاربر Instagram</p>
                                                    {last && <span className="shrink-0 text-[9px] text-slate-400">{formatDate(last.createdAt)}</span>}
                                                </div>
                                                <p className="mt-1 truncate text-[10px] text-slate-400">{conversation.participantId}</p>
                                                <p className="mt-2 truncate text-xs text-slate-500">{preview(last)}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-5 py-14 text-center"><MessageCircle size={25} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-500">هنوز گفتگویی ثبت نشده است</p><p className="mt-1 text-xs leading-5 text-slate-400">بعد از دریافت اولین DM، گفتگو اینجا نمایش داده می‌شود.</p></div>
                        )}
                    </div>
                </aside>

                <div className="flex min-h-[620px] min-w-0 flex-col">
                    {selectedConversation ? (
                        <>
                            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold text-white">IG</div>
                                    <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">گفتگو با کاربر Instagram</h3><p className="mt-1 truncate text-[10px] text-slate-400">{selectedConversation.participantId}</p></div>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${selectedConversation.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{selectedConversation.isActive ? "فعال" : "غیرفعال"}</span>
                            </header>

                            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/40 p-5 sm:p-6">
                                {messagesLoading && !messages.length ? (
                                    <div className="py-20 text-center text-sm text-slate-400">در حال دریافت پیام‌ها...</div>
                                ) : messages.length ? (
                                    messages.map((message) => (
                                        <div key={message.id} className={`flex ${message.direction === "OUTBOUND" ? "justify-start" : "justify-end"}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.direction === "OUTBOUND" ? "rounded-bl-md bg-slate-950 text-white" : "rounded-br-md border border-slate-200 bg-white text-slate-800"}`}>
                                                {message.text ? <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p> : <p className="text-sm">{preview(message)}</p>}
                                                <p className="mt-2 text-[9px] text-slate-400">{formatDate(message.createdAt)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-20 text-center text-sm text-slate-400">این گفتگو هنوز پیامی ندارد.</div>
                                )}
                            </div>

                            <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-4 sm:p-5">
                                <div className="flex items-end gap-3">
                                    <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={1000} placeholder="پاسخ خود را بنویسید..." className="min-h-[58px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white" />
                                    <button type="submit" disabled={!text.trim() || sending} className="inline-flex h-[58px] shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} />ارسال</button>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>Enter برای ارسال · Shift + Enter برای خط جدید</span><span>{text.length.toLocaleString("fa-IR")} / ۱۰۰۰</span></div>
                            </form>
                        </>
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-8 text-center">
                            <div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><MessageCircle size={24} /></div><h3 className="mt-4 font-bold text-slate-800">یک گفتگو را انتخاب کنید</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">از ستون گفتگوها یک conversation را انتخاب کنید تا تاریخچه پیام‌ها و امکان پاسخ نمایش داده شود.</p></div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
