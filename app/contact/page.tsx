import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, Headset, MessageSquareText, ShieldCheck } from "lucide-react";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
export const metadata:Metadata={title:"ارتباط با ما | دایرا"};
export default function ContactPage(){
  return <PublicInfoPage eyebrow="راه‌های ارتباط" title="از پرسش تا پیگیری، مسیر مشخص است." description="برای مشکلات فنی، راهنمایی امکانات یا درخواست‌های مربوط به داده‌های شخصی، مسیر مناسب را انتخاب کن.">
    <div className="da-info-cards">
      <section className="da-info-card da-info-card--wide">
        <Headset size={31} aria-hidden="true"/>
        <h2>پشتیبانی از داخل داشبورد</h2>
        <p>اگر درباره ساخت پاسخ، اتصال پیج، صندوق دایرکت یا انتشار سؤال داری، وارد بخش پشتیبانی شو و «درخواست جدید +» را بزن. پیگیری پیام‌ها در همان صفحه انجام می‌شود.</p>
        <Link className="da-info-card__link" href="/dashboard/tickets/new">ثبت درخواست پشتیبانی <ArrowUpLeft size={17}/></Link>
      </section>
      <section className="da-info-card">
        <MessageSquareText size={28} aria-hidden="true"/>
        <h2>پاسخ به سؤال‌های محصول</h2>
        <p>پیش از ثبت درخواست، می‌توانی مراحل استفاده از هر یازده قابلیت را در راهنمای تصویری دایرا ببینی.</p>
        <Link className="da-info-card__link" href="/features">راهنمای امکانات <ArrowUpLeft size={17}/></Link>
      </section>
      <section className="da-info-card">
        <ShieldCheck size={28} aria-hidden="true"/>
        <h2>حذف اطلاعات و حریم خصوصی</h2>
        <p>حتی بدون ورود به حساب، درخواست حذف داده ثبت کن و کد پیگیری دریافت کن. پیش از حذف، مالکیت حساب تأیید می‌شود.</p>
        <Link className="da-info-card__link" href="/data-deletion">درخواست حذف داده <ArrowUpLeft size={17}/></Link>
      </section>
    </div>
  </PublicInfoPage>;
}
