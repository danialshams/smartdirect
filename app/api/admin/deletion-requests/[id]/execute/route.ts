import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/admin-auth";
import {prisma} from "@/lib/prisma";
import {sameOrigin,privateHeaders} from "@/lib/auth/request";
import {getStorageProviderForObject} from "@/lib/storage/provider";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 if(!sameOrigin(req))return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
 const {id}=await params;
 const item=await prisma.dataDeletionRequest.findUnique({where:{id}});
 if(!item||!item.verifiedUserId||!item.verifiedAt||item.status!=="VERIFYING")
  return NextResponse.json({message:"درخواست باید ابتدا توسط مالک حساب تأیید شود."},{status:409,headers:privateHeaders});
 const user=await prisma.user.findUnique({where:{id:item.verifiedUserId},select:{id:true,role:true}});
 if(!user||user.role==="ADMIN")return NextResponse.json({message:"حذف این حساب از این مسیر مجاز نیست."},{status:409,headers:privateHeaders});
 // Lock processing to one admin action. If an external storage operation fails,
 // a subsequent explicit retry can resume. No account records are removed
 // before tracked uploaded objects are successfully erased.
 const locked=await prisma.dataDeletionRequest.updateMany({
  where:{id,status:"VERIFYING",verifiedUserId:user.id},data:{status:"PROCESSING"}
 });
 if(locked.count!==1)return NextResponse.json({message:"این درخواست در حال پردازش است."},{status:409,headers:privateHeaders});
 try{
  await prisma.user.update({where:{id:user.id},data:{isBlocked:true,sessionVersion:{increment:1}}});
  const objects=await prisma.instagramStorageObject.findMany({where:{userId:user.id,deletedAt:null},select:{storageKey:true,publicUrl:true}});
  for(const object of objects){
   if(object.storageKey.startsWith("test:"))continue;
   await getStorageProviderForObject(object.storageKey,object.publicUrl).delete(object.storageKey);
  }
  await prisma.$transaction(async tx=>{
   await tx.freeTrialClaim.deleteMany({where:{userId:user.id}});
   await tx.smsCampaign.deleteMany({where:{createdById:user.id}});
   await tx.user.delete({where:{id:user.id}});
   await tx.auditLog.create({data:{actorUserId:guard.session!.user.id,action:"deletion.request.executed",targetType:"DataDeletionRequest",targetId:id,metadata:{result:"completed",trackedObjects:objects.length}}});
   await tx.dataDeletionRequest.update({
    where:{id},data:{status:"COMPLETED",completedAt:new Date(),
     verifiedUserId:null,contact:"[deleted]",instagramName:null,details:null,ipHash:"[deleted]"}
   });
  });
  return NextResponse.json({success:true},{headers:privateHeaders});
 }catch{
  await prisma.dataDeletionRequest.updateMany({where:{id,status:"PROCESSING"},data:{status:"VERIFYING"}});
  return NextResponse.json({message:"حذف کامل نشد. وضعیت برای تلاش دوباره بازگردانده شد؛ داده‌های حذف‌شده دوباره ایجاد نمی‌شوند."},{status:503,headers:privateHeaders});
 }
}
