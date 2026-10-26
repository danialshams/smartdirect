import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { META_SOURCES } from "@/lib/meta-monitor/catalog";
import { extractCandidates } from "@/lib/meta-monitor/parser";
import { fetchMetaArticleBody } from "@/lib/meta-monitor/article";
import { isFreshMetaNotice } from "@/lib/meta-monitor/freshness";
import { renderFactualPersian } from "@/lib/meta-monitor/translation";
export const runtime="nodejs";
export const maxDuration=45;
/** Exact fresh notice only. No old changelog headings or fallback to unrelated articles. */
export async function POST(req:NextRequest){
 const admin=await requireAdmin();if(admin.response)return admin.response;
 const body=await req.json().catch(()=>null);
 if(typeof body?.id!=="string"||body.id.length>128)return NextResponse.json({message:"شناسه اعلان نامعتبر است"},{status:400});
 const notice=await prisma.metaMonitorNotice.findUnique({where:{id:body.id}});
 if(!notice)return NextResponse.json({message:"اعلان پیدا نشد"},{status:404});
 if(!isFreshMetaNotice(notice))return NextResponse.json({message:"این خبر قدیمی یا فاقد تاریخ معتبر است و توضیح جدید برای آن دریافت نمی‌شود."},{status:409});
 if(notice.summaryFa.startsWith("چه چیزی در مستندات Meta"))return NextResponse.json({titleFa:notice.titleFa,summaryFa:notice.summaryFa,translated:true});
 const source=META_SOURCES.find(s=>s.id===notice.sourceId);
 if(!source)return NextResponse.json({message:"منبع رسمی معتبر نیست"},{status:422});
 try{
  let description="";
  if(source.format==="rss"){
   description=await fetchMetaArticleBody(notice.sourceUrl,notice.originalTitle);
  }else{
   // Even for a dated version, translate only its exact section, never the entire history.
   const response=await fetch(source.url,{cache:"no-store",headers:{"Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error("Official changelog unavailable");
   const candidates=extractCandidates((await response.text()).slice(0,2_000_000),source);
   const entry=candidates.find(c=>c.title.trim().toLowerCase()===notice.originalTitle.trim().toLowerCase());
   if(!entry)throw Error("Exact announcement heading not found");
   description=entry.description;
  }
  if(description.trim().length<85)return NextResponse.json({message:"متن توضیحی کافی برای این خبر در منبع رسمی پیدا نشد؛ ترجمه ناقص نمایش داده نمی‌شود."},{status:422});
  const translated=await renderFactualPersian(notice.originalTitle,description,source.id);
  await prisma.metaMonitorNotice.update({where:{id:notice.id},data:translated});
  return NextResponse.json({...translated,translated:true});
 }catch(error){
  console.error("[meta-monitor] selected fresh notice translation failed",error);
  return NextResponse.json({message:"ترجمه معتبر این خبر در حال حاضر در دسترس نیست. هیچ خبر قدیمی جایگزین آن نخواهد شد."},{status:503});
 }
}
