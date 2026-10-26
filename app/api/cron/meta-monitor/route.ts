import { NextRequest,NextResponse } from "next/server";
import { scanOfficialMetaSources } from "@/lib/meta-monitor/scanner";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!=="Bearer "+secret)
  return NextResponse.json({message:"Unauthorized"},{status:401});
 try {
  const result=await scanOfficialMetaSources(false);
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("[meta-monitor] cron scan failed",error);
  return NextResponse.json({message:"Meta monitoring failed"},{status:503});
 }
}
