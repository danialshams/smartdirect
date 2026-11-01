import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {requireAdmin} from "@/lib/admin-auth";
import {sameOrigin,privateHeaders} from "@/lib/auth/request";
import {encryptMetaToken} from "@/lib/security/meta-token";
export const runtime="nodejs";
export async function GET(){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 const remaining=await prisma.instagramAccount.count({where:{NOT:{accessToken:{startsWith:"daira-meta-enc1:"}}}});
 return NextResponse.json({remaining},{headers:privateHeaders});
}
export async function POST(req:NextRequest){
 const guard=await requireAdmin();if(guard.response)return guard.response;
 if(!sameOrigin(req))return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
 const accounts=await prisma.instagramAccount.findMany({where:{NOT:{accessToken:{startsWith:"daira-meta-enc1:"}}},select:{id:true,accessToken:true},take:50,orderBy:{id:"asc"}});
 let changed=0;
 for(const account of accounts){
  const ciphertext=encryptMetaToken(account.accessToken);
  const result=await prisma.instagramAccount.updateMany({where:{id:account.id,accessToken:account.accessToken},data:{accessToken:ciphertext}});
  changed+=result.count;
 }
 const remaining=await prisma.instagramAccount.count({where:{NOT:{accessToken:{startsWith:"daira-meta-enc1:"}}}});
 return NextResponse.json({changed,remaining},{headers:privateHeaders});
}
