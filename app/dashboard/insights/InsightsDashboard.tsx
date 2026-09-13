"use client";

import {
    useEffect,
    useState,
} from "react";

type Summary = {
    reach: number;
    views: number;
    accountsEngaged: number;
    totalInteractions: number;
    profileViews: number;
    followerCount: number;
};

type Account = {
    id: string;
    username: string;
    followers: number;
    following: number;
    mediaCount: number;
};

type Snapshot = {
    id: string;
    snapshotDate: string;
    reach: number | null;
    views: number | null;
    accountsEngaged: number | null;
    totalInteractions: number | null;
    profileViews: number | null;
    followerCount: number | null;
};

type ApiResponse = {
    account: Account;
    period: {
        days: number;
    };
    summary: Summary;
};

type HistoryResponse = {
    snapshots: Snapshot[];
};

function formatNumber(
    value: number,
) {
    return new Intl.NumberFormat(
        "fa-IR",
    ).format(value);
}

function StatCard({
    title,
    value,
}: {
    title: string;
    value: number;
}) {
    return (
        <div className="border border-zinc-200 bg-white p-5">
            <div className="mb-3 text-sm text-zinc-500">
                {title}
            </div>

            <div className="text-2xl font-semibold text-zinc-900">
                {formatNumber(value)}
            </div>
        </div>
    );
}

export default function InsightsDashboard() {
    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState("");

    const [
        data,
        setData,
    ] = useState<ApiResponse | null>(
        null,
    );

    const [
        history,
        setHistory,
    ] = useState<Snapshot[]>([]);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                setError("");

                const response =
                    await fetch(
                        "/api/instagram/insights?days=7",
                        {
                            cache: "no-store",
                        },
                    );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ||
                        "خطا در دریافت اطلاعات",
                    );
                }

                setData(result);

                const historyResponse =
                    await fetch(
                        `/api/instagram/insights/history?accountId=${result.account.id}&days=30`,
                        {
                            cache: "no-store",
                        },
                    );

                const historyResult =
                    await historyResponse.json();

                if (historyResponse.ok) {
                    setHistory(
                        historyResult.snapshots ||
                        [],
                    );
                }
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "خطا در دریافت اطلاعات",
                );
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    if (loading) {
        return (
            <main
                dir="rtl"
                className="min-h-screen bg-white p-6"
            >
                <div className="mx-auto max-w-7xl">
                    در حال دریافت آمار...
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main
                dir="rtl"
                className="min-h-screen bg-white p-6"
            >
                <div className="mx-auto max-w-7xl">
                    <div className="border border-red-200 bg-red-50 p-5 text-red-700">
                        {error}
                    </div>
                </div>
            </main>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <main
            dir="rtl"
            className="min-h-screen bg-white p-6"
        >
            <div className="mx-auto max-w-7xl space-y-8">

                <header>
                    <div className="text-sm text-zinc-500">
                        Instagram Insights
                    </div>

                    <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
                        آمار پیج
                    </h1>

                    <p className="mt-2 text-zinc-500">
                        @{data.account.username}
                    </p>
                </header>

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <StatCard
                        title="دسترسی"
                        value={data.summary.reach}
                    />

                    <StatCard
                        title="بازدید"
                        value={data.summary.views}
                    />

                    <StatCard
                        title="اکانت‌های درگیر"
                        value={
                            data.summary.accountsEngaged
                        }
                    />

                    <StatCard
                        title="تعاملات"
                        value={
                            data.summary.totalInteractions
                        }
                    />

                    <StatCard
                        title="بازدید پروفایل"
                        value={
                            data.summary.profileViews
                        }
                    />

                    <StatCard
                        title="دنبال‌کنندگان"
                        value={
                            data.summary.followerCount
                        }
                    />
                </section>

                <section className="border border-zinc-200 bg-white p-6">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-zinc-900">
                            تاریخچه
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            داده‌هایی که SmartDirect از Instagram ذخیره کرده است.
                        </p>
                    </div>

                    {history.length === 0 ? (
                        <div className="py-12 text-center text-sm text-zinc-500">
                            هنوز داده تاریخی ذخیره نشده است.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-right text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-200 text-zinc-500">
                                        <th className="px-4 py-3">
                                            تاریخ
                                        </th>

                                        <th className="px-4 py-3">
                                            Reach
                                        </th>

                                        <th className="px-4 py-3">
                                            Views
                                        </th>

                                        <th className="px-4 py-3">
                                            تعامل
                                        </th>

                                        <th className="px-4 py-3">
                                            Followers
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {history.map(
                                        (item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b border-zinc-100"
                                            >
                                                <td className="px-4 py-3">
                                                    {new Date(
                                                        item.snapshotDate,
                                                    ).toLocaleDateString(
                                                        "fa-IR",
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatNumber(
                                                        item.reach || 0,
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatNumber(
                                                        item.views || 0,
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatNumber(
                                                        item.totalInteractions ||
                                                        0,
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {formatNumber(
                                                        item.followerCount ||
                                                        0,
                                                    )}
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}