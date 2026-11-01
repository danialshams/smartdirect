import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { internalEmailForPhone, normalizePhone, validatePassword } from "@/lib/auth/phone";
import { clientIp, sameOrigin, privateHeaders } from "@/lib/auth/request";
import { hashRequestIp } from "@/lib/auth/sms-otp";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
  const body = await request.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const phone = normalizePhone(body?.phone ?? "");
  const password = body?.password;
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60 || !phone ||
      !validatePassword(password) || password !== body?.confirmPassword) {
    return NextResponse.json({message:"نام، نام خانوادگی، موبایل و رمز عبور را بررسی کنید. رمز باید حداقل ۸ کاراکتر شامل حرف و عدد باشد."},
      {status:400,headers:privateHeaders});
  }
  try {
    // Bound new account creation per IP. Uses the existing database rather
    // than an in-memory counter that resets on each serverless instance.
    const ipHash = hashRequestIp(clientIp(request));
    const since = new Date(Date.now() - 3600000);
    const attempts = await prisma.authSignupAttempt.count({
      where: { ipHash, createdAt: { gt: since } }
    });
    if (attempts >= 8) return NextResponse.json({message:"تعداد درخواست‌ها زیاد است. بعداً تلاش کنید."},
      {status:429,headers:privateHeaders});
    await prisma.authSignupAttempt.create({data:{ipHash}});
    const existing = await prisma.user.findFirst({ where: { phone }, select: { id: true } });
    if (existing) return NextResponse.json({message:"برای این شماره حسابی وجود دارد. وارد حساب شوید."},
      {status:409,headers:privateHeaders});
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { firstName, lastName, name: `${firstName} ${lastName}`,
        phone, email: internalEmailForPhone(phone), password: hash }
    });
    return NextResponse.json({success:true,userId:user.id,phoneVerified:false},
      {status:201,headers:privateHeaders});
  } catch (error) {
    // Unique legacy email identifier also prevents parallel duplicate signup.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
      return NextResponse.json({message:"برای این شماره حسابی وجود دارد."},{status:409,headers:privateHeaders});
    return NextResponse.json({message:"ثبت‌نام انجام نشد. دوباره تلاش کنید."},
      {status:500,headers:privateHeaders});
  }
}
