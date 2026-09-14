"use client";

import {
    ExternalLink,
    FileImage,
    Globe2,
    Image as ImageIcon,
    RefreshCw,
    UserRound,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

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

function formatNumber(value: number | null) {
    if (value === null) return "—";
    return new Intl.NumberFormat("fa-IR").format(value);
}

function formatAccountType(value: string | null) {
    if (!value) return "Professional";

    const normalized = value.toLowerCase();

    if (normalized === "business") return "Business";
    if (normalized === "creator") return "Creator";

    return value;
}

export default function InstagramProfileDashboard({
    accounts,
}: {
    accounts: InstagramAccount[];
}) {
    const connectedAccounts = useMemo(
        () => accounts.filter((account) => account.isConnected),
        [accounts],
    );

    const [accountId, setAccountId] = useState(connectedAccounts[0]?.id || "");
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!connectedAccounts.length) {
            setAccountId("");
            return;
        }

        if (!connectedAccounts.some((account) => account.id === accountId)) {
            setAccountId(connectedAccounts[0].id);
        }
    }, [connectedAccounts, accountId]);

    const loadProfile = useCallback(async () => {
        if (!accountId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/instagram/profile?accountId=${encodeURIComponent(accountId)}`,
                { cache: "no-store" },
            );

            const data = (await response.json()) as {
                success?: boolean;
                profile?: Profile;
                error?: string;
            };

            if (!response.ok || !data.success || !data.profile) {
                throw new Error(data.error || "اطلاعات پروفایل دریافت نشد.");
            }

            setProfile(data.profile);
        } catch (requestError) {
            setProfile(null);
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "خطا در دریافت اطلاعات پروفایل.",
            );
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    if (!connectedAccounts.length) {
        return (
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <UserRound size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">PROFILE</p>
                        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Instagram Profile Dashboard</h2>
                    </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-500">
                    برای نمایش اطلاعات پروفایل، ابتدا یک اکانت Professional اینستاگرام را متصل کنید.
                </p>
            </section>
        );
    }

    return (
        <section className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-7">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">PROFILE</p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Instagram Profile Dashboard</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">اطلاعات زنده پروفایل اکانت متصل را از Instagram دریافت و نمایش می‌دهد.</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    {connectedAccounts.length > 1 && (
                        <select
                            value={accountId}
                            onChange={(event) => setAccountId(event.target.value)}
                            className="min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        >
                            {connectedAccounts.map((account) => (
                                <option key={account.id} value={account.id}>@{account.igUsername}</option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => void loadProfile()}
                        disabled={loading || !accountId}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        بروزرسانی
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>
            )}

            {loading && !profile ? (
                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <div className="h-56 animate-pulse rounded-[22px] bg-slate-100" />
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-[20px] bg-slate-100" />)}
                    </div>
                </div>
            ) : profile ? (
                <>
                    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
                                    {profile.profilePictureUrl ? (
                                        <img src={profile.profilePictureUrl} alt={profile.username} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-slate-400"><UserRound size={32} /></div>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-xl font-bold text-slate-900">{profile.name || `@${profile.username}`}</h3>
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{formatAccountType(profile.accountType)}</span>
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-slate-500">@{profile.username}</p>
                                    {profile.biography && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{profile.biography}</p>}
                                    {profile.website && (
                                        <a href={profile.website} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-slate-700 hover:underline">
                                            <Globe2 size={15} />
                                            <span className="truncate">{profile.website}</span>
                                            <ExternalLink size={13} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <ProfileStat icon={<Users size={18} />} label="دنبال‌کننده" value={formatNumber(profile.followersCount)} />
                            <ProfileStat icon={<UserRound size={18} />} label="دنبال‌شونده" value={formatNumber(profile.followsCount)} />
                            <ProfileStat icon={<ImageIcon size={18} />} label="محتوا" value={formatNumber(profile.mediaCount)} />
                            <ProfileStat icon={<FileImage size={18} />} label="نوع اکانت" value={formatAccountType(profile.accountType)} />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-slate-100 bg-white px-4 py-3 text-xs text-slate-400">
                        <span>Instagram ID: {profile.igUserId}</span>
                        <span>اتصال: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(profile.connectedAt))}</span>
                    </div>
                </>
            ) : null}
        </section>
    );
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</div>
            <p className="mt-4 text-xl font-bold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{label}</p>
        </div>
    );
}
