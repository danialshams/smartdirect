import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import { DashboardPageLayout } from "../../../components/dashboard/DashboardPageLayout";

export default function ProfilePage() {
  return (
    <DashboardRoute>
      <DashboardPageLayout
        title="پروفایل پیج"
        description="اطلاعات عمومی و آمار پایه پیج متصل."
        actions={
          <Link href="/dashboard/tickets" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 text-xs font-bold text-[#2F61FD] no-underline transition hover:bg-[#EFF6FF]">
            <LifeBuoy size={17} aria-hidden="true" />
            پشتیبانی
          </Link>
        }
      >
        <DashboardAccountsClient mode="profile" />
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
