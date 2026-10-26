import { plain, metaUrl } from "./parser";
/** Only read the selected official article. Never translate whole changelog/index/history pages. */
export async function fetchMetaArticleBody(sourceUrl:string,expectedTitle:string):Promise<string>{
 const url=metaUrl(sourceUrl);
 if(!url || !new URL(url).pathname.includes("/blog/"))throw Error("Only an exact official Meta article can be translated");
 const res=await fetch(url,{cache:"no-store",redirect:"follow",headers:{"Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw Error("The selected Meta article was unavailable");
 const raw=(await res.text()).slice(0,1_800_000);
 const article=raw.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||
               raw.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||"";
 const withoutNavigation=article.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi," ").replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi," ")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ");
 const paragraphs=[...withoutNavigation.matchAll(/<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)]
  .map(m=>plain(m[1])).filter(p=>p.length>50&&!/cookie|privacy policy|sign up|related posts|subscribe|copyright/i.test(p));
 const selected=paragraphs.slice(0,9).join(" ").slice(0,1300);
 if(selected.length>=120)return selected;
 // Public RSS snippets can supply short context but should not be passed as a "full article".
 const description=raw.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]||"";
 const desc=plain(description);
 if(desc.length>120&&desc.toLowerCase().includes(expectedTitle.toLowerCase().slice(0,12)))return desc.slice(0,850);
 throw Error("Selected official article has no readable, specific explanatory text");
}
