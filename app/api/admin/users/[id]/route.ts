import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import { effectiveStatus } from "@/lib/admin-users";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  const guard = await requireAdmin(); if (guard.response) return guard.response;
  const { id } = await context.params;
  const user = await prisma.user.findFirst({ where: { id, role: "USER" }, select: {
    id:true, name:true, email:true, createdAt:true, isBlocked:true, blockedReason:true, blockedAt:true, phone:true, phoneVerifiedAt:true, smsConsentAt:true,
    instagramAccounts: { select: { id:true, igUsername:true, isConnected:true, createdAt:true, _count: { select: { automations: { where: { isActive: true } } } } } },
    subscriptions: { orderBy: [{ createdAt:"desc" },{id:"desc"}], select: { id:true,planKey:true,status:true,source:true,startedAt:true,expiresAt:true,suspendedAt:true,cancelledAt:true,note:true,autoRenew:true,createdAt:true } },
    tickets: { orderBy:{updatedAt:"desc"},take:20, select: {id:true,subject:true,status:true,priority:true,updatedAt:true} }
  } });
  if (!user) return NextResponse.json({ message:"کاربر پیدا نشد" },{status:404});
  const current=user.subscriptions[0]||null;
  return NextResponse.json({ ...user, subscription: current ? {...current,effectiveStatus:effectiveStatus(current)} : null,
    activeAutomations:user.instagramAccounts.filter(a=>a.isConnected).reduce((sum,a)=>sum+a._count.automations,0) });
}
export async function PATCH(req: NextRequest, context: Context) {
  const guard = await requireAdmin(); if (guard.response) return guard.response;
  const { id } = await context.params;
  const user = await prisma.user.findFirst({ where:{id,role:"USER"},select:{id:true} });
  if(!user) return NextResponse.json({message:"کاربر پیدا نشد"},{status:404});
  const body=await req.json().catch(()=>null);
  if(!body || typeof body!=="object") return NextResponse.json({message:"اطلاعات نامعتبر است"},{status:400});
  const data: {isBlocked?:boolean;blockedAt?:Date|null;blockedReason?:string|null;phone?:string|null;phoneVerifiedAt?:null;smsConsentAt?:null} = {};
  if(typeof body.isBlocked==="boolean") {
    data.isBlocked=body.isBlocked;
    data.blockedAt=body.isBlocked?new Date():null;
    data.blockedReason=body.isBlocked?String(body.blockedReason||"").trim().slice(0,300)||null:null;
  }
  if(typeof body.phone==="string") {
    const phone=body.phone.replace(/[\s\-]/g,"").trim();
    if(phone && !/^\+?[0-9]{10,15}$/.test(phone)) return NextResponse.json({message:"شماره تماس معتبر نیست"},{status:400});
    data.phone=phone||null;data.phoneVerifiedAt=null;data.smsConsentAt=null;
  }
  if(!Object.keys(data).length) return NextResponse.json({message:"تغییری ارسال نشده"},{status:400});
  const updated=await prisma.user.update({where:{id},data,select:{id:true,isBlocked:true,blockedReason:true,phone:true,phoneVerifiedAt:true,smsConsentAt:true}});
  await writeAdminAudit({actorUserId:guard.session!.user.id,action:"user.update",targetType:"User",targetId:id,metadata:{fields:Object.keys(data),isBlocked:updated.isBlocked}});
  return NextResponse.json(updated);
}
