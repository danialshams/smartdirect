import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
 ArrowUpLeft, ArrowLeft, BarChart3, CalendarDays, CheckCheck, CheckCircle2,
 ChevronLeft, CircleHelp, Clock3, Heart, MessageCircle, MessagesSquare,
 MousePointerClick, Radio, Send, ShieldCheck, Sparkles, WandSparkles,
} from "lucide-react";
import { showcaseScenes, type ShowcaseKind } from "./showcase-scenes";
import { InstagramPreview } from "./InstagramPreview";
import { VeloraDashboardMockup } from "./VeloraDashboardMockup";

// Preserve eight direct scene children: WebKit's 10 static optical tiles
// are hero + eight sections + footer. They are regenerated on layout changes.
const mainFeatures: readonly ShowcaseKind[]=["comment","story","direct","inbox","publishing","insights"];
const growthFeatures: readonly ShowcaseKind[]=["share","live","reminder"];
const conversationFeatures: readonly ShowcaseKind[]=["menu","icebreaker"];

function Header({label,title,description,center=false}:{
 label:string;title:ReactNode;description:string;center?:boolean;
}){
 return <div className={"dv-section-head"+(center?" dv-section-head--center":"")} data-dv-reveal>
   <span className="dv-eyebrow"><Sparkles size={14} aria-hidden="true"/>{label}</span>
   <h2>{title}</h2><p>{description}</p>
 </div>;
}
function FeatureTile({kind,visual=false,accent=false}:{kind:ShowcaseKind;visual?:boolean;accent?:boolean}){
 const item=showcaseScenes.find(s=>s.id===kind)!;
 const image={
 comment:"/dashboard-art/comment-reply.webp",
 story:"/dashboard-art/story-reply.webp",
 direct:"/dashboard-art/direct-automation.webp",
 share:"/dashboard-art/share-mention.webp",
 live:"/dashboard-art/live-reply.webp",
 reminder:"/dashboard-art/smart-reminders.webp",
 inbox:"/dashboard-art/inbox.webp",
 publishing:"/dashboard-art/publishing.webp",
 insights:"/dashboard-art/insights.webp",
 menu:"/dashboard-art/direct-menu.webp",
 icebreaker:"/dashboard-art/icebreakers.webp"
 }[kind];
 return <Link data-dv-reveal href={"/features/"+kind} className={"dv-bento-card"+(visual?" dv-bento-card--visual":"")+(accent?" dv-bento-card--accent":"")}>
   <div className="dv-bento-card__art" aria-hidden="true">
     {visual?<InstagramPreview kind={kind}/>:<Image src={image} alt="" width={194} height={194} sizes="(max-width:700px) 130px, 194px"/>}
   </div>
   <div className="dv-bento-card__copy">
     <span className="dv-bento-card__num">{item.no} / ۱۱</span>
     <h3>{item.title}</h3>
     <p>{item.tagline}</p>
     <span className="dv-bento-card__link">راهنمای این قابلیت <ArrowUpLeft size={16} aria-hidden="true"/></span>
   </div>
 </Link>;
}
const steps=[
 {number:"۰۱",title:"پیجت را متصل کن",body:"با حساب حرفه‌ای و مجوزهای لازم، اتصال اینستاگرام را از داخل پنل دایرا انجام بده.",icon:<MousePointerClick size={23}/>},
 {number:"۰۲",title:"شرط و پاسخ را بساز",body:"از کلمه کلیدی و نوع تعامل تا متن یا محتوای پاسخ را با گزینه‌های هر بخش تنظیم کن.",icon:<WandSparkles size={23}/>},
 {number:"۰۳",title:"نتیجه را مدیریت کن",body:"قانون را ذخیره کن، گفتگوها را در صندوق ببین و با امکانات تحلیلی موجود پیج را بررسی کن.",icon:<CheckCheck size={23}/>}
] as const;
const faqs=[
 {q:"برای استفاده از دایرا به چه نوع اکانتی نیاز دارم؟",a:"برای امکانات متکی به API اینستاگرام، حساب حرفه‌ای واجد شرایط و مجوزهای لازم متا موردنیاز است. جزئیات دسترسی به هر قابلیت ممکن است متفاوت باشد."},
 {q:"آیا پاسخ‌های خودکار برای تمام پیام‌ها ارسال می‌شوند؟",a:"خیر. هر پاسخ طبق شرایطی که در داشبورد تنظیم می‌کنی و فقط در چارچوب سیاست‌های پیام‌رسانی Meta اجرا می‌شود."},
 {q:"آیا می‌توانم انتشار محتوا را زمان‌بندی کنم؟",a:"بله، ابزار انتشار برای پست، ریلز، پست اسلایدی و استوری طراحی شده است. اجرا به وضعیت اتصال پیج و مجوزهای انتشار بستگی دارد."},
 {q:"اگر اتصال اینستاگرام محدود یا قطع شود چه می‌شود؟",a:"امکانات وابسته به Meta ممکن است موقتاً در دسترس نباشند. جزئیات محدودیت‌ها و شرایط اشتراک در صفحه قوانین و مقررات دایرا توضیح داده شده است."}
];
function Scene({children,className="",first=false,last=false}:{
 children:ReactNode;className?:string;first?:boolean;last?:boolean;
}){
 return <section className={"ap-showcase-capture dv-scene "+className+(first?" ap-showcase-capture--first":"")+(last?" ap-showcase-capture--last":"")}>{children}</section>;
}
export function FeatureShowcase(){
 return <>
   <Scene first className="dv-scene--features">
     <div className="ap-shell">
       <Header label="امکانات دایرا" center title={<>ابزارهایی که با هم <span className="dv-gradient-text">کار می‌کنند</span></>} description="از پاسخ خودکار تا انتشار محتوا، هر ابزار در جای خودش. روی هر قابلیت بزن تا مراحل دقیق آن را ببینی."/>
       <div className="dv-bento-grid" id="features">
         {mainFeatures.map((kind,i)=><FeatureTile key={kind} kind={kind} visual={i===0||i===3} accent={i===1}/>)}
       </div>
       <div className="dv-feature-more" data-dv-reveal><Link href="/features">مشاهده هر ۱۱ قابلیت و راهنمای مراحل <ArrowUpLeft size={17}/></Link></div>
     </div>
   </Scene>
   <Scene className="dv-scene--connection">
     <div className="ap-shell dv-two-column">
       <div className="dv-connection-copy" data-dv-reveal>
         <Header label="یک جریان یکپارچه" title={<>از یک کامنت تا <span className="dv-gradient-text">یک گفتگوی واقعی</span></>} description="دایرا بین تعامل‌های پیج و پاسخ‌هایی که تنظیم کرده‌ای ارتباط برقرار می‌کند؛ بدون نیاز به جابه‌جایی بین چند ابزار."/>
         <ul className="dv-check-list">
           <li><CheckCircle2 size={18}/> تشخیص کلمه کلیدی در تعامل مرتبط</li>
           <li><CheckCircle2 size={18}/> پاسخ زیر کامنت یا ارسال دایرکت در شرایط مجاز</li>
           <li><CheckCircle2 size={18}/> پیگیری گفتگو در صندوق دایرکت</li>
         </ul>
         <Link className="dv-inline-link" href="/features/comment">آشنایی با پاسخ به کامنت <ArrowUpLeft size={17}/></Link>
       </div>
       <div className="dv-flow-graphic" data-dv-reveal aria-label="شمای جریان پاسخ خودکار">
         <div className="dv-flow-node dv-flow-node--top"><MessageCircle size={21}/><span>کامنت: «قیمت»</span></div>
         <div className="dv-flow-line"><span/><span/><span/></div>
         <div className="dv-flow-core"><Sparkles size={27}/><strong>دایرا</strong><small>شرط و پاسخ انتخابی</small></div>
         <div className="dv-flow-path"><i/><i/></div>
         <div className="dv-flow-results">
           <div><Heart size={21}/><strong>پاسخ به کامنت</strong><small>متن عمومی</small></div>
           <div><Send size={21}/><strong>پیام دایرکت</strong><small>در شرایط مجاز</small></div>
         </div>
       </div>
     </div>
   </Scene>
   <Scene className="dv-scene--steps">
     <div className="ap-shell">
       <Header label="شروع کار با دایرا" center title={<>سه قدم تا <span className="dv-gradient-text">مدیریت ساده‌تر</span></>} description="از اتصال پیج تا اولین پاسخ خودکار، مسیر داخل داشبورد مشخص و قابل پیگیری است."/>
       <div className="dv-steps-grid">
         {steps.map(s=><div className="dv-step-card" data-dv-reveal key={s.number}>
           <span className="dv-step-card__number">{s.number}</span>
           <span className="dv-step-card__icon">{s.icon}</span>
           <h3>{s.title}</h3><p>{s.body}</p>
         </div>)}
       </div>
     </div>
   </Scene>
   <Scene className="dv-scene--growth">
     <div className="ap-shell">
       <Header label="تعامل هوشمند" title={<>برای هر نوع تعامل، <span className="dv-gradient-text">یک پاسخ مناسب</span></>} description="منشن در استوری، کامنت لایو و یادآوری زمان‌دار؛ هرکدام تنظیمات اختصاصی خودشان را دارند."/>
       <div className="dv-bento-grid dv-bento-grid--three">
         {growthFeatures.map((kind,i)=><FeatureTile key={kind} kind={kind} visual={i===0} accent={i===2}/>)}
       </div>
     </div>
   </Scene>
   <Scene className="dv-scene--product">
     <div className="ap-shell dv-product-stage">
       <div className="dv-product-stage__copy" data-dv-reveal>
         <Header label="همه‌چیز در یک پنل" title={<>محیط کار روشن، <span className="dv-gradient-text">منظم و قابل کنترل</span></>} description="پاسخ‌ها، محتوای منتشرشده و گفتگوها هرکدام در بخش خودش قرار دارد. تنظیم و ویرایش از همان داشبورد انجام می‌شود."/>
         <Link className="dv-inline-link" href="/login">ورود به پنل دایرا <ArrowUpLeft size={17}/></Link>
       </div>
       <div data-dv-reveal className="dv-product-stage__mock"><VeloraDashboardMockup/></div>
     </div>
   </Scene>
   <Scene className="dv-scene--conversations">
     <div className="ap-shell">
       <Header label="گفتگو با مخاطب" title={<>شروع مکالمه را <span className="dv-gradient-text">ساده‌تر کن</span></>} description="منوی سه‌خطی داخل دایرکت و دکمه‌های آغاز گفتگو دو امکان مستقل‌اند؛ هر کدام می‌تواند مخاطب را به مسیر دلخواه هدایت کند."/>
       <div className="dv-bento-grid dv-bento-grid--conversations">
         {conversationFeatures.map(kind=><FeatureTile key={kind} kind={kind} visual/>)}
       </div>
     </div>
   </Scene>
   <Scene className="dv-scene--faq">
     <div className="ap-shell dv-faq-layout">
       <div data-dv-reveal>
         <Header label="سؤال‌های رایج" title={<>قبل از شروع، <span className="dv-gradient-text">شفاف بدان</span></>} description="قابلیت‌های دایرا با مجوزهای اینستاگرام و سیاست‌های Meta کار می‌کنند. پاسخ چند سؤال متداول را اینجا بخوان."/>
         <Link className="dv-inline-link" href="/contact">ارتباط با پشتیبانی <ArrowUpLeft size={17}/></Link>
       </div>
       <div className="dv-faq-list" data-dv-reveal>
         {faqs.map(({q,a})=><details key={q}><summary><CircleHelp size={18}/><span>{q}</span><ChevronLeft size={18} className="dv-faq-chevron"/></summary><p>{a}</p></details>)}
       </div>
     </div>
   </Scene>
   <Scene last className="dv-scene--last-cta">
     <div className="ap-shell dv-cta-stage" data-dv-reveal>
       <div className="dv-cta-orbit" aria-hidden="true"><span/><span/><span/></div>
       <span className="dv-eyebrow"><ShieldCheck size={15}/> کنترل پاسخ‌ها در اختیار توست</span>
       <h2>برای یک پیج منظم‌تر، <span>از همین‌جا شروع کن.</span></h2>
       <p>قانون‌های پاسخ، گفتگوها و انتشار محتوا را در یک داشبورد مدیریت کن.</p>
       <div className="dv-cta-actions">
         <Link className="dv-primary-button" href="/login">ورود و شروع استفاده <ArrowUpLeft size={18}/></Link>
         <Link className="dv-outline-button" href="/features">راهنمای همه امکانات <ArrowLeft size={18}/></Link>
       </div>
     </div>
   </Scene>
 </>;
}
