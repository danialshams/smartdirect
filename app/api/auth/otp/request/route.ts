import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/auth/phone";
import { sendOtp, hashRequestIp, isSmsReady, type OtpPurpose } from "@/lib/auth/sms-otp";
import { clientIp, sameOrigin, privateHeaders } from "@/lib/auth/request";

const purposeList = ["login","reset","verify"];
export async function GET() {
  return NextResponse.json({providerConfigured:isSmsReady(),ttlSeconds:120},{headers:privateHeaders});
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
  if (!isSmsReady()) return NextResponse.json({
    message:"ارسال پیامک هنوز در دایرا فعال نشده است. فعلاً با رمز عبور وارد شوید.",
    providerConfigured:false
  },{status:503,headers:privateHeaders});
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(body?.phone ?? "");
  const purpose = body?.purpose as OtpPurpose;
  if (!phone || !purposeList.includes(purpose))
    return NextResponse.json({message:"شماره تماس یا نوع درخواست معتبر نیست."},{status:400,headers:privateHeaders});
  try {
    const matches = await prisma.user.findMany({ where: { phone }, take: 2 });
    // Identical outward response prevents phone-number enumeration.
    if (matches.length === 1 && !matches[0].isBlocked &&
        (purpose === "verify" ? !matches[0].phoneVerifiedAt : !!matches[0].phoneVerifiedAt)) {
      await sendOtp(matches[0].id, phone, purpose, hashRequestIp(clientIp(request)));
    }
    return NextResponse.json({success:true,message:"اگر شماره واجد شرایط باشد، کد تأیید ارسال می‌شود.",
      ttlSeconds:120},{headers:privateHeaders});
  } catch (e) {
    if (e instanceof Error && e.message === "OTP_RATE_LIMIT")
      return NextResponse.json({message:"برای دریافت کد جدید کمی بعد تلاش کنید."},{status:429,headers:privateHeaders});
    return NextResponse.json({message:"ارسال پیامک انجام نشد. لطفاً دوباره تلاش کنید."},{status:503,headers:privateHeaders});
  }
}
