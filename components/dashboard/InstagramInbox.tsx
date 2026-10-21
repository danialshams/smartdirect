"use client";

import { Button, DashboardLoading } from "@/components/dashboard/DashboardUI";
import { Input } from "@/components/dashboard/DashboardUI";
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
  Search,
  Send,
  ArrowDown,
  Square,
  RotateCcw,
  UserRound,
  Video,
  X,
  CircleHelp,
} from "lucide-react";
import {
  Fragment,
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
  sendStatus?: "FAILED" | "SENDING";
  failureReason?: string;
};

type RetryPayload =
  | { kind: "TEXT"; text: string }
  | { kind: "FILE"; file: File };

type MessagingWindow = {
  mode: "STANDARD" | "HUMAN_AGENT" | "CLOSED";
  canSend: boolean;
  humanAgentEnabled: boolean;
  lastInboundAt: string | null;
  standardExpiresAt: string | null;
  humanAgentExpiresAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
};

type Conversation = {
  id: string;
  participantId: string;
  participantUsername: string | null;
  participantName: string | null;
  participantProfilePicture: string | null;
  isActive: boolean;
  messagingWindow?: MessagingWindow;
  lastMessageAt: string | null;
  updatedAt: string;
  messages: Message[];
  unreadCount?: number;
  hasMoreMessages?: boolean;
  hasNewerMessages?: boolean;
  nextCursor?: string | null;
};

type ApiResult = {
  success?: boolean;
  error?: string;
  conversations?: Conversation[];
  conversation?: Conversation;
  message?: Message;
  matches?: Message[];
  hasMoreConversations?: boolean;
  nextOffset?: number;
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

function messagingWindowLabel(window?: MessagingWindow) {
  if (!window) return null;
  if (window.mode === "STANDARD") return "امکان پاسخ‌گویی فعال";
  if (window.mode === "HUMAN_AGENT") return "پشتیبانی انسانی فعال";
  return "زمان پاسخ‌گویی تمام شده";
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
            onKeyDown={(event) => {
              const audio = audioRef.current;
              if (!audio || !Number.isFinite(audio.duration)) return;
              if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? audio.duration :
                audio.currentTime + (event.key === "ArrowRight" ? 5 : -5);
              audio.currentTime = Math.min(audio.duration, Math.max(0, next));
              setCurrentTime(audio.currentTime);
            }}
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
  accountsLoading = false,
}: {
  accounts: Account[];
  accountsLoading?: boolean;
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
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [searchingThreads, setSearchingThreads] = useState(false);
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
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [nextConversationsOffset, setNextConversationsOffset] = useState(0);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearchText, setConversationSearchText] = useState("");
  const [conversationMatches, setConversationMatches] = useState<Message[]>([]);
  const [conversationSearching, setConversationSearching] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [recordedVoice, setRecordedVoice] = useState<File | null>(null);
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
  const conversationFetchIdRef = useRef(0);
  const loadedMoreConversationsRef = useRef(false);
  const messageFetchIdRef = useRef(0);
  const pendingMessageFetchRef = useRef<string | null>(null);
  const activeConversationRef = useRef("");
  const previousNewestIdRef = useRef<string | null>(null);
  activeConversationRef.current = accountId + ":" + selectedId;
  const initialScrollPendingRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const failedRetryRef = useRef<Map<string, RetryPayload>>(new Map());
  const optimisticMediaRef = useRef<Map<string, string>>(new Map());
  const optimisticMessagesByConversationRef = useRef<Map<string, Message[]>>(new Map());
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
      loadedMoreConversationsRef.current = false;
      setConversations([]);
      setAccountId(connectedAccounts[0]?.id || "");
    }
  }, [accountId, connectedAccounts]);

  const loadConversations = useCallback(async () => {
    if (!accountId) {
      setConversations([]);
      setSelectedId("");
      setMessages([]);
      setMobileChatOpen(false);
      setHasMoreConversations(false);
      loadedMoreConversationsRef.current = false;
      return;
    }

    const requestId = ++conversationFetchIdRef.current;
    try {
      if (!conversations.length) setLoading(true);
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

      if (requestId !== conversationFetchIdRef.current) return;
      const next = result.conversations || [];
      if (!loadedMoreConversationsRef.current) {
        setHasMoreConversations(Boolean(result.hasMoreConversations));
        setNextConversationsOffset(result.nextOffset ?? next.length);
      }
      setConversations((current) => {
        const nextIds = new Set(next.map((item) => item.id));
        return [...next, ...current.filter((item) => !nextIds.has(item.id))];
      });

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

        if (nextId && nextId !== current) {
          initialScrollPendingRef.current = true;
          shouldStickToBottomRef.current = true;
        }

        return nextId;
      });

      if (savedIdIsValid && !selectedId) {
        setMobileChatOpen(savedMobileOpen);
      }
    } catch (err) {
      if (requestId === conversationFetchIdRef.current) {
        setError(err instanceof Error ? err.message : "خطا در دریافت گفتگوها");
      }
    } finally {
      if (requestId === conversationFetchIdRef.current) setLoading(false);
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

        if (response.ok && result.success && activeConversationRef.current === accountId + ":" + selectedId) {
          lastMarkedInboundRef.current = inboundMarker;
          setConversations((current) => current.map((item) =>
            item.id === selectedId ? { ...item, unreadCount: 0 } : item
          ));
        }
      } catch {
        // A failed read receipt must never block the inbox.
      }
    },
    [accountId, selectedId],
  );


  const loadMessages = useCallback(async (options?: { before?: string; focusId?: string }) => {
    if (!accountId || !selectedId) {
      setMessages([]);
      return;
    }

    const key = accountId + ":" + selectedId;
    if (!options && pendingMessageFetchRef.current === key) return;
    if (!options) pendingMessageFetchRef.current = key;
    const requestId = ++messageFetchIdRef.current;
    const container = messagesScrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    if (container && !options?.before && !options?.focusId) {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottomRef.current = distance < 100;
    }

    try {
      if (options?.before) setLoadingOlderMessages(true);
      else setMessagesLoading(true);
      const params = new URLSearchParams({ accountId, conversationId: selectedId });
      if (options?.before) params.set("before", options.before);
      if (options?.focusId) params.set("focusId", options.focusId);
      const response = await fetch(`/api/instagram/inbox?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = await readApiResult(response);
      if (!response.ok || !result.success || !result.conversation) {
        throw new Error(result.error || "خطا در دریافت پیام‌ها");
      }
      if (requestId !== messageFetchIdRef.current || activeConversationRef.current !== key) return;

      const serverMessages = result.conversation.messages || [];
      const mergedMessages = serverMessages.map((message) => {
        const optimisticUrl = optimisticMediaRef.current.get(message.id);
        if (message.mediaUrl && optimisticUrl) {
          URL.revokeObjectURL(optimisticUrl);
          optimisticMediaRef.current.delete(message.id);
        }
        return !message.mediaUrl && optimisticUrl ? { ...message, mediaUrl: optimisticUrl } : message;
      });
      setMessages((current) => {
        const localPending = optimisticMessagesByConversationRef.current.get(key) || [];
        const merged = options?.before
          ? [...mergedMessages, ...current]
          : options?.focusId ? mergedMessages : [...mergedMessages, ...localPending];
        return [...new Map(merged.map((item) => [item.id, item])).values()]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      setHasMoreMessages(Boolean(result.conversation.hasMoreMessages));
      setConversations((current) => current.map((item) =>
        item.id === selectedId
          ? { ...item, ...result.conversation, messages: item.messages, unreadCount: item.unreadCount }
          : item
      ));

      if (options?.before && container) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (messagesScrollRef.current === container) {
            container.scrollTop = previousTop + container.scrollHeight - previousHeight;
          }
        }));
      } else if (options?.focusId) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          container?.querySelector(`[data-message-id="${options.focusId}"]`)?.scrollIntoView({ block: "center" });
        }));
      } else {
        const latest = serverMessages.at(-1);
        if (latest && previousNewestIdRef.current && latest.id !== previousNewestIdRef.current && !shouldStickToBottomRef.current) {
          setNewMessageCount((value) => value + 1);
        }
        if (latest) previousNewestIdRef.current = latest.id;
      }

      const latestInbound = [...serverMessages].reverse().find((message) => message.direction === "INBOUND");
      const isVisible = document.visibilityState === "visible" &&
        (window.matchMedia("(min-width: 1024px)").matches || mobileChatOpen);
      if (!options?.before && !options?.focusId && latestInbound && isVisible) {
        void markConversationSeen(latestInbound.igMessageId || latestInbound.id);
      }
    } catch (err) {
      if (requestId === messageFetchIdRef.current && activeConversationRef.current === key) {
        setError(err instanceof Error ? err.message : "خطا در دریافت پیام‌ها");
      }
    } finally {
      if (requestId === messageFetchIdRef.current) {
        setMessagesLoading(false);
        setLoadingOlderMessages(false);
      }
      if (pendingMessageFetchRef.current === key) pendingMessageFetchRef.current = null;
    }
  }, [accountId, selectedId, markConversationSeen, mobileChatOpen]);

  async function loadMoreConversations() {
    if (!accountId || loadingMoreConversations || !hasMoreConversations) return;
    setLoadingMoreConversations(true);
    try {
      const response = await fetch(`/api/instagram/inbox?accountId=${encodeURIComponent(accountId)}&offset=${nextConversationsOffset}`, { cache: "no-store" });
      const result = await readApiResult(response);
      if (!response.ok || !result.success) throw new Error(result.error || "دریافت گفتگوهای بیشتر ناموفق بود.");
      const page = result.conversations || [];
      loadedMoreConversationsRef.current = true;
      setConversations((current) => [...current, ...page.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setNextConversationsOffset(result.nextOffset ?? nextConversationsOffset + page.length);
      setHasMoreConversations(Boolean(result.hasMoreConversations));
    } catch (err) {
      setError(err instanceof Error ? err.message : "دریافت گفتگوهای بیشتر ناموفق بود.");
    } finally {
      setLoadingMoreConversations(false);
    }
  }

  useEffect(() => {
    lastMarkedInboundRef.current = "";
    previousMessageCountRef.current = 0;
    previousNewestIdRef.current = null;
    setFocusedMessageId(null);
    setNewMessageCount(0);
    setShowJumpToLatest(false);
    setConversationSearchOpen(false);
    setConversationSearchText("");
    setConversationMatches([]);
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
    if (selectedId && (mobileChatOpen || window.matchMedia("(min-width: 1024px)").matches)) {
      void loadMessages();
    }
  }, [loadMessages, selectedId, mobileChatOpen]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadConversations();
      if (selectedId && !focusedMessageId && !loadingOlderMessages &&
          (mobileChatOpen || window.matchMedia("(min-width: 1024px)").matches)) {
        void loadMessages();
      }
    };
    const interval = window.setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadConversations, loadMessages, selectedId, focusedMessageId, loadingOlderMessages, mobileChatOpen]);

  const forceScrollToBottom = useCallback(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    setShowJumpToLatest(false);
    setNewMessageCount(0);
  }, []);

  useEffect(() => {
    if (
      !selectedId ||
      (!mobileChatOpen && !window.matchMedia("(min-width: 1024px)").matches) ||
      messagesLoading ||
      !messages.length
    ) {
      return;
    }

    if (!initialScrollPendingRef.current && !shouldStickToBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        forceScrollToBottom();
        initialScrollPendingRef.current = false;
        shouldStickToBottomRef.current = true;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, mobileChatOpen, messagesLoading, messages.length, forceScrollToBottom]);

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
      optimisticMediaRef.current.forEach((url) => URL.revokeObjectURL(url));
      optimisticMediaRef.current.clear();
    };
  }, []);

  function addOptimisticMessage(payload: RetryPayload): string {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const file = payload.kind === "FILE" ? payload.file : null;
    const mediaUrl = file ? URL.createObjectURL(file) : null;
    if (mediaUrl) optimisticMediaRef.current.set(id, mediaUrl);
    const message: Message = {
      id,
      direction: "OUTBOUND",
      messageType: file?.type.startsWith("image/") ? "IMAGE" : file?.type.startsWith("video/") ? "VIDEO" : file ? "AUDIO" : "TEXT",
      text: payload.kind === "TEXT" ? payload.text : null,
      mediaUrl,
      mediaId: null,
      igMessageId: null,
      readAt: null,
      seenAt: null,
      createdAt: new Date().toISOString(),
      sendStatus: "SENDING",
    };
    const key = accountId + ":" + selectedId;
    optimisticMessagesByConversationRef.current.set(key, [
      ...(optimisticMessagesByConversationRef.current.get(key) || []), message,
    ]);
    if (activeConversationRef.current === key) setMessages((current) => [...current, message]);
    shouldStickToBottomRef.current = true;
    initialScrollPendingRef.current = true;
    return id;
  }

  function markOptimisticFailed(id: string, payload: RetryPayload, reason: string, key: string) {
    failedRetryRef.current.set(id, payload);
    const update = (item: Message) => item.id === id
      ? { ...item, sendStatus: "FAILED" as const, failureReason: reason } : item;
    const cached = optimisticMessagesByConversationRef.current.get(key) || [];
    optimisticMessagesByConversationRef.current.set(key, cached.map(update));
    if (activeConversationRef.current === key) setMessages((current) => current.map(update));
  }

  async function sendFile(file: File): Promise<boolean> {
    if (!accountId || !selectedId || sending || !selectedConversation?.messagingWindow?.canSend) return false;
    const conversationKey = accountId + ":" + selectedId;
    const optimisticId = addOptimisticMessage({ kind: "FILE", file });
    setSending(true);
    try {
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
        throw new Error(result.error || "ارسال رسانه ناموفق بود.");
      }
      const sent = result.message;
      optimisticMessagesByConversationRef.current.set(conversationKey,
        (optimisticMessagesByConversationRef.current.get(conversationKey) || []).filter((item) => item.id !== optimisticId));
      const localUrl = optimisticMediaRef.current.get(optimisticId);
      optimisticMediaRef.current.delete(optimisticId);
      if (localUrl) {
        if (sent.mediaUrl) URL.revokeObjectURL(localUrl);
        else optimisticMediaRef.current.set(sent.id, localUrl);
      }
      if (activeConversationRef.current === conversationKey) {
        setMessages((current) => {
          const updated = current.map((item) => item.id === optimisticId
            ? { ...sent, mediaUrl: sent.mediaUrl || localUrl || null } : item);
          return [...new Map(updated.map((item) => [item.id, item])).values()];
        });
        setSelectedFile(null);
        setRecordedVoice(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      void loadConversations();
      return true;
    } catch (error) {
      markOptimisticFailed(optimisticId, { kind: "FILE", file },
        error instanceof Error ? error.message : "ارسال رسانه ناموفق بود.", conversationKey);
      if (activeConversationRef.current === conversationKey) {
        setSelectedFile(null);
        setRecordedVoice(null);
      }
      return false;
    } finally {
      setSending(false);
    }
  }

  async function sendTextMessage(messageText: string): Promise<boolean> {
    if (!messageText.trim() || !accountId || !selectedId || sending || !selectedConversation?.messagingWindow?.canSend) return false;
    const cleanText = messageText.trim();
    const conversationKey = accountId + ":" + selectedId;
    const optimisticId = addOptimisticMessage({ kind: "TEXT", text: cleanText });
    setSending(true);
    if (activeConversationRef.current === conversationKey) setText("");
    try {
      const form = new FormData();
      form.append("accountId", accountId);
      form.append("conversationId", selectedId);
      form.append("text", cleanText);
      const response = await fetch("/api/instagram/inbox", {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      });
      const result = await readApiResult(response);
      if (!response.ok || !result.success || !result.message) {
        throw new Error(result.error || "ارسال پیام ناموفق بود.");
      }
      optimisticMessagesByConversationRef.current.set(conversationKey,
        (optimisticMessagesByConversationRef.current.get(conversationKey) || []).filter((item) => item.id !== optimisticId));
      if (activeConversationRef.current === conversationKey) {
        setMessages((current) => {
          const updated = current.map((item) => item.id === optimisticId ? result.message! : item);
          return [...new Map(updated.map((item) => [item.id, item])).values()];
        });
      }
      void loadConversations();
      return true;
    } catch (error) {
      markOptimisticFailed(optimisticId, { kind: "TEXT", text: cleanText },
        error instanceof Error ? error.message : "ارسال پیام ناموفق بود.", conversationKey);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!text.trim() && !selectedFile && !recordedVoice) || !accountId || !selectedId || sending) return;
    if (selectedFile || recordedVoice) {
      const file = selectedFile || recordedVoice;
      if (!file) return;
      const accompanyingText = text.trim();
      const sent = await sendFile(file);
      // Graph API sends attachments and text as separate messages.
      if (sent && accompanyingText) await sendTextMessage(accompanyingText);
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
          setRecordedVoice(new File(
            [blob],
            `smartdirect-voice-${Date.now()}.${extension}`,
            { type: blob.type },
          ));
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
    const discovered = searchResults.find((item) => item.id === conversationId);
    if (discovered) setConversations((current) =>
      current.some((item) => item.id === conversationId) ? current : [discovered, ...current]);
    if (conversationId === selectedId) {
      setMobileChatOpen(true);
      return;
    }

    setSelectedId(conversationId);
    initialScrollPendingRef.current = true;
    previousMessageCountRef.current = 0;
    setMessages(optimisticMessagesByConversationRef.current.get(accountId + ":" + conversationId) || []);
    setText("");
    setSelectedFile(null);
    setRecordedVoice(null);
    setConversationSearchOpen(false);
    setConversationMatches([]);
    setHasMoreMessages(false);
    pendingMessageFetchRef.current = null;
    messageFetchIdRef.current += 1;
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

  async function retryFailedMessage(messageId: string) {
    const payload = failedRetryRef.current.get(messageId);
    if (!payload || sending || !selectedConversation?.messagingWindow?.canSend) return;
    failedRetryRef.current.delete(messageId);
    const key = accountId + ":" + selectedId;
    optimisticMessagesByConversationRef.current.set(key,
      (optimisticMessagesByConversationRef.current.get(key) || []).filter((item) => item.id !== messageId));
    const localUrl = optimisticMediaRef.current.get(messageId);
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      optimisticMediaRef.current.delete(messageId);
    }
    setMessages((current) => current.filter((item) => item.id !== messageId));
    if (payload.kind === "FILE") await sendFile(payload.file);
    else await sendTextMessage(payload.text);
  }

  useEffect(() => {
    if (!search.trim() || !accountId) {
      setSearchResults([]);
      setSearchingThreads(false);
      return;
    }
    let valid = true;
    const timer = window.setTimeout(async () => {
      setSearchingThreads(true);
      try {
        const params = new URLSearchParams({ accountId, conversationSearch: search.trim() });
        const response = await fetch(`/api/instagram/inbox?${params.toString()}`, { cache: "no-store" });
        const result = await readApiResult(response);
        if (valid) setSearchResults(response.ok ? result.conversations || [] : []);
      } catch {
        if (valid) setSearchResults([]);
      } finally {
        if (valid) setSearchingThreads(false);
      }
    }, 300);
    return () => { valid = false; window.clearTimeout(timer); };
  }, [accountId, search]);

  const filteredConversations = (search.trim() ? searchResults : conversations).filter((conversation) => {
    if (filter === "UNREAD" && !(conversation.unreadCount || 0)) return false;
    if (filter === "READ" && (conversation.unreadCount || 0) > 0) return false;

    return true;
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
  const recordedVoiceUrl = useMemo(
    () => (recordedVoice ? URL.createObjectURL(recordedVoice) : null),
    [recordedVoice],
  );

  useEffect(() => {
    return () => {
      if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
      if (recordedVoiceUrl) URL.revokeObjectURL(recordedVoiceUrl);
    };
  }, [selectedFileUrl, recordedVoiceUrl]);

  useEffect(() => {
    if (!conversationSearchOpen || !conversationSearchText.trim() || !accountId || !selectedId) {
      setConversationMatches([]);
      setConversationSearching(false);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(async () => {
      setConversationSearching(true);
      try {
        const params = new URLSearchParams({
          accountId,
          conversationId: selectedId,
          messageSearch: conversationSearchText.trim(),
        });
        const response = await fetch(`/api/instagram/inbox?${params.toString()}`, { cache: "no-store" });
        const result = await readApiResult(response);
        if (active) setConversationMatches(response.ok ? result.matches || [] : []);
      } catch {
        if (active) setConversationMatches([]);
      } finally {
        if (active) setConversationSearching(false);
      }
    }, 320);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [accountId, selectedId, conversationSearchOpen, conversationSearchText]);

  async function focusSearchResult(id: string) {
    setFocusedMessageId(id);
    setConversationSearchOpen(false);
    setConversationMatches([]);
    await loadMessages({ focusId: id });
  }

  function returnToLatest() {
    setFocusedMessageId(null);
    initialScrollPendingRef.current = true;
    shouldStickToBottomRef.current = true;
    void loadMessages();
  }

  useEffect(() => {
    if (!mobileChatOpen) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
      document.documentElement.style.setProperty("--smartdirect-inbox-visible-height", `${height}px`);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    viewport?.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("resize", updateViewport);
      document.documentElement.style.removeProperty("--smartdirect-inbox-visible-height");
    };
  }, [mobileChatOpen]);

  const listPanel = (
    <aside className="flex min-h-0 flex-1 flex-col bg-white lg:w-[355px] lg:flex-none lg:border-l lg:border-[#E8EDF5]">
      <div className="shrink-0 border-b border-[#E8EDF5] px-4 pb-3.5 pt-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-[#18233C]">صندوق دایرکت</h1>
            <p className="mt-1 text-[11px] text-[#64748B]">{conversations.length.toLocaleString("fa-IR")} گفتگو</p>
          </div>
          <button type="button" onClick={() => void loadConversations()} aria-label="به‌روزرسانی گفتگوها" title="به‌روزرسانی" className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F5FC] text-[#526580] transition hover:bg-[#E7EEFC]"><RotateCcw size={17}/></button>
        </div>
        <div className="flex min-w-0 flex-nowrap items-center gap-1 rounded-xl bg-[#EEF3FB] p-1" role="group" aria-label="فیلتر گفتگوها">
          {(
            [
              ["ALL", "همه", conversations.length],
              ["READ", "خوانده", readTotal]
              ["UNREAD", "خوانده‌نشده", unreadTotal]
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 py-2 text-[11px] font-semibold transition ${
                filter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="shrink-0 whitespace-nowrap">{label}</span>
              <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums opacity-70">
                {count.toLocaleString("fa-IR")}
              </span>
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <Search
            size={15}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8290A6]"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی گفتگو..."
            className="h-11 rounded-xl border-[#E5EAF3] bg-[#F8FAFD] pr-10 text-[13px] focus:border-[#2F61FD]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3 sm:px-3">
        {(accountsLoading || (connectedAccounts.length > 0 && (!accountId || loading))) && !conversations.length ? (
          <DashboardLoading label="در حال دریافت گفتگوها..." className="dashboard-loading--fill" />
        ) : searchingThreads && search.trim() ? (
          <DashboardLoading label="در حال جست‌وجوی گفتگوها..." className="dashboard-loading--fill" />
        ) : filteredConversations.length ? (
          <>
          {filteredConversations.map((conversation) => {
            const active = conversation.id === selectedId;
            const unread = (conversation.unreadCount || 0) > 0;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`group flex w-full min-h-[56px] items-center gap-2 rounded-xl px-2 py-2 text-right transition ${
                  active
                    ? "bg-[#EBF2FF] ring-1 ring-[#DCE8FF]"
                    : "hover:bg-[#F5F8FE]"
                }`}
              >
                <div className="relative shrink-0">
                  {conversation.participantProfilePicture ? (
                    <img
                      src={conversation.participantProfilePicture}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-1 ring-[#E5EAF3]"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF3FB] text-[#64748B]">
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
                      className={`truncate text-[13px] ${
                        unread
                          ? "font-bold text-foreground"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {displayName(conversation)}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#8290A6]">
                      {formatDate(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-xs leading-5 ${
                        unread
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {preview(conversation.messages[conversation.messages.length - 1])}
                    </p>
                    {unread && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2F61FD] px-1.5 text-[10px] font-bold text-white">
                        {(conversation.unreadCount || 0).toLocaleString("fa-IR")}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {hasMoreConversations && !search.trim() && (
            <button type="button" disabled={loadingMoreConversations} onClick={() => void loadMoreConversations()} className="my-3 w-full rounded-xl border border-[#DBEAFE] bg-[#F8FAFF] px-3 py-3 text-xs font-bold text-[#2F61FD] disabled:opacity-50">
              {loadingMoreConversations ? "در حال بارگذاری…" : "نمایش گفتگوهای بیشتر"}
            </button>
          )}
          </>
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
          <header className="flex shrink-0 items-center gap-2 border-b border-[#E8EDF5] bg-white px-3 py-3 sm:px-5">
            <button type="button" onClick={goBackToList} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#526580] hover:bg-[#F1F5FC] lg:hidden" aria-label="بازگشت به گفتگوها"><ArrowRight size={19}/></button>
            {selectedConversation.participantProfilePicture ? (
              <img src={selectedConversation.participantProfilePicture} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[#E5EAF3]"/>
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF3FB] text-[#64748B]"><UserRound size={19}/></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-[#18233C]">{displayName(selectedConversation)}</p>
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[11px] text-[#71809A]">{selectedConversation.participantName || "دایرکت اینستاگرام"}</span>
                {selectedConversation.messagingWindow && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    selectedConversation.messagingWindow.canSend
                      ? "bg-[#ECFDF3] text-[#16834C]"
                      : "bg-[#FEF2F2] text-[#B91C1C]"
                  }`}>{selectedConversation.messagingWindow.canSend ? "پاسخ‌گویی فعال" : "مهلت پاسخ تمام شده"}</span>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setConversationSearchOpen((value) => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#526580] hover:bg-[#F1F5FC]" aria-label="جست‌وجو در پیام‌ها" aria-expanded={conversationSearchOpen}><Search size={19}/></button>
          </header>

          {conversationSearchOpen && (
            <div className="shrink-0 border-b border-[#E8EDF5] bg-white px-3 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <input autoFocus value={conversationSearchText} onChange={(event) => setConversationSearchText(event.target.value)} placeholder="جست‌وجو در پیام‌های این گفتگو..." aria-label="جست‌وجو در پیام‌های گفتگو" className="h-11 min-w-0 flex-1 rounded-xl border border-[#DFE7F3] bg-[#F8FAFD] px-3 text-sm text-[#18233C] outline-none focus:border-[#2F61FD]" />
                <button type="button" onClick={() => {setConversationSearchOpen(false);setConversationSearchText("");}} className="grid h-10 w-10 place-items-center rounded-xl text-[#64748B]" aria-label="بستن جست‌وجو"><X size={18}/></button>
              </div>
              {conversationSearchText.trim() && (
                <div className="mt-2 max-h-[32vh] space-y-1 overflow-y-auto" aria-live="polite">
                  {conversationSearching ? <p className="p-3 text-xs text-[#64748B]">در حال جست‌وجو…</p> :
                  conversationMatches.length ? conversationMatches.map((result) => (
                    <button key={result.id} type="button" onClick={() => void focusSearchResult(result.id)} className="flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-right hover:bg-[#F1F5FC]">
                      <span className="line-clamp-2 text-xs leading-5 text-[#18233C]">{result.text}</span>
                      <span className="text-[10px] text-[#94A3B8]">{formatDate(result.createdAt)}</span>
                    </button>
                  )) : <p className="p-3 text-xs text-[#64748B]">پیامی پیدا نشد.</p>}
                </div>
              )}
            </div>
          )}

          <div
            ref={messagesScrollRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
              shouldStickToBottomRef.current = distance < 100;
              setShowJumpToLatest(distance > 180);
              if (distance < 100) setNewMessageCount(0);
            }}
            className="relative min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-[#F7F9FD] px-3 py-4 sm:px-6 sm:py-5"
          >
            {focusedMessageId && (
              <div className="mx-auto mb-4 flex max-w-2xl justify-center">
                <button type="button" onClick={returnToLatest} className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-4 py-2 text-xs font-bold text-[#2F61FD] shadow-sm">
                  <ArrowDown size={15}/> بازگشت به آخرین پیام‌ها
                </button>
              </div>
            )}
            {messagesLoading && !messages.length ? (
              <DashboardLoading label="در حال دریافت پیام‌ها..." className="dashboard-loading--fill" />
            ) : messages.length ? (
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-1">
                {hasMoreMessages && (
                  <button type="button" disabled={loadingOlderMessages} onClick={() => {
                    const first = messages.find((message) => !message.sendStatus);
                    if (first) void loadMessages({ before: first.id });
                  }} className="mx-auto mb-4 rounded-full border border-[#E0E8F5] bg-white px-4 py-2 text-xs font-bold text-[#64748B] shadow-sm disabled:opacity-50">
                    {loadingOlderMessages ? "در حال دریافت…" : "نمایش پیام‌های قدیمی‌تر"}
                  </button>
                )}
                {messages.map((message, index) => {
                  const outbound = message.direction === "OUTBOUND";
                  const previous = messages[index - 1];
                  const sameSender = Boolean(previous && previous.direction === message.direction &&
                    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300000);
                  const showDate = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                  const hasMedia = Boolean(message.mediaUrl);
                  return (
                    <Fragment key={message.id}>
                      {showDate && (
                        <div className="my-4 flex items-center justify-center" role="separator">
                          <span className="rounded-full bg-[#E9EEF7] px-3 py-1.5 text-[11px] font-medium text-[#667893]">
                            {new Date(message.createdAt).toLocaleDateString("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>
                      )}
                      <div data-message-id={message.id} className={`flex ${sameSender ? "mt-0.5" : "mt-2"} ${outbound ? "justify-start" : "justify-end"}`}>
                        <div className="max-w-[85%] sm:max-w-[70%]">
                          <div className={`overflow-hidden shadow-[0_2px_8px_rgba(20,40,80,.04)] ${
                            message.messageType === "AUDIO" ? "rounded-[21px]" :
                              "rounded-[20px] " + (outbound
                                ? "rounded-br-[20px] rounded-bl-md bg-[#2F61FD] text-white"
                                : "rounded-br-md border border-[#E7EDF5] bg-white text-[#18233C]")
                          } ${message.messageType === "AUDIO" ? (outbound ? "bg-[#2F61FD] text-white" : "border border-[#E7EDF5] bg-white text-[#18233C]") : ""}`}>
                            {hasMedia && <MediaBubble message={message} onMediaLoad={scrollToInitialBottom}/>}
                            {message.text && (
                              <div className="px-3.5 py-2.5">
                                <p dir="auto" className="whitespace-pre-wrap break-words text-[13px] leading-6">{message.text}</p>
                              </div>
                            )}
                            {!hasMedia && !message.text && (
                              <div className="px-3.5 py-2.5 text-xs opacity-75">{preview(message)}</div>
                            )}
                          </div>
                          <div className={`mt-1 flex items-center gap-1.5 px-1 text-[10px] text-[#8290A6] ${outbound ? "justify-start" : "justify-end"}`}>
                            <span>{formatTime(message.createdAt)}</span>
                            {outbound && message.sendStatus === "SENDING" ? (
                              <span className="text-[#64748B]" role="status">در حال ارسال…</span>
                            ) : outbound && message.sendStatus === "FAILED" ? (
                              <button type="button" onClick={() => void retryFailedMessage(message.id)}
                                disabled={sending || !selectedConversation.messagingWindow?.canSend}
                                className="inline-flex items-center gap-1 rounded-lg px-1 text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-50"
                                title={message.failureReason || "ارسال ناموفق بود"} aria-label="تلاش دوباره برای ارسال پیام">
                                <CircleHelp size={14}/><span>ناموفق · تلاش مجدد</span>
                              </button>
                            ) : outbound && (message.seenAt ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#2F61FD]"><CheckCheck size={14}/>دیده‌شده</span>
                            ) : <span title="ارسال‌شده"><Check size={13}/></span>)}
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white text-[#94A3B8] shadow-sm"><MessageCircle size={27}/></div>
                  <h3 className="mt-4 text-sm font-bold text-[#18233C]">هنوز پیامی وجود ندارد</h3>
                  <p className="mt-2 max-w-xs text-xs leading-6 text-[#64748B]">اولین پیام را از همین‌جا ارسال کنید.</p>
                </div>
              </div>
            )}
            {showJumpToLatest && !focusedMessageId && (
              <div className="pointer-events-none sticky bottom-3 mt-3 flex justify-center">
                <button type="button" onClick={forceScrollToBottom} className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#2F61FD] shadow-[0_4px_16px_rgba(24,35,60,.15)]" aria-label="رفتن به آخرین پیام">
                  <ArrowDown size={16}/>
                  {newMessageCount ? `${newMessageCount.toLocaleString("fa-IR")} پیام جدید` : "آخرین پیام"}
                </button>
              </div>
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="shrink-0 border-t border-[#E8EDF5] bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:py-3"
          >
            {selectedConversation.messagingWindow && !selectedConversation.messagingWindow.canSend && (
              <div className="mb-2 rounded-lg bg-muted/60 px-3 py-2 text-[10px] leading-5 text-muted-foreground">
                زمان مجاز پاسخ‌گویی به این گفتگو تمام شده است. با پیام جدید کاربر، امکان پاسخ دوباره فعال می‌شود.
              </div>
            )}
            {recordedVoice && recordedVoiceUrl && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-[#DBEAFE] bg-[#F4F8FF] p-3">
                <Mic size={17} className="shrink-0 text-[#2F61FD]"/>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-bold text-[#18233C]">پیش‌نمایش پیام صوتی</p>
                  <audio src={recordedVoiceUrl} controls className="h-9 w-full" preload="metadata"/>
                </div>
                <button type="button" onClick={() => setRecordedVoice(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#64748B] hover:bg-[#FEE2E2]" aria-label="حذف ویس ضبط‌شده"><X size={17}/></button>
              </div>
            )}
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
                    <span className="shrink-0 text-[10px] tabular-nums text-[#8290A6]">
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
                  variant="icon"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 text-primary hover:text-primary/80 disabled:text-slate-300"
                  aria-label="پایان ضبط و پیش‌نمایش ویس"
                >
                  <Square size={16} fill="currentColor" />
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
                    const file = event.target.files?.[0] || null;
                    if (file && file.size > 25 * 1024 * 1024) {
                      setError("حجم فایل نباید بیشتر از ۲۵ مگابایت باشد.");
                      event.currentTarget.value = "";
                      return;
                    }
                    setError("");
                    setRecordedVoice(null);
                    setSelectedFile(file);
                  }}
                />

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    variant="icon"
                    className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl p-0 text-[#64748B] hover:bg-[#F3F6FB] hover:text-[#2F61FD]"
                    aria-label="ارسال عکس، ویدیو یا فایل صوتی"
                  >
                    <Paperclip size={18} />
                  </Button>

                  <textarea
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      const target = event.currentTarget;
                      target.style.height = "auto";
                      target.style.height = Math.min(160, Math.max(40, target.scrollHeight)) + "px";
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="پیام خود را بنویسید..."
                    className="min-h-11 max-h-40 min-w-0 flex-1 resize-none appearance-none rounded-2xl border border-[#E3EAF5] bg-[#F7F9FD] px-4 py-2.5 text-base leading-6 text-[#18233C] outline-none focus:border-[#2F61FD] focus:bg-white"
                    style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }}
                  />

                  {!text.trim() && !selectedFile && !recordedVoice && (
                    <Button type="button" onClick={() => void startRecording()}
                      disabled={sending || !selectedConversation.messagingWindow?.canSend} variant="icon"
                      className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl p-0 text-[#64748B] hover:bg-[#F3F6FB] hover:text-[#2F61FD] disabled:text-slate-300"
                      aria-label="ضبط ویس"><Mic size={20}/></Button>
                  )}

                  <Button
                    type="submit"
                    disabled={
                    sending ||
                    !selectedConversation.messagingWindow?.canSend ||
                    (!text.trim() && !selectedFile && !recordedVoice)
                  }
                    variant="icon"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2F61FD] p-0 text-white shadow-sm hover:bg-[#244ED2] disabled:bg-[#E7EDF6] disabled:text-[#94A3B8]"
                    aria-label="ارسال"
                  >
                    <Send size={17} />
                  </Button>
                </div>

                <div className="mt-1.5 flex items-center justify-end px-1 text-[9px] text-muted-foreground">
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
    <section id="messages" dir="rtl" data-mobile-chat-open={mobileChatOpen ? "true" : "false"} className="scroll-mt-24 overflow-x-hidden">
      <style>{`
        @media (max-width: 1023px) {
          .daira-app-shell:has(#messages[data-mobile-chat-open="true"]) .daira-bottom-nav,
          .daira-app-shell:has(#messages[data-mobile-chat-open="true"]) .daira-bottom-nav-backdrop { display: none; }
          .daira-app-shell:has(#messages[data-mobile-chat-open="true"]) .daira-app-main { padding-bottom: 0; }
          #messages[data-mobile-chat-open="true"] .inbox-frame {
            height: calc(min(100dvh, var(--smartdirect-inbox-visible-height, 100dvh)) - 90px - env(safe-area-inset-top, 0px));
            min-height: 0;
            border-radius: 16px;
          }
        }
      `}</style>
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

      <div className="inbox-frame h-[calc(100dvh-196px)] min-h-0 overflow-hidden rounded-[22px] border border-[#DFE7F3] bg-white shadow-[0_10px_35px_rgba(15,23,42,0.04)] lg:h-[calc(100dvh-235px)] lg:min-h-[420px]">
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
