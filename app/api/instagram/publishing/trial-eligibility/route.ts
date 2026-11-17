import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { getTrialReelEligibility } from "@/lib/instagram/trial-reels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
  const accountId = request.nextUrl.searchParams.get("accountId")?.trim();
  if (!accountId) return NextResponse.json({ success: false, message: "پیج اینستاگرام را انتخاب کن." }, { status: 400 });
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId: session.user.id, isConnected: true },
    select: { id: true },
  });
  if (!account) return NextResponse.json({ success: false, message: "پیج متصل معتبر نیست." }, { status: 404 });
  try {
    const result = await getTrialReelEligibility(await getValidInstagramAccessToken(account.id));
    return NextResponse.json(
      { success: true, ...result, note: "تشخیص نهایی فعال بودن Trial و سقف مجاز انتشار با خود Instagram است." },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "دریافت شرایط Trial از اینستاگرام ناموفق بود. اتصال پیج را بررسی و دوباره تلاش کن." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
