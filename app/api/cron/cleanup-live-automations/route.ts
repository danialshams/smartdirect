import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollLiveReplySessions } from "@/lib/automation/live-session-lifecycle";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
    return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  const accounts=await prisma.instagramAccount.findMany({
    where:{isConnected:true,automations:{some:{mediaId:"__smartdirect_live_comments_v1__",
      triggerType:"COMMENT_KEYWORD",isActive:true,mediaIds:{not:null}}}},
    select:{id:true,igUserId:true},
  });
  let inspected=0,failed=0;
  for(const account of accounts){
    try{await pollLiveReplySessions(account);inspected++;}
    catch(error){failed++;console.warn("[LIVE_REPLY] Periodic session check failed:",account.id,
      error instanceof Error?error.message:String(error));}
  }
  return NextResponse.json({success:failed===0,inspected,failed});
}
