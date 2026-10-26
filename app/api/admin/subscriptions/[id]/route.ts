import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_PLAN_KEYS, verifyUnder10KPlan } from "@/lib/admin-users";
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
 const guard = await requireAdmin();if (guard.response) return guard.response;
 const {id}=await context.params;
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=="object")return NextResponse.json({message:"اطلاعات نامعتبر است"},{status:400});
 const current=await prisma.subscription.findUnique({where:{id}});
 if(!current)return NextResponse.json({message:"اشتراک پیدا نشد"},{status:404});
 const latest=await prisma.subscription.findFirst({where:{userId:current.userId},orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true}});
 if(latest?.id!==id)return NextResponse.json({message:"برای تغییر، اشتراک فعلی کاربر را انتخاب کنید"},{status:409});
 const data:{planKey?:string;note?:string|null;autoRenew?:boolean;expiresAt?:Date}={};
 if(body.planKey!==undefined){
  if(typeof body.planKey!=="string"||!ADMIN_PLAN_KEYS.includes(body.planKey as never))return NextResponse.json({message:"نوع اشتراک نامعتبر است"},{status:400});
  data.planKey=body.planKey;
 }
 if(typeof body.note==="string"){
  if(body.note.length>1000)return NextResponse.json({message:"یادداشت بیش از حد طولانی است"},{status:400});
  data.note=body.note.trim()||null;
 }
 if(typeof body.autoRenew==="boolean")data.autoRenew=body.autoRenew;
 if(body.expiresAt!==undefined){
  const date=new Date(body.expiresAt);
  if(Number.isNaN(date.getTime())||date<=current.startedAt)return NextResponse.json({message:"تاریخ انقضا نامعتبر است"},{status:400});
  data.expiresAt=date;
 }
 if(!Object.keys(data).length)return NextResponse.json({message:"تغییری ارسال نشده است"},{status:400});
 try{
  if((data.planKey||current.planKey)==="monthly_under_10k"&&data.planKey!==undefined)await verifyUnder10KPlan(current.userId);
  const updated=await prisma.subscription.update({where:{id},data});
  await writeAdminAudit({actorUserId:guard.session!.user.id,action:"subscription.update",targetType:"Subscription",targetId:id,metadata:{changed:Object.keys(data),planKey:updated.planKey}});
  return NextResponse.json(updated);
 }catch(e){return NextResponse.json({message:e instanceof Error?e.message:"ویرایش اشتراک ناموفق بود"},{status:400});}
}
