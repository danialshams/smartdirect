import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSavedResponseOrigin } from "@/lib/automation/saved-response-origin";
import { invalidateAutomationCache } from "@/lib/cache/instagram";
import { splitAutomationKeywords } from "@/lib/automation/trigger";

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
  if(destinationType==="VIDEO")throw new RuleError("آپلود ویدیو برای پاسخ خودکار فعلاً غیرفعال است.");
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
  const title=clean(body.title);
  if (!title||title.length>80) throw new RuleError("نام پاسخ را وارد کن (حداکثر ۸۰ نویسه).");
  const words=Array.from(new Set(splitAutomationKeywords(clean(body.keyword))));
  if(!instagramAccountId)throw new RuleError("پیج اینستاگرام را انتخاب کنید.");
  if(!words.length||words.length>10||words.some(w=>w.length>100))throw new RuleError("بین ۱ تا ۱۰ کلمه کلیدی، هرکدام حداکثر ۱۰۰ کاراکتر، وارد کنید.");
  const raw=obj(body.message),messageType=clean(raw.messageType) as Type;
  if(!types.includes(messageType))throw new RuleError("نوع پاسخ معتبر نیست.");
  if(messageType==="VIDEO")throw new RuleError("آپلود ویدیو برای پاسخ خودکار فعلاً غیرفعال است.");
  const text=clean(raw.text),mediaUrl=clean(raw.mediaUrl),mediaId=clean(raw.mediaId),showcaseId=clean(raw.showcaseId),formId=clean(raw.formId);
  if(["TEXT","FORM"].includes(messageType)&&(!text||text.length>2000))throw new RuleError("متن پیام یا سؤال فرم را کامل وارد کنید.");
  if(["IMAGE","VIDEO","AUDIO"].includes(messageType)&&!mediaUrl&&!mediaId)throw new RuleError("فایل پیام را انتخاب کنید.");
  if(messageType==="SHOWCASE"&&!showcaseId)throw new RuleError("ویترین پاسخ را انتخاب کنید.");
  const replies=messageType==="FORM"?parseReplies(raw.quickReplies):[];
  const account=await prisma.instagramAccount.findFirst({where:{id:instagramAccountId,userId:session.user.id,isConnected:true},select:{id:true}});
  if(!account)throw new RuleError("پیج اینستاگرام متصل و متعلق به شما نیست.",403);
  let savedOrigin: string | null | undefined;
  try { savedOrigin = await validateSavedResponseOrigin(raw.savedResponseId, instagramAccountId, session.user.id); }
  catch (error) { throw new RuleError(error instanceof Error ? error.message : "پاسخ ذخیره‌شده معتبر نیست."); }
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
   const current=editing?await tx.automation.findFirst({where:{id,instagramAccountId,triggerType:"DM"},select:{id:true,updatedAt:true}}):null;
   if(editing&&!current)throw new RuleError("پاسخ خودکار دایرکت پیدا نشد.",404);
   if(current&&current.updatedAt.getTime()!==new Date(expected).getTime())throw new RuleError("این پاسخ هم‌زمان ویرایش شده است؛ صفحه را دوباره باز کنید.",409);
   const peers=await tx.automation.findMany({where:{instagramAccountId,triggerType:"DM",keyword:{not:null},...(current?{id:{not:current.id}}:{})},select:{keyword:true}});
   const names=new Set(words);
   if(peers.some(p=>splitAutomationKeywords(p.keyword||"").some(w=>names.has(w))))throw new RuleError("یکی از کلمات کلیدی قبلاً برای پاسخ دیگری ثبت شده است.",409);
   const automation=current
    ?await tx.automation.update({where:{id:current.id},data:{title,keyword:words.join(","),keywordMatchMode:"EXACT",sendDm:true,isActive:true}})
    :await tx.automation.create({data:{instagramAccountId,title,triggerType:"DM",keyword:words.join(","),keywordMatchMode:"EXACT",sendDm:true,isActive:true}});
   const existing=await tx.automationMessage.findMany({where:{automationId:automation.id},orderBy:{order:"asc"},select:{id:true}});
   const fields={messageType,order:0,text:text||null,...(savedOrigin !== undefined ? { savedResponseId: savedOrigin } : {}),
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
  try{await invalidateAutomationCache(instagramAccountId);}catch(error){console.warn("DM automation cache invalidation failed",error);}
  return NextResponse.json({success:true,data:result},{status:editing?200:201});
 }catch(error){
  if(error instanceof RuleError)return NextResponse.json({success:false,error:error.message},{status:error.status});
  console.error("DM automation save failed",error);
  return NextResponse.json({success:false,error:"ذخیره پاسخ خودکار دایرکت ناموفق بود."},{status:500});
 }
}
export async function POST(req:NextRequest){return save(req,false);}
export async function PUT(req:NextRequest){return save(req,true);}
