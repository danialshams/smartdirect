"use client";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";

import type {
    Automation,
    AutomationTriggerType,
} from "./AutomationManager";

type InstagramAccount = {
    id: string;
    igUsername: string;
};

type InstagramMedia = {
    id: string;
    caption?: string | null;
    media_type?: string;
    media_product_type?: string;
    media_url?: string | null;
    thumbnail_url?: string | null;
    permalink?: string | null;
    timestamp?: string | null;
};

type Props = {
    account: InstagramAccount;
    automation?: Automation | null;
    onClose: () => void;
    onCreated: (automation: Automation) => void;
    onUpdated: (automation: Automation) => void;
};

function getDefaultTrigger(
    automation?: Automation | null
): AutomationTriggerType {
    return (
        automation?.triggerType ??
        "COMMENT_KEYWORD"
    );
}

export default function AutomationForm({
    account,
    automation,
    onClose,
    onCreated,
    onUpdated,
}: Props) {
    const [triggerType, setTriggerType] =
        useState<AutomationTriggerType>(
            getDefaultTrigger(automation)
        );

    const [keyword, setKeyword] = useState(
        automation?.keyword ?? ""
    );

    const [mediaId, setMediaId] = useState(
        automation?.mediaId ?? ""
    );

    const [
        commentReplyText,
        setCommentReplyText,
    ] = useState(
        automation?.commentReplyText ?? ""
    );

    const [replyText, setReplyText] = useState(
        automation?.replyText ?? ""
    );

    const [likeComment, setLikeComment] =
        useState(
            automation?.likeComment ?? false
        );

    const [
        likeIncomingDm,
        setLikeIncomingDm,
    ] = useState(
        automation?.likeIncomingDm ?? false
    );

    const [isActive, setIsActive] =
        useState(
            automation?.isActive ?? true
        );

    const [media, setMedia] = useState<
        InstagramMedia[]
    >([]);

    const [loadingMedia, setLoadingMedia] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadMedia() {
            try {
                setLoadingMedia(true);

                const response = await fetch(
                    `/api/instagram/media?instagramAccountId=${encodeURIComponent(
                        account.id
                    )}`,
                    {
                        cache: "no-store",
                        credentials: "include",
                    }
                );

                const result =
                    await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.error ||
                        result.message ||
                        "دریافت پست‌ها ناموفق بود."
                    );
                }

                if (!cancelled) {
                    setMedia(
                        result.data ?? []
                    );
                }
            } catch (error) {
                console.error(error);

                if (!cancelled) {
                    setMedia([]);
                }
            } finally {
                if (!cancelled) {
                    setLoadingMedia(false);
                }
            }
        }

        loadMedia();

        return () => {
            cancelled = true;
        };
    }, [account.id]);

    function handleTriggerChange(
        value: AutomationTriggerType
    ) {
        setTriggerType(value);

        setError("");

        if (value === "DM") {
            setKeyword("");
            setMediaId("");
            setCommentReplyText("");
            setLikeComment(false);
        }

        if (
            value === "STORY_REPLY_KEYWORD"
        ) {
            setCommentReplyText("");
            setLikeComment(false);
        }
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");

        const requiresKeyword =
            triggerType ===
            "COMMENT_KEYWORD" ||
            triggerType ===
            "STORY_REPLY_KEYWORD";

        if (
            requiresKeyword &&
            !keyword.trim()
        ) {
            setError(
                "کلمه کلیدی را وارد کنید."
            );
            return;
        }

        if (
            triggerType ===
            "COMMENT_KEYWORD" &&
            !commentReplyText.trim() &&
            !replyText.trim() &&
            !likeComment
        ) {
            setError(
                "حداقل یک Action برای کامنت انتخاب کنید."
            );
            return;
        }

        if (
            triggerType === "DM" &&
            !replyText.trim()
        ) {
            setError(
                "برای Automation دایرکت، متن پاسخ یا Flow پیام لازم است."
            );
            return;
        }

        if (
            triggerType ===
            "STORY_REPLY_KEYWORD" &&
            !replyText.trim()
        ) {
            setError(
                "برای پاسخ استوری، متن دایرکت را وارد کنید."
            );
            return;
        }

        try {
            setSaving(true);

            const isEditing =
                Boolean(automation?.id);

            const response = await fetch(
                isEditing
                    ? `/api/automations/${automation!.id}`
                    : "/api/automations",
                {
                    method: isEditing
                        ? "PATCH"
                        : "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        instagramAccountId:
                            account.id,

                        triggerType,

                        mediaId:
                            mediaId.trim() || null,

                        keyword:
                            keyword.trim() || null,

                        commentReplyText:
                            commentReplyText.trim() ||
                            null,

                        replyText:
                            replyText.trim() ||
                            null,

                        likeComment,

                        likeIncomingDm,

                        isActive,
                    }),
                }
            );

            const result =
                await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error ||
                    result.message ||
                    "ذخیره Automation ناموفق بود."
                );
            }

            if (isEditing) {
                onUpdated(result.data);
            } else {
                onCreated(result.data);
            }
        } catch (error) {
            console.error(error);

            setError(
                error instanceof Error
                    ? error.message
                    : "خطای ناشناخته رخ داد."
            );
        } finally {
            setSaving(false);
        }
    }

    const isComment =
        triggerType === "COMMENT_KEYWORD";

    const isDm = triggerType === "DM";

    const isStory =
        triggerType ===
        "STORY_REPLY_KEYWORD";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {automation
                                ? "ویرایش Automation"
                                : "ساخت Automation"}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            @{account.igUsername}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-2xl leading-none text-gray-400 transition hover:text-gray-900"
                    >
                        ×
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="max-h-[80vh] space-y-6 overflow-y-auto p-6"
                >
                    <div>
                        <label className="mb-3 block text-sm font-medium text-gray-800">
                            نوع Trigger
                        </label>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <TriggerOption
                                active={isComment}
                                title="کامنت"
                                description="وقتی کاربر یک عبارت را کامنت کند"
                                onClick={() =>
                                    handleTriggerChange(
                                        "COMMENT_KEYWORD"
                                    )
                                }
                            />

                            <TriggerOption
                                active={isDm}
                                title="دایرکت"
                                description="وقتی کاربر وارد گفتگو شود"
                                onClick={() =>
                                    handleTriggerChange(
                                        "DM"
                                    )
                                }
                            />

                            <TriggerOption
                                active={isStory}
                                title="پاسخ استوری"
                                description="وقتی کاربر به استوری پاسخ دهد"
                                onClick={() =>
                                    handleTriggerChange(
                                        "STORY_REPLY_KEYWORD"
                                    )
                                }
                            />
                        </div>
                    </div>

                    {(isComment || isStory) && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                                {isComment
                                    ? "پست مورد نظر"
                                    : "استوری / Media مورد نظر"}
                            </label>

                            {loadingMedia ? (
                                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                                    در حال دریافت
                                    Media ها...
                                </div>
                            ) : media.length ===
                                0 ? (
                                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                                    Media ای برای
                                    این اکانت پیدا
                                    نشد.
                                </div>
                            ) : (
                                <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                                    {media.map(
                                        (item) => {
                                            const image =
                                                item.media_type ===
                                                    "VIDEO" ||
                                                    item.media_product_type ===
                                                    "REELS"
                                                    ? item.thumbnail_url
                                                    : item.media_url;

                                            const selected =
                                                mediaId ===
                                                item.id;

                                            return (
                                                <button
                                                    key={
                                                        item.id
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        setMediaId(
                                                            selected
                                                                ? ""
                                                                : item.id
                                                        )
                                                    }
                                                    className={[
                                                        "overflow-hidden rounded-xl border text-right transition",
                                                        selected
                                                            ? "border-gray-900 ring-2 ring-gray-900/10"
                                                            : "border-gray-200 hover:border-gray-400",
                                                    ].join(
                                                        " "
                                                    )}
                                                >
                                                    <div className="aspect-square bg-gray-100">
                                                        {image ? (
                                                            <img
                                                                src={
                                                                    image
                                                                }
                                                                alt={
                                                                    item.caption ||
                                                                    "Instagram media"
                                                                }
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                                                بدون تصویر
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-2">
                                                        <p className="line-clamp-2 text-xs text-gray-600">
                                                            {item.caption ||
                                                                "بدون کپشن"}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(isComment || isStory) && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                                کلمه یا عبارت Trigger
                            </label>

                            <input
                                value={keyword}
                                onChange={(event) =>
                                    setKeyword(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="مثلاً 1"
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
                            />

                            <p className="mt-2 text-xs leading-5 text-gray-400">
                                {isComment
                                    ? "وقتی کاربر این عبارت را در کامنت وارد کند، Automation اجرا می‌شود."
                                    : "وقتی کاربر این عبارت را در پاسخ استوری ارسال کند، Automation اجرا می‌شود."}
                            </p>
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-5">
                        <h3 className="mb-4 text-sm font-semibold text-gray-900">
                            Actions
                        </h3>

                        <div className="space-y-4">
                            {isComment && (
                                <>
                                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(
                                                commentReplyText.trim()
                                            )}
                                            onChange={(
                                                event
                                            ) => {
                                                if (
                                                    event
                                                        .target
                                                        .checked
                                                ) {
                                                    if (
                                                        !commentReplyText
                                                    ) {
                                                        setCommentReplyText(
                                                            "ممنون از کامنت شما."
                                                        );
                                                    }
                                                } else {
                                                    setCommentReplyText(
                                                        ""
                                                    );
                                                }
                                            }}
                                            className="mt-1"
                                        />

                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">
                                                پاسخ عمومی به کامنت
                                            </div>

                                            <textarea
                                                value={
                                                    commentReplyText
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setCommentReplyText(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="متن پاسخ عمومی..."
                                                className="mt-3 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                                            />
                                        </div>
                                    </label>

                                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                        <input
                                            type="checkbox"
                                            checked={
                                                likeComment
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setLikeComment(
                                                    event
                                                        .target
                                                        .checked
                                                )
                                            }
                                            className="mt-1"
                                        />

                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                لایک کردن کامنت
                                            </div>

                                            <p className="mt-1 text-xs leading-5 text-gray-500">
                                                بعد از تأیید
                                                Permission
                                                و تست نهایی
                                                API فعال
                                                می‌شود.
                                            </p>
                                        </div>
                                    </label>
                                </>
                            )}

                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                <input
                                    type="checkbox"
                                    checked={Boolean(
                                        replyText
                                    )}
                                    onChange={(
                                        event
                                    ) => {
                                        if (
                                            event
                                                .target
                                                .checked
                                        ) {
                                            if (
                                                !replyText
                                            ) {
                                                setReplyText(
                                                    "سلام، ممنون از پیام شما."
                                                );
                                            }
                                        } else {
                                            setReplyText(
                                                ""
                                            );
                                        }
                                    }}
                                    className="mt-1"
                                />

                                <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                        ارسال دایرکت
                                    </div>

                                    <textarea
                                        value={
                                            replyText
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setReplyText(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder={
                                            isDm
                                                ? "مثلاً سلام، چطور می‌تونم کمکتون کنم؟"
                                                : "متن دایرکت..."
                                        }
                                        className="mt-3 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                                    />

                                    <p className="mt-2 text-xs leading-5 text-gray-400">
                                        در مرحله بعد می‌توانیم
                                        به‌جای این متن، Flow
                                        کامل شامل Quick Reply،
                                        تصویر، ویدیو، فرم و
                                        Showcase قرار دهیم.
                                    </p>
                                </div>
                            </label>

                            {isDm && (
                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                    <input
                                        type="checkbox"
                                        checked={
                                            likeIncomingDm
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setLikeIncomingDm(
                                                event
                                                    .target
                                                    .checked
                                            )
                                        }
                                        className="mt-1"
                                    />

                                    <div>
                                        <div className="text-sm font-medium text-gray-900">
                                            لایک کردن پیام ورودی
                                        </div>

                                        <p className="mt-1 text-xs leading-5 text-gray-500">
                                            فعلاً تا تأیید
                                            نهایی API
                                            اجرا نمی‌شود.
                                        </p>
                                    </div>
                                </label>
                            )}
                        </div>
                    </div>

                    {automation && (
                        <label className="flex cursor-pointer items-center gap-3 border-t border-gray-100 pt-5">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(event) =>
                                    setIsActive(
                                        event.target
                                            .checked
                                    )
                                }
                            />

                            <span className="text-sm text-gray-800">
                                Automation فعال باشد
                            </span>
                        </label>
                    )}

                    {error && (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-gray-200 px-5 py-3 text-sm text-gray-700"
                        >
                            انصراف
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving
                                ? "در حال ذخیره..."
                                : automation
                                    ? "ذخیره تغییرات"
                                    : "ساخت Automation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function TriggerOption({
    active,
    title,
    description,
    onClick,
}: {
    active: boolean;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "rounded-xl border p-4 text-right transition",
                active
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400",
            ].join(" ")}
        >
            <div className="text-sm font-semibold">
                {title}
            </div>

            <div
                className={[
                    "mt-1 text-xs leading-5",
                    active
                        ? "text-slate-300"
                        : "text-slate-400",
                ].join(" ")}
            >
                {description}
            </div>
        </button>
    );
}