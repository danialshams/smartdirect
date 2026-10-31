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
  Icon: LucideIcon;
};

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: "comment", no: "۰۱", title: "پاسخ به کامنت",
    tagline: "برای هر کلمه، پاسخ دلخواه خودت.",
    Icon: MessageCircle,
  },
  {
    id: "story", no: "۰۲", title: "پاسخ به استوری",
    tagline: "یک پاسخ، برای تعامل با استوری‌ها.",
    Icon: Clapperboard,
  },
  {
    id: "direct", no: "۰۳", title: "پاسخ خودکار دایرکت",
    tagline: "کلمه کلیدی را مشخص کن. پاسخ آماده است.",
    Icon: Send,
  },
  {
    id: "share", no: "۰۴", title: "اشتراک‌گذاری و منشن",
    tagline: "وقتی نامت برده می‌شود، پاسخ خودت را داشته باش.",
    Icon: Share2,
  },
  {
    id: "live", no: "۰۵", title: "پاسخ به لایو",
    tagline: "پاسخ مناسب، در زمان مناسب.",
    Icon: Radio,
  },
  {
    id: "reminder", no: "۰۶", title: "یادآوری هوشمند",
    tagline: "گفتگوها را در زمان دلخواه پیگیری کن.",
    Icon: BellRing,
  },
  {
    id: "inbox", no: "۰۷", title: "صندوق دایرکت",
    tagline: "همه گفتگوها، در یک فضای مرتب.",
    Icon: Inbox,
  },
  {
    id: "publishing", no: "۰۸", title: "انتشار محتوا",
    tagline: "از انتخاب محتوا تا زمان‌بندی انتشار.",
    Icon: CalendarDays,
  },
  {
    id: "insights", no: "۰۹", title: "آنالیز پیج",
    tagline: "عملکرد پیجت را واضح‌تر ببین.",
    Icon: ChartNoAxesCombined,
  },
  {
    id: "menu", no: "۱۰", title: "منوی دایرکت",
    tagline: "دسترسی سریع‌تر به پاسخ‌های پرکاربرد.",
    Icon: ListFilter,
  },
  {
    id: "icebreaker", no: "۱۱", title: "پیام شروع گفتگو",
    tagline: "شروع گفتگو را ساده و دوستانه کن.",
    Icon: MessagesSquare,
  },
];
