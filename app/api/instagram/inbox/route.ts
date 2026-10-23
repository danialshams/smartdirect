import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";

import { authOptions } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import {
  InstagramApiError,
  instagramApiRequest,
} from "@/lib/instagram/client";
import {
  proxyInstagramMediaUrl,
  proxyInstagramParticipantProfileUrl,
} from "@/lib/instagram/media-proxy";
import { getInstagramMessagingWindow } from "@/lib/instagram/messaging-window";
import { normalizeInstagramAudio } from "@/lib/instagram/audio-normalizer";
import { normalizeInstagramVideo } from "@/lib/instagram/video-normalizer";
import { getStorageProvider } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_IMAGE_SIZE = 8_000_000 - 1;
const MAX_MESSAGE_MEDIA_SIZE = 25_000_000 - 1;


type HandoffState = {
  conversationId: string;
  active: boolean;
  assignedToUserId: string | null;
  handedOffAt: Date;
  handedBackAt: Date | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      error?: { message?: unknown } | unknown;
    };

    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message;
    }

    if (
      candidate.error &&
      typeof candidate.error === "object" &&
      typeof (candidate.error as { message?: unknown }).message === "string"
    ) {
      return (candidate.error as { message: string }).message;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to the safe fallback.
    }
  }

  return fallback;
}

function proxyConversationMedia<
  T extends {
    instagramAccountId: string;
    participantId: string;
    participantProfilePicture?: string | null;
    messages?: Array<{ id: string; mediaUrl?: string | null }>;
  },
>(conversation: T): T {
  return {
    ...conversation,
    participantProfilePicture: conversation.participantId
      ? proxyInstagramParticipantProfileUrl(
          conversation.instagramAccountId,
          conversation.participantId,
        )
      : proxyInstagramMediaUrl(conversation.participantProfilePicture),
    messages: conversation.messages?.map((message) => ({
      ...message,
      mediaUrl: proxyInstagramMediaUrl(
        message.mediaUrl,
        conversation.instagramAccountId,
        message.id,
      ),
    })),
  };
}

async function getHandoffState(conversationId: string) {
  const rows = await prisma.$queryRaw<HandoffState[]>`
    SELECT
      "conversationId",
      "active",
      "assignedToUserId",
      "handedOffAt",
      "handedBackAt"
    FROM "ConversationHandoff"
    WHERE "conversationId" = ${conversationId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getHandoffStates(conversationIds: string[]) {
  if (!conversationIds.length) {
    return new Map<string, HandoffState>();
  }

  const rows = await prisma.$queryRaw<HandoffState[]>`
    SELECT
      "conversationId",
      "active",
      "assignedToUserId",
      "handedOffAt",
      "handedBackAt"
    FROM "ConversationHandoff"
    WHERE "conversationId" IN (${Prisma.join(conversationIds)})
  `;

  return new Map(rows.map((row) => [row.conversationId, row]));
}

async function getOwnedAccount(userId: string, accountId?: string | null) {
  return prisma.instagramAccount.findFirst({
    where: {
      userId,
      ...(accountId ? { id: accountId } : {}),
      isConnected: true,
    },
    select: {
      id: true,
      igUserId: true,
      igUsername: true,
    },
  });
}

async function enrichParticipantProfile(
  accountId: string,
  participantId: string,
  accessToken: string,
  tenantId: string,
) {
  try {
    const profile = await instagramApiRequest<{
      name?: string;
      username?: string;
      profile_pic?: string;
    }>("/" + encodeURIComponent(participantId), {
      accessToken,
      params: {
        fields: "name,username,profile_pic",
      },
      timeoutMs: 30_000,
      rateLimit: {
        instagramAccountId: accountId,
        tenantId,
        operation: "CONVERSATION_READ",
      },
    });

    if (!profile.username && !profile.name && !profile.profile_pic) {
      return;
    }

    await prisma.conversation.updateMany({
      where: {
        instagramAccountId: accountId,
        participantId,
      },
      data: {
        ...(profile.username ? { participantUsername: profile.username } : {}),
        ...(profile.name ? { participantName: profile.name } : {}),
        ...(profile.profile_pic
          ? { participantProfilePicture: profile.profile_pic }
          : {}),
      },
    });
  } catch (error) {
    console.warn("Instagram participant profile lookup failed:", error);
  }
}

async function uploadInstagramAttachment({
  instagramAccountId,
  tenantId,
  igUserId,
  accessToken,
  file,
  alreadyNormalized = false,
}: {
  instagramAccountId: string;
  tenantId: string;
  igUserId: string;
  accessToken: string;
  file: File;
  alreadyNormalized?: boolean;
}) {
  const mimeType = file.type.toLowerCase();

  const attachmentType = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
        ? "audio"
        : null;

  if (!attachmentType) {
    throw new Error("فقط فایل‌های عکس، ویدیو و صوت قابل ارسال هستند.");
  }

  if (file.size <= 0) throw new Error("فایل خالی است.");
  const maxSize = attachmentType === "image" ? MAX_MESSAGE_IMAGE_SIZE : MAX_MESSAGE_MEDIA_SIZE;
  if (file.size > maxSize) {
    throw new Error(attachmentType === "image" ? "حجم تصویر برای دایرکت باید کمتر از ۸ مگابایت باشد." : "حجم ویدیو یا صدا برای دایرکت باید کمتر از ۲۵ مگابایت باشد.");
  }
  if (attachmentType === "image" && !["image/jpeg", "image/png"].includes(mimeType)) {
    throw new Error("برای تصویر دایرکت از JPG یا PNG استفاده کن.");
  }
  let uploadBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
  let uploadFileName = file.name || "smartdirect-media";
  let uploadContentType = mimeType;
  if (attachmentType === "audio" && !alreadyNormalized) {
    uploadBuffer = await normalizeInstagramAudio(Buffer.from(uploadBuffer), uploadFileName);
    uploadFileName = path.basename(uploadFileName, path.extname(uploadFileName)) + ".m4a";
    uploadContentType = "audio/mp4";
  }
  if (attachmentType === "video" && !alreadyNormalized) {
    uploadBuffer = await normalizeInstagramVideo(Buffer.from(uploadBuffer), uploadFileName, "MESSAGE");
    uploadFileName = path.basename(uploadFileName, path.extname(uploadFileName)) + ".mp4";
    uploadContentType = "video/mp4";
  }

  const uploadBody = new FormData();

  const blobBuffer = new ArrayBuffer(uploadBuffer.byteLength);
  new Uint8Array(blobBuffer).set(uploadBuffer);

  uploadBody.append(
    "message",
    JSON.stringify({
      attachment: {
        type: attachmentType,
        payload: {
          is_reusable: false,
        },
      },
    }),
  );

  uploadBody.append(
    "filedata",
    new Blob([blobBuffer], {
      type: uploadContentType,
    }),
    uploadFileName,
  );

  const data = await instagramApiRequest<{
    attachment_id?: string;
  }>("/" + encodeURIComponent(igUserId) + "/message_attachments", {
    method: "POST",
    accessToken,
    body: uploadBody,
    timeoutMs: 90_000,
    rateLimit: {
      instagramAccountId,
      tenantId,
      operation: "MESSAGE_MEDIA",
    },
  });

  if (!data.attachment_id) {
    throw new Error("Instagram پاسخ موفق داد اما attachment_id برنگرداند.");
  }

  return {
    attachmentId: data.attachment_id,
    attachmentType,
  };
}

async function getInstagramMessageMediaUrl({
  messageId,
  accessToken,
  instagramAccountId,
  tenantId,
}: {
  messageId: string;
  accessToken: string;
  instagramAccountId: string;
  tenantId: string;
}) {
  try {
    const data = await instagramApiRequest<{
      attachments?: {
        data?: Array<{
          file_url?: string;
          url?: string;
          image_data?: { url?: string; medial_url?: string };
          video_data?: { url?: string };
          audio_data?: { url?: string };
          payload?: { url?: string };
        }>;
      };
    }>(`/${encodeURIComponent(messageId)}`, {
      params: {
        fields: "attachments",
      },
      accessToken,
      timeoutMs: 30_000,
      rateLimit: {
        instagramAccountId,
        tenantId,
        operation: "MESSAGE_MEDIA",
      },
    });

    const attachment = data.attachments?.data?.[0];

    return (
      attachment?.file_url ??
      attachment?.url ??
      attachment?.payload?.url ??
      attachment?.image_data?.url ??
      attachment?.image_data?.medial_url ??
      attachment?.video_data?.url ??
      attachment?.audio_data?.url ??
      null
    );
  } catch (error) {
    console.warn("[INBOX_MEDIA_DEBUG] message-media-lookup-failed", {
      messageId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

async function refreshConversationMediaUrls({
  conversationId,
  accountId,
  tenantId,
  accessToken,
  messages,
}: {
  conversationId: string;
  accountId: string;
  tenantId: string;
  accessToken: string;
  messages: Array<{
    id: string;
    messageType: string;
    mediaUrl: string | null;
    mediaId: string | null;
    igMessageId: string | null;
  }>;
}) {
  const mediaMessages = messages.filter(
    (message) =>
      ["IMAGE", "VIDEO", "AUDIO", "STICKER"].includes(message.messageType) &&
      Boolean(message.igMessageId) &&
      !message.mediaUrl,
  );

  if (!mediaMessages.length) return messages;

  const refreshed = await Promise.all(
    mediaMessages.map(async (message) => {
      const freshUrl = await getInstagramMessageMediaUrl({
        messageId: message.igMessageId!,
        accessToken,
        instagramAccountId: accountId,
        tenantId,
      });

      if (!freshUrl) return message;

      if (freshUrl !== message.mediaUrl) {
        await prisma.conversationMessage.update({
          where: { id: message.id },
          data: { mediaUrl: freshUrl },
        });
      }

      return {
        ...message,
        mediaUrl: freshUrl,
      };
    }),
  );

  const refreshedMap = new Map(refreshed.map((message) => [message.id, message]));

  return messages.map((message) => refreshedMap.get(message.id) ?? message);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return jsonError("برای مشاهده Inbox باید وارد حساب شوید.", 401);
    }

    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get("accountId");
    const conversationId = searchParams.get("conversationId");
    const conversationSearch = searchParams.get("conversationSearch")?.trim().slice(0, 100) || "";
    const before = searchParams.get("before");
    const focusId = searchParams.get("focusId");
    const messageSearch = searchParams.get("messageSearch")?.trim().slice(0, 100) || "";
    const conversationOffset = Math.min(10000, Math.max(0, Number(searchParams.get("offset")) || 0));

    const account = await getOwnedAccount(session.user.id, accountId);

    if (!account) {
      console.error("[INBOX_DEBUG] account-not-found", { accountId });
      return jsonError("اکانت متصل Instagram پیدا نشد.", 404);
    }

    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id,
          instagramAccountId: account.id,
        },
      });

      if (!conversation) {
        return jsonError("گفتگو پیدا نشد.", 404);
      }

      const messageSelect = {
        id: true,
        direction: true,
        messageType: true,
        text: true,
        mediaUrl: true,
        mediaId: true,
        igMessageId: true,
        readAt: true,
        seenAt: true,
        createdAt: true,
      } as const;

      if (messageSearch) {
        const matches = await prisma.conversationMessage.findMany({
          where: {
            conversationId: conversation.id,
            text: { contains: messageSearch, mode: "insensitive" },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
          select: messageSelect,
        });
        return NextResponse.json({ success: true, matches });
      }

      // A scoped cursor keeps chat loading bounded even for very long histories.
      const cursor = before
        ? await prisma.conversationMessage.findFirst({
            where: { id: before, conversationId: conversation.id },
            select: { id: true },
          })
        : null;

      const focused = focusId
        ? await prisma.conversationMessage.findFirst({
            where: { id: focusId, conversationId: conversation.id },
            select: { id: true },
          })
        : null;

      let messagesPage;
      let hasMoreMessages = false;
      let hasNewerMessages = false;

      if (focused) {
        const [older, newer] = await Promise.all([
          prisma.conversationMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            cursor: { id: focused.id },
            take: 26,
            select: messageSelect,
          }),
          prisma.conversationMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            cursor: { id: focused.id },
            skip: 1,
            take: 26,
            select: messageSelect,
          }),
        ]);
        hasMoreMessages = older.length > 25;
        hasNewerMessages = newer.length > 25;
        messagesPage = [...older.slice(0, 25).reverse(), ...newer.slice(0, 25)];
      } else {
        const latest = await prisma.conversationMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
          take: 51,
          select: messageSelect,
        });
        hasMoreMessages = latest.length > 50;
        messagesPage = latest.slice(0, 50).reverse();
      }

      const accessToken = await getValidInstagramAccessToken(account.id);
      const refreshedMessages = await refreshConversationMediaUrls({
        conversationId: conversation.id,
        accountId: account.id,
        tenantId: session.user.id,
        accessToken,
        messages: messagesPage,
      });

      const lastInbound = await prisma.conversationMessage.findFirst({
        where: {
          conversationId: conversation.id,
          direction: "INBOUND",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      });

      const messagingWindow = getInstagramMessagingWindow(
        lastInbound?.createdAt ?? null,
      );

      const handoff = await getHandoffState(conversation.id);

      return NextResponse.json({
        success: true,
        account: {
          id: account.id,
          username: account.igUsername,
          igUserId: account.igUserId,
        },
        conversation: {
          ...proxyConversationMedia({ ...conversation, messages: refreshedMessages }),
          hasMoreMessages,
          hasNewerMessages,
          nextCursor: refreshedMessages[0]?.id ?? null,
          humanMode: handoff?.active ?? false,
          handoff,
          messagingWindow,
        },
      });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: session.user.id,
        instagramAccountId: account.id,
        ...(conversationSearch ? {
          OR: [
            { participantUsername: { contains: conversationSearch, mode: "insensitive" as const } },
            { participantName: { contains: conversationSearch, mode: "insensitive" as const } },
            { messages: { some: { text: { contains: conversationSearch, mode: "insensitive" as const } } } },
          ],
        } : {}),
      },
      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      skip: conversationOffset,
      take: 51,
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            direction: true,
            messageType: true,
            text: true,
            mediaUrl: true,
            mediaId: true,
            igMessageId: true,
            readAt: true,
            seenAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
    const hasMoreConversations = conversations.length > 50;
    const visibleConversations = conversations.slice(0, 50);
    const conversationIds = visibleConversations.map((item) => item.id);

    const unread = await prisma.conversationMessage.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: {
          in: conversationIds,
        },
        direction: "INBOUND",
        readAt: null,
      },
      _count: {
        _all: true,
      },
    });

    const unreadMap = new Map(
      unread.map((item) => [item.conversationId, item._count._all]),
    );

    const lastInboundRows = conversationIds.length
      ? await prisma.conversationMessage.findMany({
          where: {
            conversationId: {
              in: conversationIds,
            },
            direction: "INBOUND",
          },
          orderBy: {
            createdAt: "desc",
          },
          distinct: ["conversationId"],
          select: {
            conversationId: true,
            createdAt: true,
          },
        })
      : [];

    const lastInboundMap = new Map(
      lastInboundRows.map((item) => [item.conversationId, item.createdAt]),
    );

    const handoffMap = await getHandoffStates(
      conversations.map((item) => item.id),
    );

    const freshConversations = await prisma.conversation.findMany({
      where: {
        id: {
          in: visibleConversations.map((item) => item.id),
        },
      },
      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            direction: true,
            messageType: true,
            text: true,
            mediaUrl: true,
            mediaId: true,
            igMessageId: true,
            readAt: true,
            seenAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        username: account.igUsername,
        igUserId: account.igUserId,
      },
      hasMoreConversations,
      nextOffset: conversationOffset + visibleConversations.length,
      conversations: freshConversations.map((item) => {
        const handoff = handoffMap.get(item.id) ?? null;

        return {
          ...proxyConversationMedia(item),
          unreadCount: unreadMap.get(item.id) || 0,
          humanMode: handoff?.active ?? false,
          handoff,
          messagingWindow: getInstagramMessagingWindow(
            lastInboundMap.get(item.id) ?? null,
          ),
        };
      }),
    });
  } catch (error) {
    console.error("Instagram inbox GET error:", error);

    return jsonError(
      error instanceof Error ? error.message : "خطا در دریافت Inbox",
      500,
    );
  }
}

/** Fetch only a pending upload owned by the authenticated dashboard user. */
async function loadStagedInboxMedia(userId: string, storageKey: string) {
  if (!storageKey.startsWith("pending/" + userId + "/")) throw new Error("فایل متعلق به این کاربر نیست.");
  const item = await prisma.instagramStorageObject.findFirst({
    where: { userId, storageKey, deletedAt: null },
    select: { publicUrl: true },
  });
  if (!item?.publicUrl) throw new Error("فایل موقت برای ارسال پیدا نشد.");
  const url = new URL(item.publicUrl);
  const allowed = [process.env.S3_PUBLIC_BASE_URL, process.env.LOCAL_STORAGE_PUBLIC_URL]
    .filter((value): value is string => Boolean(value))
    .some((value) => { try { const base = new URL(value); return base.origin === url.origin && url.pathname.startsWith(base.pathname.replace(/\\/$/, "") + "/"); } catch { return false; } });
  const vercelHost = url.hostname.endsWith(".public.blob.vercel-storage.com");
  if (url.protocol !== "https:" || url.username || url.password || (!vercelHost && !allowed)) {
    throw new Error("آدرس فایل برای ارسال معتبر نیست.");
  }
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error("دریافت فایل آپلودشده ناموفق بود.");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_MESSAGE_MEDIA_SIZE) throw new Error("حجم فایل بیش از حد مجاز است.");
  const data = await response.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_MESSAGE_MEDIA_SIZE) throw new Error("حجم فایل معتبر نیست.");
  const name = storageKey.split("/").at(-1) || "inbox-media";
  const normalizedAudio = name.endsWith(".normalized.m4a");
  const normalizedVideo = name.endsWith(".normalized.mp4");
  const fallbackType = normalizedAudio ? "audio/mp4" : normalizedVideo ? "video/mp4" : "";
  const receivedType = response.headers.get("content-type")?.split(";")[0] || "";
  const type = fallbackType || receivedType;
  if (!/^(image\\/(jpeg|png)|video\\/(mp4|quicktime)|audio\\/(mp4|mpeg|webm|ogg|wav|x-wav|aac))$/.test(type)) {
    throw new Error("فرمت فایل آپلودشده برای دایرکت مجاز نیست.");
  }
  return { file: new File([data], name, { type }), alreadyNormalized: normalizedAudio || normalizedVideo };
}

export async function POST(request: NextRequest) {
  const debugId = `inbox-send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    console.info("[INBOX_SEND_DEBUG] request-start", {
      debugId,
      method: request.method,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
    });
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return jsonError("برای ارسال پیام باید وارد حساب شوید.", 401);
    }

    const contentType = request.headers.get("content-type") || "";

    let body: Record<string, unknown> = {};
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();

      body = {
        accountId: form.get("accountId"),
        conversationId: form.get("conversationId"),
        text: form.get("text"),
      };

      const candidate = form.get("file");

      file = candidate instanceof File ? candidate : null;
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }

    const accountId = typeof body.accountId === "string" ? body.accountId : "";

    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";

    const stagedStorageKey = typeof body.stagedStorageKey === "string" ? body.stagedStorageKey : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const action = typeof body.action === "string" ? body.action : "";

    console.info("[INBOX_SEND_DEBUG] parsed-request", {
      debugId,
      accountId,
      conversationId,
      hasText: Boolean(text),
      textLength: text.length,
      action: action || null,
      hasFile: Boolean(file),
      file: file
        ? {
            name: file.name,
            type: file.type,
            size: file.size,
          }
        : null,
    });

    if (!accountId || !conversationId) {
      console.error("[INBOX_SEND_DEBUG] validation-failed", {
        debugId,
        reason: "missing-account-or-conversation",
      });
      return jsonError("accountId و conversationId الزامی هستند.");
    }

    if (action !== "mark_seen" && !text && !file && !stagedStorageKey) {
      return jsonError("متن یا فایل پیام الزامی است.");
    }

    if (action !== "mark_seen" && text.length > 1000) {
      return jsonError("متن پیام نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.");
    }

    const account = await getOwnedAccount(session.user.id, accountId);

    if (!account) {
      return jsonError("اکانت متصل Instagram پیدا نشد.", 404);
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
        instagramAccountId: account.id,
      },
      select: {
        id: true,
        participantId: true,
      },
    });

    if (!conversation) {
      console.error("[INBOX_SEND_DEBUG] conversation-not-found", {
        debugId,
        conversationId,
        accountId: account.id,
      });
      return jsonError("گفتگو پیدا نشد.", 404);
    }

    const lastInbound = await prisma.conversationMessage.findFirst({
      where: {
        conversationId: conversation.id,
        direction: "INBOUND",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    const messagingWindow = getInstagramMessagingWindow(
      lastInbound?.createdAt ?? null,
    );

    if (action !== "mark_seen" && !messagingWindow.canSend) {
      return jsonError(
        "مهلت ارسال پیام به پایان رسیده است. کاربر باید دوباره پیام بدهد.",
        403,
      );
    }

    console.info("[INBOX_SEND_DEBUG] conversation-resolved", {
      debugId,
      accountId: account.id,
      igUserId: account.igUserId,
      participantId: conversation.participantId,
    });

    const accessToken = await getValidInstagramAccessToken(account.id);

    if (action === "mark_seen") {
      try {
        await instagramApiRequest(
          `/${encodeURIComponent(account.igUserId)}/messages`,
          {
            method: "POST",
            accessToken,
            body: {
              recipient: {
                id: conversation.participantId,
              },
              sender_action: "mark_seen",
            },
            timeoutMs: 30_000,
            rateLimit: {
              instagramAccountId: account.id,
              tenantId: session.user.id,
              operation: "CONVERSATION_READ",
            },
          },
        );

        await prisma.conversationMessage.updateMany({
          where: {
            conversationId: conversation.id,
            direction: "INBOUND",
            readAt: null,
          },
          data: {
            readAt: new Date(),
          },
        });

        console.info("[INBOX_READ_DEBUG] mark-seen-success", {
          accountId: account.id,
          conversationId: conversation.id,
          participantId: conversation.participantId,
        });

        return NextResponse.json({
          success: true,
          markedSeen: true,
        });
      } catch (error) {
        console.error("[INBOX_READ_DEBUG] mark-seen-failed", {
          accountId: account.id,
          conversationId: conversation.id,
          errorMessage: getErrorMessage(error, "Instagram mark_seen failed"),
        });

        return jsonError(
          getErrorMessage(error, "علامت‌گذاری پیام‌ها به‌عنوان خوانده‌شده ناموفق بود."),
          502,
        );
      }
    }

    console.info("[INBOX_SEND_DEBUG] access-token-resolved", {
      debugId,
      accountId: account.id,
      hasAccessToken: Boolean(accessToken),
    });

    let messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" = "TEXT";

    let mediaId: string | null = null;
    const mediaUrl: string | null = null;

    const messageBody: Record<string, unknown> = {
      recipient: {
        id: conversation.participantId,
      },
      ...(messagingWindow.mode === "HUMAN_AGENT"
        ? {
            messaging_type: "MESSAGE_TAG",
            tag: "HUMAN_AGENT",
          }
        : {
            messaging_type: "RESPONSE",
          }),
    };

    let attachmentFile = file;
    let alreadyNormalized = false;
    if (!attachmentFile && stagedStorageKey) {
      const staged = await loadStagedInboxMedia(session.user.id, stagedStorageKey);
      attachmentFile = staged.file;
      alreadyNormalized = staged.alreadyNormalized;
    }
    if (attachmentFile) {
      console.info("[INBOX_SEND_DEBUG] attachment-upload-start", {
        debugId,
        attachmentType: attachmentFile.type,
        fileName: attachmentFile.name,
        fileSize: attachmentFile.size,
      });

      const uploaded = await uploadInstagramAttachment({
        instagramAccountId: account.id,
        tenantId: session.user.id,
        igUserId: account.igUserId,
        accessToken,
        file: attachmentFile,
        alreadyNormalized,
      });

      console.info("[INBOX_SEND_DEBUG] attachment-upload-success", {
        debugId,
        attachmentId: uploaded.attachmentId,
        attachmentType: uploaded.attachmentType,
      });

      mediaId = uploaded.attachmentId;

      messageType =
        uploaded.attachmentType === "image"
          ? "IMAGE"
          : uploaded.attachmentType === "video"
            ? "VIDEO"
            : "AUDIO";

      messageBody.message = {
        attachment: {
          type: uploaded.attachmentType,
          payload: {
            attachment_id: uploaded.attachmentId,
          },
        },
      };
    } else {
      messageBody.message = {
        text,
      };
    }


    console.info(
      "[INBOX_SEND_DEBUG] meta-message-send-start",
      JSON.stringify({
        accountId: account.id,
        conversationId: conversation.id,
        messageType,
      }),
    );

    let data: { message_id?: string };

    try {
      data = await instagramApiRequest<{ message_id?: string }>(
        `/${encodeURIComponent(account.igUserId)}/messages`,
        {
          method: "POST",
          accessToken,
          body: messageBody,
          timeoutMs: 30_000,
          rateLimit: {
            instagramAccountId: account.id,
            tenantId: session.user.id,
            operation: attachmentFile ? "MESSAGE_MEDIA" : "MESSAGE_TEXT",
          },
        },
      );
    } catch (error) {
      console.error("[INBOX_SEND_DEBUG] meta-message-send-failed", {
        debugId,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        error:
          error instanceof InstagramApiError
            ? {
                status: error.status,
                details: error.details,
                response: error.response,
              }
            : null,
      });
      const status = error instanceof InstagramApiError ? error.status : 502;
      const message = getErrorMessage(
        error,
        "Instagram پیام را ارسال نکرد.",
      );
      return jsonError(message, status >= 400 && status < 500 ? status : 502);
    }

    console.info("[INBOX_SEND_DEBUG] meta-message-send-success", {
      debugId,
      messageId: data.message_id ?? null,
      messageType,
    });

    if (!data.message_id) {
      console.error("[INBOX_SEND_DEBUG] missing-message-id", { debugId, data });
      return jsonError("Instagram پاسخ موفق داد اما message_id برنگرداند.", 502);
    }

    // Do not block the send response on a second Graph API lookup for the
    // attachment URL. The UI can render the local file immediately, and the
    // media URL is resolved lazily when the conversation is loaded.
    const createdMessage = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        messageType,
        text: text || null,
        mediaUrl,
        mediaId,
        igMessageId: data.message_id,
      },
      select: {
        id: true,
        direction: true,
        messageType: true,
        text: true,
        mediaUrl: true,
        mediaId: true,
        igMessageId: true,
        readAt: true,
        seenAt: true,
        createdAt: true,
      },
    });

    await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        lastMessageAt: createdMessage.createdAt,
      },
    });

    console.info("[INBOX_SEND_DEBUG] db-message-created", {
      debugId,
      dbMessageId: createdMessage.id,
      igMessageId: createdMessage.igMessageId,
      messageType: createdMessage.messageType,
    });

    return NextResponse.json({
      success: true,
      message: {
        ...createdMessage,
        mediaUrl: proxyInstagramMediaUrl(createdMessage.mediaUrl, account.id),
      },
    });
  } catch (error) {
    console.error("[INBOX_SEND_DEBUG] unhandled-error", {
      debugId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return jsonError(
      getErrorMessage(error, "خطا در ارسال پیام"),
      500,
    );
  }
}
