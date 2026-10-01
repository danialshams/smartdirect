"use client";

import { CheckCircle2, Link2, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/dashboard/DashboardUI";
import { Card, CardContent, CardActions, Chip, Skeleton, Typography } from "@mui/material";

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
    <div dir="rtl" className="space-y-5">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">مدیریت اتصال</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">اکانت‌های متصل</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            پیج‌های متصل به SmartDirect را مدیریت کنید.
          </p>
        </div>

        <Button asChild className="w-full sm:w-auto">
          <a href="/api/instagram/connect">
            <Link2 />
            اتصال پیج
          </a>
        </Button>
      </header>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Typography className="text-sm text-destructive">{error}</Typography>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw />
              تلاش مجدد
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={56} height={56} />
                  <div className="space-y-2">
                    <Skeleton width={112} height={16} />
                    <Skeleton width={144} height={12} />
                  </div>
                </div>
              </CardContent>
              <CardActions className="border-t px-5 py-3">
                <Skeleton width={96} height={16} />
              </CardActions>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-5 py-16 text-center">
            <UsersRound className="size-8 text-muted-foreground/50" strokeWidth={1.6} />
            <h2 className="mt-4 text-base font-bold">اکانتی متصل نیست</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              برای شروع، اولین پیج Instagram خود را متصل کنید.
            </p>
            <Button asChild className="mt-5">
              <a href="/api/instagram/connect">اتصال پیج</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-full border bg-muted">
                    {account.profilePictureUrl ? (
                      <img
                        src={account.profilePictureUrl}
                        alt={account.username}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <UserRound className="size-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Typography className="truncate text-sm" component="div" fontWeight={700}>
                      @{account.username}
                    </Typography>
                    <Typography className="mt-1 truncate text-xs text-muted-foreground" component="div">
                      {account.igUserId}
                    </Typography>
                  </div>
                </div>
              </CardContent>

              <CardActions className="justify-between border-t px-5 py-3">
                <span className="text-xs text-muted-foreground">وضعیت اتصال</span>
                <Chip size="small" variant="outlined" label={
  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" />{account.isConnected ? "متصل" : "قطع"}</span>
} />
              </CardActions>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
