import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { META_FRESH_DAYS, NEW_VERSIONS } from "@/lib/meta-monitor/freshness";
export const dynamic="force-dynamic";
const currentWhere=()=>({OR:[
 {publishedAt:{gte:new Date(Date.now()-META_FRESH_DAYS*86400000),lte:new Date(Date.now()+86400000)}},
 {kind:"VERSION",apiVersion:{in:NEW_VERSIONS}}
]});
export async function GET(req:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const p=req.nextUrl.searchParams,page=Math.max(1,Math.min(10000,Math.floor(Number(p.get("page"))||1)));
 const category=(p.get("category")||"").slice(0,70),unread=p.get("unread")==="1",archive=p.get("scope")==="archive";
 const criteria=[archive?{NOT:currentWhere()}:currentWhere(),...(category?[{category}]:[]),...(unread?[{isRead:false}]:[])];
 const where={AND:criteria};
 const [data,total,sources,run,unreadCount,archiveCount]=await Promise.all([
  prisma.metaMonitorNotice.findMany({where,orderBy:[{publishedAt:"desc"},{detectedAt:"desc"}],skip:(page-1)*20,take:20}),
  prisma.metaMonitorNotice.count({where}),
  prisma.metaMonitorSource.findMany({orderBy:{id:"asc"}}),
  prisma.metaMonitorRun.findUnique({where:{id:"official"}}),
  prisma.metaMonitorNotice.count({where:{AND:[currentWhere(),{isRead:false}]}}),
  prisma.metaMonitorNotice.count({where:{NOT:currentWhere()}})
 ]);
 return NextResponse.json({data,total,page,pageSize:20,unreadCount,archiveCount,sources,run,scope:archive?"archive":"current"},{headers:{"Cache-Control":"private, no-store"}});
}
