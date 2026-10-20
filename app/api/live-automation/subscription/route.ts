import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSubscription, subscribeLiveComments } from "@/lib/instagram/live-webhook-subscription";

export const dynamic = "force-dynamic";

async function resolveAccount(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "احراز هویت انجام نشده است.", status: 401 } as const;
  let accountId = new URL(request.url).searchParams.get("instagramAccountId")?.trim() || "";
  if (request.method === "POST" && !accountId) {
    const body: unknown = await request.json().catch(() => null);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const requested = (body as Record<string, unknown>).instagramAccountId;
      if (typeof requested === "string") accountId = requested.trim();
    }
  }
  if (!accountId) return { error: "شناسه پیج الزامی است.", status: 400 } as const;
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId: session.user.id, isConnected: true }, select: { id: true },
  });
  if (!account) return { error: "پیج متصل پیدا نشد.", status: 404 } as const;
  return { accountId: account.id };
}

export async function GET(request: NextRequest) {
  const a = await resolveAccount(request);
  if ("error" in a) return NextResponse.json({ success: false, error: a.error }, { status: a.status });
  const state = await getLiveSubscription(a.accountId);
  if (state.error) console.warn("[LIVE_WEBHOOK] subscription-status-check-failed", { instagramAccountId: a.accountId, error: state.error });
  return NextResponse.json({ success: !state.error, data: state, error: state.error });
}

export async function POST(request: NextRequest) {
  const a = await resolveAccount(request);
  if ("error" in a) return NextResponse.json({ success: false, error: a.error }, { status: a.status });
  const state = await subscribeLiveComments(a.accountId);
  if (!state.subscribed) console.error("[LIVE_WEBHOOK] subscription-failed", { instagramAccountId: a.accountId, error: state.error ?? "Meta did not confirm subscription" });
  return NextResponse.json({ success: state.subscribed, data: state, error: state.error }, { status: state.subscribed ? 200 : 502 });
}
