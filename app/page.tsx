import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "دایرا | ابزارهای مدیریت پیج اینستاگرام",
  description: "پاسخ‌های خودکار، مدیریت دایرکت، انتشار محتوا و تحلیل پیج در یک پنل یکپارچه.",
};

export default function Home() {
  return (
    <main dir="rtl" className="flex min-h-screen flex-col bg-[#f7f9fc] text-[#18213b]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
        رفتن به محتوای اصلی
      </a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xl font-black" aria-label="دایرا، صفحه اصلی">
          <Image src="/daira-header-logo-hd.webp" alt="" width={44} height={44} className="h-11 w-11 object-contain" priority />
          <span>دایرا</span>
        </Link>
        <Link href="/login" className="rounded-xl border border-[#d8e0ee] bg-white px-5 py-3 text-sm font-bold text-[#213c70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2464ee]">
          ورود به حساب
        </Link>
      </header>
      <section id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
        <span className="mb-6 rounded-full border border-[#e1e8f2] bg-white px-4 py-2 text-sm font-medium text-[#476481]">
          دایرا، ابزارهای مدیریت پیج در یک فضا
        </span>
        <h1 className="text-4xl font-black leading-[1.5] tracking-tight sm:text-6xl">
          صفحه اصلی دایرا در حال بازطراحی است
        </h1>
        <p className="mt-5 max-w-xl text-base leading-9 text-[#566681] sm:text-lg">
          پنل دایرا در دسترس است. برای استفاده از ابزارهای مدیریت تعاملات، دایرکت و انتشار محتوا، وارد حساب خود شوید.
        </p>
        <Link href="/login" className="mt-9 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#285df6] px-8 py-3 font-bold text-white hover:bg-[#1f4cd1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285df6]">
          ورود به دایرا
        </Link>
      </section>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-[#dfe7f3] px-5 py-6 text-sm text-[#66758e] sm:px-8">
        <span>© {new Date().getFullYear()} دایرا</span>
        <nav className="flex items-center gap-5" aria-label="پیوندهای حقوقی">
          <Link href="/privacy-policy" className="hover:text-[#285df6]">حریم خصوصی</Link>
          <Link href="/data-deletion" className="hover:text-[#285df6]">حذف داده‌ها</Link>
        </nav>
      </footer>
    </main>
  );
}
