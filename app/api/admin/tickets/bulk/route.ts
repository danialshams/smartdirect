import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { publishSupportChange } from "@/lib/support/tickets";
import { resolveAdminSelection,type AdminSelection } from "@/lib/admin-users";
export async function POST(req:NextRequest){
  const guard=await requireAdmin();if(guard.response)return guard.response;
  const b=await req.json().catch(()=>null);
  const subject=String(b?.subject||"").trim(),message=String(b?.message||"").trim();
  if(!subject||subject.length>160||!message||message.length>5000)return NextResponse.json({message:"عنوان یا متن نامعتبر است"},{status:400});
  let ids:string[];try{ids=await resolveAdminSelection(b.selection as AdminSelection);}catch(e){return NextResponse.json({message:e instanceof Error?e.message:"انتخاب نامعتبر"},{status:400});}
  const actor=guard.session!.user.id;const results:{userId:string;success:boolean;message?:string}[]=[];
  for(let i=0;i<ids.length;i+=10){
    results.push(...await Promise.all(ids.slice(i,i+10).map(async userId=>{
      try {
        const ticket=await prisma.$transaction(async tx=>{
          const created=await tx.ticket.create({data:{userId,subject,status:"OPEN",priority:"NORMAL",messages:{create:{senderUserId:actor,body:message}}},select:{id:true,messages:{select:{id:true},take:1}}});
          await tx.auditLog.create({data:{actorUserId:actor,action:"ticket.bulk_create",targetType:"Ticket",targetId:created.id,metadata:{userId}}});
          return created;
        });
        await publishSupportChange(userId,ticket.id,ticket.messages[0]?.id||ticket.id);
        return {userId,success:true};
      }catch(e){return {userId,success:false,message:e instanceof Error?e.message:"خطا"};}
    })));
  }
  const failed=results.filter(r=>!r.success).length;
  return NextResponse.json({ok:failed===0,processed:results.length,succeeded:results.length-failed,failed,results},{status:failed?207:200});
}
