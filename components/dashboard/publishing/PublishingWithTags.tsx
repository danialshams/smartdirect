"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import PublishingDashboardV2 from "./PublishingDashboardV2";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY";

type UserTag = {
  username: string;
};

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "");
}

export default function PublishingWithTags() {
  const [type, setType] = useState<PublishType>("POST");
  const [tags, setTags] = useState<UserTag[]>([]);
  const [draftUsername, setDraftUsername] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const pathname = new URL(requestUrl, window.location.href).pathname;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (
        pathname === "/api/instagram/publishing" &&
        method === "POST" &&
        init?.body
      ) {
        try {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;

          body.userTags =
            type === "POST" || type === "REEL"
              ? tags.map((tag) => ({
                  username: normalizeUsername(tag.username),
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
  }, [tags, type]);

  function addTag() {
    const username = normalizeUsername(draftUsername);

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

    setTags((current) => [...current, { username }]);
    setDraftUsername("");
    setMessage("");
  }

  function removeTag(username: string) {
    setTags((current) => current.filter((tag) => tag.username !== username));
    setMessage("");
  }

  function handleTypeChange(nextType: PublishType) {
    setType(nextType);

    if (nextType !== "POST" && nextType !== "REEL") {
      setTags([]);
      setDraftUsername("");
      setMessage("");
    }
  }

  const showTags = type === "POST" || type === "REEL";

  return (
    <div className="space-y-6">
      {showTags && (
        <section className="mx-auto w-full max-w-6xl rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={draftUsername}
                onChange={(event) => setDraftUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="username یا @username"
                className="h-11 flex-1 rounded-xl border border-border px-3 text-sm outline-none transition focus:border-ring"
                dir="ltr"
              />
              <Button
                type="button"
                onClick={addTag}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                <Plus size={17} />
                افزودن
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={tag.username}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                    dir="ltr"
                  >
                    <span className="text-sm font-medium text-foreground">
                      @{tag.username}
                    </span>
                    <Button
                      type="button"
                      onClick={() => removeTag(tag.username)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`حذف تگ ${tag.username}`}
                    >
                      <X size={15} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {message && <p className="text-sm text-red-600">{message}</p>}
          </div>
        </section>
      )}

      <PublishingDashboardV2 onTypeChange={handleTypeChange} />
    </div>
  );
}
