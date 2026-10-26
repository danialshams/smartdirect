import { classify } from "./parser";
const MAX_EXCERPT=1150;
export function safeEnglishExcerpt(text:string):string{return text.replace(/\s+/g," ").trim().slice(0,MAX_EXCERPT);}
function unescapeTranslation(s:string){return s.replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");}
export async function translatePublicEnglishToPersian(input:string):Promise<string|null>{
 const text=safeEnglishExcerpt(input);
 if(text.length<25)return null;
 const parts:string[]=[];let remaining=text;
 while(remaining.length>0&&parts.length<4){
  if(remaining.length<=300){parts.push(remaining);break;}
  let cut=remaining.lastIndexOf(". ",300);if(cut<110)cut=remaining.lastIndexOf(" ",300);if(cut<110)cut=299;
  parts.push(remaining.slice(0,cut+1).trim());remaining=remaining.slice(cut+1).trim();
 }
 const translated:string[]=[];
 for(const part of parts){
  try{
   const uri=new URL("https://api.mymemory.translated.net/get");
   uri.searchParams.set("q",part);uri.searchParams.set("langpair","en|fa");
   const res=await fetch(uri,{cache:"no-store",signal:AbortSignal.timeout(4600),headers:{"Accept":"application/json"}});
   if(!res.ok)return null;
   const data=await res.json() as {responseStatus?:number;responseData?:{translatedText?:string}};
   const value=unescapeTranslation(data.responseData?.translatedText||"").replace(/\s+/g," ").trim();
   if(data.responseStatus!==200||value.length<10||!/[آ-ی]/.test(value)||/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(value))return null;
   translated.push(value);
  }catch{return null;}
 }
 return translated.join(" ").trim()||null;
}
/** Do not fabricate details if Meta did not publish enough text. */
export async function renderFactualPersian(title:string,description:string,sourceId=""){
 const excerpt=safeEnglishExcerpt(description);
 if(excerpt.length<85)throw Error("Official announcement does not contain enough detail to translate accurately");
 const meta=classify(title,excerpt,sourceId);
 const translated=await translatePublicEnglishToPersian(excerpt);
 if(!translated||translated.length<65)throw Error("Persian translation is unavailable or too short");
 const translatedTitle=await translatePublicEnglishToPersian(title);
 const titleFa=translatedTitle&&translatedTitle.length>18?translatedTitle:meta.titleFa;
 const impact=meta.category==="نسخه API"?
  "این خبر مربوط به نسخه API است؛ پیش از ارتقا باید سازگاری تمام ابزارهای SmartDirect بررسی شود.":
  "بخش مرتبط در SmartDirect: "+meta.category+". این اطلاعیه به‌تنهایی ثابت نمی‌کند که قابلیت در حساب توسعه‌دهنده ما فعال شده است.";
 return {titleFa,summaryFa:"چه چیزی در مستندات Meta نوشته شده؟\n"+translated+
 "\n\nاین تغییر به کدام بخش مربوط است؟\n"+impact+
 "\n\nوضعیت اجرا: برای استفاده در SmartDirect نیازمند بررسی مجوزها و سازگاری فنی است."};
}
