import { NextRequest,NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sameOrigin,privateHeaders } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
export async function POST(req:NextRequest) {
 if(!sameOrigin(req))return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
 const session=await getServerSession(authOptions);
 if(!session?.user?.id)return NextResponse.json({message:"ورود الزامی است."},{status:401,headers:privateHeaders});
 await prisma.user.update({where:{id:session.user.id},data:{sessionVersion:{increment:1}}});
 return NextResponse.json({success:true,message:"تمام نشست‌های قبلی باطل شدند. مجدداً وارد شوید."},{headers:privateHeaders});
}
