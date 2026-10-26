import { classify } from "./parser";

/** Source excerpts are PUBLIC Meta documentation, never user/account data.
 * MyMemory offers a rate-limited anonymous translation API: a failed translation
 * must never be represented as a faithful Persian rendering of source text. */
export function factualPersianFallback(title: string, body: string): string {
 const text=(title+" "+body).toLowerCase();
 if (/phone number and email quick replies disabled/i.test(title))
  return "طبق مستندات متا، پاسخ‌های سریع با گزینه «شماره تلفن» و «ایمیل» غیرفعال شده‌اند. این تغییر برای تعاملات دایرکت و فرم‌های دریافت اطلاعات در SmartDirect اهمیت دارد.";
 if (/captions on stories published through/i.test(title))
  return "مستندات رسمی متا به قابلیت افزودن کپشن به استوری‌هایی اشاره می‌کند که از طریق Content Publishing API منتشر می‌شوند. سازگاری آن با انتشار استوری SmartDirect باید بررسی شود.";
 if (/ordered comments for instagram ad media/i.test(title))
  return "تغییر مستندات مربوط به کامنت‌های مرتب‌شده در رسانه‌های تبلیغاتی اینستاگرام است. لازم است جزئیات بازیابی و ترتیب کامنت‌ها در منبع رسمی بررسی شود.";
 if (/phone number|email|quick repl/i.test(text)&&/disabl|remov/i.test(text))
  return "متا در دسترس‌بودن برخی پاسخ‌های سریع، از جمله اطلاعات تماس، را تغییر داده است. جزئیات دقیق انواع پاسخ و محدودیت‌های جدید در منبع رسمی مشخص شده‌اند.";
 if (/graph api (?:v|version )?(\d+)\.0/i.test(title)) {
  const version=title.match(/(?:v|version )?(\d+)\.0/i)?.[1]||"جدید";
  return "مستندات رسمی از نسخه "+version+".0 Graph API خبر می‌دهند. پیش از ارتقای SmartDirect لازم است تغییرات سازگاری، مجوزها و نقاط پایانی مربوط به اینستاگرام بررسی شوند.";
 }
 const c=classify(title,body);
 const subject=c.category==="سایر تغییرات مرتبط"?"رابط برنامه‌نویسی اینستاگرام":c.category;
 const event=c.kind==="DEPRECATION"?"حذف یا غیرفعال‌شدن بخشی از امکانات":c.kind==="LIMIT"?"تغییر محدودیت‌ها":c.kind==="NEW"?"معرفی قابلیت تازه":"به‌روزرسانی مستندات";
 return "اطلاعیه رسمی درباره "+event+" در «"+subject+"» است. برای جلوگیری از بیان جزئیات تأییدنشده، متن کامل اعلامیه را باید در منبع رسمی مطالعه کرد.";
}
export function safeEnglishExcerpt(text: string): string {
 return text.replace(/\s+/g," ").trim().slice(0,850);
}
function translateEntities(input:string):string {
 return input.replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
}
export async function translatePublicEnglishToPersian(input:string):Promise<string|null>{
 const trimmed=safeEnglishExcerpt(input);
 if(trimmed.length<12)return null;
 // Max 500 BYTES/request in the official MyMemory API. Stay below 400.
 const chunks:string[]=[];let rest=trimmed;
 for(let n=0;n<3&&rest.length>0;n++){
  if(rest.length<=370){chunks.push(rest);break;}
  let cut=rest.lastIndexOf(". ",370);
  if(cut<110)cut=rest.lastIndexOf(" ",370);
  if(cut<110)cut=370;
  chunks.push(rest.slice(0,cut+1).trim());rest=rest.slice(cut+1).trim();
 }
 const translated:string[]=[];
 for(const chunk of chunks){
  try {
   const uri=new URL("https://api.mymemory.translated.net/get");
   uri.searchParams.set("q",chunk);uri.searchParams.set("langpair","en|fa");
   const res=await fetch(uri,{cache:"no-store",signal:AbortSignal.timeout(4500),headers:{"Accept":"application/json"}});
   if(!res.ok)return null;
   const raw=await res.json() as {responseStatus?:number;responseData?:{translatedText?:string}};
   const result=translateEntities(raw.responseData?.translatedText||"").trim();
   if(raw.responseStatus!==200||result.length<8||!/[آ-ی]/.test(result)||/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(result))return null;
   translated.push(result);
  } catch{return null;}
 }
 return translated.join(" ").trim()||null;
}
/** Persian rendering of the actual announcement title and excerpt, not a generic category label. */
export async function renderFactualPersian(title:string,description:string){
 const excerpt=safeEnglishExcerpt(description);
 const fallback=factualPersianFallback(title,excerpt);
 const [translatedTitle,translatedBody]=await Promise.all([
   translatePublicEnglishToPersian(title),
   excerpt.length>18?translatePublicEnglishToPersian(excerpt):Promise.resolve(null)
 ]);
 return {
  titleFa:translatedTitle||classify(title,description).titleFa,
  summaryFa:translatedBody
   ? "ترجمه فارسی متن رسمی متا: "+translatedBody+"\n\nبرداشت مرتبط با SmartDirect: "+fallback
   : "توضیح مرتبط با SmartDirect: "+fallback+(excerpt?"\n\nمتن اصلی برای ارجاع: "+excerpt:"\n\nمتن توضیحی کافی برای ترجمه در منبع قابل دریافت نبود.")
 };
}
