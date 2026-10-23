/** Consistent Persian page names for the compact mobile navigation breadcrumb. */
const pageTitles: Record<string, string> = {
  "/dashboard": "خانه",
  "/dashboard/profile": "پروفایل پیج",
  "/dashboard/tickets": "پشتیبانی",
  "/dashboard/insights": "تحلیل پیج",
  "/dashboard/publishing": "انتشار محتوا",
  "/dashboard/inbox": "صندوق دایرکت",
  "/dashboard/ice-breaker": "پیام‌های شروع گفتگو",
  "/dashboard/persistent-menu": "منوی دایرکت",
  "/dashboard/direct-automation": "پاسخ خودکار دایرکت",
  "/dashboard/comment-automation": "پاسخ خودکار کامنت",
  "/dashboard/story-automation": "پاسخ خودکار استوری",
  "/dashboard/live-automation": "پاسخ خودکار لایو",
  "/dashboard/auto-replies": "ویرایش پاسخ‌های خودکار",
  "/dashboard/reminders": "یادآوری‌های هوشمند",
  "/dashboard/content-analytics": "عملکرد محتوا",
  "/dashboard/reports": "گزارش‌ها",
  "/dashboard/settings": "تنظیمات",
  "/dashboard/subscription": "اشتراک",
  "/dashboard/admin/queue": "وضعیت صف",
};

const nestedPages: Record<string, { create?: string; edit?: string }> = {
  "/dashboard/direct-automation": {
    create: "ایجاد پاسخ خودکار دایرکت",
    edit: "ویرایش پاسخ خودکار دایرکت",
  },
  "/dashboard/comment-automation": {
    create: "ایجاد پاسخ خودکار کامنت",
    edit: "ویرایش پاسخ خودکار کامنت",
  },
  "/dashboard/story-automation": {
    create: "ایجاد پاسخ خودکار استوری",
    edit: "ویرایش پاسخ خودکار استوری",
  },
  "/dashboard/live-automation": {
    create: "ایجاد پاسخ خودکار لایو",
    edit: "ویرایش پاسخ خودکار لایو",
  },
  "/dashboard/reminders": {
    create: "ایجاد یادآوری هوشمند",
    edit: "ویرایش یادآوری هوشمند",
  },
  "/dashboard/publishing": { edit: "ویرایش انتشار محتوا" },
  "/dashboard/tickets": {
    create: "تیکت جدید",
    edit: "جزئیات تیکت",
  },
};

export function getDashboardBottomPageTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/dashboard";
  if (pageTitles[path]) return pageTitles[path];

  for (const [base, labels] of Object.entries(nestedPages)) {
    if (!path.startsWith(base + "/")) continue;
    const subpath = path.slice(base.length + 1);
    if (subpath === "new" || subpath.startsWith("new/")) return labels.create ?? pageTitles[base];
    return labels.edit ?? pageTitles[base];
  }

  // Never expose raw database IDs or unknown URL fragments in the navigation.
  return "صفحه فعلی";
}
