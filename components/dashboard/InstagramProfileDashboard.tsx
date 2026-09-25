"use client";

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

function Reveal({
  children,
  delay,
  visible,
  className = "",
}: {
  children: React.ReactNode;
  delay: number;
  visible: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        "transition-all duration-700 ease-out " +
        (visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 ") +
        className
      }
      style={{ transitionDelay: delay + "ms" }}
    >
      {children}
    </div>
  );
}

export default function InstagramProfileDashboard({
  accountId,
  greetingName,
  onProfileLoaded,
}: {
  accountId: string;
  greetingName: string;
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
      window.setTimeout(() => setVisible(true), 80);
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
    <main className="flex flex-col items-center">
      {error && (
        <div className="mb-5 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
          {error}
        </div>
      )}

      {loading && !profile ? (
        <div className="flex w-full flex-col items-center gap-4 py-10">
          <Skeleton className="h-[124px] w-[124px] rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
      ) : profile ? (
        <div className="flex w-full flex-col items-center">
          <Reveal visible={visible} delay={0} className="w-full text-right">
            <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
              سلام، {greetingName}
            </h1>
          </Reveal>

          <div className="flex w-full flex-col items-center">
            <Reveal visible={visible} delay={180}>
              <div className="mt-10 h-[128px] w-[128px] overflow-hidden rounded-full border border-border bg-muted sm:h-[150px] sm:w-[150px]">
                {profile.profilePictureUrl ? (
                  <img
                    src={profile.profilePictureUrl}
                    alt={profile.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <span className="text-3xl font-light">?</span>
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal visible={visible} delay={340} className="text-center">
              <p dir="ltr" className="mt-5 text-sm font-medium text-muted-foreground">
                @{profile.username}
              </p>
            </Reveal>
          </div>

          <div className="mt-[min(28vh,260px)] grid w-full max-w-xl grid-cols-3 sm:mt-[min(30vh,280px)]">
            <Reveal visible={visible} delay={520}>
              <AnimatedProfileStat
                label="فالووینگ"
                value={profile.followsCount}
                delay={0}
                visible={visible}
              />
            </Reveal>
            <Reveal visible={visible} delay={680}>
              <AnimatedProfileStat
                label="فالوور"
                value={profile.followersCount}
                delay={160}
                visible={visible}
              />
            </Reveal>
            <Reveal visible={visible} delay={840}>
              <AnimatedProfileStat
                label="پست"
                value={profile.mediaCount}
                delay={320}
                visible={visible}
              />
            </Reveal>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-muted-foreground">
          اطلاعات پروفایل در دسترس نیست.
        </div>
      )}
    </main>
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

      if (progress < 1) frame = requestAnimationFrame(animate);
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
    <div className="flex min-w-0 flex-col items-center justify-center text-center">
      <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {value == null ? "—" : formatNumber(displayValue)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}
