import type { Candidate } from "./catalog";
export const META_FRESH_DAYS = 45;
export const META_BASELINE_VERSION = 26;
export const NEW_VERSIONS = Array.from({length:24},(_,i)=>"v"+(i+META_BASELINE_VERSION+1)+".0");
export function isFreshMetaAnnouncement(publishedAt:Date|null|undefined, apiVersion?:string|null, kind?:string):boolean {
 if(publishedAt && Number.isFinite(publishedAt.getTime()))
   return publishedAt.getTime()<=Date.now()+86400000 && publishedAt.getTime()>=Date.now()-META_FRESH_DAYS*86400000;
 return kind==="VERSION" && !!apiVersion && NEW_VERSIONS.includes(apiVersion);
}
export function isFreshMetaNotice(notice:{publishedAt:Date|null;kind:string;apiVersion:string|null}):boolean{
 return isFreshMetaAnnouncement(notice.publishedAt,notice.apiVersion,notice.kind);
}
export function isFreshMetaCandidate(item:Candidate,kind:string,apiVersion:string|null|undefined):boolean{
 return isFreshMetaAnnouncement(item.publishedAt,apiVersion,kind);
}
