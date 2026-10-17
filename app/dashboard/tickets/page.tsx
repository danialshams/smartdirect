import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import { DashboardPageLayout } from "../../../components/dashboard/DashboardPageLayout";

export default function SupportPage() {
  return (
    <DashboardRoute>
      <DashboardPageLayout title="پشتیبانی" description="برای پیگیری درخواست‌های پشتیبانی، این بخش در مرحله بعد تکمیل می‌شود.">
        <section
          dir="rtl"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 20,
            padding: "24px 20px",
            color: "#5A6B87",
            lineHeight: 1.9,
            boxShadow: "0 4px 20px rgba(22, 54, 110, 0.05)",
          }}
        >
          صفحه پشتیبانی فعلاً آماده‌سازی شده و رابط مدیریت تیکت‌ها در مرحله بعد اضافه می‌شود.
        </section>
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
