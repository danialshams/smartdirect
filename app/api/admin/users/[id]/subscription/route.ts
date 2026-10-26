import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import { ADMIN_PLAN_KEYS, verifyUnder10KPlan } from "@/lib/admin-users";
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}){
  const guard=await requireAdmin();if(guard.response)return guard.response;
  const {id:userId}=await context.params;
  const user=await prisma.user.findFirst({where:{id:userId,role:"USER"},select:{id:true}});
  if(!user)return NextResponse.json({message:"کاربر پیدا نشد"},{status:404});
  const b=await req.json().catch(()=>({}));
  const action=String(b.action||"");const days=Number(b.days??0);
  const planKey=String(b.planKey||"").trim();
  if(!["save","create","activate","suspend","cancel","adjust","extend","change-plan"].includes(action))return NextResponse.json({message:"عملیات نامعتبر است"},{status:400});
  if(["save","create","change-plan"].includes(action)&&!ADMIN_PLAN_KEYS.includes(planKey as never))return NextResponse.json({message:"نوع اشتراک نامعتبر است"},{status:400});
  if(["save","create","adjust","extend"].includes(action)&&(!Number.isInteger(days)||Math.abs(days)>3650||(action==="adjust"||action==="extend")&&days===0))return NextResponse.json({message:"تعداد روز نامعتبر است"},{status:400});
  try{
    const current=await prisma.subscription.findFirst({where:{userId},orderBy:[{createdAt:"desc"},{id:"desc"}]});
    const selectedPlan=["save","create","change-plan"].includes(action)?planKey:(current?.planKey||"monthly");
    if(selectedPlan==="monthly_under_10k"&&["save","create","activate","change-plan"].includes(action))await verifyUnder10KPlan(userId);
    const now=new Date();
    const result=await prisma.$transaction(async tx=>{
      if(action==="create"||(!current&&["save","activate","extend"].includes(action))){
        const interval=days>0?days:selectedPlan==="yearly"?365:30;
        return tx.subscription.create({data:{userId,planKey:selectedPlan,status:"ACTIVE",source:"MANUAL",startedAt:now,expiresAt:new Date(now.getTime()+interval*86400000)}});
      }
      if(!current)throw new Error("کاربر اشتراک ندارد");
      if(action==="suspend")return tx.subscription.update({where:{id:current.id},data:{status:"SUSPENDED",suspendedAt:now}});
      if(action==="cancel")return tx.subscription.update({where:{id:current.id},data:{status:"CANCELLED",cancelledAt:now}});
      if(action==="change-plan")return tx.subscription.update({where:{id:current.id},data:{planKey:selectedPlan}});
      if(action==="activate"){
        const expiresAt=current.expiresAt>now?current.expiresAt:new Date(now.getTime()+(selectedPlan==="yearly"?365:30)*86400000);
        return tx.subscription.update({where:{id:current.id},data:{status:"ACTIVE",expiresAt,suspendedAt:null,cancelledAt:null}});
      }
      const base=current.expiresAt>now?current.expiresAt:now;
      const expiresAt=days?new Date(base.getTime()+days*86400000):current.expiresAt;
      if(expiresAt<=now)throw new Error("تاریخ انقضا نمی‌تواند در گذشته باشد");
      const changes={planKey:selectedPlan,expiresAt,status:days!==0?"ACTIVE" as const:current.status,suspendedAt:days!==0?null:current.suspendedAt,cancelledAt:days!==0?null:current.cancelledAt};
      return tx.subscription.update({where:{id:current.id},data:changes});
    });
    await writeAdminAudit({actorUserId:guard.session!.user.id,action:"subscription."+action,targetType:"Subscription",targetId:result.id,metadata:{userId,days,planKey:result.planKey}});
    return NextResponse.json(result);
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"عملیات ناموفق بود"},{status:400});}
}
