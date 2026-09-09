import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "../../components/auth/SignOutButton";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect("/login");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, role: true, createdAt: true },
    });

    if (!user) redirect("/login");

    return (
        <main dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900">پنل کاربری</h1>
                        <p className="text-slate-500 mt-1">خوش آمدید، {user.name || "کاربر گرامی"}</p>
                    </div>
                    <SignOutButton />
                </header>

                {/* Profile Card */}
                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">مشخصات حساب</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-xs text-slate-400">ایمیل</p>
                            <p className="font-medium text-slate-700">{user.email}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-slate-400">تاریخ عضویت</p>
                            <p className="font-medium text-slate-700">
                                {new Intl.DateTimeFormat("fa-IR").format(user.createdAt)}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Instagram Accounts Section */}
                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-800">اکانت‌های اینستاگرام</h2>
                        <button className="text-xs bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition">
                            افزودن اکانت جدید
                        </button>
                    </div>

                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                        <p className="text-slate-400 text-sm">هنوز اکانتی متصل نکردید.</p>
                    </div>
                </section>
            </div>
        </main>
    );
}
