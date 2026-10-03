"use client";

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
            type === "POST" || type === "CAROUSEL" || type === "REEL"
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

  return <PublishingDashboardV2 onTypeChange={handleTypeChange} />;
}

function handleTypeChange(nextType: PublishType) {
  setType(nextType);
}
