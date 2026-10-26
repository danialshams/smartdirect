import Link from "next/link";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DashboardProfileClient from "../../../components/dashboard/DashboardProfileClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import { DashboardPageLayout } from "../../../components/dashboard/DashboardPageLayout";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  return (
    <DashboardRoute>
      <DashboardPageLayout
        title="پروفایل پیج"
        description="اطلاعات عمومی و آمار پایه پیج متصل."
        actions={
          <div className="flex flex-wrap gap-2">
            {session?.user?.role === "ADMIN" && <Link href="/rickandmorty" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface)] px-4 text-xs font-bold text-[var(--daira-primary)] no-underline">
              <ShieldCheck size={17} aria-hidden="true" /> پنل مدیریت
            </Link>}
            <Link href="/dashboard/tickets" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface)] px-4 text-xs font-bold text-[var(--daira-primary)] no-underline">
              <LifeBuoy size={17} aria-hidden="true" /> پشتیبانی
            </Link>
          </div>
        }
      >
        <DashboardProfileClient />
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
