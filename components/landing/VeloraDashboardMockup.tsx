import Image from "next/image";
import { BarChart3, CheckCheck, ChevronDown, CirclePlus, MessageCircle, Send, Sparkles, Zap } from "lucide-react";

const modules=[
  {label:"پاسخ به کامنت",image:"/dashboard-art/comment-reply.webp"},
  {label:"پاسخ به استوری",image:"/dashboard-art/story-reply.webp"},
  {label:"پاسخ خودکار دایرکت",image:"/dashboard-art/direct-automation.webp"},
  {label:"صندوق دایرکت",image:"/dashboard-art/inbox.webp"},
  {label:"انتشار محتوا",image:"/dashboard-art/publishing.webp"},
  {label:"تحلیل پیج",image:"/dashboard-art/insights.webp"},
] as const;

/** Static illustrative dashboard: no fabricated account statistics or claims. */
export function VeloraDashboardMockup(){
 return <div className="dv-dashboard" aria-label="پیش‌نمایش نمایشی محیط داشبورد دایرا">
    <div className="dv-dashboard__window"><span/><span/><span/><small>daira / dashboard</small></div>
    <div className="dv-dashboard__layout">
      <aside className="dv-dashboard__side" aria-hidden="true">
        <strong><Image src="/daira-header-logo-hd.webp" alt="" width={30} height={30}/> دایرا</strong>
        <span className="dv-dash-active"><Sparkles size={15}/> داشبورد</span>
        <span><MessageCircle size={15}/> پاسخ‌های خودکار</span>
        <span><Send size={15}/> صندوق دایرکت</span>
        <span><BarChart3 size={15}/> تحلیل پیج</span>
      </aside>
      <div className="dv-dashboard__workspace">
        <div className="dv-dashboard__headline">
          <div><small>فضای مدیریت دایرا</small><h3>همه ابزارها، یک‌جا</h3></div>
          <span>پیج اینستاگرام <ChevronDown size={14}/></span>
        </div>
        <div className="dv-dashboard__tiles">
          {modules.map(m=><div className="dv-dashboard__tile" key={m.label}>
            <Image src={m.image} alt="" width={88} height={88} sizes="88px"/>
            <span>{m.label}</span>
          </div>)}
        </div>
        <div className="dv-dashboard__note"><span><Zap size={15}/> پاسخ خودکار قابل تنظیم</span><span><CheckCheck size={15}/> انتخاب و ذخیره در داشبورد</span></div>
      </div>
    </div>
    <div className="dv-dashboard__floating" aria-hidden="true">
      <span><CirclePlus size={16}/></span><div><strong>ساخت پاسخ جدید</strong><small>تنظیم شرط، محتوا و ذخیره</small></div>
    </div>
 </div>;
}
