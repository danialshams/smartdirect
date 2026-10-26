import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin-users";
export async function GET(req:NextRequest){
  const guard=await requireAdmin();if(guard.response)return guard.response;
  const p=req.nextUrl.searchParams,status=p.get("status")||"",q=p.get("q")?.trim()||"",userId=p.get("userId")||"",planKey=p.get("planKey")||"";
  const page=Math.max(1,Math.floor(Number(p.get("page"))||1)),pageSize=Math.min(100,Math.max(1,Number(p.get("pageSize"))||20));
  const currentPlanIds=planKey?(await getAdminUsers({planKey})).map(u=>u.id):null;
  const where={...(status?{status:status as never}:{}),...(userId?{userId}:{}),...(q?{OR:[{subject:{contains:q,mode:"insensitive" as const}},{user:{name:{contains:q,mode:"insensitive" as const}}},{user:{email:{contains:q,mode:"insensitive" as const}}}]}:{}),...(currentPlanIds?{userId:{in:currentPlanIds}}:{})};
  const [total,items]=await Promise.all([prisma.ticket.count({where}),prisma.ticket.findMany({where,orderBy:{updatedAt:"desc"},skip:(page-1)*pageSize,take:pageSize,select:{id:true,subject:true,status:true,priority:true,createdAt:true,updatedAt:true,user:{select:{id:true,name:true,email:true}},_count:{select:{messages:true}}}})]);
  return NextResponse.json({data:items,total,page,pageSize});
}
