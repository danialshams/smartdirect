import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "ابتدا وارد حساب کاربری شوید." },
                { status: 401 },
            );
        }

        const accountId = new URL(request.url).searchParams.get("accountId");

        const account = await prisma.instagramAccount.findFirst({
            where: {
                userId: session.user.id,
                ...(accountId ? { id: accountId } : {}),
            },
            select: {
                id: true,
                igUserId: true,
                igUsername: true,
                isConnected: true,
                tokenExpiresAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!account) {
            return NextResponse.json(
                { success: false, error: "اکانت Instagram پیدا نشد." },
                { status: 404 },
            );
        }

        const [
            automations,
            conversations,
            inboundMessages,
            outboundMessages,
            publishJobs,
            publishedJobs,
            scheduledJobs,
            failedJobs,
            forms,
            showcases,
            pendingFollowGates,
            latestConversations,
            latestPublishing,
        ] = await Promise.all([
            prisma.automation.groupBy({
                by: ["isActive"],
                where: { instagramAccountId: account.id },
                _count: { _all: true },
            }),
            prisma.conversation.count({ where: { instagramAccountId: account.id } }),
            prisma.conversationMessage.count({
                where: {
                    conversation: { instagramAccountId: account.id },
                    direction: "INBOUND",
                },
            }),
            prisma.conversationMessage.count({
                where: {
                    conversation: { instagramAccountId: account.id },
                    direction: "OUTBOUND",
                },
            }),
            prisma.instagramPublishJob.count({ where: { instagramAccountId: account.id } }),
            prisma.instagramPublishJob.count({
                where: { instagramAccountId: account.id, status: "PUBLISHED" },
            }),
            prisma.instagramPublishJob.count({
                where: { instagramAccountId: account.id, status: "SCHEDULED" },
            }),
            prisma.instagramPublishJob.count({
                where: { instagramAccountId: account.id, status: "FAILED" },
            }),
            prisma.form.count({ where: { instagramAccountId: account.id, isActive: true } }),
            prisma.showcase.count({ where: { instagramAccountId: account.id, isActive: true } }),
            prisma.pendingFollowGate.count({
                where: { instagramAccountId: account.id, status: "PENDING" },
            }),
            prisma.conversation.findMany({
                where: { instagramAccountId: account.id },
                orderBy: { lastMessageAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    participantId: true,
                    lastMessageAt: true,
                    isActive: true,
                },
            }),
            prisma.instagramPublishJob.findMany({
                where: { instagramAccountId: account.id },
                orderBy: { updatedAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    type: true,
                    status: true,
                    scheduledAt: true,
                    publishedAt: true,
                    updatedAt: true,
                },
            }),
        ]);

        const activeAutomations = automations.find((item) => item.isActive)?._count._all ?? 0;
        const inactiveAutomations = automations.find((item) => !item.isActive)?._count._all ?? 0;

        return NextResponse.json({
            success: true,
            account: {
                id: account.id,
                igUserId: account.igUserId,
                username: account.igUsername,
                isConnected: account.isConnected,
                tokenExpiresAt: account.tokenExpiresAt,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
            },
            operations: {
                automations: {
                    total: activeAutomations + inactiveAutomations,
                    active: activeAutomations,
                    inactive: inactiveAutomations,
                },
                messaging: {
                    conversations,
                    inboundMessages,
                    outboundMessages,
                },
                publishing: {
                    total: publishJobs,
                    published: publishedJobs,
                    scheduled: scheduledJobs,
                    failed: failedJobs,
                },
                tools: {
                    activeForms: forms,
                    activeShowcases: showcases,
                    pendingFollowGates,
                },
            },
            latest: {
                conversations: latestConversations,
                publishing: latestPublishing,
            },
        });
    } catch (error) {
        console.error("[Instagram Business Dashboard]", error);

        return NextResponse.json(
            { success: false, error: "خطا در دریافت خلاصه مدیریتی Instagram." },
            { status: 500 },
        );
    }
}
