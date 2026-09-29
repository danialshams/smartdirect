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
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  UserRound,
  UserRoundCheck,
  Video,
  X,
  CircleHelp,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";

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
  sendStatus?: "FAILED";
};

type RetryPayload =
  | { kind: "TEXT"; text: string }
  | { kind: "FILE"; file: File };

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

function AudioBubble({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const formatAudioTime = (value: number) => {
    if (!Number.isFinite(value)) return "00:00";
    const total = Math.max(0, Math.floor(value));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
      total % 60,
    ).padStart(2, "0")}`;
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const seekFromWaveform = (event: ReactPointerEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );

    audio.currentTime = ratio * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audio) audio.playbackRate = next;
  };

  return (
    <div className="w-[292px] max-w-full px-3 py-2.5" dir="ltr">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          audio.playbackRate = speed;
        }}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => setPlaying(false)}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void toggle()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition active:scale-95"
          aria-label={playing ? "توقف پخش" : "پخش پیام صوتی"}
        >
          {playing ? (
            <Pause size={15} />
          ) : (
            <Play size={15} className="ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            className="flex h-8 min-w-0 cursor-pointer items-center gap-[2px] overflow-hidden rounded-full select-none touch-none"
            onPointerDown={seekFromWaveform}
            role="slider"
            aria-label="موقعیت پیام صوتی"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={Math.min(currentTime, duration || 0)}
            tabIndex={0}
          >
            {Array.from({ length: 34 }, (_, index) => {
              const pattern = [6, 10, 14, 8, 17, 11, 7, 13, 18, 9, 12, 6];
              const height = pattern[index % pattern.length];
              const active =
                duration > 0 && index / 34 <= currentTime / duration;
              return (
                <span
                  key={index}
                  className={`w-[3px] shrink-0 rounded-full transition-opacity ${
                    active ? "bg-current opacity-100" : "bg-current opacity-25"
                  }`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>

          <div className="mt-0.5 flex items-center justify-between text-[9px] tabular-nums opacity-65">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={cycleSpeed}
          className="flex h-8 min-w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition hover:bg-black/5 active:scale-95"
          aria-label={`سرعت پخش ${speed} برابر`}
          title="تغییر سرعت پخش"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}

function MediaBubble({
  message,
  onMediaLoad,
}: {
  message: Message;
  onMediaLoad?: () => void;
}) {
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
          onLoad={onMediaLoad}
          className="mx-auto max-h-[280px] max-w-full object-contain transition hover:opacity-95 sm:max-h-[320px]"
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
        onLoadedMetadata={onMediaLoad}
        onLoadedData={onMediaLoad}
        className="mx-auto max-h-[280px] w-full min-w-0 max-w-[420px] bg-black sm:max-h-[320px]"
      />
    );
  }

  if (message.messageType === "AUDIO") {
    return <AudioBubble src={message.mediaUrl} />;
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

  const initialAccountId = connectedAccounts[0]?.id || "";
  const initialStoredSelection = (() => {
    if (typeof window === "undefined" || !initialAccountId) return null;
    const urlSelection = new URLSearchParams(window.location.search).get("conversation");
    const storedSelection = window.sessionStorage.getItem(
      `smartdirect:inbox:selected:${initialAccountId}`,
    );
    return urlSelection || storedSelection;
  })();
  const [accountId, setAccountId] = useState(initialAccountId);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState(initialStoredSelection || "");
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
  const [mobileChatOpen, setMobileChatOpen] = useState(() => {
    if (typeof window === "undefined" || !initialAccountId || !initialStoredSelection) {
      return false;
    }
    return (
      window.sessionStorage.getItem(
        `smartdirect:inbox:mobile-open:${initialAccountId}`,
      ) === "1"
    );
  });
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(
    Array.from({ length: 34 }, () => 4),
  );

  const inboxStorageKey = accountId
    ? `smartdirect:inbox:selected:${accountId}`
    : "";
  const inboxMobileStorageKey = accountId
    ? `smartdirect:inbox:mobile-open:${accountId}`
    : "";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const initialScrollPendingRef = useRef(false);
  const failedRetryRef = useRef<Map<string, RetryPayload>>(new Map());
  const optimisticMediaRef = useRef<Map<string, string>>(new Map());
  const lastMarkedInboundRef = useRef<string>("");
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
      setMobileChatOpen(false);
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

      const savedId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("conversation") ||
            (inboxStorageKey ? window.sessionStorage.getItem(inboxStorageKey) : null)
          : null;
      const savedMobileOpen =
        typeof window !== "undefined" && inboxMobileStorageKey
          ? window.sessionStorage.getItem(inboxMobileStorageKey) === "1"
          : false;
      const savedIdIsValid = Boolean(savedId && next.some((item) => item.id === savedId));

      setSelectedId((current) => {
        const currentIsValid = Boolean(current && next.some((item) => item.id === current));
        const nextId = currentIsValid
          ? current
          : (savedIdIsValid ? savedId : next[0]?.id) || "";

        if (nextId) {
          initialScrollPendingRef.current = true;
        }

        return nextId;
      });

      if (savedIdIsValid && !selectedId) {
        setMobileChatOpen(savedMobileOpen);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت گفتگوها");
    } finally {
      setLoading(false);
    }
  }, [accountId]);
  const markConversationSeen = useCallback(
    async (inboundMarker: string) => {
      if (!accountId || !selectedId || !inboundMarker) return;
      if (lastMarkedInboundRef.current === inboundMarker) return;

      try {
        const response = await fetch("/api/instagram/inbox", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            accountId,
            conversationId: selectedId,
            action: "mark_seen",
          }),
        });

        const result = await readApiResult(response);

        if (response.ok && result.success) {
          lastMarkedInboundRef.current = inboundMarker;
        }
      } catch {
        // A failed read receipt must never block the inbox.
      }
    },
    [accountId, selectedId],
  );


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

      const serverMessages = (result.conversation.messages || []) as Message[];
      const mergedMessages = serverMessages.map((message) => {
        const optimisticUrl = optimisticMediaRef.current.get(message.id);

        if (message.mediaUrl && optimisticUrl) {
          URL.revokeObjectURL(optimisticUrl);
          optimisticMediaRef.current.delete(message.id);
          return message;
        }

        return message.mediaUrl || !optimisticUrl
          ? message
          : { ...message, mediaUrl: optimisticUrl };
      });

      setMessages(mergedMessages);
      setConversations((current) =>
        current.map((item) =>
          item.id === selectedId
            ? { ...item, ...result.conversation, unreadCount: 0 }
            : item,
        ),
      );

      const latestInbound = [...serverMessages]
        .reverse()
        .find((message) => message.direction === "INBOUND");

      if (latestInbound) {
        void markConversationSeen(
          latestInbound.igMessageId || latestInbound.id,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت پیام‌ها");
    } finally {
      setMessagesLoading(false);
    }
  }, [accountId, selectedId, markConversationSeen]);

  useEffect(() => {
    lastMarkedInboundRef.current = "";
    previousMessageCountRef.current = 0;
    initialScrollPendingRef.current = Boolean(selectedId);
  }, [accountId, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined" || !accountId || !selectedId) return;

    window.sessionStorage.setItem(inboxStorageKey, selectedId);
    window.sessionStorage.setItem(
      inboxMobileStorageKey,
      mobileChatOpen ? "1" : "0",
    );

    if (!mobileChatOpen && window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("conversation", selectedId);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [accountId, selectedId, mobileChatOpen, inboxMobileStorageKey, inboxStorageKey]);

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

  const forceScrollToBottom = useCallback(() => {
    const container = messagesScrollRef.current;
    if (!container) return;

    container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  }, []);

  useLayoutEffect(() => {
    // Initial positioning must wait until the mobile chat panel is actually
    // visible and the message-loading phase has finished.
    if (
      !selectedId ||
      !mobileChatOpen ||
      messagesLoading ||
      !messages.length ||
      !initialScrollPendingRef.current
    ) {
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    const scrollNow = () => {
      if (cancelled || !initialScrollPendingRef.current) return;
      const container = messagesScrollRef.current;
      if (!container) return;

      container.scrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight,
      );
    };

    // The first pass happens after the visible Chat DOM has painted.
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollNow);
    });

    // Media/layout can change the scrollHeight after the messages render.
    const container = messagesScrollRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (container) {
      resizeObserver = new ResizeObserver(scrollNow);
      resizeObserver.observe(container);

      if (container.firstElementChild) {
        resizeObserver.observe(container.firstElementChild);
      }

      mutationObserver = new MutationObserver(scrollNow);
      mutationObserver.observe(container, {
        childList: true,
        subtree: true,
      });
    }

    // A few short passes cover browser layout/media settling without
    // relying on a long arbitrary timeout.
    for (const delay of [40, 100, 200, 350, 550]) {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) scrollNow();
        }, delay),
      );
    }

    const settleTimer = window.setTimeout(() => {
      if (cancelled) return;
      scrollNow();
      initialScrollPendingRef.current = false;
    }, 700);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(settleTimer);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [
    selectedId,
    mobileChatOpen,
    messagesLoading,
    messages.length,
  ]);

  // If the chat becomes visible after messages have already been loaded,
  // run the initial positioning again on the next frame.
  useEffect(() => {
    if (
      !selectedId ||
      !mobileChatOpen ||
      messagesLoading ||
      !messages.length ||
      !initialScrollPendingRef.current
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      forceScrollToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    selectedId,
    mobileChatOpen,
    messagesLoading,
    messages.length,
    forceScrollToBottom,
  ]);

  const scrollToInitialBottom = useCallback(() => {
    if (initialScrollPendingRef.current) forceScrollToBottom();
  }, [forceScrollToBottom]);

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

      const serverMessage = result.message as Message;
      const optimisticMediaUrl =
        serverMessage.mediaUrl || URL.createObjectURL(file);

      if (!serverMessage.mediaUrl) {
        optimisticMediaRef.current.set(serverMessage.id, optimisticMediaUrl);
      }

      setMessages((current) => [
        ...current,
        {
          ...serverMessage,
          mediaUrl: optimisticMediaUrl,
        },
      ]);
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      addFailedOutgoingMessage({ kind: "FILE", file });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("");
    } finally {
      setSending(false);
    }

    await loadConversations();
  }

  async function sendTextMessage(messageText: string) {
    if (!messageText.trim() || !accountId || !selectedId || sending) return;
    try {
      setSending(true);
      setError("");
      const form = new FormData();
      form.append("accountId", accountId);
      form.append("conversationId", selectedId);
      form.append("text", messageText.trim());
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
    } catch {
      addFailedOutgoingMessage({ kind: "TEXT", text: messageText.trim() });
      setText("");
      setError("");
    } finally {
      setSending(false);
    }

    await loadConversations();
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

    await sendTextMessage(text);
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
    initialScrollPendingRef.current = true;
    previousMessageCountRef.current = 0;
    setMessages([]);
    setText("");
    setSelectedFile(null);
    setError("");
    initialScrollPendingRef.current = true;
    setMobileChatOpen(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        `smartdirect:inbox:selected:${accountId}`,
        conversationId,
      );
      window.sessionStorage.setItem(
        `smartdirect:inbox:mobile-open:${accountId}`,
        "1",
      );
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function goBackToList() {
    setMobileChatOpen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        `smartdirect:inbox:mobile-open:${accountId}`,
        "0",
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("conversation");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }

  function addFailedOutgoingMessage(payload: RetryPayload) {
    const failedId = `failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const file = payload.kind === "FILE" ? payload.file : null;
    const mediaUrl = file ? URL.createObjectURL(file) : null;
    const messageType = file
      ? file.type.startsWith("image/")
        ? "IMAGE"
        : file.type.startsWith("video/")
          ? "VIDEO"
          : file.type.startsWith("audio/")
            ? "AUDIO"
            : "TEXT"
      : "TEXT";
    if (mediaUrl) optimisticMediaRef.current.set(failedId, mediaUrl);
    failedRetryRef.current.set(failedId, payload);
    setMessages((current) => [
      ...current,
      {
        id: failedId,
        direction: "OUTBOUND",
        messageType,
        text: payload.kind === "TEXT" ? payload.text : null,
        mediaUrl,
        mediaId: null,
        igMessageId: null,
        readAt: null,
        seenAt: null,
        createdAt: new Date().toISOString(),
        sendStatus: "FAILED",
      },
    ]);
    initialScrollPendingRef.current = true;
  }

  async function retryFailedMessage(messageId: string) {
    const payload = failedRetryRef.current.get(messageId);
    if (!payload || sending) return;
    const localUrl = optimisticMediaRef.current.get(messageId);
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      optimisticMediaRef.current.delete(messageId);
    }
    failedRetryRef.current.delete(messageId);
    setMessages((current) => current.filter((message) => message.id !== messageId));
    if (payload.kind === "FILE") {
      await sendFile(payload.file);
      return;
    }
    await sendTextMessage(payload.text);
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
          <p className="text-sm leading-6 text-muted-foreground">
            برای استفاده از پیام‌ها ابتدا یک اکانت Instagram متصل کنید.
          </p>
        </div>
      </section>
    );
  }

  const listPanel = (
    <aside className="flex min-h-0 flex-1 flex-col bg-background lg:w-[360px] lg:flex-none lg:border-l lg:border-border">
      <div className="shrink-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-center justify-end gap-3">
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
                      {preview(conversation.messages[conversation.messages.length - 1])}
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

          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-muted/20 px-3 py-4 sm:px-5 sm:py-5"
          >
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
                          className={`overflow-hidden shadow-sm ${
                            message.messageType === "AUDIO"
                              ? "rounded-[22px]"
                              : "rounded-2xl " +
                                (outbound
                                  ? "rounded-bl-md bg-primary text-primary-foreground"
                                  : "rounded-br-md border border-border bg-background text-foreground")
                          } ${
                            message.messageType === "AUDIO"
                              ? outbound
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-background text-foreground"
                              : ""
                          }`}
                        >
                          {hasMedia && (
                            <MediaBubble
                              message={message}
                              onMediaLoad={scrollToInitialBottom}
                            />
                          )}

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
                          {outbound && message.sendStatus === "FAILED" ? (
                            <button
                              type="button"
                              onClick={() => void retryFailedMessage(message.id)}
                              disabled={sending}
                              className="flex items-center gap-1 rounded-full text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                              title="ارسال مجدد"
                              aria-label="ارسال مجدد پیام"
                            >
                              <CircleHelp size={14} strokeWidth={2.5} />
                            </button>
                          ) : outbound &&
                            (message.seenAt ? (
                              <span className="flex items-center gap-0.5 font-medium text-blue-500">
                                <CheckCheck size={12} strokeWidth={2.5} />
                                <span>Seen</span>
                              </span>
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
                    className="mx-auto block h-32 max-h-32 max-w-full object-contain sm:h-40 sm:max-h-40"
                  />
                )}

                {selectedFileUrl && selectedFile.type.startsWith("video/") && (
                  <video
                    src={selectedFileUrl}
                    controls
                    className="mx-auto block h-32 max-h-32 max-w-full bg-black object-contain sm:h-40 sm:max-h-40"
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
              <div className="grid min-w-0 w-full grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5 shadow-sm">
                <Button
                  type="button"
                  onClick={cancelRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground hover:bg-muted"
                  aria-label="لغو ضبط"
                >
                  <X size={17} />
                </Button>

                <div className="flex min-w-0 w-full items-center gap-2 overflow-hidden px-0.5">
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <div className="flex h-7 min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden">
                    {recordingWaveform.map((height, index) => (
                      <span
                        key={index}
                        className="w-[2px] min-w-[2px] shrink-0 rounded-full bg-foreground/60 transition-[height] duration-75"
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
                  disabled={sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground p-0 text-background hover:bg-foreground/90 disabled:opacity-50"
                  aria-label="ارسال Voice"
                >
                  <Send size={16} />
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
                    className="min-h-11 flex-1 resize-none rounded-2xl border-border bg-muted/40 px-4 py-2.5 text-base leading-6 outline-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm"
                  />

                  <Button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={sending}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background p-0 text-muted-foreground hover:bg-muted disabled:opacity-50"
                    aria-label="ضبط Voice"
                  >
                    <Mic size={18} />
                  </Button>

                  <Button
                    type="submit"
                    disabled={sending || (!text.trim() && !selectedFile)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary p-0 text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    aria-label="ارسال"
                  >
                    <Send size={17} />
                  </Button>
                </div>

                <div className="mt-1.5 flex items-center justify-between px-1 text-[9px] text-muted-foreground">
                  <span>+ برای عکس، ویدیو و فایل صوتی</span>
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
    <section id="messages" dir="rtl" className="scroll-mt-24 overflow-x-hidden">
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
