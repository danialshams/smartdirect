import { prisma } from "@/lib/prisma";
import { META_SOURCES } from "./catalog";
import { classify, extractCandidates, fingerprint } from "./parser";
import { renderFactualPersian } from "./translation";

export type ScanOutcome = { checked: number; successful: number; newNotices: number; unreadCount: number; skipped?: boolean; errors: string[] };
export async function scanOfficialMetaSources(force = false): Promise<ScanOutcome> {
 const now = new Date();
 await prisma.metaMonitorRun.upsert({where:{id:"official"},create:{id:"official"},update:{}});
 const state = await prisma.metaMonitorRun.findUnique({where:{id:"official"}});
 if (!force && state?.lastCheckedAt && Date.now() - state.lastCheckedAt.getTime() < 20 * 60_000) {
   return {checked:0,successful:0,newNotices:0,unreadCount:await prisma.metaMonitorNotice.count({where:{isRead:false}}),skipped:true,errors:[]};
 }
 const lease = await prisma.metaMonitorRun.updateMany({
   where:{id:"official",OR:[{lockedUntil:null},{lockedUntil:{lt:now}}]},
   data:{lockedUntil:new Date(now.getTime()+120_000)}
 });
 if (!lease.count) return {checked:0,successful:0,newNotices:0,unreadCount:await prisma.metaMonitorNotice.count({where:{isRead:false}}),skipped:true,errors:["بررسی دیگری در حال اجراست"]};
 let successful=0, newNotices=0;
 let translationBudget=2;
 const errors:string[]=[];
 try {
  for (const source of META_SOURCES) {
   const scanTime=new Date();
   try {
    const res=await fetch(source.url,{cache:"no-store",redirect:"follow",headers:{"User-Agent":"SmartDirect-Meta-Change-Monitor/1.0","Accept":"application/rss+xml, application/xml, text/html;q=0.8","Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(7500)});
    if(!res.ok)throw new Error("HTTP "+res.status);
    const size=Number(res.headers.get("content-length")||"0");
    if(size>2_000_000)throw new Error("متن منبع بیش از حد بزرگ است");
    const raw=(await res.text()).slice(0,2_000_000);
    const items=extractCandidates(raw,source);
    if(source.format==="rss"&&!items.length)throw new Error("هیچ مطلب معتبری از RSS خوانده نشد");
    const previous=await prisma.metaMonitorSource.findUnique({where:{id:source.id},select:{initializedAt:true}});
    const bootstrap=!previous?.initializedAt;
    const candidates=items.filter(item=>classify(item.title,item.description,source.id).relevant);
    const records=candidates.map(item=>{
      const match=classify(item.title,item.description,source.id);
      const key=match.kind==="VERSION"&&match.apiVersion?fingerprint("https://developers.facebook.com/docs/graph-api/changelog","Graph API "+match.apiVersion):fingerprint(item.url,item.title);
      return {fingerprint:key,sourceId:source.id,sourceUrl:item.url,
        originalTitle:item.title.slice(0,400),titleFa:match.titleFa,summaryFa:match.summaryFa,
        category:match.category,kind:match.kind,apiVersion:match.apiVersion,
        publishedAt:item.publishedAt,isRead:bootstrap,readAt:bootstrap?scanTime:null};
    });
    if(records.length){
      const saved=await prisma.metaMonitorNotice.createMany({data:records,skipDuplicates:true});
      if(!bootstrap)newNotices+=saved.count;
      if(translationBudget>0){
       for(const item of candidates){
        if(translationBudget<=0)break;
        const meta=classify(item.title,item.description,source.id);
        const key=meta.kind==="VERSION"&&meta.apiVersion?fingerprint("https://developers.facebook.com/docs/graph-api/changelog","Graph API "+meta.apiVersion):fingerprint(item.url,item.title);
        const existing=await prisma.metaMonitorNotice.findUnique({where:{fingerprint:key},select:{summaryFa:true}});
        if(existing?.summaryFa?.startsWith("ترجمه فارسی متن رسمی"))continue;
        translationBudget--;
        const translated=await renderFactualPersian(item.title,item.description);
        await prisma.metaMonitorNotice.updateMany({where:{fingerprint:key},data:translated});
       }
      }
    }
    await prisma.metaMonitorSource.upsert({where:{id:source.id},
      create:{id:source.id,label:source.label,url:source.url,initializedAt:scanTime,lastCheckedAt:scanTime,lastSuccessAt:scanTime,lastItemCount:items.length},
      update:{label:source.label,url:source.url,initializedAt:previous?.initializedAt||scanTime,lastCheckedAt:scanTime,lastSuccessAt:scanTime,lastError:null,lastItemCount:items.length}});
    successful++;
   }catch(err){
    const message=err instanceof Error?err.message:"خطای نامشخص";
    errors.push(source.label+": "+message.slice(0,160));
    await prisma.metaMonitorSource.upsert({where:{id:source.id},
      create:{id:source.id,label:source.label,url:source.url,lastCheckedAt:scanTime,lastError:message.slice(0,200)},
      update:{label:source.label,url:source.url,lastCheckedAt:scanTime,lastError:message.slice(0,200)}});
   }
  }
  await prisma.metaMonitorRun.update({where:{id:"official"},data:{lastCheckedAt:new Date(),
    ...(successful?{lastSuccessAt:new Date()}:{}),lastError:errors.length?errors.join(" | ").slice(0,700):null}});
  return {checked:META_SOURCES.length,successful,newNotices,
   unreadCount:await prisma.metaMonitorNotice.count({where:{isRead:false}}),errors};
 }finally{
  await prisma.metaMonitorRun.update({where:{id:"official"},data:{lockedUntil:null}}).catch(()=>undefined);
 }
}
