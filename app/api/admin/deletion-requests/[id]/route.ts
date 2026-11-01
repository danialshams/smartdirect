import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { sameOrigin } from "@/lib/auth/request";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 if(!sameOrigin(req))return NextResponse.json({message:"منبع درخواست معتبر نیست."},{status:403});
 const {id}=await params;
 const body=await req.json().catch(()=>null);
 const status=body?.status;
 if(!["VERIFYING","COMPLETED","REJECTED"].includes(status))
  return NextResponse.json({message:"وضعیت نامعتبر است."},{status:400});
 if(status==="COMPLETED" && body?.confirmedDeletion !== true)
  return NextResponse.json({message:"تکمیل فقط پس از تأیید انجام واقعی حذف داده مجاز است."},{status:400});
 const existing=await prisma.dataDeletionRequest.findUnique({where:{id},select:{id:true,status:true}});
 if(!existing)return NextResponse.json({message:"درخواست پیدا نشد."},{status:404});
 if(existing.status==="COMPLETED")
  return NextResponse.json({message:"درخواست تکمیل‌شده قابل تغییر نیست."},{status:409});
 const updated=await prisma.dataDeletionRequest.update({where:{id},data:{status},select:{id:true,status:true}});
 await writeAdminAudit({actorUserId:guard.session!.user.id,action:"deletion.request.status",targetType:"DataDeletionRequest",targetId:id,metadata:{from:existing.status,to:status}});
 return NextResponse.json(updated,{headers:{"Cache-Control":"private, no-store"}});
}
