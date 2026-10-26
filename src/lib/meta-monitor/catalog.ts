export const META_SOURCES = [
{ id:"blog",label:"وبلاگ Meta",url:"https://developers.facebook.com/blog/feed",format:"rss" },
{ id:"news",label:"اخبار توسعه‌دهندگان",url:"https://developers.facebook.com/blog/devblog/rss/",format:"rss" },
{ id:"graph",label:"تغییرات Graph API",url:"https://developers.facebook.com/docs/graph-api/changelog",format:"html" },
{ id:"instagram",label:"تغییرات Instagram API",url:"https://developers.facebook.com/docs/instagram-platform/changelog",format:"html" }
] as const;
export type Source = (typeof META_SOURCES)[number];
export type Candidate = {title:string;url:string;source:string;description:string;publishedAt:Date|null};
export const CATEGORY_RULES: {name:string; pattern:RegExp}[] = [
{name:"پاسخ به کامنت",pattern:/comment|private repl/i},
{name:"پاسخ به استوری",pattern:/story|stories/i},
{name:"اشتراک‌گذاری و منشن",pattern:/mention|shared media|share to/i},
{name:"پاسخ به لایو",pattern:/instagram live|live comment/i},
{name:"یادآوری هوشمند",pattern:/messaging window|follow.up|reminder/i},
{name:"صندوق دایرکت",pattern:/inbox|conversation|direct message|message attachment/i},
{name:"پاسخ خودکار دایرکت",pattern:/automation|automated messag|quick repl|icebreaker/i},
{name:"انتشار محتوا",pattern:/publish|reels?|carousel|media container/i},
{name:"تحلیل پیج",pattern:/insights?|analytics|metric|impressions|reach/i},
{name:"منوی دایرکت و شروع گفتگو",pattern:/persistent menu|ice.breaker|starter/i},
{name:"مجوزها و وب‌هوک",pattern:/webhook|permission|app review|access verification|rate limit|login/i}
];