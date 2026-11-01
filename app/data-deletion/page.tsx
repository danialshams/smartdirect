import type { Metadata } from "next";
import Link from "next/link";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
import { DataDeletionRequestForm } from "@/components/legal/DataDeletionRequestForm";
import {VerifyDeletionOwnership} from "@/components/legal/VerifyDeletionOwnership";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import "../legal-pages.css";

export const metadata:Metadata={title:"حذف اطلاعات و داده‌های کاربر | دایرا",description:"مسیر عمومی ثبت و پیگیری درخواست حذف اطلاعات دایرا و داده‌های دریافتی از اینستاگرام و متا."};
export default async function DataDeletionPage(){
 const session=await getServerSession(authOptions);
 return <PublicInfoPage eyebrow="حذف اطلاعات کاربران" title="درخواست حذف داده‌ها" description="برای درخواست حذف اطلاعات مرتبط با حساب دایرا یا اتصال اینستاگرام، بدون نیاز به ورود فرم زیر را تکمیل کنید.">
  <div className="da-legal">
   <section><h2>چه اطلاعاتی می‌توان حذف کرد؟</h2><p>اطلاعات شناسایی و حساب دایرا، توکن و داده‌های اتصال پیج، پاسخ‌های خودکار، محتوا و پیام‌های ذخیره‌شده و سایر اطلاعات پردازش‌شده از طریق مجوزهای متا، با رعایت الزامات قانونی.</p></section>
   <section><h2>روش ثبت درخواست</h2><ol style={{listStyle:"decimal"}}>
    <li>ایمیل یا شماره تماس مرتبط و در صورت امکان نام کاربری اینستاگرام را وارد کنید.</li>
    <li>درخواست را ثبت کنید و کد پیگیری را نزد خود نگه دارید.</li>
    <li>برای حفظ امنیت داده‌ها، مالکیت حساب و هویت درخواست‌کننده پیش از حذف بررسی می‌شود.</li>
    <li>پس از تأیید درخواست، اطلاعات قابل حذف بدون تأخیر غیرضروری حذف یا بی‌هویت می‌شوند. وضعیت را با کد پیگیری بررسی کنید.</li>
   </ol><DataDeletionRequestForm/></section>
   <VerifyDeletionOwnership signedIn={!!session?.user?.id}/>
   <section><h2>قطع اتصال و حذف در خود اینستاگرام</h2><p>می‌توانید دسترسی برنامه را در تنظیمات حساب Meta/Instagram نیز لغو کنید. این کار لزوماً داده‌های پیش‌تر ذخیره‌شده در دایرا را پاک نمی‌کند. حذف اطلاعات از دایرا نیز محتوای منتشرشده داخل خود اینستاگرام را حذف نمی‌کند.</p></section>
   <section><h2>استثناهای قانونی</h2><p>اطلاعاتی که نگهداری آن‌ها طبق قانون لازم است، فقط در حد الزام قانونی و با محدودکردن دسترسی حفظ می‌شوند. برای آگاهی بیشتر <Link href="/privacy-policy">سیاست حریم خصوصی</Link> را مطالعه کنید. همچنین می‌توانید از <Link href="/dashboard/tickets/new">پشتیبانی حساب دایرا</Link> کمک بگیرید.</p></section>
  </div>
 </PublicInfoPage>;
}
