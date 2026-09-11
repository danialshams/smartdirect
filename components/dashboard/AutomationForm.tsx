"use client";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";
import type { Automation } from "./AutomationManager";
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

export default function AutomationForm({
    account,
    automation,
    onClose,
    onCreated,
    onUpdated,
}: Props) {
    const [keyword, setKeyword] = useState(
        automation?.keyword ?? "",
    );

    const [mediaId, setMediaId] = useState(
        automation?.mediaId ?? "",
    );

    const [commentReplyText, setCommentReplyText] =
        useState(
            automation?.commentReplyText ?? "",
        );

    const [replyText, setReplyText] = useState(
        automation?.replyText ?? "",
    );

    const [likeComment, setLikeComment] =
        useState(
            automation?.likeComment ?? false,
        );

    const [isActive, setIsActive] =
        useState(
            automation?.isActive ?? true,
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
                        account.id,
                    )}`,
                    {
                        cache: "no-store",
                    },
                );

                const result =
                    await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message ||
                        "دریافت پست‌ها ناموفق بود.",
                    );
                }

                if (!cancelled) {
                    setMedia(result.data ?? []);
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

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");

        if (!keyword.trim()) {
            setError(
                "کلمه کلیدی را وارد کنید.",
            );
            return;
        }

        if (
            !commentReplyText.trim() &&
            !replyText.trim() &&
            !likeComment
        ) {
            setError(
                "حداقل یک Action انتخاب کنید.",
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
                    body: JSON.stringify({
                        instagramAccountId:
                            account.id,
                        mediaId:
                            mediaId || null,
                        keyword,
                        commentReplyText:
                            commentReplyText.trim() ||
                            null,
                        replyText:
                            replyText.trim() ||
                            null,
                        likeComment,
                        ...(isEditing
                            ? {
                                isActive,
                            }
                            : {}),
                    }),
                },
            );

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "ذخیره Automation ناموفق بود.",
                );
            }

            if (isEditing) {
                onUpdated(result.data);
            } else {
                onCreated(result.data);
            }
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "خطای ناشناخته رخ داد.",
            );
        } finally {
            setSaving(false);
        }
    }

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
                        <label className="mb-2 block text-sm font-medium text-gray-800">
                            پست مورد نظر
                        </label>

                        {loadingMedia ? (
                            <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                                در حال دریافت پست‌ها...
                            </div>
                        ) : media.length === 0 ? (
                            <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                                پستی برای این اکانت پیدا نشد.
                            </div>
                        ) : (
                            <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                                {media.map((item) => {
                                    const image =
                                        item.media_type ===
                                            "VIDEO" ||
                                            item.media_product_type ===
                                            "REELS"
                                            ? item.thumbnail_url
                                            : item.media_url;

                                    const selected =
                                        mediaId === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() =>
                                                setMediaId(
                                                    selected
                                                        ? ""
                                                        : item.id,
                                                )
                                            }
                                            className={`overflow-hidden rounded-xl border text-right transition ${selected
                                                    ? "border-gray-900 ring-2 ring-gray-900/10"
                                                    : "border-gray-200 hover:border-gray-400"
                                                }`}
                                        >
                                            <div className="aspect-square bg-gray-100">
                                                {image ? (
                                                    <img
                                                        src={image}
                                                        alt={
                                                            item.caption ||
                                                            "Instagram post"
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
                                })}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-800">
                            کلمه یا عبارت Trigger
                        </label>

                        <input
                            value={keyword}
                            onChange={(event) =>
                                setKeyword(
                                    event.target.value,
                                )
                            }
                            placeholder="مثلاً 1"
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
                        />

                        <p className="mt-2 text-xs text-gray-400">
                            وقتی کاربر این عبارت را در کامنت وارد کند، Automation اجرا می‌شود.
                        </p>
                    </div>

                    <div className="border-t border-gray-100 pt-5">
                        <h3 className="mb-4 text-sm font-semibold text-gray-900">
                            Actions
                        </h3>

                        <div className="space-y-4">
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                <input
                                    type="checkbox"
                                    checked={
                                        Boolean(
                                            commentReplyText.trim(),
                                        )
                                    }
                                    onChange={(event) => {
                                        if (
                                            event.target.checked
                                        ) {
                                            if (
                                                !commentReplyText
                                            ) {
                                                setCommentReplyText(
                                                    "ممنون از کامنت شما.",
                                                );
                                            }
                                        } else {
                                            setCommentReplyText(
                                                "",
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
                                        value={commentReplyText}
                                        onChange={(event) =>
                                            setCommentReplyText(
                                                event.target.value,
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
                                    checked={Boolean(replyText)}
                                    onChange={(event) => {
                                        if (
                                            event.target.checked
                                        ) {
                                            if (!replyText) {
                                                setReplyText(
                                                    "سلام، ممنون از پیام شما.",
                                                );
                                            }
                                        } else {
                                            setReplyText("");
                                        }
                                    }}
                                    className="mt-1"
                                />

                                <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                        ارسال دایرکت
                                    </div>

                                    <textarea
                                        value={replyText}
                                        onChange={(event) =>
                                            setReplyText(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="متن دایرکت..."
                                        className="mt-3 min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                                    />
                                </div>
                            </label>

                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                                <input
                                    type="checkbox"
                                    checked={likeComment}
                                    onChange={(event) =>
                                        setLikeComment(
                                            event.target.checked,
                                        )
                                    }
                                    className="mt-1"
                                />

                                <div>
                                    <div className="text-sm font-medium text-gray-900">
                                        لایک کردن کامنت
                                    </div>

                                    <p className="mt-1 text-xs leading-5 text-gray-500">
                                        این گزینه را فعلاً تا تأیید نهایی Permission و تست API غیرفعال اجرا می‌کنیم.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {automation && (
                        <label className="flex cursor-pointer items-center gap-3 border-t border-gray-100 pt-5">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(event) =>
                                    setIsActive(
                                        event.target.checked,
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