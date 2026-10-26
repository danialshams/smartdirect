import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { META_SOURCES } from "@/lib/meta-monitor/catalog";
import { extractCandidates } from "@/lib/meta-monitor/parser";
import { renderFactualPersian } from "@/lib/meta-monitor/translation";

export const runtime="nodejs";
export const maxDuration=45;
/** Translates the original official announcement on demand, once per notice. */
export async function POST(req:NextRequest){
 const admin=await requireAdmin();if(admin.response)return admin.response;
 const body=await req.json().catch(()=>null);
 if(typeof body?.id!=="string"||body.id.length>128)return NextResponse.json({message:"شناسه اعلان نامعتبر است"},{status:400});
 const notice=await prisma.metaMonitorNotice.findUnique({where:{id:body.id}});
 if(!notice)return NextResponse.json({message:"اعلان پیدا نشد"},{status:404});
 if(notice.summaryFa.startsWith("ترجمه فارسی متن رسمی"))return NextResponse.json({titleFa:notice.titleFa,summaryFa:notice.summaryFa,translated:true});
 const source=META_SOURCES.find(s=>s.id===notice.sourceId);
 if(!source)return NextResponse.json({message:"منبع رسمی معتبر نیست"},{status:422});
 try{
  const response=await fetch(source.url,{cache:"no-store",headers:{"Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error("HTTP "+response.status);
  const html=(await response.text()).slice(0,2_000_000);
  const candidates=extractCandidates(html,source);
  const entry=candidates.find(c=>c.title.toLowerCase()===notice.originalTitle.toLowerCase());
  const result=await renderFactualPersian(notice.originalTitle,entry?.description||"");
  if(result.summaryFa.startsWith("ترجمه فارسی متن رسمی")){
   await prisma.metaMonitorNotice.update({where:{id:notice.id},data:result});
   return NextResponse.json({...result,translated:true});
  }
  return NextResponse.json({...result,translated:false,notice:"ترجمه خودکار متن کامل در دسترس نیست؛ توضیح فارسیِ تأییدپذیر نمایش داده شد."});
 }catch(error){
  console.error("[meta-monitor] official notice translation failed",error);
  return NextResponse.json({message:"در حال حاضر دسترسی به متن رسمی یا ترجمه امکان‌پذیر نیست"},{status:503});
 }
}