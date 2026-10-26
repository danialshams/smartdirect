import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { scanOfficialMetaSources } from "@/lib/meta-monitor/scanner";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const state=await prisma.metaMonitorRun.findUnique({where:{id:"official"},select:{lastCheckedAt:true}});
 if(state?.lastCheckedAt&&Date.now()-state.lastCheckedAt.getTime()<60_000)
  return NextResponse.json({message:"برای بررسی مجدد حداقل یک دقیقه صبر کنید"},{status:429});
 try {
  const result=await scanOfficialMetaSources(true);
  return NextResponse.json(result);
 }catch(error){
  console.error("[meta-monitor] admin scan failed",error);
  return NextResponse.json({message:"بررسی منابع رسمی ناموفق بود"},{status:503});
 }
}
