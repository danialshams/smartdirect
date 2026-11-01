import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizePhone, validatePassword } from "@/lib/auth/phone";
import { consumeOtp, isSmsReady } from "@/lib/auth/sms-otp";
import { sameOrigin, privateHeaders } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
  if (!isSmsReady()) return NextResponse.json({message:"بازیابی پیامکی هنوز فعال نیست."},{status:503,headers:privateHeaders});
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone || !validatePassword(body?.password) || body.password !== body?.confirmPassword ||
      typeof body?.code !== "string")
    return NextResponse.json({message:"شماره، کد و رمز جدید را بررسی کنید."},{status:400,headers:privateHeaders});
  try {
    const users = await prisma.user.findMany({where:{phone,phoneVerifiedAt:{not:null},isBlocked:false},take:2});
    if (users.length !== 1 || !await consumeOtp(users[0].id,phone,"reset",body.code))
      return NextResponse.json({message:"کد اشتباه یا منقضی شده است."},{status:400,headers:privateHeaders});
    await prisma.user.update({where:{id:users[0].id},data:{password:await bcrypt.hash(body.password,12),sessionVersion:{increment:1}}});
    return NextResponse.json({success:true,message:"رمز عبور تغییر کرد. با رمز جدید وارد شوید."},{headers:privateHeaders});
  } catch {
    return NextResponse.json({message:"تغییر رمز انجام نشد. دوباره تلاش کنید."},{status:500,headers:privateHeaders});
  }
}
