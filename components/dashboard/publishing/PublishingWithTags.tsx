"use client";

import { Plus, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import PublishingDashboard from "./PublishingDashboard";

type UserTag = {
  username: string;
  x: number;
  y: number;
};

const emptyTag: UserTag = {
  username: "",
  x: 0.5,
  y: 0.5,
};

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "");
}

export default function PublishingWithTags() {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [draft, setDraft] = useState<UserTag>(emptyTag);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const pathname = new URL(requestUrl, window.location.href).pathname;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (pathname === "/api/instagram/publishing" && method === "POST" && init?.body) {
        try {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          body.userTags = tags.length
            ? tags.map((tag) => ({
                username: normalizeUsername(tag.username),
                x: tag.x,
                y: tag.y,
              }))
            : [];

          return originalFetch(input, {
            ...init,
            body: JSON.stringify(body),
            headers: {
              ...(init.headers ?? {}),
              "Content-Type": "application/json",
            },
          });
        } catch {
          return originalFetch(input, init);
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [tags]);

  function addTag() {
    const username = normalizeUsername(draft.username);

    if (!username) {
      setMessage("نام کاربری Instagram را وارد کنید.");
      return;
    }

    if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) {
      setMessage("نام کاربری Instagram معتبر نیست.");
      return;
    }

    if (tags.some((tag) => tag.username.toLowerCase() === username.toLowerCase())) {
      setMessage("این اکانت قبلاً اضافه شده است.");
      return;
    }

    if (tags.length >= 10) {
      setMessage("حداکثر ۱۰ اکانت می‌توان اضافه کرد.");
      return;
    }

    setTags((current) => [...current, { ...draft, username }]);
    setDraft(emptyTag);
    setMessage("");
  }

  function removeTag(username: string) {
    setTags((current) => current.filter((tag) => tag.username !== username));
    setMessage("");
  }

  function updateTag(username: string, field: "x" | "y", value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;

    setTags((current) =>
      current.map((tag) =>
        tag.username === username
          ? { ...tag, [field]: Math.min(1, Math.max(0, numeric)) }
          : tag,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <UserRound size={18} />
              <h2 className="text-base font-bold">Tag People</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              برای Post و Reel می‌توانید حداکثر ۱۰ اکانت Instagram را Tag کنید.
              برای Post، X و Y محل Tag روی تصویر است و از ۰ تا ۱ تنظیم می‌شود.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
            <input
              value={draft.username}
              onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="username یا @username"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
              dir="ltr"
            />
            <input
              value={draft.x}
              onChange={(event) => setDraft((current) => ({ ...current, x: Number(event.target.value) }))}
              type="number"
              min="0"
              max="1"
              step="0.01"
              placeholder="X"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
              dir="ltr"
              aria-label="X position"
            />
            <input
              value={draft.y}
              onChange={(event) => setDraft((current) => ({ ...current, y: Number(event.target.value) }))}
              type="number"
              min="0"
              max="1"
              step="0.01"
              placeholder="Y"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
              dir="ltr"
              aria-label="Y position"
            />
            <button
              type="button"
              onClick={addTag}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus size={17} />
              افزودن
            </button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag.username}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  dir="ltr"
                >
                  <span className="text-sm font-medium text-slate-800">@{tag.username}</span>
                  <label className="text-xs text-slate-400">
                    X
                    <input
                      value={tag.x}
                      onChange={(event) => updateTag(tag.username, "x", event.target.value)}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className="ml-1 w-14 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Y
                    <input
                      value={tag.y}
                      onChange={(event) => updateTag(tag.username, "y", event.target.value)}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className="ml-1 w-14 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTag(tag.username)}
                    className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                    aria-label={`حذف تگ ${tag.username}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      </section>

      <PublishingDashboard />
    </div>
  );
}
