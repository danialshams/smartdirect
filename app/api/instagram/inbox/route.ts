import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

function jsonError(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
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

async function enrichParticipantProfile(accountId: string, participantId: string, accessToken: string) {
    try {
        const profileResponse = await fetch(
            `${GRAPH_BASE}/${encodeURIComponent(participantId)}?fields=name,username,profile_pic`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
            },
        );

        if (!profileResponse.ok) return null;

        const profile = (await profileResponse.json()) as {
            name?: string;
            username?: string;
            profile_pic?: string;
        };

        if (!profile.username && !profile.name && !profile.profile_pic) return null;

        return prisma.conversation.updateMany({
            where: {
                instagramAccountId: accountId,
                participantId,
            },
            data: {
                participantUsername: profile.username || undefined,
                participantName: profile.name || undefined,
                participantProfilePicture: profile.profile_pic || undefined,
            },
        });
    } catch (error) {
        console.warn("Instagram participant profile lookup failed:", error);
        return null;
    }
}

async function uploadInstagramAttachment({
    igUserId,
    accessToken,
    file,
}: {
    igUserId: string;
    accessToken: string;
    file: File;
}) {
    const mimeType = file.type.toLowerCase();
    let attachmentType: "image" | "video" | "audio";

    if (mimeType.startsWith("image/")) attachmentType = "image";
    else if (mimeType.startsWith("video/")) attachmentType = "video";
    else if (mimeType.startsWith("audio/")) attachmentType = "audio";
    else throw new Error("فقط فایل‌های عکس، ویدیو و صوت قابل ارسال هستند.");

    if (file.size > 25 * 1024 * 1024) {
        throw new Error("حجم فایل نمی‌تواند بیشتر از ۲۵ مگابایت باشد.");
    }

    const uploadBody = new FormData();
    uploadBody.append(
        "message",
        JSON.stringify({
            attachment: {
                type: attachmentType,
                payload: { is_reusable: false },
            },
        }),
    );
    uploadBody.append("filedata", new Blob([await file.arrayBuffer()], { type: mimeType }), "smartdirect-media");

    const uploadResponse = await fetch(`${GRAPH_BASE}/${igUserId}/message_attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadBody,
        cache: "no-store",
    });

    const uploadData = (await uploadResponse.json().catch(() => ({}))) as {
        attachment_id?: string;
        error?: { message?: string };
    };

    if (!uploadResponse.ok || !uploadData.attachment_id) {
        throw new Error(uploadData.error?.message || "آپلود فایل به Instagram ناموفق بود.");
    }

    return { attachmentId: uploadData.attachment_id, attachmentType };
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return jsonError("برای مشاهده Inbox باید وارد حساب شوید.", 401);

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");
        const conversationId = searchParams.get("conversationId");
        const account = await getOwnedAccount(session.user.id, accountId);

        if (!account) return jsonError("اکانت متصل Instagram پیدا نشد.", 404);

        const accessToken = await getValidInstagramAccessToken(account.id);

        if (conversationId) {
            const conversation = await prisma.conversation.findFirst({
                where: {
                    id: conversationId,
                    userId: session.user.id,
                    instagramAccountId: account.id,
                },
                include: {
                    messages: {
                        orderBy: { createdAt: "asc" },
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

            if (!conversation) return jsonError("گفتگو پیدا نشد.", 404);

            await prisma.conversationMessage.updateMany({
                where: {
                    conversationId: conversation.id,
                    direction: "INBOUND",
                    readAt: null,
                },
                data: { readAt: new Date() },
            });

            const refreshed = await prisma.conversation.findUnique({
                where: { id: conversation.id },
                include: {
                    messages: {
                        orderBy: { createdAt: "asc" },
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

            if (!refreshed) return jsonError("گفتگو پیدا نشد.", 404);

            if (!refreshed.participantUsername) {
                await enrichParticipantProfile(account.id, refreshed.participantId, accessToken);
            }

            const finalConversation = await prisma.conversation.findUnique({
                where: { id: refreshed.id },
                include: {
                    messages: {
                        orderBy: { createdAt: "asc" },
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

            return NextResponse.json({
                success: true,
                account: { id: account.id, username: account.igUsername, igUserId: account.igUserId },
                conversation: finalConversation || refreshed,
            });
        }

        const conversations = await prisma.conversation.findMany({
            where: { userId: session.user.id, instagramAccountId: account.id },
            orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
            take: 100,
            include: {
                messages: {
                    orderBy: { createdAt: "desc" },
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
                _count: { select: { messages: true } },
            },
        });

        const missingProfiles = conversations.filter((item) => !item.participantUsername).slice(0, 25);
        await Promise.all(
            missingProfiles.map((item) => enrichParticipantProfile(account.id, item.participantId, accessToken)),
        );

        const unread = await prisma.conversationMessage.groupBy({
            by: ["conversationId"],
            where: {
                conversationId: { in: conversations.map((item) => item.id) },
                direction: "INBOUND",
                readAt: null,
            },
            _count: { _all: true },
        });
        const unreadMap = new Map(unread.map((item) => [item.conversationId, item._count._all]));

        const freshConversations = await prisma.conversation.findMany({
            where: { id: { in: conversations.map((item) => item.id) } },
            orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
            include: {
                messages: {
                    orderBy: { createdAt: "desc" },
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
                _count: { select: { messages: true } },
            },
        });

        return NextResponse.json({
            success: true,
            account: { id: account.id, username: account.igUsername, igUserId: account.igUserId },
            conversations: freshConversations.map((item) => ({ ...item, unreadCount: unreadMap.get(item.id) || 0 })),
        });
    } catch (error) {
        console.error("Instagram inbox GET error:", error);
        return jsonError(error instanceof Error ? error.message : "خطا در دریافت Inbox", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return jsonError("برای ارسال پیام باید وارد حساب شوید.", 401);

        const contentType = request.headers.get("content-type") || "";
        const accountId = contentType.includes("multipart/form-data")
            ? String((await request.clone().formData()).get("accountId") || "")
            : "";

        let body: Record<string, unknown> = {};
        let file: File | null = null;

        if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            body = {
                accountId: form.get("accountId"),
                conversationId: form.get("conversationId"),
                text: form.get("text"),
                replyToMessageId: form.get("replyToMessageId"),
            };
            const candidate = form.get("file");
            file = candidate instanceof File ? candidate : null;
        } else {
            body = (await request.json()) as Record<string, unknown>;
        }

        const resolvedAccountId = typeof body.accountId === "string" ? body.accountId : accountId;
        const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
        const text = typeof body.text === "string" ? body.text.trim() : "";
        const replyToMessageId = typeof body.replyToMessageId === "string" ? body.replyToMessageId : "";

        if (!resolvedAccountId || !conversationId) return jsonError("accountId و conversationId الزامی هستند.");
        if (!text && !file) return jsonError("متن یا فایل پیام الزامی است.");
        if (text.length > 1000) return jsonError("متن پیام نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.");

        const account = await getOwnedAccount(session.user.id, resolvedAccountId);
        if (!account) return jsonError("اکانت متصل Instagram پیدا نشد.", 404);

        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId: session.user.id, instagramAccountId: account.id },
            select: { id: true, participantId: true },
        });
        if (!conversation) return jsonError("گفتگو پیدا نشد.", 404);

        const accessToken = await getValidInstagramAccessToken(account.id);
        let messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" = "TEXT";
        let mediaId: string | null = null;
        let mediaUrl: string | null = null;

        const messageBody: Record<string, unknown> = {
            recipient: { id: conversation.participantId },
        };

        if (file) {
            const uploaded = await uploadInstagramAttachment({
                igUserId: account.igUserId,
                accessToken,
                file,
            });
            mediaId = uploaded.attachmentId;
            messageType = uploaded.attachmentType === "image" ? "IMAGE" : uploaded.attachmentType === "video" ? "VIDEO" : "AUDIO";
            messageBody.message = {
                attachment: {
                    type: uploaded.attachmentType,
                    payload: { attachment_id: uploaded.attachmentId },
                },
                ...(text ? { text } : {}),
            };
        } else {
            messageBody.message = { text };
        }

        if (replyToMessageId) {
            const replyTarget = await prisma.conversationMessage.findFirst({
                where: { id: replyToMessageId, conversationId: conversation.id },
                select: { igMessageId: true },
            });
            if (replyTarget?.igMessageId) {
                messageBody.reply_to = { mid: replyTarget.igMessageId };
            }
        }

        const response = await fetch(`${GRAPH_BASE}/${account.igUserId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(messageBody),
            cache: "no-store",
        });

        const data = (await response.json().catch(() => ({}))) as {
            message_id?: string;
            error?: { message?: string };
        };

        if (!response.ok) {
            console.error("Instagram inbox send error:", data);
            return jsonError(data?.error?.message || "Instagram پیام را ارسال نکرد.", response.status >= 400 && response.status < 500 ? response.status : 502);
        }

        const createdMessage = await prisma.conversationMessage.create({
            data: {
                conversationId: conversation.id,
                direction: "OUTBOUND",
                messageType,
                text: text || null,
                mediaUrl,
                mediaId,
                igMessageId: data.message_id || undefined,
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

        await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: createdMessage.createdAt } });

        return NextResponse.json({ success: true, message: createdMessage });
    } catch (error) {
        console.error("Instagram inbox POST error:", error);
        return jsonError(error instanceof Error ? error.message : "خطا در ارسال پیام", 500);
    }
}
