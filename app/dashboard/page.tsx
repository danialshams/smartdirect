import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "../../components/auth/SignOutButton";
import Link from "next/link";

type DashboardPageProps = {
  searchParams: Promise<{
    instagram?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const instagramStatus = params.instagram;

  // =========================================================
  // Get current user + Instagram accounts
  // =========================================================

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },

    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,

      instagramAccounts: {
        select: {
          id: true,
          igUsername: true,
          igUserId: true,
          isConnected: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* =====================================================
            Header
        ====================================================== */}

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              پنل کاربری
            </h1>

            <p className="text-slate-500 mt-1">
              خوش آمدید، {user.name || "کاربر گرامی"}
            </p>
          </div>

          <SignOutButton />
        </header>

        {/* =====================================================
            Instagram OAuth Status
        ====================================================== */}

        {instagramStatus === "connected" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
            <p className="text-sm font-medium text-green-800">
              اکانت اینستاگرام با موفقیت متصل شد.
            </p>
          </div>
        )}

        {instagramStatus === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm font-medium text-red-800">
              اتصال اکانت اینستاگرام با خطا مواجه شد.
            </p>
          </div>
        )}

        {instagramStatus === "token_error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm font-medium text-red-800">
              دریافت دسترسی اینستاگرام با خطا مواجه شد.
            </p>
          </div>
        )}

        {instagramStatus === "profile_error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm font-medium text-red-800">
              دریافت اطلاعات پروفایل اینستاگرام با خطا مواجه شد.
            </p>
          </div>
        )}

        {/* =====================================================
            Profile
        ====================================================== */}

        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-400 mb-6">
            مشخصات حساب
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email */}

            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                ایمیل
              </p>

              <p className="font-medium text-slate-700 break-all">
                {user.email}
              </p>
            </div>

            {/* Registration Date */}

            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                تاریخ عضویت
              </p>

              <p className="font-medium text-slate-700">
                {new Intl.DateTimeFormat("fa-IR").format(
                  user.createdAt,
                )}
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            Instagram Accounts
        ====================================================== */}

        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                اکانت‌های اینستاگرام
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                پیج‌های اینستاگرامی متصل به حساب شما
              </p>
            </div>

            <Link
              href="/api/instagram/connect"
              className="inline-flex items-center justify-center text-sm bg-slate-900 text-white px-5 py-3 rounded-lg hover:bg-slate-800 transition"
            >
              افزودن اکانت جدید
            </Link>
          </div>

          {/* ===================================================
              Empty State
          ==================================================== */}

          {user.instagramAccounts.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
              <p className="text-slate-400 text-sm">
                هنوز اکانتی متصل نکردید.
              </p>

              <p className="text-slate-300 text-xs mt-2">
                برای شروع، روی «افزودن اکانت جدید» کلیک کنید.
              </p>
            </div>
          ) : (
            /* =================================================
               Connected Accounts
            ================================================== */

            <div className="space-y-3">
              {user.instagramAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-200 rounded-xl p-5"
                >
                  {/* Account Info */}

                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-slate-600">
                          IG
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          @
                          {account.igUsername ||
                            "instagram-account"}
                        </p>

                        <p className="text-xs text-slate-400 mt-1 break-all">
                          شناسه: {account.igUserId}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          اتصال در{" "}
                          {new Intl.DateTimeFormat("fa-IR").format(
                            account.createdAt,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Connection Status */}

                  <div className="shrink-0">
                    {account.isConnected ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        متصل
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        قطع شده
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}