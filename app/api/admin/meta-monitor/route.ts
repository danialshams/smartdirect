import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const p=req.nextUrl.searchParams,page=Math.max(1,Math.floor(Number(p.get("page"))||1));
 const category=(p.get("category")||"").slice(0,70),unread=p.get("unread")==="1";
 const where={...(category?{category}:{}),...(unread?{isRead:false}:{})};
 const [data,total,sources,run,unreadCount]=await Promise.all([
  prisma.metaMonitorNotice.findMany({where,orderBy:[{detectedAt:"desc"},{id:"desc"}],skip:(page-1)*20,take:20}),
  prisma.metaMonitorNotice.count({where}),
  prisma.metaMonitorSource.findMany({orderBy:{id:"asc"}}),
  prisma.metaMonitorRun.findUnique({where:{id:"official"}}),
  prisma.metaMonitorNotice.count({where:{isRead:false}})
 ]);
 return NextResponse.json({data,total,page,pageSize:20,unreadCount,sources,run},{headers:{"Cache-Control":"private, no-store"}});
}
