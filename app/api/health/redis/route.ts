import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { redisHealthCheck } from "@/lib/redis/client";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const guard=await requireAdmin();
 if(guard.response)return guard.response;
 const health=await redisHealthCheck();
 return NextResponse.json({service:"redis",ok:health.ok,status:health.ok?"ready":"error",timestamp:new Date().toISOString()},{status:health.ok?200:503,headers:{"Cache-Control":"private, no-store"}});
}
