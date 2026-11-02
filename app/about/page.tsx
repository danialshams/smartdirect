import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, Boxes, HeartHandshake, ShieldCheck } from "lucide-react";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
export const metadata:Metadata={title:"درباره ما | دایرا"};
export default function AboutPage(){
  return <PublicInfoPage eyebrow="داستان محصول" title="تعامل کمتر با کارهای تکراری. ارتباط بیشتر با آدم‌ها." description="دایرا یک محیط یکپارچه برای مدیریت تعاملات، گفتگوها و محتوای حساب حرفه‌ای اینستاگرام است.">
    <div className="da-info-cards">
      <section className="da-info-card da-info-card--wide">
        <Boxes size={30} aria-hidden="true"/>
        <h2>یک داشبورد، یازده قابلیت</h2>
        <p>از تعیین پاسخ به کامنت و استوری تا مدیریت دایرکت، پیگیری گفتگوها، انتشار محتوا و تحلیل عملکرد پیج؛ ابزارهای روزمره را به یک تجربه پیوسته تبدیل می‌کنیم.</p>
        <Link className="da-info-card__link" href="/features">دیدن راهنمای همه امکانات <ArrowUpLeft size={17}/></Link>
      </section>
      <section className="da-info-card">
        <HeartHandshake size={27} aria-hidden="true"/>
        <h2>کاربر در کنترل است</h2>
        <p>شرط فعال‌شدن پاسخ‌ها، محتوای پیام و زمان‌بندی در داشبورد مشخص است. تصمیم هر تعامل با صاحب حساب است.</p>
      </section>
      <section className="da-info-card">
        <ShieldCheck size={27} aria-hidden="true"/>
        <h2>با احترام به محدودیت‌ها</h2>
        <p>اجرای امکانات به مجوزهای حساب و سیاست‌های Meta وابسته است. دایرا سرویس مستقل است و وابسته به Meta نیست.</p>
        <Link className="da-info-card__link" href="/privacy-policy">نحوه مدیریت داده‌ها <ArrowUpLeft size={17}/></Link>
      </section>
    </div>
  </PublicInfoPage>;
}
