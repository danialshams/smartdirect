import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const page=Math.min(10000,Math.max(1,Math.floor(Number(req.nextUrl.searchParams.get("page"))||1)));
 const status=req.nextUrl.searchParams.get("status")||"";
 const allowed=new Set(["PENDING","VERIFYING","COMPLETED","REJECTED"]);
 if(status && !allowed.has(status))return NextResponse.json({message:"وضعیت نامعتبر است."},{status:400});
 const where=status?{status}:{};
 const [data,total]=await Promise.all([
  prisma.dataDeletionRequest.findMany({where,orderBy:{createdAt:"desc"},take:30,skip:(page-1)*30,select:{id:true,contact:true,instagramName:true,details:true,status:true,createdAt:true,updatedAt:true}}),
  prisma.dataDeletionRequest.count({where})
 ]);
 return NextResponse.json({data,total,page},{headers:{"Cache-Control":"private, no-store"}});
}
