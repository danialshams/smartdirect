import {
  ArrowRight, AtSign, BarChart3, Bookmark, CalendarDays, CheckCheck,
  ChevronLeft, Clock3, Heart, ImageIcon, Instagram, Menu, MessageCircle,
  MoreHorizontal, Play, Radio, Search, Send, Share2, Smile,
} from "lucide-react";
import type { ShowcaseKind } from "./showcase-scenes";

/** Illustrations, not live Instagram data. These are recognizable UI sketches
 * of the actual interaction surfaces, rather than placeholder analytics. */
function TopBar({ title, menu = false }: { title: string; menu?: boolean }) {
  return (
    <div className="ig-topbar">
      <ArrowRight size={17} aria-hidden="true"/>
      <strong>{title}</strong>
      {menu ? <Menu size={19} aria-hidden="true"/> : <MoreHorizontal size={18} aria-hidden="true"/>}
    </div>
  );
}
function Profile({ title = "daira.shop", sub }: {title?:string;sub?:string}) {
  return <div className="ig-profile">
    <span className="ig-avatar"><Instagram size={15} aria-hidden="true"/></span>
    <span><strong>{title}</strong>{sub && <small>{sub}</small>}</span>
  </div>;
}
function Bubble({children,mine=false}:{children:React.ReactNode;mine?:boolean}) {
  return <div className={"ig-bubble"+(mine?" ig-bubble--mine":"")}>{children}</div>;
}
function Chat({kind}:{kind:"direct"|"reminder"|"icebreaker"|"menu"}) {
  if(kind==="menu")return <>
    <TopBar title="daira.shop" menu/>
    <div className="ig-chat">
      <div className="ig-chat__center"><span className="ig-avatar ig-avatar--large">D</span><strong>daira.shop</strong><small>حساب تجاری</small></div>
      <Bubble>سلام، محصولاتتون رو از کجا ببینم؟</Bubble>
      <Bubble mine>از منوی گفتگو انتخاب کن 💙</Bubble>
    </div>
    <div className="ig-menu-sheet">
      <span className="ig-sheet-handle"/>
      <strong><Menu size={14} aria-hidden="true"/> منوی دایرکت</strong>
      <div>مشاهده محصولات <ChevronLeft size={14}/></div>
      <div>سوالات متداول <ChevronLeft size={14}/></div>
      <div>ارتباط با پشتیبانی <ChevronLeft size={14}/></div>
    </div>
  </>;
  if(kind==="icebreaker")return <>
    <TopBar title="daira.shop"/>
    <div className="ig-chat">
      <div className="ig-chat__center"><span className="ig-avatar ig-avatar--large">D</span><strong>daira.shop</strong><small>برای شروع گفتگو انتخاب کن</small></div>
      <div className="ig-quickreplies"><span>قیمت محصولات</span><span>راهنمای خرید</span><span>ساعات پاسخ‌گویی</span></div>
      <Bubble mine>قیمت محصولات</Bubble>
    </div>
    <div className="ig-input">پیام… <Smile size={16}/></div>
  </>;
  return <>
    <TopBar title="daira.shop"/>
    <div className="ig-chat">
      <div className="ig-chat__center"><span className="ig-avatar ig-avatar--large">D</span><strong>daira.shop</strong><small>حساب حرفه‌ای اینستاگرام</small></div>
      <Bubble>{kind==="direct"?"سلام، قیمت این محصول چنده؟":"موجودی این محصول رو خبرم می‌کنید؟"}</Bubble>
      <Bubble mine>{kind==="direct"?"سلام! برای دیدن قیمت، مدل موردنظرت رو بفرست.":"حتماً، درخواستت ثبت شد."}</Bubble>
      {kind==="reminder" && <><span className="ig-timestamp"><Clock3 size={12}/> یادآوری زمان‌بندی‌شده</span><Bubble mine>سلام! هنوز درباره محصول سوالی داری؟</Bubble></>}
      {kind==="direct" && <span className="ig-seen"><CheckCheck size={12}/> seen</span>}
    </div>
    <div className="ig-input"><span>پیام…</span><span><ImageIcon size={16}/><Smile size={16}/></span></div>
  </>;
}
function Post({kind}:{kind:"comment"|"share"|"story"|"live"}) {
  if(kind==="story" || kind==="share")return <>
    <div className={"ig-story ig-story--"+kind}>
      <div className="ig-story__progress"><span/><span/><span/></div>
      <div className="ig-story__top"><Profile title="daira.shop" sub="الان"/><MoreHorizontal size={18}/></div>
      <div className="ig-story__art"><span className="ig-story__circle"/><strong>لحظه‌های تازه</strong><span>با دایرا</span></div>
      {kind==="share" && <div className="ig-mention"><AtSign size={14}/> daira.shop <span>شما منشن شدید</span></div>}
      <div className="ig-story__bottom"><span>ارسال پیام…</span><Heart size={19}/><Send size={19}/></div>
    </div>
  </>;
  if(kind==="live")return <div className="ig-live">
    <div className="ig-story__top"><Profile title="daira.shop"/><span className="ig-live__badge"><Radio size={11}/> LIVE</span></div>
    <div className="ig-live__photo"><span className="ig-live__object"/></div>
    <div className="ig-live__comments"><div>کاربر ۱: قیمت؟</div><div>دایرا: برای اطلاعات پیام بده 💙</div></div>
    <div className="ig-story__bottom"><span>نظر بده…</span><Heart size={18}/><Send size={18}/></div>
  </div>;
  return <>
    <div className="ig-feed-top"><Profile/><MoreHorizontal size={19}/></div>
    <div className="ig-post-image"><div className="ig-post-object"/><span>NEW COLLECTION</span></div>
    <div className="ig-feed-actions"><Heart size={19}/><MessageCircle size={19}/><Send size={19}/><Bookmark size={19}/></div>
    <div className="ig-post-comments"><strong>daira.shop</strong> محصول جدید رسید ✨</div>
    <div className="ig-post-comments"><strong>کاربر</strong> قیمت چنده؟</div>
    <div className="ig-comment-answer"><MessageCircle size={14}/> پاسخ خودکار: سلام! جزئیات توی دایرکت 💙</div>
  </>;
}
function Inbox() {
  return <>
    <div className="ig-topbar"><ArrowRight size={17}/><strong>پیام‌ها</strong><Search size={19}/></div>
    <div className="ig-inbox-tabs"><span className="ig-tab-active">اصلی</span><span>عمومی</span><span>درخواست‌ها</span></div>
    {[
      ["نرگس","سلام، موجوده؟","۲ دقیقه"],
      ["علی","آدرس فروشگاه رو می‌فرستید؟","۵ دقیقه"],
      ["مریم","ممنون، سفارش دادم 🙌","۱ ساعت"],
    ].map(([name,message,time],i)=><div className="ig-inbox-row" key={name}>
      <span className={"ig-person ig-person--"+i}>{name.slice(0,1)}</span>
      <div><strong>{name}</strong><small>{message}</small></div>
      <span className="ig-inbox-time">{time}{i===0&&<i/>}</span>
    </div>)}
    <div className="ig-inbox-bottom">همه گفتگوها، یک‌جا</div>
  </>;
}
function Publishing() {
  return <>
    <TopBar title="پروفایل daira.shop"/>
    <div className="ig-profile-stats"><span className="ig-avatar ig-avatar--large">D</span><div><strong>پست‌ها</strong><small>محتوای پیج</small></div><div><strong>ریلز</strong><small>ویدیوها</small></div><div><strong>استوری</strong><small>داستان‌ها</small></div></div>
    <div className="ig-photo-grid">{Array.from({length:6},(_,i)=><span key={i} className={"ig-photo-grid__item ig-photo-grid__item--"+i}><ImageIcon size={18}/>{i===0&&<span className="ig-publish-clock"><CalendarDays size={12}/></span>}</span>)}</div>
    <div className="ig-schedule"><CalendarDays size={15}/><span>انتشار محتوای بعدی برنامه‌ریزی شده</span><CheckCheck size={14}/></div>
  </>;
}
function Insights() {
  return <>
    <TopBar title="آمار و اطلاعات"/>
    <div className="ig-insights-head"><BarChart3 size={18}/><strong>روند تعامل پیج</strong></div>
    <div className="ig-insights-labels"><span>بازدیدها</span><span>تعامل‌ها</span><span>مخاطبان</span></div>
    <div className="ig-insights-bars" role="img" aria-label="نمودار نمونه بدون داده واقعی">
      {[34,57,44,72,65,87,80,100].map((n,i)=><span key={i} style={{height:n+"%"}}/>)}
    </div>
    <p className="ig-insights-caption">نمایش شماتیک آمار، بدون اعداد ساختگی</p>
  </>;
}
export function InstagramPreview({kind}:{kind:ShowcaseKind}) {
  return (
    <div className={"ig-preview ig-preview--"+kind} aria-label="پیش‌نمایش نمایشی رابط اینستاگرام">
      {(["direct","reminder","icebreaker","menu"] as ShowcaseKind[]).includes(kind)
        ? <Chat kind={kind as "direct"|"reminder"|"icebreaker"|"menu"}/>
        : (["comment","story","share","live"] as ShowcaseKind[]).includes(kind)
          ? <Post kind={kind as "comment"|"story"|"share"|"live"}/>
          : kind==="inbox" ? <Inbox/> : kind==="publishing" ? <Publishing/> : <Insights/>}
    </div>
  );
}
