import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const page=Math.max(1,Math.floor(Number(req.nextUrl.searchParams.get("page"))||1));
 const targetId=(req.nextUrl.searchParams.get("targetId")||"").slice(0,120);
 const action=(req.nextUrl.searchParams.get("action")||"").slice(0,120);
 const where={...(targetId?{targetId}:{}),...(action?{action:{startsWith:action}}:{})};
 const [total,data]=await Promise.all([
  prisma.auditLog.count({where}),
  prisma.auditLog.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*30,take:30,select:{id:true,action:true,targetType:true,targetId:true,metadata:true,createdAt:true,actor:{select:{name:true,email:true}}}})
 ]);
 return NextResponse.json({total,data,page,pageSize:30},{headers:{"Cache-Control":"private, no-store"}});
}
