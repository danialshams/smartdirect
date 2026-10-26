import { plain, metaUrl } from "./parser";

/** Extract the *selected* public Meta blog post from both semantic and legacy Meta HTML.
 * Meta's legacy blog (2026) has paragraphs but no <main> or <article> tags.
 * Never fall back to unrelated posts, indexes, or archived changelogs. */
export function extractMetaArticleBody(html:string, expectedTitle:string):string {
 const safe=html.slice(0,1_800_000).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ");
 const matchingTitle=expectedTitle.trim().toLowerCase();
 if(matchingTitle.length<14)throw Error("Invalid selected Meta article title");
 const bodyStart=safe.search(/<body\b[^>]*>/i);
 if(bodyStart<0)throw Error("Official article body is missing");
 const body=safe.slice(bodyStart);
 const headingTags=[...body.matchAll(/<(?:h[1-6]|p)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|p)>/gi)];
 const heading=headingTags.find(m=>plain(m[1]).toLowerCase().includes(matchingTitle));
 if(!heading)throw Error("The expected article title does not match the official Meta page");
 const start=(heading.index||0)+heading[0].length;
 const following=body.slice(start,Math.min(start+26000,body.length));
 const section=following.split(/(?:<section\b[^>]*class=["'][^"']*(?:related|recommended)|<h[1-4][^>]*>[^<]*(?:Related (?:News|Articles|Posts)|More from Meta))/i)[0];
 const paragraphs=[...section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map(m=>plain(m[1])).filter(p=>p.length>=55&&!/cookie|privacy policy|sign up|related posts|subscribe|copyright|accept all/i.test(p));
 const result=paragraphs.slice(0,9).join(" ").slice(0,1150);
 if(result.length>=150)return result;
 throw Error("The selected official article has insufficient explanatory paragraphs");
}

export async function fetchMetaArticleBody(sourceUrl:string, expectedTitle:string):Promise<string>{
 const url=metaUrl(sourceUrl);
 if(!url||!new URL(url).pathname.includes("/blog/post/"))throw Error("Only a specific official Meta article can be translated");
 const res=await fetch(url,{cache:"no-store",redirect:"follow",headers:{"Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(11000)});
 if(!res.ok)throw Error("The selected Meta article was unavailable");
 return extractMetaArticleBody(await res.text(),expectedTitle);
}
