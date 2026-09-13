import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "ابتدا وارد حساب کاربری شوید." },
                { status: 401 },
            );
        }

        const accounts = await prisma.instagramAccount.findMany({
            where: { userId: session.user.id },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                igUserId: true,
                igUsername: true,
                isConnected: true,
            },
        });

        return NextResponse.json({ success: true, accounts });
    } catch (error) {
        console.error("[Instagram Accounts]", error);

        return NextResponse.json(
            { success: false, error: "خطا در دریافت اکانت‌های Instagram." },
            { status: 500 },
        );
    }
}
