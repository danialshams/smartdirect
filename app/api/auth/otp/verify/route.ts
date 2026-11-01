import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/auth/phone";
import { consumeOtp, isSmsReady } from "@/lib/auth/sms-otp";
import { sameOrigin, privateHeaders } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
  if (!isSmsReady()) return NextResponse.json({message:"تأیید پیامکی هنوز فعال نشده است."},{status:503,headers:privateHeaders});
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone || typeof body?.code !== "string")
    return NextResponse.json({message:"شماره یا کد معتبر نیست."},{status:400,headers:privateHeaders});
  const users = await prisma.user.findMany({where:{phone,isBlocked:false},take:2});
  if (users.length !== 1 || !await consumeOtp(users[0].id,phone,"verify",body.code))
    return NextResponse.json({message:"کد اشتباه یا منقضی شده است."},{status:400,headers:privateHeaders});
  await prisma.user.update({where:{id:users[0].id},data:{phoneVerifiedAt:new Date()}});
  return NextResponse.json({success:true},{headers:privateHeaders});
}
