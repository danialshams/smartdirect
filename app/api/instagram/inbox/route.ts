import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

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

export const dynamic = "force-dynamic";

const MAX_MESSAGE_MEDIA_SIZE = 25 * 1024 * 1024;
const SAFE_AUDIO_SIZE = 24 * 1024 * 1024;
const execFileAsync = promisify(execFile);


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

function proxyConversationMedia<
  T extends {
    instagramAccountId: string;
    participantId: string;
    participantProfilePicture?: string | null;
    messages?: Array<{ mediaUrl?: string | null }>;
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
      mediaUrl: proxyInstagramMediaUrl(message.mediaUrl, conversation.instagramAccountId),
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
}: {
  instagramAccountId: string;
  tenantId: string;
  igUserId: string;
  accessToken: string;
  file: File;
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

  if (file.size > MAX_MESSAGE_MEDIA_SIZE) {
    throw new Error("حجم فایل نمی‌تواند بیشتر از ۲۵ مگابایت باشد.");
  }

  let uploadBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
  let uploadFileName = file.name || "smartdirect-media";
  let uploadContentType = mimeType;

  if (attachmentType === "audio") {
    if (!ffmpegPath) {
      throw new Error("FFmpeg در سرور برای آماده‌سازی Voice در دسترس نیست.");
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "smartdirect-inbox-audio-"));
    const inputPath = path.join(tempDir, "input" + (path.extname(uploadFileName) || ".audio"));
    const outputPath = path.join(tempDir, "output.m4a");

    try {
      await writeFile(inputPath, uploadBuffer);
      let normalized: Uint8Array<ArrayBufferLike> | null = null;

      for (const bitrate of ["96k", "64k", "48k"]) {
        await rm(outputPath, { force: true });
        await execFileAsync(
          ffmpegPath,
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            inputPath,
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            bitrate,
            "-ar",
            "44100",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            outputPath,
          ],
          { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
        );

        normalized = new Uint8Array(await readFile(outputPath));
        if (normalized.length <= SAFE_AUDIO_SIZE) break;
      }

      if (!normalized || normalized.length > SAFE_AUDIO_SIZE) {
        throw new Error("حجم فایل صوتی پس از تبدیل باید حداکثر ۲۴ مگابایت باشد.");
      }

      uploadBuffer = normalized;
      uploadFileName = path.basename(uploadFileName, path.extname(uploadFileName)) + ".m4a";
      uploadContentType = "audio/mp4";
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
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
    timeoutMs: 30_000,
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
          image_data?: { url?: string; medial_url?: string };
          video_data?: { url?: string };
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
        operation: "CONVERSATION_READ",
      },
    });

    const attachment = data.attachments?.data?.[0];

    return (
      attachment?.file_url ??
      attachment?.image_data?.url ??
      attachment?.image_data?.medial_url ??
      attachment?.video_data?.url ??
      null
    );
  } catch (error) {
    console.warn("[INBOX_SEND_DEBUG] sent-media-url-lookup-failed", {
      messageId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
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
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
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
          },
        },
      });

      if (!conversation) {
        return jsonError("گفتگو پیدا نشد.", 404);
      }

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
      const refreshed = await prisma.conversation.findUnique({
        where: {
          id: conversation.id,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
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
          },
        },
      });

      const handoff = await getHandoffState(conversation.id);

      return NextResponse.json({
        success: true,
        account: {
          id: account.id,
          username: account.igUsername,
          igUserId: account.igUserId,
        },
        conversation: {
          ...proxyConversationMedia(refreshed || conversation),
          humanMode: handoff?.active ?? false,
          handoff,
        },
      });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: session.user.id,
        instagramAccountId: account.id,
      },
      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 100,
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
    const unread = await prisma.conversationMessage.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: {
          in: conversations.map((item) => item.id),
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

    const handoffMap = await getHandoffStates(
      conversations.map((item) => item.id),
    );

    const freshConversations = await prisma.conversation.findMany({
      where: {
        id: {
          in: conversations.map((item) => item.id),
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
      conversations: freshConversations.map((item) => {
        const handoff = handoffMap.get(item.id) ?? null;

        return {
          ...proxyConversationMedia(item),
          unreadCount: unreadMap.get(item.id) || 0,
          humanMode: handoff?.active ?? false,
          handoff,
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

    const text = typeof body.text === "string" ? body.text.trim() : "";

    console.info("[INBOX_SEND_DEBUG] parsed-request", {
      debugId,
      accountId,
      conversationId,
      hasText: Boolean(text),
      textLength: text.length,
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

    if (!text && !file) {
      return jsonError("متن یا فایل پیام الزامی است.");
    }

    if (text.length > 1000) {
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

    console.info("[INBOX_SEND_DEBUG] conversation-resolved", {
      debugId,
      accountId: account.id,
      igUserId: account.igUserId,
      participantId: conversation.participantId,
    });

    const accessToken = await getValidInstagramAccessToken(account.id);

    console.info("[INBOX_SEND_DEBUG] access-token-resolved", {
      debugId,
      accountId: account.id,
      hasAccessToken: Boolean(accessToken),
    });

    let messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" = "TEXT";

    let mediaId: string | null = null;
    let mediaUrl: string | null = null;

    const messageBody: Record<string, unknown> = {
      recipient: {
        id: conversation.participantId,
      },
    };

    if (file) {
      console.info("[INBOX_SEND_DEBUG] attachment-upload-start", {
        debugId,
        attachmentType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });

      const uploaded = await uploadInstagramAttachment({
        instagramAccountId: account.id,
        tenantId: session.user.id,
        igUserId: account.igUserId,
        accessToken,
        file,
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
            operation: file ? "MESSAGE_MEDIA" : "MESSAGE_TEXT",
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
      const message = error instanceof Error ? error.message : "Instagram پیام را ارسال نکرد.";
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

    if (mediaId) {
      mediaUrl = await getInstagramMessageMediaUrl({
        messageId: data.message_id,
        accessToken,
        instagramAccountId: account.id,
        tenantId: session.user.id,
      });

      console.info("[INBOX_SEND_DEBUG] sent-media-url-resolved", {
        debugId,
        messageId: data.message_id,
        hasMediaUrl: Boolean(mediaUrl),
      });
    }

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
      error instanceof Error ? error.message : "خطا در ارسال پیام",
      500,
    );
  }
}
