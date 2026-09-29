"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Check,
  CheckCheck,
  File as FileIcon,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Paperclip,
  Play,
  RefreshCw,
  Search,
  Send,
  Square,
  UserRound,
  UserRoundCheck,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
};

type ApiResult = {
  success?: boolean;
  error?: string;
  conversations?: Conversation[];
  conversation?: Conversation;
  message?: Message;
  humanMode?: boolean;
};

type InboxFilter = "ALL" | "READ" | "UNREAD";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});

function displayName(conversation?: Conversation | null) {
  if (!conversation) return "کاربر Instagram";
  return conversation.participantUsername
    ? `@${conversation.participantUsername}`
    : conversation.participantName || "کاربر Instagram";
}

function preview(message?: Message) {
  if (!message) return "هنوز پیامی ثبت نشده است";
  if (message.text) return message.text;
  if (message.messageType === "IMAGE") return "عکس";
  if (message.messageType === "VIDEO") return "ویدیو";
  if (message.messageType === "AUDIO") return "پیام صوتی";
  if (message.messageType === "STICKER") return "استیکر";
  if (message.messageType === "REACTION") return "واکنش";
  return "پیام Instagram";
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "بدون پیام";
}

function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

async function readApiResult(response: Response): Promise<ApiResult> {
  const raw = await response.text();

  try {
    return raw ? (JSON.parse(raw) as ApiResult) : {};
  } catch {
    throw new Error(`پاسخ نامعتبر از سرور دریافت شد (${response.status}).`);
  }
}

function MediaBubble({ message }: { message: Message }) {
  if (!message.mediaUrl) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <FileIcon size={15} />
        <span>{preview(message)} آماده نمایش نیست.</span>
      </div>
    );
  }

  if (message.messageType === "IMAGE") {
    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden"
      >
        <img
          src={message.mediaUrl}
          alt="Instagram media"
          className="max-h-[360px] w-full object-cover transition hover:opacity-95"
        />
      </a>
    );
  }

  if (message.messageType === "VIDEO") {
    return (
      <video
        src={message.mediaUrl}
        controls
        preload="metadata"
        playsInline
        className="max-h-[360px] w-full min-w-[240px] max-w-[460px] bg-black"
      />
    );
  }

  if (message.messageType === "AUDIO") {
    return (
      <div className="flex min-w-[260px] items-center gap-3 px-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Play size={15} />
        </div>
        <audio src={message.mediaUrl} controls preload="metadata" className="h-9 w-full min-w-0" />
      </div>
    );
  }

  return null;
}

export default function InstagramInbox({
  accounts,
}: {
  accounts: Account[];
}) {
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
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("ALL");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(
    Array.from({ length: 34 }, () => 4),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingAnimationFrameRef = useRef<number | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (
      !accountId ||
      !connectedAccounts.some((account) => account.id === accountId)
    ) {
      setAccountId(connectedAccounts[0]?.id || "");
    }
  }, [accountId, connectedAccounts]);

  const loadConversations = useCallback(async () => {
    if (!accountId) {
      setConversations([]);
      setSelectedId("");
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/instagram/inbox?accountId=${encodeURIComponent(accountId)}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await readApiResult(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "خطا در دریافت گفتگوها");
      }

      const next = result.conversations || [];
      setConversations(next);
      setSelectedId((current) =>
        current && next.some((item) => item.id === current)
          ? current
          : next[0]?.id || "",
      );
    } catch (err) {
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
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      const result = await readApiResult(response);

      if (!response.ok || !result.success || !result.conversation) {
        throw new Error(result.error || "خطا در دریافت پیام‌ها");
      }

      setMessages(result.conversation.messages || []);
      setConversations((current) =>
        current.map((item) =>
          item.id === selectedId
            ? { ...item, ...result.conversation, unreadCount: 0 }
            : item,
        ),
      );
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
    }, 10000);

    return () => window.clearInterval(interval);
  }, [loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, selectedId]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingAnimationFrameRef.current) {
        window.cancelAnimationFrame(recordingAnimationFrameRef.current);
      }
      void recordingAudioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  async function setHumanMode(action: "transfer" | "resume") {
    if (!accountId || !selectedId || handoffLoading) return;

    try {
      setHandoffLoading(true);
      setError("");

      const response = await fetch("/api/instagram/inbox/handoff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          accountId,
          conversationId: selectedId,
          action,
        }),
      });

      const result = await readApiResult(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "تغییر وضعیت گفتگو ناموفق بود");
      }

      setConversations((current) =>
        current.map((item) =>
          item.id === selectedId
            ? { ...item, humanMode: Boolean(result.humanMode) }
            : item,
        ),
      );

      await loadMessages();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تغییر وضعیت گفتگو ناموفق بود",
      );
    } finally {
      setHandoffLoading(false);
    }
  }

  async function sendFile(file: File) {
    if (!accountId || !selectedId || sending) return;

    try {
      setSending(true);
      setError("");

      const form = new FormData();
      form.append("accountId", accountId);
      form.append("conversationId", selectedId);
      form.append("file", file);

      const response = await fetch("/api/instagram/inbox", {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      });

      const result = await readApiResult(response);

      if (!response.ok || !result.success || !result.message) {
        throw new Error(result.error || "ارسال رسانه ناموفق بود");
      }

      setMessages((current) => [...current, result.message as Message]);
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ارسال رسانه ناموفق بود");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      (!text.trim() && !selectedFile) ||
      !accountId ||
      !selectedId ||
      sending
    ) {
      return;
    }

    if (selectedFile) {
      await sendFile(selectedFile);
      if (text.trim()) {
        setText("");
      }
      return;
    }

    try {
      setSending(true);
      setError("");

      const form = new FormData();
      form.append("accountId", accountId);
      form.append("conversationId", selectedId);
      form.append("text", text.trim());

      const response = await fetch("/api/instagram/inbox", {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      });

      const result = await readApiResult(response);

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

  async function startRecording() {
    if (!accountId || !selectedId || recording || sending) return;

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("مرورگر شما از ضبط Voice پشتیبانی نمی‌کند.");
      return;
    }

    try {
      setError("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      recordingAudioContextRef.current = audioContext;

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const animateWaveform = () => {
        analyser.getByteFrequencyData(frequencyData);
        const next = Array.from({ length: 34 }, (_, index) => {
          const start = Math.floor(
            (index / 34) * frequencyData.length,
          );
          const end = Math.max(
            start + 1,
            Math.floor(((index + 1) / 34) * frequencyData.length),
          );
          let sum = 0;
          for (let i = start; i < end; i += 1) sum += frequencyData[i];
          const average = sum / Math.max(1, end - start);
          return Math.max(3, Math.min(18, Math.round(3 + average / 18)));
        });
        setRecordingWaveform(next);
        recordingAnimationFrameRef.current =
          window.requestAnimationFrame(animateWaveform);
      };

      animateWaveform();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;

        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (recordingAnimationFrameRef.current) {
          window.cancelAnimationFrame(recordingAnimationFrameRef.current);
          recordingAnimationFrameRef.current = null;
        }
        void recordingAudioContextRef.current?.close().catch(() => undefined);
        recordingAudioContextRef.current = null;

        setRecording(false);
        setRecordingSeconds(0);

        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size > 0) {
          const extension = blob.type.includes("webm") ? "webm" : "audio";
          void sendFile(
            new File(
              [blob],
              `smartdirect-voice-${Date.now()}.${extension}`,
              { type: blob.type },
            ),
          );
        }
      };

      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);
      setRecordingWaveform(Array.from({ length: 34 }, () => 4));

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (err) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setError(
        err instanceof Error
          ? err.message
          : "دسترسی به میکروفون ممکن نشد.",
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;

    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    if (recordingAnimationFrameRef.current) {
      window.cancelAnimationFrame(recordingAnimationFrameRef.current);
      recordingAnimationFrameRef.current = null;
    }
    void recordingAudioContextRef.current?.close().catch(() => undefined);
    recordingAudioContextRef.current = null;

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setRecording(false);
    setRecordingSeconds(0);
    setRecordingWaveform(Array.from({ length: 34 }, () => 4));
  }

  function selectConversation(conversationId: string) {
    if (conversationId === selectedId) {
      setMobileChatOpen(true);
      return;
    }

    setSelectedId(conversationId);
    setMessages([]);
    setText("");
    setSelectedFile(null);
    setError("");
    setMobileChatOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function goBackToList() {
    setMobileChatOpen(false);
  }

  const filteredConversations = conversations.filter((conversation) => {
    if (filter === "UNREAD" && !(conversation.unreadCount || 0)) return false;
    if (filter === "READ" && (conversation.unreadCount || 0) > 0) return false;

    const query = search.trim().toLowerCase();
    if (!query) return true;

    return (
      displayName(conversation).toLowerCase().includes(query) ||
      conversation.participantId.toLowerCase().includes(query) ||
      preview(conversation.messages[0]).toLowerCase().includes(query)
    );
  });

  const unreadTotal = conversations.filter(
    (conversation) => (conversation.unreadCount || 0) > 0,
  ).length;
  const readTotal = conversations.length - unreadTotal;
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId,
  );

  const selectedFileUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFileUrl]);

  if (!connectedAccounts.length) {
    return (
      <section
        id="messages"
        dir="rtl"
        className="scroll-mt-24 rounded-2xl border bg-card p-6 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <MessageCircle size={21} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              پیام‌ها
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              برای استفاده از پیام‌ها ابتدا یک اکانت Instagram متصل کنید.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const listPanel = (
    <aside className="flex min-h-0 flex-1 flex-col bg-background lg:w-[360px] lg:flex-none lg:border-l lg:border-border">
      <div className="shrink-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">پیام‌ها</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              گفتگوهای Instagram
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              void loadConversations();
              if (selectedId) void loadMessages();
            }}
            disabled={loading || messagesLoading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background p-0 text-muted-foreground hover:bg-muted"
            aria-label="بروزرسانی"
          >
            <RefreshCw
              size={15}
              className={loading || messagesLoading ? "animate-spin" : ""}
            />
          </Button>
        </div>

        <div className="mt-4 flex items-center rounded-xl bg-muted/60 p-1">
          {(
            [
              ["ALL", "همه", conversations.length],
              ["READ", "خوانده شده", readTotal],
              ["UNREAD", "خوانده نشده", unreadTotal],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition ${
                filter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{label}</span>
              <span className="text-[10px] tabular-nums opacity-70">
                {count.toLocaleString("fa-IR")}
              </span>
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <Search
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی گفتگو..."
            className="h-10 rounded-xl border-border bg-muted/30 pr-9 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
        {loading && !conversations.length ? (
          <div className="space-y-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl px-3 py-3"
              >
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-40 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length ? (
          filteredConversations.map((conversation) => {
            const active = conversation.id === selectedId;
            const unread = (conversation.unreadCount || 0) > 0;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition ${
                  active
                    ? "bg-muted"
                    : "hover:bg-muted/60"
                }`}
              >
                <div className="relative shrink-0">
                  {conversation.participantProfilePicture ? (
                    <img
                      src={conversation.participantProfilePicture}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserRound size={18} />
                    </div>
                  )}
                  {unread && (
                    <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-xs ${
                        unread
                          ? "font-bold text-foreground"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {displayName(conversation)}
                    </span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {formatDate(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-[11px] leading-5 ${
                        unread
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {preview(conversation.messages[0])}
                    </p>
                    {unread && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-foreground px-1.5 text-[9px] font-semibold text-background">
                        {(conversation.unreadCount || 0).toLocaleString("fa-IR")}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <MessageCircle size={21} />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              گفتگویی پیدا نشد
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              فیلتر یا عبارت جستجو را تغییر دهید.
            </p>
          </div>
        )}
      </div>
    </aside>
  );

  const chatPanel = (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {selectedConversation ? (
        <>
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <Button
              type="button"
              onClick={goBackToList}
              className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background p-0 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="بازگشت به گفتگوها"
            >
              <ArrowRight size={17} />
            </Button>

            {selectedConversation.participantProfilePicture ? (
              <img
                src={selectedConversation.participantProfilePicture}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserRound size={17} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">
                {displayName(selectedConversation)}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {selectedConversation.participantName || "Instagram Direct"}
              </p>
            </div>

            <Button
              type="button"
              onClick={() =>
                void setHumanMode(
                  selectedConversation.humanMode ? "resume" : "transfer",
                )
              }
              disabled={handoffLoading}
              className={`hidden h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-medium sm:flex ${
                selectedConversation.humanMode
                  ? "border-border bg-background text-foreground hover:bg-muted"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {selectedConversation.humanMode ? (
                <UserRoundCheck size={14} />
              ) : (
                <UserRound size={14} />
              )}
              {selectedConversation.humanMode
                ? "بازگشت به ربات"
                : "انتقال به اپراتور"}
            </Button>

            <Button
              type="button"
              onClick={() =>
                void setHumanMode(
                  selectedConversation.humanMode ? "resume" : "transfer",
                )
              }
              disabled={handoffLoading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background p-0 text-muted-foreground hover:bg-muted sm:hidden"
              aria-label="تغییر حالت اپراتور"
            >
              <UserRoundCheck size={15} />
            </Button>
          </header>

          {selectedConversation.humanMode && (
            <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-[10px] leading-5 text-amber-800">
              این گفتگو در حالت اپراتور است؛ پاسخ‌ها دستی ارسال می‌شوند.
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-5 sm:py-5">
            {messagesLoading && !messages.length ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex ${index % 2 ? "justify-start" : "justify-end"}`}
                  >
                    <div className="h-12 w-48 animate-pulse rounded-2xl bg-muted" />
                  </div>
                ))}
              </div>
            ) : messages.length ? (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {messages.map((message) => {
                  const outbound = message.direction === "OUTBOUND";
                  const hasMedia = Boolean(message.mediaUrl);

                  return (
                    <div
                      key={message.id}
                      className={`flex ${outbound ? "justify-start" : "justify-end"}`}
                    >
                      <div className="max-w-[88%] sm:max-w-[70%]">
                        <div
                          className={`overflow-hidden rounded-2xl shadow-sm ${
                            outbound
                              ? "rounded-bl-md bg-primary text-primary-foreground"
                              : "rounded-br-md border border-border bg-background text-foreground"
                          }`}
                        >
                          {hasMedia && <MediaBubble message={message} />}

                          {message.text && (
                            <div className="px-3.5 py-2.5">
                              <p className="whitespace-pre-wrap text-[13px] leading-6">
                                {message.text}
                              </p>
                            </div>
                          )}

                          {!hasMedia && !message.text && (
                            <div className="px-3.5 py-2.5 text-xs text-muted-foreground">
                              {preview(message)}
                            </div>
                          )}
                        </div>

                        <div
                          className={`mt-1 flex items-center gap-1.5 px-1 text-[9px] text-muted-foreground ${
                            outbound ? "justify-start" : "justify-end"
                          }`}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {outbound &&
                            (message.seenAt ? (
                              <CheckCheck size={12} />
                            ) : (
                              <Check size={12} />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm">
                    <MessageCircle size={24} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">
                    هنوز پیامی وجود ندارد
                  </h3>
                  <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
                    اولین پیام را از همین‌جا ارسال کنید.
                  </p>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="shrink-0 border-t border-border bg-background p-3 sm:p-4"
          >
            {selectedFile && (
              <div className="mb-3 max-h-52 overflow-hidden rounded-2xl border border-border bg-muted/30 sm:max-h-60">
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {selectedFile.type.startsWith("image/") ? (
                      <ImageIcon size={15} />
                    ) : selectedFile.type.startsWith("video/") ? (
                      <Video size={15} />
                    ) : (
                      <FileIcon size={15} />
                    )}
                    <span className="truncate text-xs font-medium">
                      {selectedFile.name}
                    </span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {Math.max(1, Math.round(selectedFile.size / 1024))} KB
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg p-0 text-muted-foreground hover:bg-background"
                    aria-label="حذف فایل"
                  >
                    <X size={14} />
                  </Button>
                </div>

                {selectedFileUrl && selectedFile.type.startsWith("image/") && (
                  <img
                    src={selectedFileUrl}
                    alt=""
                    className="mx-auto max-h-36 max-w-full object-contain sm:max-h-48"
                  />
                )}

                {selectedFileUrl && selectedFile.type.startsWith("video/") && (
                  <video
                    src={selectedFileUrl}
                    controls
                    className="mx-auto max-h-36 max-w-full bg-black object-contain sm:max-h-48"
                  />
                )}

                {selectedFileUrl && selectedFile.type.startsWith("audio/") && (
                  <div className="px-3 pb-3">
                    <audio
                      src={selectedFileUrl}
                      controls
                      className="h-9 w-full"
                    />
                  </div>
                )}
              </div>
            )}

            {recording ? (
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5 shadow-sm">
                <Button
                  type="button"
                  onClick={cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:bg-muted"
                  aria-label="لغو ضبط"
                >
                  <X size={17} />
                </Button>

                <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <div className="flex h-7 flex-1 items-center gap-1 overflow-hidden">
                    {recordingWaveform.map((height, index) => (
                      <span
                        key={index}
                        className="w-[3px] shrink-0 rounded-full bg-foreground/60 transition-[height] duration-75"
                        style={{ height: height + "px" }}
                      />
                    ))}
                  </div>
                  <span className="w-10 shrink-0 text-center text-[11px] font-semibold tabular-nums">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={stopRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground p-0 text-background hover:bg-foreground/90"
                  aria-label="ارسال Voice"
                >
                  <Square size={14} fill="currentColor" />
                </Button>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] || null);
                  }}
                />

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background p-0 text-muted-foreground hover:bg-muted"
                    aria-label="ارسال عکس، ویدیو یا فایل صوتی"
                  >
                    <Paperclip size={18} />
                  </Button>

                  <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="پیام خود را بنویسید..."
                    className="min-h-11 flex-1 resize-none rounded-2xl border-border bg-muted/40 px-4 py-2.5 text-sm leading-6 outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />

                  {text.trim() || selectedFile ? (
                    <Button
                      type="submit"
                      disabled={sending}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary p-0 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      aria-label="ارسال"
                    >
                      <Send size={17} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void startRecording()}
                      disabled={sending}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground p-0 text-background hover:bg-foreground/90 disabled:opacity-50"
                      aria-label="ضبط Voice"
                    >
                      <Mic size={18} />
                    </Button>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between px-1 text-[9px] text-muted-foreground">
                  <span>+ برای عکس، ویدیو و Voice فایل</span>
                  <span>{text.length.toLocaleString("fa-IR")} / ۱۰۰۰</span>
                </div>
              </>
            )}
          </form>
        </>
      ) : (
        <div className="hidden h-full items-center justify-center p-8 text-center lg:flex">
          <div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <MessageCircle size={24} />
            </div>
            <h3 className="mt-4 text-sm font-bold text-foreground">
              یک گفتگو را انتخاب کنید
            </h3>
            <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
              از ستون گفتگوها یک مکالمه را انتخاب کنید.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section id="messages" dir="rtl" className="scroll-mt-24">
      {error && (
        <div className="mb-3 flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{error}</span>
          <Button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 font-medium hover:underline"
          >
            بستن
          </Button>
        </div>
      )}

      <div className="h-[calc(100dvh-8.5rem)] min-h-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="flex h-full min-h-0">
          <div
            className={`flex min-h-0 flex-1 flex-col lg:flex-none ${
              mobileChatOpen ? "hidden lg:flex" : "flex"
            }`}
          >
            {listPanel}
          </div>

          <div
            className={`min-h-0 flex-1 ${
              mobileChatOpen ? "flex" : "hidden lg:flex"
            }`}
          >
            {chatPanel}
          </div>
        </div>
      </div>
    </section>
  );
}
