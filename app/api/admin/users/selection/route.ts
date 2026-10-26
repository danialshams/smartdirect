import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSelection,type AdminSelection } from "@/lib/admin-users";
export async function POST(request:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const b=await request.json().catch(()=>null);
 try{
  const userIds=await resolveAdminSelection(b?.selection as AdminSelection);
  return NextResponse.json({userIds,count:userIds.length},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({message:e instanceof Error?e.message:"انتخاب کاربران نامعتبر است"},{status:400});}
}
