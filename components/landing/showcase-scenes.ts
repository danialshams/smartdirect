import type { LucideIcon } from "lucide-react";
import {
  MessageCircle, Radio, Send, Share2, BellRing,
  Inbox, CalendarDays, ChartNoAxesCombined, ListFilter, MessagesSquare, Clapperboard,
} from "lucide-react";

export type ShowcaseKind =
  | "comment" | "story" | "direct" | "share" | "live" | "reminder"
  | "inbox" | "publishing" | "insights" | "menu" | "icebreaker";

export type ShowcaseScene = {
  id: ShowcaseKind;
  no: string;
  title: string;
  tagline: string;
  eyebrow: string;
  Icon: LucideIcon;
  theme: "pearl" | "ice" | "midnight" | "lilac" | "violet" | "mint";
  inputLabel: string;
  keyword: string;
  response: string;
  outcome: string;
};

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: "comment", no: "۰۱", title: "پاسخ به کامنت",
    tagline: "برای هر کلمه، پاسخ دلخواه خودت.", eyebrow: "کامنت",
    Icon: MessageCircle, theme: "pearl", inputLabel: "کلمه کلیدی",
    keyword: "قیمت", response: "سلام! جزئیات محصول را در دایرکت برات فرستادیم 💙",
    outcome: "قانون پاسخ به کامنت ثبت شد",
  },
  {
    id: "story", no: "۰۲", title: "پاسخ به استوری",
    tagline: "یک پاسخ، برای تعامل با استوری‌ها.", eyebrow: "استوری",
    Icon: Clapperboard, theme: "lilac", inputLabel: "متن پاسخ",
    keyword: "سلام! از دیدن استوری خوشحالیم 💙", response: "پاسخ روی همه استوری‌ها تنظیم می‌شود.",
    outcome: "پاسخ استوری تنظیم شد",
  },
  {
    id: "direct", no: "۰۳", title: "پاسخ خودکار دایرکت",
    tagline: "کلمه کلیدی را مشخص کن. پاسخ آماده است.", eyebrow: "دایرکت",
    Icon: Send, theme: "midnight", inputLabel: "کلمه کلیدی پیام",
    keyword: "آدرس", response: "سلام! آدرس و راه‌های ارتباط را اینجا ببین.",
    outcome: "قانون دایرکت ایجاد شد",
  },
  {
    id: "share", no: "۰۴", title: "اشتراک‌گذاری و منشن",
    tagline: "وقتی نامت برده می‌شود، پاسخ خودت را داشته باش.", eyebrow: "اشتراک‌گذاری",
    Icon: Share2, theme: "ice", inputLabel: "پاسخ تعامل",
    keyword: "ممنون که ما رو معرفی کردی 💙", response: "محتوای انتخاب‌شده و پاسخ تنظیم شد.",
    outcome: "قانون تعامل ذخیره شد",
  },
  {
    id: "live", no: "۰۵", title: "پاسخ به لایو",
    tagline: "پاسخ مناسب، در زمان مناسب.", eyebrow: "لایو",
    Icon: Radio, theme: "violet", inputLabel: "کلمه کلیدی لایو",
    keyword: "لینک", response: "سلام! اطلاعات رو در دایرکت برات می‌فرستیم.",
    outcome: "پاسخ لایو آماده شد",
  },
  {
    id: "reminder", no: "۰۶", title: "یادآوری هوشمند",
    tagline: "گفتگوها را در زمان دلخواه پیگیری کن.", eyebrow: "یادآوری",
    Icon: BellRing, theme: "pearl", inputLabel: "تأخیر یادآوری",
    keyword: "۱۵ دقیقه", response: "سلام! اگر هنوز سوالی داری، اینجام.",
    outcome: "یادآوری ثبت شد",
  },
  {
    id: "inbox", no: "۰۷", title: "صندوق دایرکت",
    tagline: "همه گفتگوها، در یک فضای مرتب.", eyebrow: "صندوق پیام",
    Icon: Inbox, theme: "ice", inputLabel: "متن پاسخ",
    keyword: "سلام، خوشحالیم که پیام دادی 💙", response: "گفتگو به‌روزرسانی شد.",
    outcome: "پاسخ در پیش‌نمایش ارسال شد",
  },
  {
    id: "publishing", no: "۰۸", title: "انتشار محتوا",
    tagline: "از انتخاب محتوا تا زمان‌بندی انتشار.", eyebrow: "محتوا",
    Icon: CalendarDays, theme: "pearl", inputLabel: "زمان انتشار",
    keyword: "فردا · ۱۸:۳۰", response: "پست در زمان انتخاب‌شده منتشر می‌شود.",
    outcome: "محتوا به صف انتشار اضافه شد",
  },
  {
    id: "insights", no: "۰۹", title: "آنالیز پیج",
    tagline: "عملکرد پیجت را واضح‌تر ببین.", eyebrow: "آمار",
    Icon: ChartNoAxesCombined, theme: "midnight", inputLabel: "بازه گزارش",
    keyword: "۳۰ روز گذشته", response: "بازدیدها و تعاملات در بازه انتخابی",
    outcome: "نمایش آمار نمونه کامل شد",
  },
  {
    id: "menu", no: "۱۰", title: "منوی دایرکت",
    tagline: "دسترسی سریع‌تر به پاسخ‌های پرکاربرد.", eyebrow: "منو",
    Icon: ListFilter, theme: "lilac", inputLabel: "عنوان گزینه",
    keyword: "مشاهده محصولات", response: "گزینه در منوی دایرکت قرار می‌گیرد.",
    outcome: "گزینه منو ذخیره شد",
  },
  {
    id: "icebreaker", no: "۱۱", title: "پیام شروع گفتگو",
    tagline: "شروع گفتگو را ساده و دوستانه کن.", eyebrow: "گفتگو",
    Icon: MessagesSquare, theme: "mint", inputLabel: "گزینه شروع",
    keyword: "راهنمای خرید", response: "سلام! چطور می‌تونیم کمکت کنیم؟",
    outcome: "گزینه شروع گفتگو اضافه شد",
  },
];
