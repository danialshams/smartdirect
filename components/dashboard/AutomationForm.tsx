"use client";

import {
    Bot,
    Check,
    Loader2,
    MessageCircle,
    X,
} from "lucide-react";
import { FormEvent, useState } from "react";

import type { Automation } from "./AutomationManager";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type AutomationFormProps = {
  account: InstagramAccount;
  automation: Automation | null;
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
}: AutomationFormProps) {
  const editing = Boolean(automation);

  const [keyword, setKeyword] = useState(
    automation?.keyword ?? "",
  );

  const [commentReplyText, setCommentReplyText] =
    useState(
      automation?.commentReplyText ?? "",
    );

  const [replyText, setReplyText] = useState(
    automation?.replyText ?? "",
  );

  const [isActive, setIsActive] = useState(
    automation?.isActive ?? true,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!keyword.trim()) {
      setError(
        "کلمه یا عبارت فعال‌کننده را وارد کنید.",
      );
      return;
    }

    if (!commentReplyText.trim()) {
      setError("متن پاسخ عمومی را وارد کنید.");
      return;
    }

    if (!replyText.trim()) {
      setError("متن دایرکت را وارد کنید.");
      return;
    }

    try {
      setSaving(true);

      const endpoint = editing
        ? `/api/automations/${automation?.id}`
        : "/api/automations";

      const method = editing ? "PATCH" : "POST";

      const body = {
        ...(editing
          ? {}
          : {
              instagramAccountId: account.id,
            }),
        keyword: keyword.trim(),
        commentReplyText: commentReplyText.trim(),
        replyText: replyText.trim(),
        ...(editing
          ? {
              isActive,
            }
          : {}),
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "ذخیره اتوماسیون ناموفق بود.",
        );
      }

      if (editing) {
        onUpdated(result.data);
      } else {
        onCreated(result.data);
      }
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "ذخیره اتوماسیون ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-slate-400">
              <Bot size={17} />

              <span className="text-[10px] font-semibold tracking-[0.15em]">
                AUTOMATION
              </span>
            </div>

            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {editing
                ? "ویرایش اتوماسیون"
                : "ساخت اتوماسیون جدید"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 p-5 sm:p-7"
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-medium text-slate-400">
              پیج اینستاگرام
            </p>

            <p className="mt-1 text-sm font-bold text-slate-800">
              @{account.igUsername}
            </p>
          </div>

          <div>
            <label
              htmlFor="automation-keyword"
              className="mb-2 block text-sm font-semibold text-slate-800"
            >
              کلمه فعال‌کننده
            </label>

            <input
              id="automation-keyword"
              value={keyword}
              onChange={(event) =>
                setKeyword(event.target.value)
              }
              placeholder="مثلاً 1"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-500"
              maxLength={100}
            />

            <p className="mt-2 text-xs leading-5 text-slate-400">
              وقتی متن کامنت دقیقاً با این عبارت مطابقت
              داشته باشد، Automation اجرا می‌شود.
            </p>
          </div>

          <div>
            <label
              htmlFor="comment-reply"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <MessageCircle size={16} />
              پاسخ عمومی کامنت
            </label>

            <textarea
              id="comment-reply"
              value={commentReplyText}
              onChange={(event) =>
                setCommentReplyText(
                  event.target.value,
                )
              }
              placeholder="مثلاً: دایرکت برات ارسال شد."
              rows={4}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-500"
            />

            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
              <span>
                این متن زیر کامنت کاربر منتشر می‌شود.
              </span>

              <span>
                {commentReplyText.length}/1000
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="private-reply"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <MessageCircle size={16} />
              متن دایرکت خصوصی
            </label>

            <textarea
              id="private-reply"
              value={replyText}
              onChange={(event) =>
                setReplyText(event.target.value)
              }
              placeholder="مثلاً: سلام، اطلاعات موردنظر شما در دایرکت ارسال شد."
              rows={5}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-500"
            />

            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
              <span>
                این پیام به صورت خصوصی برای کاربر ارسال می‌شود.
              </span>

              <span>
                {replyText.length}/2000
              </span>
            </div>
          </div>

          {editing && (
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-right"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  وضعیت اتوماسیون
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  در صورت غیرفعال بودن، Trigger اجرا نمی‌شود.
                </p>
              </div>

              <span
                className={[
                  "relative h-6 w-11 rounded-full transition",
                  isActive
                    ? "bg-slate-950"
                    : "bg-slate-200",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                    isActive
                      ? "right-1"
                      : "right-6",
                  ].join(" ")}
                />
              </span>
            </button>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  در حال ذخیره
                </>
              ) : (
                <>
                  <Check size={16} />
                  {editing
                    ? "ذخیره تغییرات"
                    : "ساخت اتوماسیون"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}