import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, privateHeaders, sameOrigin } from "@/lib/auth/request";
import { hashRequestIp } from "@/lib/auth/sms-otp";

export const runtime = "nodejs";
const limits={maxBody:4096, maxPerDay:3};
const statuses=new Set(["PENDING","VERIFYING","COMPLETED","REJECTED","PROCESSING"]);
export async function POST(req:NextRequest){
  if(!sameOrigin(req)) return NextResponse.json({message:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
  const bytes=Number(req.headers.get("content-length") || 0);
  if(bytes>limits.maxBody) return NextResponse.json({message:"درخواست بیش از حد بزرگ است."},{status:413,headers:privateHeaders});
  const raw=await req.text().catch(()=>"");
  if(Buffer.byteLength(raw,"utf8")>limits.maxBody) return NextResponse.json({message:"درخواست بیش از حد بزرگ است."},{status:413,headers:privateHeaders});
  let body:Record<string,unknown>|null=null;
  try{const value=JSON.parse(raw); if(value && typeof value==="object" && !Array.isArray(value)) body=value;}catch{}
  if(!body) return NextResponse.json({message:"اطلاعات نامعتبر است."},{status:400,headers:privateHeaders});
  // Invisible bot field. Never store a spammer's contact details.
  if(body.website) return NextResponse.json({success:true,reference:""}, {headers:privateHeaders});
  const contact=typeof body.contact==="string"?body.contact.trim().slice(0,190):"";
  const instagramName=typeof body.instagramName==="string"?body.instagramName.trim().replace(/^@/,"").slice(0,80):"";
  const details=typeof body.details==="string"?body.details.trim().slice(0,600):"";
  if(!/^([^\s@]+@[^\s@]+\.[^\s@]+|\+?[0-9۰-۹\s-]{10,20})$/.test(contact) ||
      (instagramName && !/^[A-Za-z0-9._]{1,30}$/.test(instagramName)))
    return NextResponse.json({message:"یک ایمیل یا شماره تماس معتبر و نام کاربری صحیح وارد کنید."},{status:400,headers:privateHeaders});
  try{
    const ipHash=hashRequestIp(clientIp(req));
    const cutoff=new Date(Date.now()-86400000);
    const prior=await prisma.dataDeletionRequest.count({where:{ipHash,createdAt:{gt:cutoff}}});
    if(prior>=limits.maxPerDay)return NextResponse.json({message:"سقف ثبت درخواست روزانه تکمیل شده است."},{status:429,headers:privateHeaders});
    const created=await prisma.dataDeletionRequest.create({data:{contact,instagramName:instagramName||null,details:details||null,ipHash}});
    return NextResponse.json({success:true,reference:created.id,status:created.status},{status:201,headers:privateHeaders});
  }catch{return NextResponse.json({message:"ثبت درخواست انجام نشد. مجدداً تلاش کنید."},{status:503,headers:privateHeaders});}
}
export async function GET(req:NextRequest){
  const id=req.nextUrl.searchParams.get("reference")?.trim() || "";
  if(!/^c[a-z0-9]{12,40}$/.test(id))return NextResponse.json({message:"شناسه درخواست نامعتبر است."},{status:400,headers:privateHeaders});
  const request=await prisma.dataDeletionRequest.findUnique({where:{id},select:{status:true,createdAt:true}});
  if(!request||!statuses.has(request.status))return NextResponse.json({message:"درخواستی پیدا نشد."},{status:404,headers:privateHeaders});
  return NextResponse.json({status:request.status,createdAt:request.createdAt},{headers:privateHeaders});
}
