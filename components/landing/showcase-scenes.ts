
export type ShowcaseKind =
  | "comment" | "story" | "direct" | "share" | "live" | "reminder"
  | "inbox" | "publishing" | "insights" | "menu" | "icebreaker";

export type ShowcaseScene = {
  id: ShowcaseKind;
  no: string;
  title: string;
  tagline: string;
};

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: "comment", no: "۰۱", title: "پاسخ به کامنت",
    tagline: "برای هر کلمه، پاسخ دلخواه خودت.",
  },
  {
    id: "story", no: "۰۲", title: "پاسخ به استوری",
    tagline: "یک پاسخ، برای تعامل با استوری‌ها.",
  },
  {
    id: "direct", no: "۰۳", title: "پاسخ خودکار دایرکت",
    tagline: "کلمه کلیدی را مشخص کن. پاسخ آماده است.",
  },
  {
    id: "share", no: "۰۴", title: "اشتراک‌گذاری و منشن",
    tagline: "وقتی نامت برده می‌شود، پاسخ خودت را داشته باش.",
  },
  {
    id: "live", no: "۰۵", title: "پاسخ به لایو",
    tagline: "پاسخ مناسب، در زمان مناسب.",
  },
  {
    id: "reminder", no: "۰۶", title: "یادآوری هوشمند",
    tagline: "گفتگوها را در زمان دلخواه پیگیری کن.",
  },
  {
    id: "inbox", no: "۰۷", title: "صندوق دایرکت",
    tagline: "همه گفتگوها، در یک فضای مرتب.",
  },
  {
    id: "publishing", no: "۰۸", title: "انتشار محتوا",
    tagline: "از انتخاب محتوا تا زمان‌بندی انتشار.",
  },
  {
    id: "insights", no: "۰۹", title: "آنالیز پیج",
    tagline: "عملکرد پیجت را واضح‌تر ببین.",
  },
  {
    id: "menu", no: "۱۰", title: "منوی دایرکت",
    tagline: "دسترسی سریع‌تر به پاسخ‌های پرکاربرد.",
  },
  {
    id: "icebreaker", no: "۱۱", title: "پیام شروع گفتگو",
    tagline: "شروع گفتگو را ساده و دوستانه کن.",
  },
];
