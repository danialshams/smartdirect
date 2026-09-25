"use client";
import { Select } from "@/components/ui/select"

import { useCallback, useEffect, useState } from "react";
import {
    Activity,
    Bot,
    CalendarClock,
    CheckCircle2,
    ChevronLeft,
    FileText,
    Inbox,
    MessageCircle,
    RefreshCw,
    Send,
    Store,
    TriangleAlert,
    Workflow,
} from "lucide-react";

type Account = {
    id: string;
    igUserId: string;
    igUsername: string;
    isConnected: boolean;
};

type DashboardData = {
    success: boolean;
    account: {
        id: string;
        igUserId: string;
        username: string;
        isConnected: boolean;
        tokenExpiresAt: string | null;
        createdAt: string;
        updatedAt: string;
    };
    operations: {
        automations: { total: number; active: number; inactive: number };
        messaging: { conversations: number; inboundMessages: number; outboundMessages: number };
        publishing: { total: number; published: number; scheduled: number; failed: number };
        tools: { activeForms: number; activeShowcases: number; pendingFollowGates: number };
    };
    latest: {
        conversations: Array<{ id: string; participantId: string; lastMessageAt: string | null; isActive: boolean }>;
        publishing: Array<{
            id: string;
            type: string;
            status: string;
            scheduledAt: string | null;
            publishedAt: string | null;
            updatedAt: string;
        }>;
    };
};

const nf = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });

function number(value: number) {
    return nf.format(value);
}

function date(value: string | null) {
    if (!value) return "—";
    return dateFormatter.format(new Date(value));
}

function publishType(value: string) {
    if (value === "REEL") return "Reel";
    if (value === "CAROUSEL") return "Carousel";
    if (value === "STORY") return "Story";
    return "Post";
}

function publishStatus(value: string) {
    const map: Record<string, string> = {
        PUBLISHED: "منتشر شده",
        SCHEDULED: "زمان‌بندی شده",
        FAILED: "ناموفق",
        CANCELLED: "لغو شده",
        PROCESSING: "در حال پردازش",
        PUBLISHING: "در حال انتشار",
        DRAFT: "پیش‌نویس",
        UPLOADING: "در حال آپلود",
    };
    return map[value] || value;
}

function Stat({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: typeof Activity }) {
    return (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon size={18} strokeWidth={1.8} />
            </div>
            <p className="mt-5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
    );
}

function StatusRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "success" | "warning" | "neutral" }) {
    const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-foreground";
    return (
        <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
        </div>
    );
}

export default function InstagramBusinessDashboard({ accounts }: { accounts: Account[] }) {
    const [accountId, setAccountId] = useState("");
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const connectedAccount = accounts.find((account) => account.isConnected);

    useEffect(() => {
        if (!accountId) setAccountId(connectedAccount?.id || accounts[0]?.id || "");
    }, [accountId, accounts, connectedAccount]);

    const load = useCallback(async () => {
        if (!accountId) return;
        try {
            setLoading(true);
            setError("");
            const response = await fetch(`/api/instagram/business-dashboard?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
            const result = (await response.json()) as DashboardData & { error?: string };
            if (!response.ok || !result.success) throw new Error(result.error || "خطا در دریافت داشبورد مدیریتی");
            setData(result);
        } catch (err) {
            setData(null);
            setError(err instanceof Error ? err.message : "خطا در دریافت داشبورد مدیریتی Instagram");
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => {
        void load();
    }, [load]);

    if (!accounts.length) return null;

    return (
        <section id="business-dashboard" dir="rtl" className="scroll-mt-24 space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
                        <Workflow size={14} />
                        BUSINESS CONTROL CENTER
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">داشبورد مدیریتی پیج</h2>
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                        وضعیت عملیاتی اتوماسیون، پیام‌رسانی، انتشار و ابزارهای فعال این پیج را یکجا ببینید؛ بدون تکرار آمار بخش Insights و Profile.
                    </p>
                </div>

                <div className="flex gap-2">
                    <Select
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        className="min-w-[190px] rounded-lg border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none"
                        aria-label="انتخاب پیج Instagram"
                    >
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                @{account.igUsername}{account.isConnected ? "" : " — قطع اتصال"}
                            </option>
                        ))}
                    </Select>
                    <button type="button" onClick={() => void load()} disabled={loading || !accountId} className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50">
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        بروزرسانی
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>
                    <button type="button" onClick={() => void load()} className="font-medium hover:underline">تلاش مجدد</button>
                </div>
            )}

            {loading && !data ? (
                <div className="rounded-xl border bg-card px-6 py-20 text-center text-sm text-muted-foreground">در حال دریافت وضعیت مدیریتی پیج...</div>
            ) : data ? (
                <>
                    <div className="rounded-xl border bg-card p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">IG</div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-bold text-foreground">@{data.account.username}</h3>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${data.account.isConnected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                            {data.account.isConnected ? "اتصال فعال" : "نیاز به اتصال مجدد"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">Instagram ID: {data.account.igUserId}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
                                <div><p className="text-muted-foreground">اتوماسیون فعال</p><p className="mt-1 font-bold text-foreground">{number(data.operations.automations.active)}</p></div>
                                <div><p className="text-muted-foreground">گفتگوهای ثبت‌شده</p><p className="mt-1 font-bold text-foreground">{number(data.operations.messaging.conversations)}</p></div>
                                <div><p className="text-muted-foreground">انتشار زمان‌بندی‌شده</p><p className="mt-1 font-bold text-foreground">{number(data.operations.publishing.scheduled)}</p></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat title="اتوماسیون‌های فعال" value={number(data.operations.automations.active)} description={`${number(data.operations.automations.total)} اتوماسیون در مجموع`} icon={Bot} />
                        <Stat title="گفتگوها" value={number(data.operations.messaging.conversations)} description={`${number(data.operations.messaging.inboundMessages)} ورودی / ${number(data.operations.messaging.outboundMessages)} خروجی`} icon={Inbox} />
                        <Stat title="انتشارهای موفق" value={number(data.operations.publishing.published)} description={`${number(data.operations.publishing.scheduled)} مورد زمان‌بندی شده`} icon={Send} />
                        <Stat title="ابزارهای فعال" value={number(data.operations.tools.activeForms + data.operations.tools.activeShowcases)} description={`${number(data.operations.tools.activeForms)} فرم / ${number(data.operations.tools.activeShowcases)} ویترین`} icon={Store} />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-3">
                        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3"><Activity size={18} className="text-muted-foreground" /><h3 className="font-bold text-foreground">سلامت عملیات</h3></div>
                            <div className="mt-4">
                                <StatusRow label="اتصال Instagram" value={data.account.isConnected ? "فعال" : "قطع"} tone={data.account.isConnected ? "success" : "warning"} />
                                <StatusRow label="اتوماسیون فعال" value={number(data.operations.automations.active)} tone={data.operations.automations.active ? "success" : "neutral"} />
                                <StatusRow label="انتشار ناموفق" value={number(data.operations.publishing.failed)} tone={data.operations.publishing.failed ? "warning" : "success"} />
                                <StatusRow label="Follow Gate در انتظار" value={number(data.operations.tools.pendingFollowGates)} tone={data.operations.tools.pendingFollowGates ? "warning" : "success"} />
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3"><MessageCircle size={18} className="text-muted-foreground" /><h3 className="font-bold text-foreground">پیام‌رسانی</h3></div>
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"><span className="text-xs text-muted-foreground">پیام ورودی</span><span className="font-bold text-foreground">{number(data.operations.messaging.inboundMessages)}</span></div>
                                <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"><span className="text-xs text-muted-foreground">پیام خروجی</span><span className="font-bold text-foreground">{number(data.operations.messaging.outboundMessages)}</span></div>
                                <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"><span className="text-xs text-muted-foreground">گفتگوهای فعال</span><span className="font-bold text-foreground">{number(data.latest.conversations.filter((item) => item.isActive).length)}</span></div>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3"><CalendarClock size={18} className="text-muted-foreground" /><h3 className="font-bold text-foreground">انتشار محتوا</h3></div>
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">کل Jobها</span><span className="font-bold text-foreground">{number(data.operations.publishing.total)}</span></div>
                                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">زمان‌بندی‌شده</span><span className="font-bold text-foreground">{number(data.operations.publishing.scheduled)}</span></div>
                                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">ناموفق</span><span className={`font-bold ${data.operations.publishing.failed ? "text-amber-700" : "text-emerald-700"}`}>{number(data.operations.publishing.failed)}</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><MessageCircle size={18} className="text-muted-foreground" /><h3 className="font-bold text-foreground">آخرین گفتگوها</h3></div><span className="text-xs text-muted-foreground">۵ مورد اخیر</span></div>
                            <div className="mt-4 divide-y divide-slate-100">
                                {data.latest.conversations.length ? data.latest.conversations.map((conversation) => (
                                    <div key={conversation.id} className="flex items-center justify-between gap-4 py-3">
                                        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">کاربر {conversation.participantId}</p><p className="mt-1 text-[11px] text-muted-foreground">{date(conversation.lastMessageAt)}</p></div>
                                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${conversation.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{conversation.isActive ? "فعال" : "بسته"}</span>
                                    </div>
                                )) : <Empty text="هنوز گفتگویی ثبت نشده است." />}
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Send size={18} className="text-muted-foreground" /><h3 className="font-bold text-foreground">آخرین فعالیت انتشار</h3></div><span className="text-xs text-muted-foreground">۵ مورد اخیر</span></div>
                            <div className="mt-4 divide-y divide-slate-100">
                                {data.latest.publishing.length ? data.latest.publishing.map((job) => (
                                    <div key={job.id} className="flex items-center justify-between gap-4 py-3">
                                        <div><p className="text-sm font-medium text-foreground">{publishType(job.type)}</p><p className="mt-1 text-[11px] text-muted-foreground">{date(job.updatedAt)}</p></div>
                                        <span className={`rounded-full px-2 py-1 text-[10px] ${job.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : job.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`}>{publishStatus(job.status)}</span>
                                    </div>
                                )) : <Empty text="هنوز فعالیت انتشاری ثبت نشده است." />}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-border bg-muted p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" />فرم فعال: {number(data.operations.tools.activeForms)}</span>
                            <span className="inline-flex items-center gap-2"><Store size={15} />ویترین فعال: {number(data.operations.tools.activeShowcases)}</span>
                            <span className="inline-flex items-center gap-2"><TriangleAlert size={15} className={data.operations.publishing.failed ? "text-amber-600" : "text-muted-foreground"} />انتشار ناموفق: {number(data.operations.publishing.failed)}</span>
                            <span className="inline-flex items-center gap-2"><FileText size={15} />اتوماسیون غیرفعال: {number(data.operations.automations.inactive)}</span>
                        </div>
                    </div>
                </>
            ) : null}
        </section>
    );
}

function Empty({ text }: { text: string }) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
