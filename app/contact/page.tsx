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
    <p className="ap-info__note">برای جلوگیری از نمایش اطلاعات تماس تأییدنشده، در این صفحه آدرس ایمیل یا شماره تلفن ساختگی قرار داده نشده است.</p>
  </PublicInfoPage>;
}
