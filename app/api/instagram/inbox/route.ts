import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";

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
                        orderBy: { createdAt: "asc" },
                        select: {
                            id: true,
                            direction: true,
                            messageType: true,
                            text: true,
                            mediaUrl: true,
                            mediaId: true,
                            igMessageId: true,
                            createdAt: true,
                        },
                    },
                },
            });

            if (!conversation) {
                return jsonError("گفتگو پیدا نشد.", 404);
            }

            return NextResponse.json({
                success: true,
                account: {
                    id: account.id,
                    username: account.igUsername,
                    igUserId: account.igUserId,
                },
                conversation,
            });
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                userId: session.user.id,
                instagramAccountId: account.id,
            },
            orderBy: [
                { lastMessageAt: "desc" },
                { updatedAt: "desc" },
            ],
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
                        createdAt: true,
                    },
                },
                _count: {
                    select: { messages: true },
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
            conversations,
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
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return jsonError("برای ارسال پیام باید وارد حساب شوید.", 401);
        }

        const body = await request.json();
        const accountId = typeof body?.accountId === "string" ? body.accountId : "";
        const conversationId =
            typeof body?.conversationId === "string" ? body.conversationId : "";
        const text = typeof body?.text === "string" ? body.text.trim() : "";

        if (!accountId || !conversationId || !text) {
            return jsonError("accountId، conversationId و text الزامی هستند.");
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
            return jsonError("گفتگو پیدا نشد.", 404);
        }

        const accessToken = await getValidInstagramAccessToken(account.id);

        const response = await fetch(
            `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${account.igUserId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    recipient: { id: conversation.participantId },
                    message: { text },
                }),
                cache: "no-store",
            },
        );

        const data = (await response.json().catch(() => ({}))) as {
            message_id?: string;
            error?: { message?: string };
        };

        if (!response.ok) {
            console.error("Instagram inbox send error:", data);
            return jsonError(
                data?.error?.message || "Instagram پیام را ارسال نکرد.",
                response.status >= 400 && response.status < 500 ? response.status : 502,
            );
        }

        const createdMessage = await prisma.conversationMessage.create({
            data: {
                conversationId: conversation.id,
                direction: "OUTBOUND",
                messageType: "TEXT",
                text,
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
                createdAt: true,
            },
        });

        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: createdMessage.createdAt },
        });

        return NextResponse.json({
            success: true,
            message: createdMessage,
        });
    } catch (error) {
        console.error("Instagram inbox POST error:", error);
        return jsonError(
            error instanceof Error ? error.message : "خطا در ارسال پیام",
            500,
        );
    }
}
