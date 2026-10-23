export const SUPPORT_CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "سؤال عمومی" }, { value: "CONNECTION", label: "اتصال اینستاگرام" },
  { value: "AUTOMATION", label: "پاسخ‌های خودکار" }, { value: "BILLING", label: "اشتراک و پرداخت" },
  { value: "BUG", label: "گزارش مشکل فنی" }, { value: "OTHER", label: "سایر موارد" },
];
export const SUPPORT_STATUS: Record<string, string> = { OPEN: "ثبت‌شده", IN_PROGRESS: "در حال بررسی",
  WAITING_USER: "پاسخ پشتیبانی", RESOLVED: "حل‌شده", CLOSED: "بسته‌شده" };
export const supportDate = (value: string, time = false) => new Intl.DateTimeFormat("fa-IR", time ?
  { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }).format(new Date(value));
export const supportNumber = (n: number) => n.toLocaleString("fa-IR");
export const supportAttachmentUrl = (id: string) => "/api/dashboard/tickets/attachments/" + encodeURIComponent(id);
