import type { Metadata } from "next";
import Link from "next/link";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
export const metadata:Metadata={title:"ارتباط با ما | دایرا"};
export default function ContactPage(){
  return <PublicInfoPage eyebrow="ارتباط با ما" title="برای ارتباط، در کنار تو هستیم." description="پشتیبانی از طریق بخش درخواست‌های داشبورد دایرا در دسترس است.">
    <h2>درخواست پشتیبانی</h2>
    <p>برای ثبت و پیگیری سؤال یا مشکل، وارد حساب خود شو و از بخش «پشتیبانی» درخواست جدید ثبت کن.</p>
    <div className="ap-info__actions">
      <Link href="/dashboard/tickets">رفتن به پشتیبانی</Link>
      <Link href="/login">ورود به پنل</Link>
    </div>
    <h2>درخواست حریم خصوصی و حذف اطلاعات</h2>
    <p>برای حذف داده‌های ثبت‌شده در دایرا، حتی بدون ورود به حساب، می‌توانید درخواست ثبت کنید و کد پیگیری دریافت کنید.</p>
    <div className="ap-info__actions"><Link href="/data-deletion">درخواست حذف اطلاعات</Link><Link href="/privacy-policy">حریم خصوصی</Link></div>
  </PublicInfoPage>;
}
