"use client";

import {
  ExternalLink,
  Globe2,
  Image as ImageIcon,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Profile = {
  accountId: string;
  igUserId: string;
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  accountType: string | null;
  connectedAt: string;
};

const numberFormatter = new Intl.NumberFormat("fa-IR");

function formatNumber(value: number | null) {
  return value == null ? "—" : numberFormatter.format(value);
}

export default function InstagramProfileDashboard({
  accountId,
}: {
  accountId: string;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        "/api/instagram/profile?accountId=" + encodeURIComponent(accountId),
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success || !result.profile) {
        throw new Error(result.error || "اطلاعات پروفایل دریافت نشد.");
      }
      setProfile(result.profile);
    } catch (requestError) {
      setProfile(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "خطا در دریافت اطلاعات پروفایل."
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!accountId) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700 sm:mx-5 sm:mt-5">
          {error}
        </div>
      )}

      {loading && !profile ? (
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
          <Skeleton className="mx-auto h-[72px] w-[72px] rounded-full sm:mx-0" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : profile ? (
        <>
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-right">
              <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                {profile.profilePictureUrl ? (
                  <img
                    src={profile.profilePictureUrl}
                    alt={profile.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <UserRound size={26} strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <div className="mt-4 min-w-0 sm:mr-5 sm:mt-0">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {profile.name || "بدون نام"}
                </h2>
                <p dir="ltr" className="mt-1 text-sm text-muted-foreground">
                  @{profile.username}
                </p>

                {profile.biography && (
                  <p className="mx-auto mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground sm:mx-0">
                    {profile.biography}
                  </p>
                )}

                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-foreground hover:underline"
                  >
                    <Globe2 size={13} />
                    <span className="max-w-[260px] truncate">
                      {profile.website}
                    </span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-border">
            <ProfileStat
              icon={<Users size={16} />}
              label="فالوور"
              value={formatNumber(profile.followersCount)}
            />
            <ProfileStat
              icon={<UserRound size={16} />}
              label="فالووینگ"
              value={formatNumber(profile.followsCount)}
            />
            <ProfileStat
              icon={<ImageIcon size={16} />}
              label="پست"
              value={formatNumber(profile.mediaCount)}
            />
          </div>
        </>
      ) : (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          اطلاعات پروفایل در دسترس نیست.
        </div>
      )}
    </section>
  );
}

function ProfileStat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 border-l border-border px-2 py-4 text-center last:border-l-0 sm:gap-3 sm:py-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
          {label}
        </p>
      </div>
    </div>
  );
}
