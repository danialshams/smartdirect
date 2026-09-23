"use client";

import {
  ExternalLink,
  Globe2,
  Image as ImageIcon,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
};

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

export default function InstagramProfileDashboard({ accountId }: { accountId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/instagram/profile?accountId=" + encodeURIComponent(accountId), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success || !result.profile) throw new Error(result.error || "اطلاعات پروفایل دریافت نشد.");
      setProfile(result.profile);
    } catch (requestError) {
      setProfile(null);
      setError(requestError instanceof Error ? requestError.message : "خطا در دریافت اطلاعات پروفایل.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useEffect(() => {
    const handler = () => void loadProfile();
    window.addEventListener("smartdirect:refresh", handler);
    return () => window.removeEventListener("smartdirect:refresh", handler);
  }, [loadProfile]);

  if (!accountId) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <p className="text-xs font-medium text-slate-400">پروفایل Instagram</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">اطلاعات پیج فعال</h2>
      </div>
      {error && <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700 sm:mx-6">{error}</div>}
      {loading && !profile ? (
        <div className="grid gap-3 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
          <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-slate-100 sm:mx-0" />
          <div className="space-y-3"><div className="h-5 w-40 animate-pulse rounded bg-slate-100" /><div className="h-4 w-28 animate-pulse rounded bg-slate-100" /><div className="h-16 w-full animate-pulse rounded bg-slate-100" /></div>
        </div>
      ) : profile ? (
        <>
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-right">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50 sm:h-28 sm:w-28">
                {profile.profilePictureUrl ? <img src={profile.profilePictureUrl} alt={profile.username} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><UserRound size={34} strokeWidth={1.5} /></div>}
              </div>
              <div className="mt-5 min-w-0 sm:mr-6 sm:mt-0">
                <h3 className="text-xl font-bold tracking-tight text-slate-950">{profile.name || "بدون نام"}</h3>
                <p className="mt-1 text-sm text-slate-500">@{profile.username}</p>
                {profile.biography && <p className="mx-auto mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:mx-0">{profile.biography}</p>}
                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[#2563eb] hover:underline"><Globe2 size={14} /><span className="max-w-[260px] truncate">{profile.website}</span><ExternalLink size={12} /></a>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-slate-100 sm:grid-cols-4">
            <ProfileStat icon={<Users size={17} />} label="فالوور" value={formatNumber(profile.followersCount)} />
            <ProfileStat icon={<UserRound size={17} />} label="فالووینگ" value={formatNumber(profile.followsCount)} />
            <ProfileStat icon={<ImageIcon size={17} />} label="پست" value={formatNumber(profile.mediaCount)} />
            <div className="hidden sm:flex"><ProfileStat label="نوع حساب" value={profile.accountType || "Professional"} /></div>
          </div>
        </>
      ) : <div className="px-5 py-12 text-center text-sm text-slate-400">اطلاعات پروفایل در دسترس نیست.</div>}
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
    <div className="flex min-w-0 items-center justify-center gap-2 border-l border-slate-100 px-2 py-4 text-center last:border-l-0 sm:gap-3 sm:py-5">
      {icon && (
        <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 sm:flex">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-950 sm:text-base">
          {value}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">{label}</p>
      </div>
    </div>
  );
}
