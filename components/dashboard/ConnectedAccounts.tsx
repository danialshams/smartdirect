"use client";

import { CheckCircle2, Link2, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

type Account = {
  id: string;
  igUserId: string;
  igUsername: string;
  username: string;
  isConnected: boolean;
  profilePictureUrl: string | null;
};

export default function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/instagram/accounts", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "خطا در دریافت اکانت‌ها");
      }

      setAccounts(Array.isArray(result.accounts) ? result.accounts : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "خطا در دریافت اکانت‌ها",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">مدیریت اتصال</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            اکانت‌های متصل
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            پیج‌های متصل به SmartDirect را مدیریت کنید.
          </p>
        </div>

        <a
          href="/api/instagram/connect"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-xs font-semibold text-white transition hover:bg-[#1d4ed8]"
        >
          <Link2 size={15} />
          اتصال پیج
        </a>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 font-semibold"
          >
            <RefreshCw size={14} />
            تلاش مجدد
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-400">
          در حال دریافت اکانت‌ها...
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <UsersRound className="mx-auto text-slate-300" size={30} strokeWidth={1.6} />
          <h2 className="mt-4 text-base font-bold text-slate-900">اکانتی متصل نیست</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
            برای شروع، اولین پیج Instagram خود را متصل کنید.
          </p>
          <a
            href="/api/instagram/connect"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#2563eb] px-5 text-xs font-semibold text-white"
          >
            اتصال پیج
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="flex items-center gap-3 p-5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {account.profilePictureUrl ? (
                    <img
                      src={account.profilePictureUrl}
                      alt={account.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <UserRound size={22} />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-950">
                    @{account.username}
                  </h2>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {account.igUserId}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <span className="text-xs text-slate-400">وضعیت اتصال</span>
                <span
                  className={
                    account.isConnected
                      ? "inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"
                      : "inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400"
                  }
                >
                  <CheckCircle2 size={14} />
                  {account.isConnected ? "متصل" : "قطع"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
