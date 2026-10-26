import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export async function POST(req:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const body=await req.json().catch(()=>null);
 if(!body||body.all!==true&&typeof body.id!=="string")return NextResponse.json({message:"شناسه نامعتبر است"},{status:400});
 if(typeof body.id==="string"&&body.id.length>128)return NextResponse.json({message:"شناسه نامعتبر است"},{status:400});
 const result=await prisma.metaMonitorNotice.updateMany({
  where:{isRead:false,...(body.all===true?{}:{id:body.id})},data:{isRead:true,readAt:new Date()}
 });
 return NextResponse.json({updated:result.count});
}
