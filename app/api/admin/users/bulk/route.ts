import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_PLAN_KEYS, resolveAdminSelection, verifyUnder10KPlan, type AdminSelection } from "@/lib/admin-users";
const ACTIONS=["subscription-adjust","subscription-change-plan","subscription-suspend","subscription-activate","access-block","access-unblock"];
export async function POST(req:NextRequest) {
  const guard=await requireAdmin();if(guard.response)return guard.response;
  const b=await req.json().catch(()=>null);
  if(!b||!ACTIONS.includes(b.action))return NextResponse.json({message:"عملیات گروهی نامعتبر است"},{status:400});
  const action=String(b.action);const days=Number(b.days??0),planKey=String(b.planKey||"");
  if(action==="subscription-adjust"&&(!Number.isInteger(days)||days===0||Math.abs(days)>3650))return NextResponse.json({message:"تعداد روز نامعتبر است"},{status:400});
  if(action==="subscription-change-plan"&&!ADMIN_PLAN_KEYS.includes(planKey as never))return NextResponse.json({message:"پلن نامعتبر است"},{status:400});
  let ids:string[];try{ids=await resolveAdminSelection(b.selection as AdminSelection);}catch(e){return NextResponse.json({message:e instanceof Error?e.message:"انتخاب نامعتبر"},{status:400});}
  const now=new Date(),actor=guard.session!.user.id;const results:{userId:string;success:boolean;message?:string}[]=[];
  for(let i=0;i<ids.length;i+=10){
    const batch=ids.slice(i,i+10);
    results.push(...await Promise.all(batch.map(async userId=>{
      try{
        if(action==="subscription-change-plan"&&planKey==="monthly_under_10k")await verifyUnder10KPlan(userId);
        await prisma.$transaction(async tx=>{
          if(action==="access-block"||action==="access-unblock"){
            const blocked=action==="access-block";
            await tx.user.update({where:{id:userId},data:{isBlocked:blocked,blockedAt:blocked?now:null,blockedReason:blocked?String(b.reason||"").slice(0,300)||"ADMIN_BULK":null}});
            await tx.auditLog.create({data:{actorUserId:actor,action,targetType:"User",targetId:userId,metadata:{blocked}}});return;
          }
          const current=await tx.subscription.findFirst({where:{userId},orderBy:[{createdAt:"desc"},{id:"desc"}]});
          if(!current&&action==="subscription-adjust"&&days<0)throw new Error("اشتراک ندارد");
          if(!current&&["subscription-suspend","subscription-change-plan"].includes(action))throw new Error("اشتراک ندارد");
          let result;
          if(!current)result=await tx.subscription.create({data:{userId,planKey:"monthly",status:"ACTIVE",source:"MANUAL",startedAt:now,expiresAt:new Date(now.getTime()+(action==="subscription-adjust"?days:30)*86400000)}});
          else if(action==="subscription-suspend")result=await tx.subscription.update({where:{id:current.id},data:{status:"SUSPENDED",suspendedAt:now}});
          else if(action==="subscription-change-plan")result=await tx.subscription.update({where:{id:current.id},data:{planKey}});
          else if(action==="subscription-activate")result=await tx.subscription.update({where:{id:current.id},data:{status:"ACTIVE",expiresAt:current.expiresAt>now?current.expiresAt:new Date(now.getTime()+30*86400000),suspendedAt:null,cancelledAt:null}});
          else {
            const base=days>0&&current.expiresAt<now?now:current.expiresAt;
            const expiresAt=new Date(base.getTime()+days*86400000);
            if(expiresAt<=now)throw new Error("تاریخ انقضا نامعتبر است");
            const status=current.status==="SUSPENDED"||current.status==="CANCELLED"?current.status: "ACTIVE";
            result=await tx.subscription.update({where:{id:current.id},data:{expiresAt,status}});
          }
          await tx.auditLog.create({data:{actorUserId:actor,action,targetType:"Subscription",targetId:result.id,metadata:{userId,planKey:result.planKey,days}}});
        });
        return {userId,success:true};
      }catch(e){return {userId,success:false,message:e instanceof Error?e.message:"خطا"};}
    })));
  }
  const failed=results.filter(r=>!r.success).length;
  return NextResponse.json({ok:failed===0,processed:results.length,succeeded:results.length-failed,failed,results},{status:failed?207:200});
}
