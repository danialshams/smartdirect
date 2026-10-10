import { NextRequest, NextResponse } from "next/server";
import { Prisma, SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_BULK_USERS = 500;
const VALID_STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED", "NONE"] as const;
type Filters = { q?: string; planKey?: string; status?: (typeof VALID_STATUSES)[number] | ""; expiryWithin?: "3" | "7" | ""; connection?: "connected" | "disconnected" | "" };

function buildUserWhere(filters: Filters, now: Date): Prisma.UserWhereInput {
  const q = filters.q?.trim() ?? "";
  const planKey = filters.planKey?.trim() ?? "";
  const status = filters.status ?? "";
  const expiryWithin = filters.expiryWithin ?? "";
  const connection = filters.connection ?? "";
  const AND: Prisma.UserWhereInput[] = [];
  const subscriptionConditions: Prisma.SubscriptionWhereInput[] = [];
  if (planKey) subscriptionConditions.push({ planKey });
  if (status === "ACTIVE") subscriptionConditions.push({ status: "ACTIVE", expiresAt: { gt: now } });
  if (status === "EXPIRED") subscriptionConditions.push({ OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lte: now } }] });
  if (status === "SUSPENDED" || status === "CANCELLED") subscriptionConditions.push({ status: status as SubscriptionStatus });
  if (expiryWithin === "3" || expiryWithin === "7") subscriptionConditions.push({ status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + Number(expiryWithin) * 86400000) } });
  if (q) AND.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] });
  if (status === "NONE") {
    AND.push({ subscriptions: { none: {} } });
    if (planKey || expiryWithin) AND.push({ subscriptions: { some: { AND: subscriptionConditions } } });
  } else if (subscriptionConditions.length) AND.push({ subscriptions: { some: { AND: subscriptionConditions } } });
  if (connection === "connected") AND.push({ instagramAccounts: { some: { isConnected: true } } });
  if (connection === "disconnected") AND.push({ instagramAccounts: { none: { isConnected: true } } });
  return { role: "USER", ...(AND.length ? { AND } : {}) };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const body = await req.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!subject || subject.length > 160) return NextResponse.json({ message: "عنوان تیکت الزامی است و حداکثر ۱۶۰ نویسه دارد" }, { status: 400 });
  if (!message || message.length > 5000) return NextResponse.json({ message: "متن تیکت الزامی است و حداکثر ۵۰۰۰ نویسه دارد" }, { status: 400 });

  const selection = body?.selection as { mode?: string; userIds?: unknown; filters?: Filters; excludeUserIds?: unknown } | undefined;
  if (!selection || !["ids", "filtered"].includes(selection.mode ?? "")) return NextResponse.json({ message: "روش انتخاب کاربران معتبر نیست" }, { status: 400 });
  let userIds: string[] = [];
  if (selection.mode === "ids") {
    if (!Array.isArray(selection.userIds)) return NextResponse.json({ message: "فهرست کاربران معتبر نیست" }, { status: 400 });
    userIds = [...new Set(selection.userIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (!userIds.length) return NextResponse.json({ message: "حداقل یک کاربر انتخاب کنید" }, { status: 400 });
    if (userIds.length > MAX_BULK_USERS) return NextResponse.json({ message: "در هر ارسال حداکثر ۵۰۰ کاربر قابل انتخاب است" }, { status: 400 });
  } else {
    const filters = selection.filters ?? {};
    if (filters.status && !VALID_STATUSES.includes(filters.status)) return NextResponse.json({ message: "فیلتر وضعیت اشتراک معتبر نیست" }, { status: 400 });
    if (filters.expiryWithin && !["3", "7"].includes(filters.expiryWithin)) return NextResponse.json({ message: "فیلتر زمان انقضا معتبر نیست" }, { status: 400 });
    if (filters.connection && !["connected", "disconnected"].includes(filters.connection)) return NextResponse.json({ message: "فیلتر اتصال اینستاگرام معتبر نیست" }, { status: 400 });
    const excluded = Array.isArray(selection.excludeUserIds) ? [...new Set(selection.excludeUserIds.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
    const matching = await prisma.user.findMany({ where: { ...buildUserWhere(filters, new Date()), ...(excluded.length ? { id: { notIn: excluded } } : {}) }, select: { id: true }, orderBy: { createdAt: "desc" }, take: MAX_BULK_USERS + 1 });
    if (matching.length > MAX_BULK_USERS) return NextResponse.json({ message: "بیش از ۵۰۰ کاربر با این فیلتر مطابقت دارند؛ فیلتر را محدودتر کنید" }, { status: 400 });
    userIds = matching.map((user) => user.id);
    if (!userIds.length) return NextResponse.json({ message: "کاربری با این فیلتر پیدا نشد" }, { status: 400 });
  }

  const targets = await prisma.user.findMany({ where: { id: { in: userIds }, role: "USER" }, select: { id: true } });
  if (!targets.length) return NextResponse.json({ message: "کاربر معتبری برای ارسال پیدا نشد" }, { status: 400 });
  const actorUserId = guard.session!.user.id;
  const results: { userId: string; success: boolean; message?: string }[] = [];
  for (let i = 0; i < targets.length; i += 10) {
    const batch = targets.slice(i, i + 10);
    results.push(...await Promise.all(batch.map(async (target) => {
      try {
        await prisma.$transaction(async (tx) => {
          const ticket = await tx.ticket.create({ data: { userId: target.id, subject, status: "OPEN", priority: "NORMAL", messages: { create: { senderUserId: actorUserId, body: message } } }, select: { id: true } });
          await tx.auditLog.create({ data: { actorUserId, action: "ticket.bulk_create", targetType: "Ticket", targetId: ticket.id, metadata: { userId: target.id, bulk: true } } });
        });
        return { userId: target.id, success: true };
      } catch (error) {
        return { userId: target.id, success: false, message: error instanceof Error ? error.message : "خطای نامشخص" };
      }
    })));
  }
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;
  return NextResponse.json({ ok: failed === 0, processed: results.length, succeeded, failed, results }, { status: failed ? 207 : 200 });
}
