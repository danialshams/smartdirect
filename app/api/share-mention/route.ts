import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateAutomationCache } from "@/lib/cache/instagram";
import { getCachedInstagramMedia } from "@/lib/cache/instagram";

export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
type Type = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SHOWCASE" | "FORM";
const types:Type[] = ["TEXT","IMAGE","VIDEO","AUDIO","SHOWCASE","FORM"];
const clean=(v:unknown)=>typeof v==="string"?v.trim():"";
const obj=(v:unknown):Row=>v&&typeof v==="object"&&!Array.isArray(v)?v as Row:{};
class RuleError extends Error { constructor(message:string,readonly status=400){super(message);} }
type Reply = {title:string;payload:string;destinationType:Type;destinationText:string;destinationQuestion:string;destinationShowcaseId:string;destinationMediaUrl:string;destinationMediaId:string;destinationFormId:string;destinationQuickReplies:Reply[];isExit:boolean};
function parseReplies(raw:unknown,depth=0,seen=new Set<string>()):Reply[]{
 if(!Array.isArray(raw)||raw.length<2||raw.length>13||depth>3)throw new RuleError("هر سؤال فرم باید بین ۲ تا ۱۳ گزینه و حداکثر چهار سطح داشته باشد.");
 return raw.map(v=>{
  const o=obj(v),title=clean(o.title),payload=clean(o.payload),destinationType=clean(o.destinationType) as Type;
  const destinationText=clean(o.destinationText),destinationQuestion=clean(o.destinationQuestion);
  const destinationShowcaseId=clean(o.destinationShowcaseId),destinationMediaUrl=clean(o.destinationMediaUrl),destinationMediaId=clean(o.destinationMediaId);
  if(!title||title.length>20||!payload||payload.length>1000||!types.includes(destinationType))throw new RuleError("عنوان یا مقصد یکی از گزینه‌های فرم نامعتبر است.");
  if(seen.has(payload))throw new RuleError("شناسه گزینه‌های فرم تکراری است.");seen.add(payload);
  if(destinationType==="TEXT"&&!destinationText)throw new RuleError("متن مقصد گزینه را وارد کنید.");
  if(destinationType==="FORM"&&!destinationQuestion)throw new RuleError("سؤال بعدی را وارد کنید.");
  if(destinationType==="SHOWCASE"&&!destinationShowcaseId)throw new RuleError("ویترین مقصد را انتخاب کنید.");
  if(["IMAGE","VIDEO","AUDIO"].includes(destinationType)&&!destinationMediaUrl&&!destinationMediaId)throw new RuleError("فایل مقصد گزینه را انتخاب کنید.");
  return {title,payload,destinationType,destinationText,destinationQuestion,destinationShowcaseId,destinationMediaUrl,destinationMediaId,
    destinationFormId:clean(o.destinationFormId),isExit:o.isExit===true,
    destinationQuickReplies:destinationType==="FORM"?parseReplies(o.destinationQuickReplies,depth+1,seen):[]};
 });
}
function getShowcases(replies:Reply[],ids:Set<string>){for(const reply of replies){if(reply.destinationType==="SHOWCASE")ids.add(reply.destinationShowcaseId);getShowcases(reply.destinationQuickReplies,ids);}}
async function save(request:NextRequest,editing:boolean){
 try{
  const session=await getServerSession(authOptions);
  if(!session?.user?.id)return NextResponse.json({success:false,error:"احراز هویت انجام نشده است."},{status:401});
  const body=obj(await request.json()),instagramAccountId=clean(body.instagramAccountId),id=clean(body.id);
  const triggerType=clean(body.triggerType);
  if(triggerType!=="DM_MEDIA_SHARE"&&triggerType!=="STORY_MENTION")throw new RuleError("نوع تعامل معتبر نیست.");
  if(!instagramAccountId)throw new RuleError("پیج اینستاگرام را انتخاب کنید.");
  const mediaIds=Array.isArray(body.mediaIds)?Array.from(new Set(body.mediaIds.filter((v:unknown):v is string=>typeof v==="string"&&/^\\d{5,40}$/.test(v.trim())).map((v:string)=>v.trim()))):[];
  if(triggerType==="DM_MEDIA_SHARE"&&(!mediaIds.length||mediaIds.length>50))throw new RuleError("بین ۱ تا ۵۰ پست یا ریلز انتخاب کنید.");
  if(triggerType==="STORY_MENTION"&&mediaIds.length)throw new RuleError("منشن استوری نیاز به انتخاب محتوا ندارد.");
  const raw=obj(body.message),messageType=clean(raw.messageType) as Type;
  if(!types.includes(messageType))throw new RuleError("نوع پاسخ معتبر نیست.");
  const text=clean(raw.text),mediaUrl=clean(raw.mediaUrl),mediaId=clean(raw.mediaId),showcaseId=clean(raw.showcaseId),formId=clean(raw.formId);
  if(["TEXT","FORM"].includes(messageType)&&(!text||text.length>2000))throw new RuleError("متن پیام یا سؤال فرم را کامل وارد کنید.");
  if(["IMAGE","VIDEO","AUDIO"].includes(messageType)&&!mediaUrl&&!mediaId)throw new RuleError("فایل پیام را انتخاب کنید.");
  if(messageType==="SHOWCASE"&&!showcaseId)throw new RuleError("ویترین پاسخ را انتخاب کنید.");
  const replies=messageType==="FORM"?parseReplies(raw.quickReplies):[];
  const account=await prisma.instagramAccount.findFirst({where:{id:instagramAccountId,userId:session.user.id,isConnected:true},select:{id:true}});
  if(!account)throw new RuleError("پیج اینستاگرام متصل و متعلق به شما نیست.",403);
  if(triggerType==="DM_MEDIA_SHARE"){
    const media=await getCachedInstagramMedia(account.id,50);
    if(!media)throw new RuleError("دریافت پست‌ها و ریلزها از اینستاگرام ناموفق بود.",502);
    const owned=new Set((media.data||[]).filter((item:Record<string,unknown>)=>item.media_product_type!=="STORY").map((item:Record<string,unknown>)=>String(item.id||"")));
    if(mediaIds.some(id=>!owned.has(id)))throw new RuleError("یکی از محتواهای انتخابی متعلق به پیج شما نیست یا خارج از فهرست فعلی است.");
  }
  const expected=clean(body.expectedUpdatedAt);
  if(editing&&(!id||!expected||!Number.isFinite(Date.parse(expected))))throw new RuleError("صفحه ویرایش را دوباره باز کنید.",409);
  const showcaseIds=new Set<string>();
  if(messageType==="SHOWCASE")showcaseIds.add(showcaseId);getShowcases(replies,showcaseIds);
  if(showcaseIds.size){
   const owned=await prisma.showcase.findMany({where:{id:{in:[...showcaseIds]},userId:session.user.id,instagramAccountId},select:{id:true}});
   if(owned.length!==showcaseIds.size)throw new RuleError("یکی از ویترین‌ها متعلق به این پیج نیست.");
  }
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRawUnsafe('SELECT id FROM "InstagramAccount" WHERE id = $1 FOR UPDATE',instagramAccountId);
   const current=editing?await tx.automation.findFirst({where:{id,instagramAccountId,triggerType:triggerType as "DM_MEDIA_SHARE"|"STORY_MENTION"},select:{id:true,updatedAt:true}}):null;
   if(editing&&!current)throw new RuleError("پاسخ تعامل انتخاب‌شده پیدا نشد.",404);
   if(current&&current.updatedAt.getTime()!==new Date(expected).getTime())throw new RuleError("این پاسخ هم‌زمان ویرایش شده است؛ صفحه را دوباره باز کنید.",409);
   const peers=await tx.automation.findMany({
     where:{instagramAccountId,triggerType:triggerType as "DM_MEDIA_SHARE"|"STORY_MENTION",...(current?{id:{not:current.id}}:{})},
     select:{mediaIds:true,mediaId:true},
   });
   if(triggerType==="STORY_MENTION"&&peers.length)throw new RuleError("برای منشن استوری قبلاً یک پاسخ ایجاد شده است.",409);
   const mediaSet=new Set(mediaIds);
   if(triggerType==="DM_MEDIA_SHARE"&&peers.some(peer=>{
     const existing=(peer.mediaIds||peer.mediaId||"").split(",").filter(Boolean);
     return existing.some(value=>mediaSet.has(value));
   }))throw new RuleError("یکی از پست‌ها قبلاً برای پاسخ به اشتراک‌گذاری انتخاب شده است.",409);
   const automation=current
    ?await tx.automation.update({where:{id:current.id},data:{keyword:null,mediaId:mediaIds.length===1?mediaIds[0]:null,mediaIds:mediaIds.join(",")||null,sendDm:true,isActive:body.isActive!==false}})
    :await tx.automation.create({data:{instagramAccountId,triggerType:triggerType as "DM_MEDIA_SHARE"|"STORY_MENTION",keyword:null,mediaId:mediaIds.length===1?mediaIds[0]:null,mediaIds:mediaIds.join(",")||null,sendDm:true,isActive:body.isActive!==false}});
   const existing=await tx.automationMessage.findMany({where:{automationId:automation.id},orderBy:{order:"asc"},select:{id:true}});
   const fields={messageType,order:0,text:text||null,
    mediaUrl:["IMAGE","VIDEO","AUDIO"].includes(messageType)?mediaUrl||null:null,
    mediaId:["IMAGE","VIDEO","AUDIO"].includes(messageType)?mediaId||null:null,
    showcaseId:messageType==="SHOWCASE"?showcaseId:null,
    formId:messageType==="FORM"?formId||null:null};
   const saved=existing[0]?await tx.automationMessage.update({where:{id:existing[0].id},data:fields})
    :await tx.automationMessage.create({data:{automationId:automation.id,...fields}});
   const previous=await tx.quickReply.findMany({where:{automationMessageId:saved.id},select:{id:true,payload:true}});
   const previousByPayload=new Map(previous.map(x=>[x.payload,x.id]));
   const retained:string[]=[];
   for(const reply of replies){
    const data={title:reply.title,payload:reply.payload,replyText:JSON.stringify({
      isExit:reply.isExit,destinationType:reply.destinationType,destinationText:reply.destinationText,
      destinationQuestion:reply.destinationQuestion,destinationShowcaseId:reply.destinationShowcaseId,
      destinationMediaUrl:reply.destinationMediaUrl,destinationMediaId:reply.destinationMediaId,
      destinationFormId:reply.destinationFormId,destinationQuickReplies:reply.destinationQuickReplies})};
    const prev=previousByPayload.get(reply.payload);
    const item=prev?await tx.quickReply.update({where:{id:prev},data}):await tx.quickReply.create({data:{automationMessageId:saved.id,...data}});
    retained.push(item.id);
   }
   await tx.quickReply.deleteMany({where:{automationMessageId:saved.id,id:{notIn:retained}}});
   const obsolete=existing.slice(1).map(x=>x.id);
   if(obsolete.length){
    await tx.quickReply.updateMany({where:{nextMessageId:{in:obsolete}},data:{nextMessageId:null}});
    await tx.quickReply.deleteMany({where:{automationMessageId:{in:obsolete}}});
    await tx.automationMessage.deleteMany({where:{id:{in:obsolete},automationId:automation.id}});
   }
   return {id:automation.id};
  },{maxWait:10000,timeout:30000});
  try{await invalidateAutomationCache(instagramAccountId);}catch(error){console.warn("Share/mention automation cache invalidation failed",error);}
  return NextResponse.json({success:true,data:result},{status:editing?200:201});
 }catch(error){
  if(error instanceof RuleError)return NextResponse.json({success:false,error:error.message},{status:error.status});
  console.error("Share/mention automation save failed",error);
  return NextResponse.json({success:false,error:"ذخیره پاسخ به اشتراک‌گذاری و منشن ناموفق بود."},{status:500});
 }
}
export async function POST(req:NextRequest){return save(req,false);}
export async function PUT(req:NextRequest){return save(req,true);}
