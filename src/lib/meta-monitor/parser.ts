import { createHash } from "node:crypto";
import { CATEGORY_RULES, type Candidate, type Source } from "./catalog";
export function plain(s:string):string{
 return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,"$1").replace(/<[^>]+>/g," ")
 .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'")
 .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ")
 .replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/\s+/g," ").trim().slice(0,1200);
}
export function metaUrl(s:string):string|null{
 try{
 const u=new URL(s.replace(/&amp;/g,"&"));
 if(u.protocol!=="https:"||!["developers.facebook.com","developers.meta.com"].includes(u.hostname))return null;
 u.hash="";["fbclid","utm_source","utm_medium","utm_campaign"].forEach(x=>u.searchParams.delete(x));
 return u.toString();
 }catch{return null;}
}
function tag(s:string,k:string){
 const match=s.match(new RegExp("<"+k+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+k+">","i"));
 return match?plain(match[1]):"";
}
export function extractCandidates(raw:string,source:Source):Candidate[]{
 if(source.format==="rss"){
  if(!/<(?:rss|feed|rdf:RDF)\b/i.test(raw))throw Error("قالب RSS رسمی نامعتبر است");
  return [...raw.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,80).flatMap(m=>{
   const s=m[2];const href=s.match(/<link\b[^>]*href=["']([^"']+)/i)?.[1];
   const url=metaUrl(href||tag(s,"link")||tag(s,"guid")),title=tag(s,"title");
   if(!url||!title)return [];
   const d=tag(s,"pubDate")||tag(s,"published")||tag(s,"updated");
   const parsed=d?new Date(d):null;
   return [{title,url,source:source.id,description:tag(s,"description")||tag(s,"summary"),
    publishedAt:parsed&&!Number.isNaN(parsed.getTime())?parsed:null}];
  });
 }
 if(!/<html\b|<h[1-5]\b/i.test(raw))throw Error("سند رسمی قابل خواندن نیست");
 const heads=[...raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
 return heads.slice(0,160).flatMap(m=>{
  const title=plain(m[1]);if(title.length<12||title.length>180)return [];
  if(!/graph api v\d+|instagram api v\d+|deprecat|permission|messaging|publishing|insight|webhook|breaking change/i.test(title))return [];
  return [{title,url:source.url,source:source.id,description:"",publishedAt:null}];
 }).slice(0,35);
}
export function classify(title:string,description=""){
 const t=title+" "+description.slice(0,500);
 const match=title.match(/\b(?:Graph API|Instagram (?:Graph )?API)\s*(?:version\s*)?v?(\d{1,2})\.0\b/i);
 const apiVersion=match?"v"+match[1]+".0":null;
 const version=!!match&&Number(match[1])>=26&&/announc|introduc|releas|launch|graph api v|instagram api v/i.test(title);
 const matches=CATEGORY_RULES.filter(x=>x.pattern.test(t));
 const insta=/instagram|graph api|meta business|webhook|messaging platform/i.test(t);
 const unrelated=/whatsapp|threads|horizon|quest|marketing api|facebook ads|wearables/i.test(title);
 const relevant=(version||(insta&&matches.length>0))&&!(unrelated&&!/instagram|graph api/i.test(title));
 const category=version?"نسخه API":matches[0]?.name||"سایر تغییرات مرتبط";
 const kind=version?"VERSION":/deprecat|remov|sunset|retir|discontinu/i.test(t)?"DEPRECATION":/restriction|rate limit|policy|breaking change/i.test(t)?"LIMIT":/new |introduc|launch|releas|support for/i.test(title)?"NEW":"UPDATE";
 const label=kind==="VERSION"?"نسخه جدید":kind==="NEW"?"قابلیت جدید":kind==="DEPRECATION"?"حذف قابلیت":kind==="LIMIT"?"تغییر محدودیت":"تغییر مستندات";
 const titleFa=version?"اطلاعیه رسمی انتشار "+apiVersion:"اعلان "+label+" درباره "+category;
 const summaryFa=version?"خبر "+apiVersion+" در مستندات رسمی Meta دیده شد. نسخه فعلی SmartDirect، v26.0 است؛ پیش از ارتقا باید جزئیات و سازگاری بررسی شود."
 :"Meta اطلاعیه‌ای مرتبط با «"+category+"» منتشر کرده است. عنوان منبع: «"+title.slice(0,180)+"». امکان استفاده در SmartDirect هنوز نیاز به ارزیابی دارد.";
 return {relevant,category,kind,apiVersion,titleFa,summaryFa};
}
export function fingerprint(url:string,title:string){
 const normalized=metaUrl(url)||url;
 return createHash("sha256").update(normalized.replace(/\/$/,"")+"|"+title.toLowerCase().replace(/\s+/g," ").trim()).digest("hex");
}
