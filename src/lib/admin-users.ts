import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { getInstagramProfile } from "@/lib/instagram/api";
export const ADMIN_PLAN_KEYS = ["monthly", "yearly", "monthly_under_10k"] as const;
export const ADMIN_PLAN_LABELS: Record<string, string> = { monthly: "ماهانه", yearly: "سالانه", monthly_under_10k: "ماهانه زیر ۱۰هزار", free: "آزمایشی" };
export type AdminFilters = { q?: string; planKey?: string; status?: string; expiryWithin?: string; connection?: string; access?: string };
export type AdminSelection = { mode: "ids"; userIds: string[] } | { mode: "filtered"; filters?: AdminFilters; excludeUserIds?: string[] };
export const MAX_ADMIN_TARGETS = 20000;
export function effectiveStatus(sub: { status: string; expiresAt: Date } | null, now = Date.now()) {
  return !sub ? "NONE" : sub.status === "SUSPENDED" || sub.status === "CANCELLED" ? sub.status
    : sub.status === "ACTIVE" && sub.expiresAt.getTime() > now ? "ACTIVE" : "EXPIRED";
}
export async function getAdminUsers(filters: AdminFilters = {}) {
  const q = (filters.q || "").trim().slice(0, 120);
  const where = {
    role: "USER" as const,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { instagramAccounts: { some: { igUsername: { contains: q, mode: "insensitive" as const } } } }] } : {}),
    ...(filters.connection === "connected" ? { instagramAccounts: { some: { isConnected: true } } } : {}),
    ...(filters.connection === "disconnected" ? { instagramAccounts: { none: { isConnected: true } } } : {}),
    ...(filters.access === "blocked" ? { isBlocked: true } : filters.access === "allowed" ? { isBlocked: false } : {})
  };
  const users = await prisma.user.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, email: true, role: true, isBlocked: true, blockedReason: true, phone: true, phoneVerifiedAt: true, smsConsentAt: true, createdAt: true,
      instagramAccounts: { where: { isConnected: true }, select: { id: true, igUsername: true } },
      subscriptions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, planKey: true, status: true, startedAt: true, expiresAt: true, createdAt: true } } }
  });
  const now = Date.now();
  return users.map(u => {
    const { subscriptions, ...rest } = u;
    const sub = subscriptions[0] || null;
    return { ...rest, pagesCount: u.instagramAccounts.length, subscription: sub ? { ...sub, effectiveStatus: effectiveStatus(sub, now) } : null, effectiveStatus: effectiveStatus(sub, now) };
  }).filter(u => {
    if (filters.planKey && u.subscription?.planKey !== filters.planKey) return false;
    if (filters.status && u.effectiveStatus !== filters.status) return false;
    const days = Number(filters.expiryWithin);
    if (filters.expiryWithin && Number.isFinite(days) && days > 0 && (!u.subscription || u.effectiveStatus !== "ACTIVE" || u.subscription.expiresAt.getTime() > now + days * 86400000)) return false;
    return true;
  });
}
export async function resolveAdminSelection(selection: AdminSelection) {
  if (!selection || (selection.mode !== "ids" && selection.mode !== "filtered")) throw new Error("انتخاب کاربران نامعتبر است");
  let ids: string[];
  if (selection.mode === "ids") {
    if (!Array.isArray(selection.userIds)) throw new Error("فهرست کاربران نامعتبر است");
    ids = [...new Set(selection.userIds.filter(id => typeof id === "string" && id.length > 0))];
  } else {
    const users = await getAdminUsers(selection.filters || {});
    const exclude = new Set(Array.isArray(selection.excludeUserIds) ? selection.excludeUserIds : []);
    ids = users.filter(u => !exclude.has(u.id)).map(u => u.id);
  }
  if (!ids.length) throw new Error("کاربری انتخاب نشده است");
  if (ids.length > MAX_ADMIN_TARGETS) throw new Error("برای حفظ کارایی، انتخاب را به حداکثر ۲۰هزار کاربر محدود کنید");
  return (await prisma.user.findMany({ where: { id: { in: ids }, role: "USER" }, select: { id: true } })).map(x=>x.id);
}
export async function verifyUnder10KPlan(userId: string) {
  const accounts = await prisma.instagramAccount.findMany({ where: { userId, isConnected: true }, select: { id: true } });
  if (!accounts.length) throw new Error("پلن زیر ۱۰هزار به حداقل یک پیج متصل نیاز دارد");
  for (const account of accounts) {
    try {
      const token = await getValidInstagramAccessToken(account.id);
      const profile = await getInstagramProfile(token, account.id);
      const followers = Number(profile.followers_count);
      if (!Number.isFinite(followers) || followers < 0) throw new Error("آمار فالوورها قابل دریافت نیست");
      if (followers >= 10000) throw new Error("حداقل یک پیج متصل ۱۰هزار فالوور یا بیشتر دارد");
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "تعداد دنبال‌کنندگان قابل تأیید نیست");
    }
  }
}
