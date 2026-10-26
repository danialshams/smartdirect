import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export const dynamic="force-dynamic";
export async function GET(){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const [unreadCount,run]=await Promise.all([
  prisma.metaMonitorNotice.count({where:{isRead:false}}),
  prisma.metaMonitorRun.findUnique({where:{id:"official"},select:{lastCheckedAt:true,lastSuccessAt:true}})
 ]);
 return NextResponse.json({unreadCount,lastCheckedAt:run?.lastCheckedAt||null,lastSuccessAt:run?.lastSuccessAt||null},{headers:{"Cache-Control":"private, no-store"}});
}
