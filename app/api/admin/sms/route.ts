import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSelection, type AdminSelection } from "@/lib/admin-users";
import { writeAdminAudit } from "@/lib/admin-audit";
export async function GET(){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const campaigns=await prisma.smsCampaign.findMany({orderBy:{createdAt:"desc"},take:100,select:{id:true,message:true,status:true,targetCount:true,verifiedRecipientCount:true,createdAt:true}});
 return NextResponse.json({data:campaigns,providerConfigured:false});
}
export async function POST(req:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const body=await req.json().catch(()=>null),message=String(body?.message||"").trim();
 if(!message||message.length>1000)return NextResponse.json({message:"متن باید بین ۱ تا ۱۰۰۰ نویسه باشد"},{status:400});
 let ids:string[];try{ids=await resolveAdminSelection(body.selection as AdminSelection);}catch(e){return NextResponse.json({message:e instanceof Error?e.message:"انتخاب نامعتبر"},{status:400});}
 const verified=await prisma.user.count({where:{id:{in:ids},phone:{not:null},phoneVerifiedAt:{not:null},smsConsentAt:{not:null}}});
 const campaign=await prisma.smsCampaign.create({data:{createdById:guard.session!.user.id,message,selection:{mode:"ids",userIds:ids},targetCount:ids.length,verifiedRecipientCount:verified,status:"DRAFT"}});
 await writeAdminAudit({actorUserId:guard.session!.user.id,action:"sms.draft_create",targetType:"SmsCampaign",targetId:campaign.id,metadata:{targetCount:ids.length,verifiedRecipientCount:verified}});
 return NextResponse.json({id:campaign.id,status:"DRAFT",targetCount:ids.length,verifiedRecipientCount:verified,providerConfigured:false},{status:201});
}
