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
type Reply = {title:string;payload:string;savedResponseId:string|null;destinationType:Type;destinationText:string;destinationQuestion:string;destinationShowcaseId:string;destinationMediaUrl:string;destinationMediaId:string;destinationFormId:string;destinationQuickReplies:Reply[];isExit:boolean};
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
  return {title,payload,savedResponseId:clean(o.savedResponseId)||null,destinationType,destinationText,destinationQuestion,destinationShowcaseId,destinationMediaUrl,destinationMediaId,
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
  const words=Array.from(new Set(splitAutomationKeywords(clean(body.keyword))));
  if(!instagramAccountId)throw new RuleError("پیج اینستاگرام را انتخاب کنید.");
  if(!words.length||words.length>10||words.some(w=>w.length>100))throw new RuleError("بین ۱ تا ۱۰ کلمه کلیدی، هرکدام حداکثر ۱۰۰ کاراکتر، وارد کنید.");
  // Direct automation titles are internal labels generated from the keywords,
  // never a field that users need to fill. Generate on the server too, so a
  // stale client or long list of keywords cannot block saving on title length.
  const title=("پاسخ دایرکت - "+words.join("، ")).slice(0,80);
  // A legacy single message is still accepted for backwards-compatible clients.
  // The current editor submits an ordered sequence. All messages are validated
  // before the transaction, so a partially valid flow is never persisted.
  const rawMessages: unknown[] = Array.isArray(body.messages) ? body.messages : [body.message];
  const MAX_DM_MESSAGES = 5;
  if (!rawMessages.length || rawMessages.length > MAX_DM_MESSAGES)
    throw new RuleError("بین ۱ تا ۵ پیام برای هر پاسخ خودکار دایرکت مجاز است.");
  const parsedMessages = rawMessages.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new RuleError(`ساختار پیام ${index + 1} نامعتبر است.`);
    const raw = obj(entry);
    const messageType = clean(raw.messageType) as Type;
    if (!types.includes(messageType)) throw new RuleError(`نوع پیام ${index + 1} معتبر نیست.`);
    if (messageType === "VIDEO") throw new RuleError("ارسال خودکار ویدیو فعلاً غیرفعال است.");
    const text=clean(raw.text),mediaUrl=clean(raw.mediaUrl),mediaId=clean(raw.mediaId),
      showcaseId=clean(raw.showcaseId),formId=clean(raw.formId);
    if (["TEXT","FORM"].includes(messageType) && (!text || text.length > 2000))
      throw new RuleError(`متن پیام یا سؤال فرم ${index + 1} را کامل وارد کنید (حداکثر ۲۰۰۰ کاراکتر).`);
    if (["IMAGE","AUDIO"].includes(messageType) && !mediaUrl && !mediaId)
      throw new RuleError(`فایل پیام ${index + 1} را انتخاب کنید.`);
    if (messageType === "SHOWCASE" && !showcaseId)
      throw new RuleError(`ویترین پیام ${index + 1} را انتخاب کنید.`);
    const replies = messageType === "FORM" ? parseReplies(raw.quickReplies) : [];
    return { id:clean(raw.id),messageType,text,mediaUrl,mediaId,showcaseId,formId,
      savedResponseId:raw.savedResponseId,replies };
  });
  // A form waits for the recipient to choose an option; unlike text/media, it
  // cannot be followed by an automatically sent message in the same run.
  if (parsedMessages.slice(0, -1).some(item => item.messageType === "FORM"))
    throw new RuleError("فرم باید آخرین پیام باشد؛ ارسال پاسخ بعدی منتظر انتخاب کاربر می‌ماند.");
  const account=await prisma.instagramAccount.findFirst({where:{id:instagramAccountId,userId:session.user.id,isConnected:true},select:{id:true}});
  if(!account)throw new RuleError("پیج اینستاگرام متصل و متعلق به شما نیست.",403);
  // Validate each saved-response reference against this account; never reuse a
  // saved asset from another tenant or Instagram page.
  const savedOrigins: Array<string | null | undefined> = [];
  for (const item of parsedMessages) {
    try {
      savedOrigins.push(await validateSavedResponseOrigin(
        item.savedResponseId, instagramAccountId, session.user.id, item.messageType
      ));
    } catch (error) {
      throw new RuleError(error instanceof Error ? error.message : "پاسخ ذخیره‌شده معتبر نیست.");
    }
  }
  const expected=clean(body.expectedUpdatedAt);
  if(editing&&(!id||!expected||!Number.isFinite(Date.parse(expected))))throw new RuleError("صفحه ویرایش را دوباره باز کنید.",409);
  const showcaseIds=new Set<string>();
  for (const item of parsedMessages) {
    if (item.messageType === "SHOWCASE") showcaseIds.add(item.showcaseId);
    getShowcases(item.replies,showcaseIds);
  }
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
    ?await tx.automation.update({where:{id:current.id},data:{title,keyword:words.join(","),keywordMatchMode:"EXACT",sendDm:true}})
    :await tx.automation.create({data:{instagramAccountId,title,triggerType:"DM",keyword:words.join(","),keywordMatchMode:"EXACT",sendDm:true,isActive:true}});
   const existing=await tx.automationMessage.findMany({
     where:{automationId:automation.id},orderBy:{order:"asc"},select:{id:true}
   });
   const existingIds=new Set(existing.map(item=>item.id));
   const retainedMessageIds:string[]=[];
   for (const [index,item] of parsedMessages.entries()) {
     const fields={
       messageType:item.messageType,
       order:index,
       text:item.text||null,
       savedResponseId:savedOrigins[index]??null,
       mediaUrl:["IMAGE","AUDIO"].includes(item.messageType)?item.mediaUrl||null:null,
       mediaId:["IMAGE","AUDIO"].includes(item.messageType)?item.mediaId||null:null,
       showcaseId:item.messageType==="SHOWCASE"?item.showcaseId:null,
       formId:item.messageType==="FORM"?item.formId||null:null,
     };
     // Keep the original database row and its inbound links when reordering.
     const matchedId=item.id&&existingIds.has(item.id)?item.id:null;
     const saved=matchedId
       ?await tx.automationMessage.update({where:{id:matchedId},data:fields})
       :await tx.automationMessage.create({data:{automationId:automation.id,...fields}});
     retainedMessageIds.push(saved.id);
     const previous=await tx.quickReply.findMany({
       where:{automationMessageId:saved.id},select:{id:true,payload:true}
     });
     const previousByPayload=new Map(previous.map(reply=>[reply.payload,reply.id]));
     const retainedReplyIds:string[]=[];
     for (const reply of item.replies) {
       const data={title:reply.title,payload:reply.payload,replyText:JSON.stringify({
         isExit:reply.isExit,savedResponseId:reply.savedResponseId,
         destinationType:reply.destinationType,destinationText:reply.destinationText,
         destinationQuestion:reply.destinationQuestion,
         destinationShowcaseId:reply.destinationShowcaseId,
         destinationMediaUrl:reply.destinationMediaUrl,
         destinationMediaId:reply.destinationMediaId,
         destinationFormId:reply.destinationFormId,
         destinationQuickReplies:reply.destinationQuickReplies,
       })};
       const previousId=previousByPayload.get(reply.payload);
       const row=previousId
         ?await tx.quickReply.update({where:{id:previousId},data})
         :await tx.quickReply.create({data:{automationMessageId:saved.id,...data}});
       retainedReplyIds.push(row.id);
     }
     await tx.quickReply.deleteMany({
       where:{automationMessageId:saved.id,id:{notIn:retainedReplyIds}}
     });
   }
   // Delete removed messages only after all retained rows have been saved.
   // Null external quick-reply destinations before removing their target.
   const obsolete=existing.filter(item=>!retainedMessageIds.includes(item.id)).map(item=>item.id);
   if(obsolete.length){
     await tx.quickReply.updateMany({
       where:{nextMessageId:{in:obsolete}},data:{nextMessageId:null}
     });
     await tx.quickReply.deleteMany({where:{automationMessageId:{in:obsolete}}});
     await tx.automationMessage.deleteMany({
       where:{id:{in:obsolete},automationId:automation.id}
     });
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
