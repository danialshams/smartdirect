import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { META_FRESH_DAYS, NEW_VERSIONS } from "@/lib/meta-monitor/freshness";
export const dynamic="force-dynamic";
export async function GET(){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const [unreadCount,run]=await Promise.all([
  prisma.metaMonitorNotice.count({where:{isRead:false,OR:[{publishedAt:{gte:new Date(Date.now()-META_FRESH_DAYS*86400000),lte:new Date(Date.now()+86400000)}},{kind:"VERSION",apiVersion:{in:NEW_VERSIONS}}]}}),
  prisma.metaMonitorRun.findUnique({where:{id:"official"},select:{lastCheckedAt:true,lastSuccessAt:true}})
 ]);
 return NextResponse.json({unreadCount,lastCheckedAt:run?.lastCheckedAt||null,lastSuccessAt:run?.lastSuccessAt||null},{headers:{"Cache-Control":"private, no-store"}});
}
