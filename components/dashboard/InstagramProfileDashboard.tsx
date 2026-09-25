"use client";

import { ExternalLink, Globe2, UserRound } from "lucide-react";
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

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

export default function InstagramProfileDashboard({
  accountId,
  onProfileLoaded,
}: {
  accountId: string;
  onProfileLoaded?: (name: string | null) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError("");
      setVisible(false);

      const response = await fetch(
        "/api/instagram/profile?accountId=" + encodeURIComponent(accountId),
        { cache: "no-store" }
      );
      const result = await response.json();

      if (!response.ok || !result.success || !result.profile) {
        throw new Error(result.error || "اطلاعات پروفایل دریافت نشد.");
      }

      setProfile(result.profile);
      onProfileLoaded?.(result.profile.name);
      window.setTimeout(() => setVisible(true), 50);
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
  }, [accountId, onProfileLoaded]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!accountId) return null;

  return (
    <section
      className={
        "overflow-hidden rounded-2xl border border-border bg-white transition-all duration-700 ease-out " +
        (visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")
      }
    >
      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700 sm:mx-5 sm:mt-5">
          {error}
        </div>
      )}

      {loading && !profile ? (
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
          <Skeleton className="mx-auto h-[92px] w-[92px] rounded-full sm:mx-0" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : profile ? (
        <>
          <div className="px-5 py-8 sm:px-8 sm:py-9">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-right">
              <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-full border border-border bg-muted sm:h-[104px] sm:w-[104px]">
                {profile.profilePictureUrl ? (
                  <img
                    src={profile.profilePictureUrl}
                    alt={profile.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <UserRound size={30} strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <div className="mt-5 min-w-0 sm:mr-6 sm:mt-0">
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

          <div className="grid grid-cols-3 gap-0 border-t border-border px-5 py-6 sm:px-8 sm:py-7">
            <AnimatedProfileStat
              label="فالووینگ"
              value={profile.followsCount}
              delay={0}
              visible={visible}
            />
            <AnimatedProfileStat
              label="فالوور"
              value={profile.followersCount}
              delay={120}
              visible={visible}
            />
            <AnimatedProfileStat
              label="پست"
              value={profile.mediaCount}
              delay={240}
              visible={visible}
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

function AnimatedProfileStat({
  label,
  value,
  delay,
  visible,
}: {
  label: string;
  value: number | null;
  delay: number;
  visible: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!visible || value == null) return;

    let frame = 0;
    const start = performance.now();
    const duration = 1100;

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(value * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    const timeout = window.setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [delay, value, visible]);

  return (
    <div
      className={
        "flex min-w-0 flex-col items-center justify-center text-center transition-all duration-700 ease-out " +
        (visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")
      }
      style={{ transitionDelay: delay + "ms" }}
    >
      <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {value == null ? "—" : formatNumber(displayValue)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
        {label}
      </p>
    </div>
  );
}
