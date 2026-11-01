import {NextRequest,NextResponse} from "next/server";
import bcrypt from "bcryptjs";
import {prisma} from "@/lib/prisma";
import {sameOrigin,privateHeaders} from "@/lib/auth/request";
import {asciiDigits} from "@/lib/auth/phone";
import {authenticatedAdmin,hasAdminMfa,generateTotpSecret,encryptMfaSecret,decryptMfaSecret,validTotp,generateRecoveryCodes,hashRecoveryCode,setMfaCookie} from "@/lib/security/admin-mfa";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const user=await authenticatedAdmin();
 if(!user)return NextResponse.json({message:"دسترسی غیرمجاز است."},{status:403,headers:privateHeaders});
 const state=await hasAdminMfa(user.id,user.sessionVersion);
 return NextResponse.json({state},{headers:privateHeaders});
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
 if(Number(req.headers.get("content-length")||0)>2048)return NextResponse.json({message:"درخواست بزرگ است."},{status:413,headers:privateHeaders});
 const user=await authenticatedAdmin();
 if(!user)return NextResponse.json({message:"دسترسی غیرمجاز است."},{status:403,headers:privateHeaders});
 const raw=await req.text();if(Buffer.byteLength(raw)>2048)return NextResponse.json({message:"درخواست بزرگ است."},{status:413,headers:privateHeaders});
 let body:Record<string,unknown>={};try{body=JSON.parse(raw);}catch{return NextResponse.json({message:"درخواست نامعتبر است."},{status:400,headers:privateHeaders});}
 const action=body.action;
 const existing=await prisma.adminMfa.findUnique({where:{userId:user.id}});
 if(action==="begin"){
  if(existing?.enabledAt)return NextResponse.json({message:"تأیید دومرحله‌ای قبلاً فعال شده است."},{status:409,headers:privateHeaders});
  if(typeof body.password!=="string"||body.password.length>128||!await bcrypt.compare(body.password,user.password))
   return NextResponse.json({message:"رمز عبور حساب معتبر نیست."},{status:403,headers:privateHeaders});
  const secret=generateTotpSecret(),encryptedSecret=encryptMfaSecret(secret);
  await prisma.adminMfa.upsert({where:{userId:user.id},create:{userId:user.id,encryptedSecret},update:{encryptedSecret,pendingAt:new Date(),failedAttempts:0,lastFailedAt:null}});
  const label=encodeURIComponent("Daira Admin ("+user.email+")");
  return NextResponse.json({secret,otpauth:"otpauth://totp/"+label+"?secret="+secret+"&issuer=Daira&algorithm=SHA1&digits=6&period=30"},{headers:privateHeaders});
 }
 if(action!=="activate"&&action!=="verify")
  return NextResponse.json({message:"عملیات نامعتبر است."},{status:400,headers:privateHeaders});
 if(!existing||((action==="activate")===!!existing.enabledAt))
  return NextResponse.json({message:"ابتدا راه‌اندازی دومرحله‌ای را کامل کنید."},{status:400,headers:privateHeaders});
 if(action==="activate"&&Date.now()-existing.pendingAt.getTime()>10*60*1000)
  return NextResponse.json({message:"زمان راه‌اندازی تمام شد؛ دوباره شروع کنید."},{status:400,headers:privateHeaders});
 if(existing.lastFailedAt&&Date.now()-existing.lastFailedAt.getTime()<15*60*1000&&existing.failedAttempts>=8)
  return NextResponse.json({message:"درخواست‌های زیادی ثبت شده است."},{status:429,headers:privateHeaders});
 const code=typeof body.code==="string"?asciiDigits(body.code).trim():"";
 const verified=validTotp(decryptMfaSecret(existing.encryptedSecret),code);
 if(!verified&&action==="verify"&&typeof body.code==="string"&&code.length>=12){
  const codeHash=hashRecoveryCode(user.id,code);
  const used=await prisma.adminRecoveryCode.updateMany({where:{userId:user.id,codeHash,usedAt:null},data:{usedAt:new Date()}});
  if(used.count===1){await prisma.adminMfa.update({where:{userId:user.id},data:{failedAttempts:0,lastFailedAt:null}});
   const response=NextResponse.json({success:true},{headers:privateHeaders});
   await setMfaCookie(response,user.id,user.sessionVersion,req.headers.get("user-agent")||"");return response;}
 }
 if(!verified){
  await prisma.adminMfa.update({where:{userId:user.id},data:{failedAttempts:{increment:1},lastFailedAt:new Date()}});
  return NextResponse.json({message:"کد معتبر نیست."},{status:400,headers:privateHeaders});
 }
 if(action==="activate"){
  const codes=generateRecoveryCodes();
  await prisma.$transaction(async tx=>{
   await tx.adminRecoveryCode.deleteMany({where:{userId:user.id}});
   await tx.adminRecoveryCode.createMany({data:codes.map(c=>({userId:user.id,codeHash:hashRecoveryCode(user.id,c)}))});
   await tx.adminMfa.update({where:{userId:user.id},data:{enabledAt:new Date(),failedAttempts:0,lastFailedAt:null}});
  });
  const response=NextResponse.json({success:true,recoveryCodes:codes},{headers:privateHeaders});
  await setMfaCookie(response,user.id,user.sessionVersion,req.headers.get("user-agent")||"");
  return response;
 }
 await prisma.adminMfa.update({where:{userId:user.id},data:{failedAttempts:0,lastFailedAt:null}});
 const response=NextResponse.json({success:true},{headers:privateHeaders});
 await setMfaCookie(response,user.id,user.sessionVersion,req.headers.get("user-agent")||"");
 return response;
}
