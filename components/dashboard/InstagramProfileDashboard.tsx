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
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setProfile(null);
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
    <main className="relative min-h-[calc(100dvh-5rem)] w-full">
      {loading ? (
        <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center px-4 pt-8 sm:pt-10 md:pt-12">
          <Skeleton className="h-5 w-36 self-end rounded-md" />
          <div className="mt-[12vh] flex w-full flex-col items-center md:mt-[14vh] lg:mt-[16vh]">
            <Skeleton className="h-28 w-28 rounded-full sm:h-32 sm:w-32 md:h-36 md:w-36 lg:h-40 lg:w-40" />
            <Skeleton className="mt-5 h-5 w-32 rounded-md" />
          </div>
          <div className="mt-[18vh] grid w-full max-w-xl grid-cols-3 md:mt-[20vh] lg:mt-[22vh]">
            <Skeleton className="mx-auto h-10 w-14" />
            <Skeleton className="mx-auto h-10 w-14" />
            <Skeleton className="mx-auto h-10 w-14" />
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-[calc(100dvh-5rem)] w-full items-start justify-center px-4 pt-10">
          <div className="w-full max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-xs leading-6 text-red-700">
            {error}
          </div>
        </div>
      ) : profile ? (
        <div className="relative flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center px-4 pt-7 sm:px-6 sm:pt-9 md:px-8 md:pt-10 lg:px-10 lg:pt-12">
          <Reveal visible={visible} delay={0} className="w-full flex justify-start">
            <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl md:text-[26px]">
              سلام، {greetingName}
            </h1>
          </Reveal>

          <div className="flex w-full flex-col items-center">
            <Reveal visible={visible} delay={180}>
              <div className="mt-[12vh] h-28 w-28 overflow-hidden rounded-full border border-border bg-muted sm:mt-[14vh] sm:h-32 sm:w-32 md:mt-[15vh] md:h-36 md:w-36 lg:mt-[16vh] lg:h-40 lg:w-40">
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
              <p dir="ltr" className="mt-5 text-sm font-medium text-muted-foreground md:text-[15px]">
                @{profile.username}
              </p>
            </Reveal>
          </div>

          <div dir="ltr" className="mt-[18vh] grid w-full max-w-xl grid-cols-3 sm:mt-[19vh] md:mt-[20vh] lg:mt-[22vh]">
            <Reveal visible={visible} delay={520}>
              <AnimatedProfileStat
                label="پست"
                value={profile.mediaCount}
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
                label="فالووینگ"
                value={profile.followsCount}
                delay={320}
                visible={visible}
              />
            </Reveal>
          </div>
        </div>
      ) : null}
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
      <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
        {value == null ? "—" : formatNumber(displayValue)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs md:text-sm">
        {label}
      </p>
    </div>
  );
}
