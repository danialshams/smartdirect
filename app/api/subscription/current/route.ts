import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { planKey: true, status: true, startedAt: true, expiresAt: true },
  });

  return NextResponse.json({ success: true, subscription });
}
